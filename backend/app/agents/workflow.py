"""
LangGraph Workflow
Orchestrates agent routing and execution
"""
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END

from .quiz_generator import quiz_generation_agent
from .evaluator import evaluation_agent, feedback_agent, teacher_dashboard_agent


class AgentState(TypedDict):
    group_id: str
    user_id: Optional[str]
    query: Optional[str]
    content: Optional[str]
    node: Optional[str]
    output: Optional[dict]


def router_agent(state: AgentState) -> AgentState:
    """Router that passes state through to the correct agent"""
    return state


def route_to_node(state: AgentState) -> str:
    """Route to the correct node based on the 'node' field in state"""
    node = state.get("node")
    routes = {
        "quiz_generation": "quiz_generation",
        "evaluation": "evaluation",
        "feedback": "feedback",
        "teacher_dashboard": "teacher_dashboard"
    }
    return routes.get(node)


def create_workflow():
    """Create the LangGraph workflow"""
    try:
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("router", router_agent)
        workflow.add_node("quiz_generation", quiz_generation_agent)
        workflow.add_node("evaluation", evaluation_agent)
        workflow.add_node("feedback", feedback_agent)
        workflow.add_node("teacher_dashboard", teacher_dashboard_agent)
        
        # Set entry point
        workflow.set_entry_point("router")
        
        # Add conditional routing
        workflow.add_conditional_edges(
            "router",
            route_to_node,
            {
                "quiz_generation": "quiz_generation",
                "evaluation": "evaluation",
                "feedback": "feedback",
                "teacher_dashboard": "teacher_dashboard"
            }
        )
        
        # All agents end after execution
        workflow.add_edge("quiz_generation", END)
        workflow.add_edge("evaluation", END)
        workflow.add_edge("feedback", END)
        workflow.add_edge("teacher_dashboard", END)
        
        return workflow.compile()
    except Exception as e:
        print(f"Error creating workflow: {e}")
        return None


# Initialize workflow
try:
    agent_workflow = create_workflow()
except Exception as e:
    print(f"Warning: Could not initialize agent workflow: {e}")
    agent_workflow = None


__all__ = ['agent_workflow', 'create_workflow', 'AgentState']
