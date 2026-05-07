import React, { useState, useEffect, useCallback } from 'react';
import { LuBrain } from 'react-icons/lu';
import axios from 'axios';
import { Modal, Form, Button, Alert, Badge, Row, Col, ListGroup } from 'react-bootstrap';
import { useToast } from '../../shared/components/ToastProvider';
import '../../styles/modals.css';

function GenerateQuizModal({ show, onHide, groupId, onGenerateSuccess }) {
  const { showSuccess, showError } = useToast();
  const [materials, setMaterials] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'Medium',
    questionCount: 10,
    questionType: 'MCQ',
    materialSelection: 'All', // 'All' or 'Selected'
    selectedMaterialIds: [],
    startTime: '',
    endTime: '',
    durationMinutes: '',
    useScheduling: false,
  });
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const difficulties = ['Easy', 'Medium', 'Hard'];
  const questionTypes = ['MCQ', 'True/False', 'Short Answer', 'Mixed'];

  const fetchMaterials = useCallback(async () => {
    try {
      const response = await axios.get(`/materials/${groupId}`);
      setMaterials(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
      showError('Failed to load materials.');
    }
  }, [groupId, showError]);

  // Fetch materials when modal opens
  useEffect(() => {
    if (show && groupId) {
      fetchMaterials();
    }
  }, [show, groupId, fetchMaterials]);

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

  const handleStartTimeChange = (e) => {
    const startTime = e.target.value;
    setFormData({ ...formData, startTime });

    // Auto-calculate duration if both times are set
    if (startTime && formData.endTime) {
      const start = new Date(startTime);
      const end = new Date(formData.endTime);
      const diffMinutes = Math.round((end - start) / (1000 * 60));
      if (diffMinutes > 0) {
        setFormData(prev => ({ ...prev, durationMinutes: diffMinutes.toString() }));
      }
    }
  };

  const handleEndTimeChange = (e) => {
    const endTime = e.target.value;
    setFormData({ ...formData, endTime });

    // Auto-calculate duration if both times are set
    if (formData.startTime && endTime) {
      const start = new Date(formData.startTime);
      const end = new Date(endTime);
      const diffMinutes = Math.round((end - start) / (1000 * 60));
      if (diffMinutes > 0) {
        setFormData(prev => ({ ...prev, durationMinutes: diffMinutes.toString() }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Please enter a quiz title');
      return;
    }

    // Validate material selection
    if (formData.materialSelection === 'Selected' && formData.selectedMaterialIds.length === 0) {
      setError('Please select at least one material');
      return;
    }

    // Validate scheduling
    if (formData.useScheduling) {
      if (!formData.startTime) {
        setError('Please set a start time');
        return;
      }
      if (!formData.endTime && !formData.durationMinutes) {
        setError('Please set either an end time or duration');
        return;
      }
    }

    setGenerating(true);

    try {
      // Prepare quiz settings
      const quizSettings = {
        title: formData.title,
        description: formData.description,
        difficulty: formData.difficulty,
        question_count: formData.questionCount,
        question_type: formData.questionType,
      };

      // Convert datetime strings to Unix timestamps
      let startTime = null;
      let endTime = null;
      let durationMinutes = null;

      if (formData.useScheduling && formData.startTime) {
        startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);

        if (formData.endTime) {
          endTime = Math.floor(new Date(formData.endTime).getTime() / 1000);
        } else if (formData.durationMinutes) {
          durationMinutes = parseInt(formData.durationMinutes);
          endTime = startTime + (durationMinutes * 60);
        }
      }

      const quizData = {
        group_id: groupId,
        settings: quizSettings,
        material_ids: formData.materialSelection === 'Selected' ? formData.selectedMaterialIds : [],
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes || (endTime && startTime ? Math.floor((endTime - startTime) / 60) : null),
      };

      await axios.post(`/quiz/generate/${groupId}`, quizData);

      showSuccess('Quiz generated successfully!');

      // Reset form
      setFormData({
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
      });

      if (onGenerateSuccess) {
        onGenerateSuccess();
      } else {
        onHide();
      }
    } catch (err) {
      console.error('Quiz generation error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to generate quiz. Please try again.';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setFormData({
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
    });
    setError('');
    onHide();
  };

  // Get minimum datetime (current time)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg" className="generate-quiz-modal">
      <Modal.Header closeButton>
        <Modal.Title><LuBrain style={{ marginRight: '0.5rem' }} /> Generate Quiz with AI</Modal.Title>
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
              autoFocus
            />
            <Form.Text className="text-muted">
              Enter a descriptive title for the quiz
            </Form.Text>
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
            <Form.Text className="text-muted">
              Provide additional context about the quiz
            </Form.Text>
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Difficulty <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  required
                >
                  {difficulties.map(diff => (
                    <option key={diff} value={diff}>{diff}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Question Type <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  value={formData.questionType}
                  onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
                  required
                >
                  {questionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Number of Questions: <strong>{formData.questionCount}</strong></Form.Label>
            <Form.Range
              min={5}
              max={30}
              value={formData.questionCount}
              onChange={(e) => setFormData({ ...formData, questionCount: parseInt(e.target.value) })}
            />
            <Form.Text className="text-muted">
              Adjust the slider to set the number of questions (5-30)
            </Form.Text>
          </Form.Group>

          {/* Material Selection */}
          <Form.Group className="mb-3">
            <Form.Label>Select Materials <span className="text-danger">*</span></Form.Label>
            <Form.Select
              value={formData.materialSelection}
              onChange={(e) => setFormData({ ...formData, materialSelection: e.target.value, selectedMaterialIds: [] })}
              required
            >
              <option value="All">All Materials</option>
              <option value="Selected">Select Specific Materials</option>
            </Form.Select>
            <Form.Text className="text-muted">
              Choose whether to use all materials or select specific ones
            </Form.Text>
          </Form.Group>

          {formData.materialSelection === 'Selected' && (
            <Form.Group className="mb-3">
              <Form.Label>Available Materials ({materials.length})</Form.Label>
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '0.25rem', padding: '0.5rem' }}>
                {materials.length === 0 ? (
                  <p className="text-muted">No materials available. Please upload materials first.</p>
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

          {/* Scheduling */}
          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              label="Enable Scheduling (Set Start/End Time)"
              checked={formData.useScheduling}
              onChange={(e) => setFormData({ ...formData, useScheduling: e.target.checked, startTime: '', endTime: '', durationMinutes: '' })}
            />
            <Form.Text className="text-muted">
              Optionally schedule when the quiz becomes available to students
            </Form.Text>
          </Form.Group>

          {formData.useScheduling && (
            <>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Start Time <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={handleStartTimeChange}
                      min={getMinDateTime()}
                      required={formData.useScheduling}
                    />
                    <Form.Text className="text-muted">
                      When students can start taking the quiz
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>End Time</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={handleEndTimeChange}
                      min={formData.startTime || getMinDateTime()}
                    />
                    <Form.Text className="text-muted">
                      When the quiz becomes unavailable (or use duration below)
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Duration (Minutes)</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  placeholder="Auto-calculated from start/end time"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                />
                <Form.Text className="text-muted">
                  Quiz duration in minutes (auto-calculated if start/end times are set)
                </Form.Text>
              </Form.Group>
            </>
          )}

          <div className="quiz-preview">
            <h6>Quiz Preview:</h6>
            <ul className="preview-list">
              <li>Title: <strong>{formData.title || 'Untitled Quiz'}</strong></li>
              <li>Difficulty: <Badge bg={formData.difficulty === 'Easy' ? 'success' : formData.difficulty === 'Medium' ? 'warning' : 'danger'}>
                {formData.difficulty}
              </Badge></li>
              <li>Questions: <strong>{formData.questionCount}</strong> ({formData.questionType})</li>
              <li>Materials: <strong>{formData.materialSelection === 'All' ? 'All Materials' : `${formData.selectedMaterialIds.length} Selected`}</strong></li>
              {formData.useScheduling && formData.startTime && (
                <li>Start: <strong>{new Date(formData.startTime).toLocaleString()}</strong></li>
              )}
              {formData.useScheduling && (formData.endTime || formData.durationMinutes) && (
                <li>End: <strong>{formData.endTime ? new Date(formData.endTime).toLocaleString() : `Duration: ${formData.durationMinutes} minutes`}</strong></li>
              )}
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={generating}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={generating}>
            {generating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Generating with AI...
              </>
            ) : (
              <><LuBrain style={{ marginRight: '0.25rem' }} /> Generate Quiz with AI</>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default GenerateQuizModal;