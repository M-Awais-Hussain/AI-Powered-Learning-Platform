import React from 'react';
import { Card, ListGroup, Spinner } from 'react-bootstrap';
import { LuMessageSquare, LuClock, LuX } from 'react-icons/lu';

const ChatHistoryPanel = ({
    isOpen,
    sessions,
    activeChatId,
    onSelectChat,
    onClose,
    loading
}) => {
    const formatDate = (dateString) => {
        if (!dateString) return '';

        let date = new Date(dateString);
        // If the string is from the backend (UTC) but missing the 'Z' suffix,
        // some browsers might treat it as local time.
        if (typeof dateString === 'string' && !dateString.includes('Z') && !dateString.includes('+')) {
            date = new Date(dateString + 'Z');
        }

        const now = new Date();
        const diffInMs = now - date;
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

        if (diffInHours < 1) {
            const diffInMins = Math.floor(diffInMs / (1000 * 60));
            return `${diffInMins}m ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        } else {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className={`chat-history-dropdown ${isOpen ? 'open' : ''}`}>
            <div className="history-panel-overlay" onClick={onClose} />
            <Card className="history-panel-container sd-glass-card shadow-lg border-0">
                <Card.Header className="bg-transparent border-bottom p-3 d-flex align-items-center justify-content-between">
                    <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                        <LuClock size={18} className="text-primary" /> Chat History
                    </h6>
                    <button className="btn-close-panel" onClick={onClose}>
                        <LuX size={20} />
                    </button>
                </Card.Header>
                <Card.Body className="p-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: '400px' }}>
                    {loading ? (
                        <div className="d-flex justify-content-center p-5">
                            <Spinner animation="border" variant="primary" size="sm" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="p-5 text-center text-muted">
                            <LuMessageSquare size={32} className="mb-2 opacity-25" />
                            <p className="small mb-0">No previous chats found.</p>
                        </div>
                    ) : (
                        <ListGroup variant="flush">
                            {sessions.map((session) => (
                                <ListGroup.Item
                                    key={session.chat_id}
                                    action
                                    className={`history-item p-3 border-bottom transition-all ${activeChatId === session.chat_id ? 'active' : ''}`}
                                    onClick={() => onSelectChat(session.chat_id)}
                                >
                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                        <div className="history-item-title fw-bold text-truncate">
                                            {session.title || 'New Chat'}
                                        </div>
                                        <div className="history-item-time text-muted shrink-0">
                                            {formatDate(session.updated_at)}
                                        </div>
                                    </div>
                                    <div className="history-item-preview text-muted text-truncate small">
                                        {session.last_message || 'No messages yet...'}
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </Card.Body>
            </Card>

            <style>{`
                .chat-history-dropdown {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    visibility: hidden;
                    pointer-events: none;
                }
                .chat-history-dropdown.open {
                    visibility: visible;
                    pointer-events: auto;
                }
                .history-panel-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(2px);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .chat-history-dropdown.open .history-panel-overlay {
                    opacity: 1;
                }
                .history-panel-container {
                    position: relative;
                    margin: 0 auto;
                    width: 95%;
                    max-width: 800px;
                    transform: translateY(-20px);
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 0 0 20px 20px !important;
                    background: rgba(255, 255, 255, 0.9) !important;
                }
                .chat-history-dropdown.open .history-panel-container {
                    transform: translateY(0);
                    opacity: 1;
                }
                .history-item {
                    cursor: pointer;
                    background: transparent !important;
                    border-left: 4px solid transparent;
                }
                .history-item:hover {
                    background: rgba(37, 99, 235, 0.05) !important;
                    transform: scale(1.005);
                }
                .history-item.active {
                    background: rgba(37, 99, 235, 0.08) !important;
                    border-left-color: #2563eb;
                }
                .btn-close-panel {
                    background: none;
                    border: none;
                    color: #64748b;
                    padding: 4px;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                .btn-close-panel:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: #1e293b;
                }
                .history-item-title {
                    color: #1e293b;
                    font-size: 0.95rem;
                    max-width: 75%;
                }
                .history-item-time {
                    font-size: 0.75rem;
                }
                .history-item-preview {
                    color: #64748b;
                    font-size: 0.85rem;
                }
                .shrink-0 {
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
};

export default ChatHistoryPanel;
