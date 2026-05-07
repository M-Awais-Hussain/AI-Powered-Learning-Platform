import React, { useState, useEffect, useCallback } from 'react';
import { LuLink } from 'react-icons/lu';
import axios from 'axios';
import { Container, Row, Col, Button, Form, Modal, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../shared/components/ToastProvider';
import TopBar from '../shared/components/TopBar';
import '../Modern.css';

function GroupSelector({ userId, userRole }) {
  const { showSuccess, showError } = useToast();
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUserGroups = useCallback(async () => {
    try {
      const response = await axios.get(`/groups/user/${userId}`);
      setGroups(response.data);
    } catch (err) {
      setError('Failed to fetch groups');
    }
  }, [userId]);

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      showError('Please enter a group name');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/groups/create', {
        name: newGroup.name,
        description: newGroup.description
      });

      await fetchUserGroups();
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '' });
      showSuccess('Group created successfully!');
    } catch (err) {
      showError('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      showError('Please enter a group code');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/groups/join', {
        code: joinCode
      });

      // Refresh groups list
      await fetchUserGroups();
      setShowJoinModal(false);
      setJoinCode('');
      showSuccess('Successfully joined the group!');
    } catch (err) {
      showError('Invalid group code or failed to join');
    } finally {
      setLoading(false);
    }
  };

  const copyGroupCode = (code) => {
    navigator.clipboard.writeText(code);
    showSuccess('Group code copied to clipboard!');
  };

  const navigate = useNavigate();

  const handleGroupSelection = (group) => {
    if (userRole === 'teacher') {
      navigate('/teacher');
    } else {
      navigate(`/student/${group.id}`);
    }
  };

  return (
    <div className="modern-dashboard">
      <TopBar title="Select Group" />
      <Container className="mt-4" style={{ paddingTop: '80px' }}>
        <Row className="justify-content-center">
          <Col md={8}>
            <div className="modern-card">
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="mb-0">Select a Group</h3>
                </div>
              </div>
              <div className="card-body">
                {error && <Alert variant="danger" className="modern-alert alert-danger">{error}</Alert>}

                <div className="mb-4">
                  {userRole === 'teacher' && (
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="modern-btn modern-btn-primary me-2"
                    >
                      Create New Group
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowJoinModal(true)}
                    className="modern-btn modern-btn-outline"
                  >
                    <LuLink style={{ marginRight: '0.25rem' }} /> Join with Code
                  </Button>
                </div>

                {groups.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      {userRole === 'teacher' ? '' : ''}
                    </div>
                    <h4>Welcome to Your Learning Platform</h4>
                    <p>
                      {userRole === 'teacher'
                        ? 'Create your first class group to start teaching and managing students.'
                        : 'Ask your teacher for a group code to join their class.'
                      }
                    </p>
                  </div>
                ) : (
                  <div>
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className="modern-card mb-3"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleGroupSelection(group)}
                      >
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <h5 className="mb-2">{group.name}</h5>
                              {group.description && <p className="text-secondary mb-2">{group.description}</p>}
                              {userRole === 'teacher' && (
                                <small className="text-secondary">
                                  {group.member_count || 0} members
                                </small>
                              )}
                            </div>
                            {userRole === 'teacher' && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyGroupCode(group.code);
                                }}
                                className="modern-btn modern-btn-primary"
                              >
                                {group.code}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Col>
        </Row>
      </Container>

      {/* Create Group Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} className="modern-modal">
        <Modal.Header closeButton>
          <Modal.Title>Create New Group</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="modern-form-label">Group Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter group name"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                className="modern-form-control"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="modern-form-label">Description (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter group description"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                className="modern-form-control"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowCreateModal(false)} className="modern-btn modern-btn-secondary">
            Cancel
          </Button>
          <Button onClick={handleCreateGroup} disabled={loading} className="modern-btn modern-btn-primary">
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Join Group Modal */}
      <Modal show={showJoinModal} onHide={() => setShowJoinModal(false)} className="modern-modal">
        <Modal.Header closeButton>
          <Modal.Title>Join Group</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="modern-form-label">Group Code</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter group code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="modern-form-control"
              />
              <small className="text-secondary">
                Ask your teacher for the group code to join their class.
              </small>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setShowJoinModal(false)} className="modern-btn modern-btn-secondary">
            Cancel
          </Button>
          <Button onClick={handleJoinGroup} disabled={loading} className="modern-btn modern-btn-primary">
            {loading ? 'Joining...' : 'Join Group'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default GroupSelector;
