import React, { useState, useEffect, useCallback } from 'react';
import { LuPencil, LuRefreshCw, LuSave } from 'react-icons/lu';
import axios from 'axios';
import { Modal, Form, Button, Alert, Row, Col, Badge, ListGroup } from 'react-bootstrap';
import { useToast } from '../../shared/components/ToastProvider';
import '../../styles/modals.css';

function EditQuizModal({ show, onHide, quiz, groupId, onEditSuccess }) {
    const { showSuccess, showError } = useToast();
    const [materials, setMaterials] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        difficulty: 'Medium',
        questionCount: 10,
        questionType: 'MCQ',
        materialSelection: 'All',
        selectedMaterialIds: [],
        startTime: '',
        endTime: '',
        durationMinutes: '',
        useScheduling: false,
        regenerateContent: false,
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const difficulties = ['Easy', 'Medium', 'Hard'];
    const questionTypes = ['MCQ', 'True/False', 'Short Answer', 'Mixed'];

    // Fetch materials when modal opens
    const fetchMaterials = useCallback(async () => {
        if (!groupId) return;
        try {
            const response = await axios.get(`/materials/${groupId}`);
            setMaterials(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('Failed to fetch materials:', err);
        }
    }, [groupId]);

    useEffect(() => {
        if (show && groupId) {
            fetchMaterials();
        }
    }, [show, groupId, fetchMaterials]);

    // Populate form when quiz prop changes
    useEffect(() => {
        if (quiz && show) {
            const settings = quiz.settings || {};
            setFormData({
                title: settings.title || settings.name || quiz.title || '',
                description: settings.description || '',
                difficulty: settings.difficulty || quiz.difficulty || 'Medium',
                questionCount: settings.question_count || quiz.question_count || 10,
                questionType: settings.question_type || 'MCQ',
                materialSelection: quiz.material_ids?.length > 0 ? 'Selected' : 'All',
                selectedMaterialIds: quiz.material_ids || [],
                startTime: quiz.start_time ? formatDateTimeLocal(quiz.start_time) : '',
                endTime: quiz.end_time ? formatDateTimeLocal(quiz.end_time) : '',
                durationMinutes: quiz.duration_minutes || '',
                useScheduling: !!(quiz.start_time || quiz.end_time),
                regenerateContent: false,
            });
        }
    }, [quiz, show]);

    // Convert Unix timestamp to datetime-local format
    const formatDateTimeLocal = (timestamp) => {
        const date = new Date(timestamp * 1000);
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - offset * 60 * 1000);
        return localDate.toISOString().slice(0, 16);
    };

    const handleMaterialToggle = (materialId) => {
        const selected = formData.selectedMaterialIds;
        if (selected.includes(materialId)) {
            setFormData({
                ...formData,
                selectedMaterialIds: selected.filter(id => id !== materialId)
            });
        } else {
            setFormData({
                ...formData,
                selectedMaterialIds: [...selected, materialId]
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.title.trim()) {
            setError('Please enter a quiz title');
            return;
        }

        // Validate material selection when regenerating
        if (formData.regenerateContent && formData.materialSelection === 'Selected' && formData.selectedMaterialIds.length === 0) {
            setError('Please select at least one material for regeneration');
            return;
        }

        setSaving(true);

        try {
            // Prepare update data
            const updateData = {
                settings: {
                    title: formData.title,
                    description: formData.description,
                    difficulty: formData.difficulty,
                    question_count: formData.questionCount,
                    question_type: formData.questionType,
                },
                regenerate_content: formData.regenerateContent,
            };

            // Handle scheduling
            if (formData.useScheduling && formData.startTime) {
                updateData.start_time = Math.floor(new Date(formData.startTime).getTime() / 1000);

                if (formData.endTime) {
                    updateData.end_time = Math.floor(new Date(formData.endTime).getTime() / 1000);
                }
                if (formData.durationMinutes) {
                    updateData.duration_minutes = parseInt(formData.durationMinutes);
                }
            } else {
                // Clear scheduling if disabled
                updateData.start_time = null;
                updateData.end_time = null;
                updateData.duration_minutes = null;
            }

            await axios.put(`/quiz/${quiz.id}`, updateData);

            showSuccess(formData.regenerateContent
                ? 'Quiz updated and questions regenerated!'
                : 'Quiz updated successfully!');

            if (onEditSuccess) {
                onEditSuccess();
            }
            onHide();
        } catch (err) {
            console.error('Quiz update error:', err);
            const errorMessage = err.response?.data?.detail || 'Failed to update quiz.';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setError('');
        setFormData(prev => ({ ...prev, regenerateContent: false }));
        onHide();
    };

    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    if (!quiz) return null;

    return (
        <Modal show={show} onHide={handleClose} centered size="lg" className="generate-quiz-modal">
            <Modal.Header closeButton>
                <Modal.Title><LuPencil style={{ marginRight: '0.5rem' }} /> Edit Quiz</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {error && (
                        <Alert variant="danger" dismissible onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    <Form.Group className="mb-3">
                        <Form.Label>Quiz Title <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="e.g., JavaScript Fundamentals Quiz"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            placeholder="Optional description of the quiz..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </Form.Group>

                    <Row>
                        <Col md={4}>
                            <Form.Group className="mb-3">
                                <Form.Label>Difficulty</Form.Label>
                                <Form.Select
                                    value={formData.difficulty}
                                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                >
                                    {difficulties.map(diff => (
                                        <option key={diff} value={diff}>{diff}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group className="mb-3">
                                <Form.Label>Question Type</Form.Label>
                                <Form.Select
                                    value={formData.questionType}
                                    onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
                                >
                                    {questionTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group className="mb-3">
                                <Form.Label>Questions</Form.Label>
                                <Form.Control
                                    type="number"
                                    min={5}
                                    max={30}
                                    value={formData.questionCount}
                                    onChange={(e) => setFormData({ ...formData, questionCount: parseInt(e.target.value) || 10 })}
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    {/* Material Selection - Only shown when regenerating */}
                    {formData.regenerateContent && (
                        <>
                            <Form.Group className="mb-3">
                                <Form.Label>Select Materials for Regeneration</Form.Label>
                                <Form.Select
                                    value={formData.materialSelection}
                                    onChange={(e) => setFormData({ ...formData, materialSelection: e.target.value, selectedMaterialIds: [] })}
                                >
                                    <option value="All">All Materials</option>
                                    <option value="Selected">Select Specific Materials</option>
                                </Form.Select>
                            </Form.Group>

                            {formData.materialSelection === 'Selected' && (
                                <Form.Group className="mb-3">
                                    <Form.Label>Available Materials ({materials.length})</Form.Label>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '0.25rem', padding: '0.5rem' }}>
                                        {materials.length === 0 ? (
                                            <p className="text-muted mb-0">No materials available.</p>
                                        ) : (
                                            <ListGroup variant="flush">
                                                {materials.map((material) => (
                                                    <ListGroup.Item
                                                        key={material.id}
                                                        action
                                                        type="button"
                                                        active={formData.selectedMaterialIds.includes(material.id)}
                                                        onClick={() => handleMaterialToggle(material.id)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <Form.Check
                                                            type="checkbox"
                                                            checked={formData.selectedMaterialIds.includes(material.id)}
                                                            onChange={() => handleMaterialToggle(material.id)}
                                                            label={material.lecture_title || material.filename}
                                                            readOnly
                                                        />
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        )}
                                    </div>
                                    {formData.selectedMaterialIds.length > 0 && (
                                        <Form.Text className="text-success">
                                            {formData.selectedMaterialIds.length} material(s) selected
                                        </Form.Text>
                                    )}
                                </Form.Group>
                            )}
                        </>
                    )}

                    {/* Scheduling */}
                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            label="Enable Scheduling (Set Start/End Time)"
                            checked={formData.useScheduling}
                            onChange={(e) => setFormData({ ...formData, useScheduling: e.target.checked })}
                        />
                    </Form.Group>

                    {formData.useScheduling && (
                        <>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Start Time</Form.Label>
                                        <Form.Control
                                            type="datetime-local"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            min={getMinDateTime()}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>End Time</Form.Label>
                                        <Form.Control
                                            type="datetime-local"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            min={formData.startTime || getMinDateTime()}
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>

                            <Form.Group className="mb-3">
                                <Form.Label>Duration (Minutes)</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    placeholder="Quiz duration in minutes"
                                    value={formData.durationMinutes}
                                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                                />
                            </Form.Group>
                        </>
                    )}

                    {/* Regenerate Content Option */}
                    <Alert variant={formData.regenerateContent ? 'warning' : 'info'} className="mb-3">
                        <Form.Check
                            type="checkbox"
                            label={<strong><LuRefreshCw style={{ marginRight: '0.25rem' }} /> Regenerate Quiz Questions</strong>}
                            checked={formData.regenerateContent}
                            onChange={(e) => setFormData({ ...formData, regenerateContent: e.target.checked })}
                        />
                        <small className="d-block mt-2">
                            {formData.regenerateContent ? (
                                <>
                                    <strong> Warning:</strong> This will generate new questions using AI.
                                    Students who already completed the quiz will keep their scores, but the quiz will have different questions.
                                </>
                            ) : (
                                <>
                                    Leave unchecked to only update title, description, and schedule.
                                    The existing questions will remain the same.
                                </>
                            )}
                        </small>
                    </Alert>

                    {/* Preview */}
                    <div className="quiz-preview">
                        <h6>Changes Preview:</h6>
                        <ul className="preview-list">
                            <li>Title: <strong>{formData.title || 'Untitled Quiz'}</strong></li>
                            <li>Difficulty: <Badge bg={formData.difficulty === 'Easy' ? 'success' : formData.difficulty === 'Medium' ? 'warning' : 'danger'}>
                                {formData.difficulty}
                            </Badge></li>
                            <li>Type: <strong>{formData.questionType}</strong></li>
                            {formData.regenerateContent && (
                                <li className="text-warning"> Questions will be regenerated ({formData.questionCount} questions)</li>
                            )}
                            {formData.useScheduling && formData.startTime && (
                                <li>Start: <strong>{new Date(formData.startTime).toLocaleString()}</strong></li>
                            )}
                            {formData.useScheduling && formData.endTime && (
                                <li>End: <strong>{new Date(formData.endTime).toLocaleString()}</strong></li>
                            )}
                        </ul>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        variant={formData.regenerateContent ? 'warning' : 'primary'}
                        type="submit"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                {formData.regenerateContent ? 'Regenerating...' : 'Saving...'}
                            </>
                        ) : (
                            formData.regenerateContent ? <><LuRefreshCw style={{ marginRight: '0.25rem' }} /> Update & Regenerate</> : <><LuSave style={{ marginRight: '0.25rem' }} /> Save Changes</>
                        )}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default EditQuizModal;
