import React, { useState } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';

const NotesSection = ({ categories, savedNotes, onSaveNote, loading }) => {
    const [noteCategory, setNoteCategory] = useState(categories[0] || 'General');
    const [noteContent, setNoteContent] = useState('');

    const handleSave = () => {
        if (noteContent.trim()) {
            onSaveNote(noteContent, noteCategory);
            setNoteContent('');
        }
    };

    return (
        <div>
            <h2 className="mb-4">My Notes</h2>

            <div className="sd-glass-card mb-4">
                <div className="card-header">
                    <h6 className="mb-0">Add New Note</h6>
                </div>
                <div className="card-body">
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small text-muted">Category</Form.Label>
                            <Form.Select
                                value={noteCategory}
                                onChange={(e) => setNoteCategory(e.target.value)}
                                className="rounded-3 border-0 shadow-sm bg-light"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small text-muted">Note Content</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={4}
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder="Enter your notes here..."
                                className="rounded-3 border-0 shadow-sm bg-light"
                            />
                        </Form.Group>
                        <Button
                            onClick={handleSave}
                            disabled={loading || !noteContent.trim()}
                            className="rounded-pill px-4 fw-bold shadow-sm border-0"
                            style={{ background: '#2563eb' }}
                        >
                            {loading ? 'Saving...' : 'Save Note'}
                        </Button>
                    </Form>
                </div>
            </div>

            <h4 className="mb-3">Saved Notes</h4>
            {savedNotes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"></div>
                    <p>No notes saved yet. Add your first note above!</p>
                </div>
            ) : (
                savedNotes.map((note) => (
                    <div key={note.id} className="sd-glass-card mb-3 p-3">
                        <div className="card-body">
                            <div className="d-flex justify-content-between mb-2">
                                <Badge bg="info">{note.category}</Badge>
                                <small className="text-secondary">{note.source}</small>
                            </div>
                            <p className="mb-0">{note.content}</p>
                            {note.summary && (
                                <div className="mt-2">
                                    <strong className="text-secondary">Summary:</strong>
                                    <p className="text-secondary mb-0">{note.summary}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default NotesSection;
