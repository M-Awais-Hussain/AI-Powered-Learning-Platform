import React, { useState, useEffect, useCallback } from 'react';
import { LuSparkles, LuSearch, LuCalendar, LuPencil, LuCircleCheck, LuCircleHelp, LuFlame, LuTrash2, LuTriangleAlert, LuClipboardList, LuZap, LuTarget } from 'react-icons/lu';
import axios from 'axios';
import { Modal, Badge, Row, Col, Table } from 'react-bootstrap';
import GenerateQuizModal from '../modals/GenerateQuizModal';
import EditQuizModal from '../modals/EditQuizModal';
import { useToast } from '../../shared/components/ToastProvider';
import DashboardHero from '../../shared/components/DashboardHero';
import { SkeletonCard } from '../../shared/components/SkeletonLoader';
import { getTwoWordName } from '../../shared/utils/nameFormat';
import '../styles/GroupQuizzes.css';

function GroupQuizzes({ groupId }) {
  const { showSuccess, showError } = useToast();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedQuizResults, setSelectedQuizResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [quizToEdit, setQuizToEdit] = useState(null);

  // Fetch quizzes from backend
  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/groups/${groupId}/quizzes`);
      const quizzesData = Array.isArray(response.data) ? response.data : [];
      setQuizzes(quizzesData);

      setQuizzes(quizzesData);
    } catch (err) {
      console.error('Failed to fetch quizzes:', err);
      showError('Failed to load quizzes. Please try again.');
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, showError]);

  useEffect(() => {
    if (groupId) {
      fetchQuizzes();
    }
  }, [groupId, fetchQuizzes]);

  const handleGenerateSuccess = () => {
    fetchQuizzes();
    setShowGenerateModal(false);
  };

  const handleDeleteQuiz = async () => {
    if (!quizToDelete) return;

    try {
      setDeleting(true);
      await axios.delete(`/quiz/${quizToDelete.id}`);
      showSuccess('Quiz deleted successfully!');
      setShowDeleteModal(false);
      setQuizToDelete(null);
      fetchQuizzes();
    } catch (err) {
      console.error('Failed to delete quiz:', err);
      showError('Failed to delete quiz. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteModal = (quiz) => {
    setQuizToDelete(quiz);
    setShowDeleteModal(true);
  };

  const handleViewResults = async (quizId) => {
    try {
      setLoadingResults(true);
      setShowResultsModal(true);
      const response = await axios.get(`/quiz/results/${quizId}`);
      setSelectedQuizResults(response.data);
    } catch (err) {
      console.error('Failed to fetch quiz results:', err);
      showError('Failed to load quiz results. Please try again.');
      setShowResultsModal(false);
    } finally {
      setLoadingResults(false);
    }
  };

  const currentTime = Math.floor(Date.now() / 1000);

  const getQuizStatus = (quiz) => {
    if (quiz.is_active === false) return 'inactive';

    const startTime = quiz.start_time;
    const endTime = quiz.end_time;

    if (startTime && currentTime < startTime) return 'scheduled';
    if (endTime && currentTime > endTime) return 'expired';
    return 'active';
  };

  const totalQuizzes = quizzes.length;
  const activeQuizzes = quizzes.filter(q => getQuizStatus(q) === 'active').length;
  const totalQuestions = quizzes.reduce((sum, q) => sum + (q.question_count || 0), 0);
  const avgScore = quizzes.length > 0
    ? Math.round(quizzes.reduce((sum, q) => sum + (q.avg_score || 0), 0) / quizzes.length)
    : 0;

  // Filter quizzes
  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = (quiz.title || quiz.settings?.name || '')
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const quizDifficulty = (quiz.difficulty || quiz.settings?.difficulty || 'medium').toLowerCase();
    const matchesDifficulty = difficultyFilter === 'all' || quizDifficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const getDifficultyClass = (difficulty) => {
    const diff = (difficulty || 'medium').toLowerCase();
    switch (diff) {
      case 'easy': return 'difficulty-easy';
      case 'hard': return 'difficulty-hard';
      default: return 'difficulty-medium';
    }
  };

  const getScoreClass = (score) => {
    if (score >= 70) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-poor';
  };

  const getQuizIcon = (difficulty) => {
    const diff = (difficulty || 'medium').toLowerCase();
    switch (diff) {
      case 'easy': return { icon: <LuCircleCheck />, bg: '#ecfdf5' };
      case 'hard': return { icon: <LuFlame />, bg: '#fef2f2' };
      default: return { icon: <LuCircleHelp />, bg: '#fef3c7' };
    }
  };

  return (
    <div className="quiz-container">
      {/* Hero Section */}
      <DashboardHero
        icon={<LuClipboardList />}
        title="Quiz Management"
        subtitle="Create, manage, and analyze quizzes for your students"
        primaryButton={{
          text: "Generate Quiz",
          icon: <LuSparkles />,
          onClick: () => setShowGenerateModal(true)
        }}
        stats={[
          { icon: <LuClipboardList />, value: totalQuizzes, label: "Total Quizzes" },
          { icon: <LuZap />, value: activeQuizzes, label: "Active" },
          { icon: <LuCircleHelp />, value: totalQuestions, label: "Questions" },
          { icon: <LuTarget />, value: `${avgScore}%`, label: "Avg Score" }
        ]}
      />

      {/* Toolbar */}
      <div className="quiz-toolbar">
        <div className="search-box">
          <span className="search-icon"><LuSearch /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Search quizzes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-pills">
          {['all', 'easy', 'medium', 'hard'].map(filter => (
            <button
              key={filter}
              className={`filter-pill ${difficultyFilter === filter ? 'active' : ''}`}
              onClick={() => setDifficultyFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="quiz-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">
            <span className="empty-icon"><LuClipboardList /></span>
            <div className="empty-circles">
              <div className="circle c1"></div>
              <div className="circle c2"></div>
              <div className="circle c3"></div>
            </div>
          </div>
          <h3 className="empty-title">
            {searchTerm || difficultyFilter !== 'all' ? 'No quizzes found' : 'No quizzes yet'}
          </h3>
          <p className="empty-text">
            {searchTerm || difficultyFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Generate your first AI-powered quiz to get started'}
          </p>
          {!searchTerm && difficultyFilter === 'all' && (
            <button className="empty-btn" onClick={() => setShowGenerateModal(true)}>
              <LuSparkles style={{ marginRight: '0.25rem' }} /> Generate Your First Quiz
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Quiz Cards Grid */}
          <div className="quiz-grid">
            {filteredQuizzes.map((quiz, index) => {
              const iconData = getQuizIcon(quiz.difficulty || quiz.settings?.difficulty);
              const score = quiz.avg_score || 0;

              return (
                <div
                  className="quiz-card"
                  key={quiz.id}
                  style={{ '--delay': `${index * 0.05}s` }}
                >
                  <div className="quiz-card-header">
                    <div className="quiz-icon-wrapper">
                      {iconData.icon}
                    </div>
                    <div className="quiz-badges">
                      <span className={`difficulty-badge ${getDifficultyClass(quiz.difficulty || quiz.settings?.difficulty)}`}>
                        {quiz.difficulty || quiz.settings?.difficulty || 'Medium'}
                      </span>
                      <span className={`status-badge status-${getQuizStatus(quiz)}`}>
                        {getQuizStatus(quiz).charAt(0).toUpperCase() + getQuizStatus(quiz).slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="quiz-card-body">
                    <h3 className="quiz-title">
                      {quiz.title || quiz.settings?.name || `Quiz ${quiz.id.slice(0, 8)}`}
                    </h3>
                    <div className="quiz-meta">
                      <span className="meta-item">
                        <span className="meta-icon"><LuCircleHelp /></span>
                        {quiz.question_count || 0} questions
                      </span>
                      <span className="meta-item">
                        <span className="meta-icon"><LuCalendar /></span>
                        {quiz.created_at
                          ? new Date(quiz.created_at * 1000).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="quiz-card-footer">
                    <div className="score-display">
                      <div className="score-bar">
                        <div
                          className={`score-fill ${getScoreClass(score)}`}
                          style={{ width: `${score}%` }}
                        ></div>
                      </div>
                      <span className="score-text">{score}% avg</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="action-btn view-btn"
                        onClick={() => handleViewResults(quiz.id)}
                      >
                        Results
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => { setQuizToEdit(quiz); setShowEditModal(true); }}
                      >
                        <LuPencil />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => openDeleteModal(quiz)}
                      >
                        <LuTrash2 />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </>
      )}

      {/* Generate Quiz Modal */}
      <GenerateQuizModal
        show={showGenerateModal}
        onHide={() => setShowGenerateModal(false)}
        onGenerateSuccess={handleGenerateSuccess}
        groupId={groupId}
      />

      {/* Edit Quiz Modal */}
      <EditQuizModal
        show={showEditModal}
        onHide={() => { setShowEditModal(false); setQuizToEdit(null); }}
        quiz={quizToEdit}
        groupId={groupId}
        onEditSuccess={() => { setShowEditModal(false); setQuizToEdit(null); fetchQuizzes(); }}
      />

      {/* Quiz Results Modal */}
      <Modal show={showResultsModal} onHide={() => { setShowResultsModal(false); setSelectedQuizResults(null); }} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Quiz Results
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingResults ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : selectedQuizResults ? (
            <div>
              <Row className="mb-4">
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h6 className="text-muted mb-1">Submissions</h6>
                    <h4 className="mb-0">{selectedQuizResults.total_submissions || 0}</h4>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h6 className="text-muted mb-1">Average</h6>
                    <h4 className="mb-0">{selectedQuizResults.average_score?.toFixed(1) || 0}%</h4>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h6 className="text-muted mb-1">Highest</h6>
                    <h4 className="mb-0">{selectedQuizResults.highest_score?.toFixed(1) || 0}%</h4>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h6 className="text-muted mb-1">Lowest</h6>
                    <h4 className="mb-0">{selectedQuizResults.lowest_score?.toFixed(1) || 0}%</h4>
                  </div>
                </Col>
              </Row>

              {selectedQuizResults.submissions && selectedQuizResults.submissions.length > 0 ? (
                <Table striped hover responsive>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuizResults.submissions.map((submission, index) => (
                      <tr key={submission.submission_id || index}>
                        <td>{getTwoWordName(submission.full_name, submission.email || `Student ${submission.user_id?.slice(0, 8) || 'Unknown'}`)}</td>
                        <td>
                          <Badge bg={submission.score >= 70 ? 'success' : submission.score >= 50 ? 'warning' : 'danger'}>
                            {submission.score?.toFixed(1) || 0}%
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={submission.completed ? 'success' : 'secondary'}>
                            {submission.completed ? 'Completed' : 'Incomplete'}
                          </Badge>
                        </td>
                        <td>
                          {submission.submitted_at
                            ? new Date(submission.submitted_at * 1000).toLocaleString()
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted">
                  <p>No submissions yet for this quiz.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted">
              <p>No results available.</p>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDeleteModal}
        onHide={() => { setShowDeleteModal(false); setQuizToDelete(null); }}
        centered
        className="delete-modal"
      >
        <Modal.Body className="text-center py-4">
          <div className="delete-icon-wrapper mb-3">
            <span style={{ fontSize: '3rem' }}><LuTriangleAlert /></span>
          </div>
          <h4 className="mb-2">Delete Quiz?</h4>
          <p className="text-muted mb-4">
            Are you sure you want to delete "<strong>{quizToDelete?.title || quizToDelete?.settings?.name || 'this quiz'}</strong>"?
            <br />This action cannot be undone.
          </p>
          <div className="d-flex gap-2 justify-content-center">
            <button
              className="btn btn-secondary px-4"
              onClick={() => { setShowDeleteModal(false); setQuizToDelete(null); }}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger px-4"
              onClick={handleDeleteQuiz}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Deleting...
                </>
              ) : (
                <><LuTrash2 style={{ marginRight: '0.25rem' }} /> Delete Quiz</>
              )}
            </button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default GroupQuizzes;
