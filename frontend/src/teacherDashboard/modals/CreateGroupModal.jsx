import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import '../../styles/modals.css';

function CreateGroupModal({ show, onHide, onCreate, loading }) {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Please enter a group name');
      return;
    }

    onCreate(formData);
  };

  const handleClose = () => {
    setFormData({ name: '', description: '' });
    setError('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="create-group-modal">
      <Modal.Header closeButton>
        <Modal.Title>Create New Group</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
          
          <Form.Group className="mb-3">
            <Form.Label>Group Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., Math 101 - Fall 2024"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
            />
            <Form.Text className="text-muted">
              Choose a descriptive name for your group
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Description (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Brief description of the group, course, or class..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Form.Text className="text-muted">
              Add context or instructions for students joining this group
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading || !formData.name.trim()}>
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default CreateGroupModal;

