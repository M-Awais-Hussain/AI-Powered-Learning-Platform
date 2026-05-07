import React, { useState, useEffect, useCallback } from 'react';
import { LuSearch, LuMail } from 'react-icons/lu';
import axios from 'axios';
import { Modal, Table, Badge, Form, InputGroup } from 'react-bootstrap';
import { useToast } from '../../shared/components/ToastProvider';
import { getTwoWordName } from '../../shared/utils/nameFormat';
import '../../styles/modals.css';

function StudentsModal({ show, onHide, groupId, studentCount }) {
  const { showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch students from backend
  const fetchStudents = useCallback(async () => {
    if (!groupId || !show) return;
    try {
      setLoading(true);
      const response = await axios.get(`/groups/${groupId}/members`);
      const studentsData = Array.isArray(response.data) ? response.data : [];
      setStudents(studentsData);
    } catch (err) {
      console.error('Failed to fetch students:', err);
      showError('Failed to load students. Please try again.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, show, showError]);

  useEffect(() => {
    if (show && groupId) {
      fetchStudents();
    }
  }, [show, groupId, fetchStudents]);

  const filteredStudents = students.filter(student =>
    (student.name || student.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 75) return 'warning';
    return 'danger';
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered className="students-modal">
      <Modal.Header closeButton>
        <Modal.Title>
           Group Students ({students.length})
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="students-search">
          <InputGroup>
            <InputGroup.Text><LuSearch /></InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </div>

        <div className="students-table-container">
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Quizzes Taken</th>
                <th>Average Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    {students.length === 0 ? 'No students in this group yet' : 'No students match your search'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <strong>{getTwoWordName(student.name, student.email || 'Unknown')}</strong>
                    </td>
                    <td>{student.email || 'N/A'}</td>
                    <td>
                      <Badge bg="info">{student.quiz_count || 0}</Badge>
                    </td>
                    <td>
                      <Badge bg={getScoreColor(student.avg_score || 0)}>
                        {student.avg_score || 0}%
                      </Badge>
                    </td>
                    <td>
                      <Badge bg="success">Active</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onHide}>
          Close
        </button>
        <button className="btn btn-primary">
          <LuMail style={{ marginRight: '0.25rem' }} /> Send Message to All
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default StudentsModal;

