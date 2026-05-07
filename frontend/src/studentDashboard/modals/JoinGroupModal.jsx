import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axios from 'axios';

function JoinGroupModal({ show, onHide, onJoined }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a valid group code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/groups/join', { code: code.trim() });
      if (onJoined) {
        onJoined(response.data.group_id);
      }
      setCode('');
      onHide();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to join group. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Join Group</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}
        <Form onSubmit={handleJoin}>
          <Form.Group className="mb-3">
            <Form.Label>Group Code</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter group code provided by your teacher"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Form.Group>
          <div className="d-flex justify-content-end">
            <Button variant="secondary" className="me-2" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Joining...' : 'Join Group'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

export default JoinGroupModal;


