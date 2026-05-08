"""
Production-Grade Chat Workflow using LangGraph
Handles STM, LTM (summarization), and title generation
"""
from typing import TypedDict, List, Optional, Annotated
from datetime import datetime
from bson import ObjectId
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from .base import llm
from ..database import chats_collection, chat_messages_collection, summaries_collection, materials_collection

class ChatState(TypedDict):
    chat_id: str
    user_id: str
    group_id: Optional[str]
    messages: List[BaseMessage]
    summary: Optional[str]
    context: str
    material_ids: List[str]
    new_message: str
    title_generated: bool

def input_node(state: ChatState) -> ChatState:
    """Process incoming message and add to state"""
    user_msg = HumanMessage(content=state["new_message"])
    return {**state, "messages": state["messages"] + [user_msg]}

def memory_manager_node(state: ChatState) -> ChatState:
    """Fetch STM and LTM from database if not already in state"""
    chat_id = state["chat_id"]
    
    # If messages are empty (rehydrating), fetch last 7
    if not state["messages"] or len(state["messages"]) == 1: # Only new message
        # Fetch latest summary
        summary_doc = summaries_collection.find_one(
            {"chat_id": chat_id},
            sort=[("range_end", -1)]
        )
        summary = summary_doc["summary"] if summary_doc else ""
        
        # Fetch last 7 messages
        msg_docs = list(chat_messages_collection.find(
            {"chat_id": chat_id}
        ).sort("timestamp", -1).limit(7))
        
        history = []
        for doc in reversed(msg_docs):
            if doc["role"] == "user":
                history.append(HumanMessage(content=doc["content"]))
            else:
                history.append(AIMessage(content=doc["content"]))
        
        # Merge new message if it's not already in history
        if state["new_message"] and (not history or history[-1].content != state["new_message"]):
            history.append(HumanMessage(content=state["new_message"]))
            
        return {**state, "messages": history, "summary": summary}
    
    return state

def summarization_node(state: ChatState) -> ChatState:
    """Summarize messages if they exceed 7"""
    messages = state["messages"]
    
    if len(messages) > 7:
        # Messages to summarize (all but last 7)
        to_summarize = messages[:-7]
        keep_messages = messages[-7:]
        
        prompt = ChatPromptTemplate.from_template(
            "Summarize the following conversation history concisely, preserving key context and entities: "
            "Current Summary: {current_summary}\n\n"
            "New Messages: {new_messages}"
        )
        
        msgs_text = "\n".join([f"{m.type}: {m.content}" for m in to_summarize])
        chain = prompt | llm
        new_summary = chain.invoke({
            "current_summary": state.get("summary", ""),
            "new_messages": msgs_text
        }).content
        
        # Update summary in DB
        summaries_collection.update_one(
            {"chat_id": state["chat_id"]},
            {"$set": {
                "summary": new_summary,
                "range_end": datetime.utcnow()
            }},
            upsert=True
        )
        
        return {**state, "messages": keep_messages, "summary": new_summary}
    
    return state

def title_generator_node(state: ChatState) -> ChatState:
    """Generate title after 3 messages if not already set"""
    chat_id = state["chat_id"]
    chat = chats_collection.find_one({"_id": ObjectId(chat_id) if ObjectId.is_valid(chat_id) else chat_id})
    
    if chat and chat.get("title") == "New Chat":
        # Check total message count in DB
        msg_count = chat_messages_collection.count_documents({"chat_id": chat_id})
        if msg_count >= 3:
            prompt = ChatPromptTemplate.from_template(
                "Generate a very short, catchy title (max 5 words) for this conversation: {history}"
            )
            history_text = "\n".join([f"{m.type}: {m.content}" for m in state["messages"][:3]])
            chain = prompt | llm
            title = chain.invoke({"history": history_text}).content.strip().strip('"')
            
            chats_collection.update_one(
                {"_id": ObjectId(chat_id) if ObjectId.is_valid(chat_id) else chat_id},
                {"$set": {"title": title, "updated_at": datetime.utcnow()}}
            )
            return {**state, "title_generated": True}
            
    return state

def retrieval_node(state: ChatState) -> ChatState:
    """Retrieve material context if material_ids are provided"""
    context = ""
    if state["material_ids"]:
        materials = list(materials_collection.find({
            "_id": {"$in": [ObjectId(mid) if ObjectId.is_valid(mid) else mid for mid in state["material_ids"]]}
        }))
        for m in materials:
            context += f"\nSource: {m.get('lecture_title')}\nContent: {m.get('content', '')[:2000]}\n"
            
    return {**state, "context": context}

def llm_response_node(state: ChatState) -> ChatState:
    """Generate final response"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a top-tier AI tutor. You explain concepts like a smart, confident student explaining to a friend. "
            "Your tone is sharp, energetic, and modern—think of a great YouTube educator or a senior student who actually 'gets it'.\n\n"
            "STRICT RULES:\n"
            "1. USE MARKDOWN for all responses. Bold (**term**) key concepts, use bullet points for lists, and keep paragraphs short and punchy.\n"
            "2. NEVER use phrases like 'Here is a summary', 'In conclusion', 'Key Takeaways', or 'Based on the context'.\n"
            "3. NO boring headings or heavy structured sections. Keep it clean and flowing like a conversation.\n"
            "4. Be insightful. Simplify complex jargon into intuitive ideas. Add small 'awesome' connections where relevant.\n"
            "5. NO robotic definitions. Only explain what's necessary to truly understand the idea.\n"
            "6. NEVER end with filler like 'Hope this helps'. Just stop when finished.\n\n"
            "Use this summary of past conversation for context: {summary}\n"
            "Use this specific material context if relevant: {context}"
        )),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{input}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({
        "summary": state.get("summary", ""),
        "context": state.get("context", ""),
        "history": state["messages"][:-1],
        "input": state["messages"][-1].content
    })
    
    # Save user message to DB
    chat_messages_collection.insert_one({
        "chat_id": state["chat_id"],
        "role": "user",
        "content": state["new_message"],
        "timestamp": datetime.utcnow()
    })
    
    # Save AI response to DB
    chat_messages_collection.insert_one({
        "chat_id": state["chat_id"],
        "role": "assistant",
        "content": response.content,
        "timestamp": datetime.utcnow()
    })
    
    # Update chat updated_at
    chats_collection.update_one(
        {"_id": ObjectId(state["chat_id"]) if ObjectId.is_valid(state["chat_id"]) else state["chat_id"]},
        {"$set": {"updated_at": datetime.utcnow()}}
    )
    
    return {**state, "messages": state["messages"] + [response]}

def create_chat_workflow():
    workflow = StateGraph(ChatState)
    
    workflow.add_node("input", input_node)
    workflow.add_node("memory", memory_manager_node)
    workflow.add_node("summarize", summarization_node)
    workflow.add_node("title", title_generator_node)
    workflow.add_node("retrieve", retrieval_node)
    workflow.add_node("respond", llm_response_node)
    
    workflow.set_entry_point("input")
    
    workflow.add_edge("input", "memory")
    workflow.add_edge("memory", "summarize")
    workflow.add_edge("summarize", "title")
    workflow.add_edge("title", "retrieve")
    workflow.add_edge("retrieve", "respond")
    workflow.add_edge("respond", END)
    
    return workflow.compile()

chat_workflow = create_chat_workflow()
