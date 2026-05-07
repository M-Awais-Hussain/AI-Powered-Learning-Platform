import React from 'react';
import { LuClock, LuPlay } from 'react-icons/lu';
import { Card, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import '../styles/QuizCard.css';

function QuizCard({ quiz, groupId }) {
  const navigate = useNavigate();

  const getDifficultyColor = (difficulty) => {
    if (!difficulty) return 'secondary';
    const diff = difficulty.toLowerCase();
    switch (diff) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'danger';
      default: return 'secondary';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Not scheduled';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusBadge = (quiz) => {
    const now = Math.floor(Date.now() / 1000);
    if (!quiz.start_time || now < quiz.start_time) {
      return <Badge bg="secondary">Not Started</Badge>;
    }
    if (quiz.end_time && now > quiz.end_time) {
      return <Badge bg="danger">Ended</Badge>;
    }
    if (quiz.has_submitted) {
      return <Badge bg="success">Completed</Badge>;
    }
    return <Badge bg="primary">Active</Badge>;
  };

  const handleStartQuiz = () => {
    navigate(`/student/quiz/${quiz.id}`);
  };

  const handleViewResults = () => {
    navigate(`/student/quiz/${quiz.id}/results`);
  };

  return (
    <Card className="quiz-card mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <Card.Title className="quiz-card-title">{quiz.title}</Card.Title>
            {quiz.description && (
              <Card.Text className="quiz-card-description">{quiz.description}</Card.Text>
            )}
          </div>
          {getStatusBadge(quiz)}
        </div>

        <div className="quiz-card-info mb-3">
          <div className="info-item">
            <span className="info-label"> Questions:</span>
            <span className="info-value">{quiz.question_count}</span>
          </div>
          <div className="info-item">
            <span className="info-label"> Difficulty:</span>
            <Badge bg={getDifficultyColor(quiz.difficulty)}>{quiz.difficulty}</Badge>
          </div>
          {quiz.start_time && (
            <div className="info-item">
              <span className="info-label"><LuClock style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Starts:</span>
              <span className="info-value">{formatTime(quiz.start_time)}</span>
            </div>
          )}
          {quiz.end_time && (
            <div className="info-item">
              <span className="info-label"><LuClock style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Ends:</span>
              <span className="info-value">{formatTime(quiz.end_time)}</span>
            </div>
          )}
          {quiz.duration_minutes && (
            <div className="info-item">
              <span className="info-label">⏱️ Duration:</span>
              <span className="info-value">{quiz.duration_minutes} minutes</span>
            </div>
          )}
          {quiz.has_submitted && quiz.submission_score !== null && (
            <div className="info-item">
              <span className="info-label"> Score:</span>
              <Badge bg={quiz.submission_score >= 80 ? 'success' : quiz.submission_score >= 60 ? 'warning' : 'danger'}>
                {quiz.submission_score}%
              </Badge>
            </div>
          )}
        </div>

        <div className="quiz-card-actions">
          {quiz.has_submitted ? (
            <Button variant="outline-primary" onClick={handleViewResults}>
               View Results
            </Button>
          ) : (
            <Button 
              variant="primary" 
              onClick={handleStartQuiz} 
              disabled={
                !quiz.start_time || 
                Math.floor(Date.now() / 1000) < quiz.start_time ||
                (quiz.end_time && Math.floor(Date.now() / 1000) > quiz.end_time)
              }
            >
              {!quiz.start_time || Math.floor(Date.now() / 1000) < quiz.start_time 
                ? '⏳ Starting Soon...' 
                : quiz.end_time && Math.floor(Date.now() / 1000) > quiz.end_time
                  ? 'Quiz Ended'
                  : <><LuPlay style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Start Quiz</>}
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export default QuizCard;
