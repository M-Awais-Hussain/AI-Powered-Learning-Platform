import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LuSend, LuUser, LuBot } from 'react-icons/lu';
import axios from 'axios';
import { Card, Form, Button, Dropdown } from 'react-bootstrap';
import { useToast } from '../../shared/components/ToastProvider';
import '../styles/GroupAIChat.css';

function GroupAIChat({ groupId }) {
  const { showError } = useToast();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedContext, setSelectedContext] = useState('All');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Fetch chat history on mount
  const fetchChatHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/chat/${groupId}/history`, {
        params: { limit: 50 }
      });
      const history = Array.isArray(response.data) ? response.data : [];

      // Convert backend format to frontend format
      const formattedMessages = history.map((msg, index) => ({
        id: index + 1,
        role: msg.role === 'assistant' ? 'ai' : 'user',
        content: msg.message,
        timestamp: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date()
      }));

      // Add welcome message if no history
      if (formattedMessages.length === 0) {
        formattedMessages.push({
          id: 0,
          role: 'ai',
          content: "Hello! I'm your AI tutor for this group. How can I help you today?",
          timestamp: new Date()
        });
      }

      setMessages(formattedMessages);
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
      // Start with welcome message if fetch fails
      setMessages([{
        id: 1,
        role: 'ai',
        content: "Hello! I'm your AI tutor for this group. How can I help you today?",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      fetchChatHistory();
    }
  }, [groupId, fetchChatHistory]);

  const contextOptions = ['All', 'Selected Materials', 'Recent Quizzes', 'Course Notes'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const queryText = inputMessage.trim();

    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: queryText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Send message to backend
      const response = await axios.post(`/chat/${groupId}`, {
        group_id: groupId,
        query: queryText,
        material_ids: [] // Can extend for specific materials selection
      });

      // Add AI response
      const aiMessage = {
        id: Date.now() + 1,
        role: 'ai',
        content: response.data?.answer || response.data?.message || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to get AI response. Please try again.';
      showError(errorMessage);

      // Add error message
      const errorMsg = {
        id: Date.now() + 1,
        role: 'ai',
        content: `Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSummarize = async () => {
    setIsTyping(true);
    try {
      const response = await axios.post(`/chat/${groupId}`, {
        query: "Please summarize the key concepts from the group materials.",
        material_ids: []
      });

      const summaryMessage = {
        id: Date.now(),
        role: 'ai',
        content: response.data?.answer || "Summary generation failed. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, summaryMessage]);
    } catch (err) {
      console.error('Summarize error:', err);
      showError('Failed to generate summary. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="group-ai-chat">
      {/* Header */}
      <div className="chat-header">
        <div>
          <h2 className="section-title"> AI Tutor</h2>
          <p className="section-subtitle">Group-Specific AI Assistant</p>
        </div>
        <div className="context-controls">
          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary" size="sm">
              Context: {selectedContext}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {contextOptions.map(option => (
                <Dropdown.Item
                  key={option}
                  active={selectedContext === option}
                  onClick={() => setSelectedContext(option)}
                >
                  {option}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      <div className="chat-container">
        {/* Chat Messages */}
        <Card className="chat-messages-card">
          <Card.Body className="chat-messages-body">
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading chat...</span>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.role === 'user' ? 'message-user' : 'message-ai'}`}
                >
                  <div className="message-avatar">
                    {message.role === 'user' ? <LuUser /> : <LuBot />}
                  </div>
                  <div className="message-content">
                    <div className="message-text">{message.content}</div>
                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}

            {isTyping && (
              <div className="message message-ai">
                <div className="message-avatar"><LuBot /></div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </Card.Body>
        </Card>

        {/* Context Options Panel */}
        <Card className="context-panel-card">
          <Card.Header>
            <h6>Context Options</h6>
          </Card.Header>
          <Card.Body>
            <div className="context-options">
              <p className="context-label">AI will use:</p>
              <p className="context-value">{selectedContext}</p>
              <Button
                variant="outline-primary"
                size="sm"
                className="w-100 mt-3"
                onClick={handleSummarize}
                disabled={isTyping}
              >
                 Summarize Selected Material
              </Button>
              <hr />
              <div className="context-info">
                <small className="text-muted">
                   The AI assistant uses materials from this group to provide context-aware answers.
                </small>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Input Area */}
      <Card className="chat-input-card">
        <Card.Body>
          <Form onSubmit={handleSend}>
            <div className="input-container">
              <Form.Control
                type="text"
                placeholder="Type your message here..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="chat-input"
                disabled={isTyping}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputMessage.trim() || isTyping}
                className="send-button"
              >
                <LuSend style={{ marginRight: '0.25rem' }} /> Send
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default GroupAIChat;

