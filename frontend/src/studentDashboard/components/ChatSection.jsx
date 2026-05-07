import React, { useState } from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { LuMessageSquare, LuSparkles, LuBook, LuPlus, LuMenu, LuClock } from 'react-icons/lu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DashboardHero from '../../shared/components/DashboardHero';
import ChatHistoryPanel from './ChatHistoryPanel';

const ChatSection = ({
    selectedGroup,
    materials,
    messages,
    onChat,
    loading,
    sessions,
    activeChatId,
    onSelectChat,
    onNewChat,
    summary
}) => {
    const [query, setQuery] = useState('');
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim() && !loading) {
            onChat(query, selectedMaterials);
            setQuery('');
        }
    };

    return (
        <div className="chat-section-wrapper">
            <DashboardHero
                icon={<LuMessageSquare />}
                title="AI Tutor"
                subtitle={`Get instant help and explanations for your materials${selectedGroup ? ` in ${selectedGroup.name}` : ''}.`}
                stats={[
                    { icon: <LuMessageSquare />, value: messages.length, label: "Messages" },
                    { icon: <LuBook />, value: materials.length, label: "Materials" },
                    { icon: <LuPlus />, value: sessions.length, label: "number of chats" }
                ]}
                actions={
                    <div className="d-flex align-items-center gap-2">
                        <Button
                            variant="light"
                            className="rounded-pill p-3 lh-1 shadow-sm d-flex align-items-center justify-content-center transition-all hover-scale"
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            title="Chat History"
                        >
                            <LuClock size={20} className="text-primary" />
                        </Button>
                        <Button
                            variant="light"
                            className="rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2 hover-scale py-3"
                            onClick={onNewChat}
                        >
                            <LuPlus /> New Chat
                        </Button>
                    </div>
                }
            />

            <ChatHistoryPanel
                isOpen={isHistoryOpen}
                sessions={sessions}
                activeChatId={activeChatId}
                onSelectChat={(chatId) => {
                    onSelectChat(chatId);
                    setIsHistoryOpen(false);
                }}
                onClose={() => setIsHistoryOpen(false)}
                loading={loading && sessions.length === 0}
            />

            <Row className="g-4">
                {/* Main Chat Area - Now Full Width or centered */}
                <Col lg={10} className="mx-auto">
                    <div className="position-relative">
                        {/* Sidebar Toggle for Mobile/Tablet */}
                        <Button
                            className="position-absolute top-0 start-0 m-3 d-lg-none z-index-10 rounded-circle shadow-sm"
                            style={{ backgroundColor: '#2563eb', border: 'none', width: '40px', height: '40px', padding: 0 }}
                            onClick={() => setShowSidebar(!showSidebar)}
                        >
                            <LuMenu color="white" />
                        </Button>

                        <div className="sd-glass-card min-vh-60 d-flex flex-column p-0 overflow-hidden">
                            <div className="p-3 border-bottom bg-white bg-opacity-10 d-flex align-items-center gap-3">
                                <div className="d-lg-none" style={{ width: '40px' }}></div>
                                <h6 className="fw-bold mb-0">
                                    {sessions.find(s => s.chat_id === activeChatId)?.title || 'AI Tutor Chat'}
                                    {loading && <LuSparkles className="ms-2 text-primary animate-pulse" size={14} />}
                                </h6>
                            </div>

                            <div className="chat-container flex-grow-1 p-4" style={{ height: '500px', overflowY: 'auto' }}>
                                {summary && (
                                    <div className="summary-banner mb-4 p-3 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-20 shadow-sm">
                                        <div className="d-flex align-items-center gap-2 text-primary fw-bold small mb-2">
                                            <LuSparkles size={14} /> CONTEXT SUMMARY
                                        </div>
                                        <p className="small text-muted mb-0 italic">"{summary}"</p>
                                    </div>
                                )}

                                {messages.length === 0 ? (
                                    <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center text-muted opacity-75">
                                        <div className="bg-primary bg-opacity-10 p-4 rounded-circle mb-3">
                                            <LuMessageSquare size={48} className="text-primary" />
                                        </div>
                                        <h5>How can I help you today?</h5>
                                        <p className="small max-w-400">Ask about your lecture materials, request a summary, or get help with specific topics.</p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => (
                                        <div key={index} className={`d-flex ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'} mb-4`}>
                                            <div
                                                className={`p-3 rounded-4 shadow-sm markdown-content ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-light text-dark'}`}
                                                style={{
                                                    maxWidth: '85%',
                                                    borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                                    fontSize: '0.95rem',
                                                    lineHeight: '1.5'
                                                }}
                                            >
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.message || msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {loading && (
                                    <div className="d-flex justify-content-start mb-4">
                                        <div className="bg-light p-3 rounded-4 d-flex gap-1 align-items-center">
                                            <div className="dot-pulse"></div>
                                            <span className="small text-muted ms-2">Thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-top bg-white bg-opacity-10">
                                {materials.length > 0 && (
                                    <div className="mb-3 d-flex flex-wrap gap-2">
                                        <span className="small text-muted w-100 mb-1">Select focus materials:</span>
                                        {materials.slice(0, 4).map((material) => (
                                            <Button
                                                key={material.id}
                                                variant={selectedMaterials.includes(material.id) ? "primary" : "outline-secondary"}
                                                size="sm"
                                                className="rounded-pill py-1 px-3 border-0 transition-all"
                                                style={{ fontSize: '0.75rem', opacity: selectedMaterials.includes(material.id) ? 1 : 0.7 }}
                                                onClick={() => {
                                                    if (selectedMaterials.includes(material.id)) {
                                                        setSelectedMaterials(selectedMaterials.filter(id => id !== material.id));
                                                    } else {
                                                        setSelectedMaterials([...selectedMaterials, material.id]);
                                                    }
                                                }}
                                            >
                                                {material.lecture_title}
                                            </Button>
                                        ))}
                                    </div>
                                )}

                                <Form onSubmit={handleSubmit}>
                                    <div className="input-group bg-light rounded-pill p-1 shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                                        <Form.Control
                                            type="text"
                                            placeholder="Type your message here..."
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            disabled={loading}
                                            className="border-0 bg-transparent px-4 py-2"
                                            style={{ boxShadow: 'none' }}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={loading || !query.trim()}
                                            className="rounded-pill px-4 fw-bold border-0 bg-primary"
                                        >
                                            Send
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </div>
                    </div>
                </Col>
            </Row>

            <style>{`
                .chat-history-sidebar {
                    transition: transform 0.3s ease-in-out;
                }
                @media (max-width: 991.98px) {
                    .chat-history-sidebar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        z-index: 1050;
                        height: 100vh;
                        width: 280px;
                        transform: translateX(-100%);
                        background: white;
                    }
                    .chat-history-sidebar.show {
                        transform: translateX(0);
                    }
                }
                .markdown-content {
                    line-height: 1.6;
                }
                .markdown-content p {
                    margin-bottom: 8px;
                }
                .markdown-content p:last-child {
                    margin-bottom: 0;
                }
                .markdown-content strong {
                    font-weight: 700;
                }
                .markdown-content.user strong {
                    color: white;
                }
                .markdown-content.assistant strong {
                    color: #000;
                }
                .markdown-content ul, .markdown-content ol {
                    padding-left: 1.25rem;
                    margin-bottom: 8px;
                }
                .dot-pulse {
                    position: relative;
                    left: -9999px;
                    width: 6px;
                    height: 6px;
                    border-radius: 5px;
                    background-color: #2563eb;
                    color: #2563eb;
                    box-shadow: 9999px 0 0 0 #2563eb;
                    animation: dotPulse 1.5s infinite linear;
                }
                @keyframes dotPulse {
                    0% { box-shadow: 9999px 0 0 -5px #2563eb; }
                    30% { box-shadow: 9999px 0 0 2px #2563eb; }
                    60%, 100% { box-shadow: 9999px 0 0 -5px #2563eb; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }
                .min-vh-60 {
                    min-height: 60vh;
                }
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
                .hover-scale {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hover-scale:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15) !important;
                }
                .chat-section-wrapper {
                    position: relative;
                }
            `}</style>
        </div>
    );
};

export default ChatSection;
