import React, { useState, useEffect } from 'react';
import { LuArrowLeft, LuCheck, LuX, LuTarget, LuBookOpen, LuInfo } from 'react-icons/lu';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Badge, Alert, Spinner, Button, ProgressBar } from 'react-bootstrap';
import { quizService } from '../../shared/services';
import { useToast } from '../../shared/components/ToastProvider';
import '../styles/QuizResultsPage.css';

function QuizResultsPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { showError } = useToast();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quizId) {
      fetchResults();
    }
  }, [quizId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const data = await quizService.getMySubmission(quizId);
      setResults(data);
    } catch (err) {
      console.error('Failed to fetch quiz results:', err);
      showError(err.response?.data?.detail || 'Failed to load quiz results.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="results-loading">
        <Spinner animation="border" variant="primary" />
        <p>Loading results...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="results-error">
        <Alert variant="danger">
          Results not available. You may not have submitted this quiz yet.
        </Alert>
        <Button variant="primary" onClick={() => navigate('/student')}>
          <LuArrowLeft style={{ marginRight: '0.5rem' }} /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const scorePercent = results.score || 0;
  const isPassing = scorePercent >= 70;
  const correctCount = results.correct || 0;
  const totalCount = results.total || 0;

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const renderQuestionResult = (q, index) => {
    const isCorrect = q.is_correct;
    const questionType = q.type || 'multiple_choice';

    return (
      <Card key={q.id || index} className={`result-question-card ${isCorrect ? 'correct' : 'incorrect'}`}>
        <Card.Body>
          <div className="result-q-header">
            <div className="result-q-header-left">
              <Badge bg="secondary" className="result-q-number">Q{index + 1}</Badge>
              <Badge bg={questionType === 'multiple_choice' ? 'primary' : questionType === 'true_false' ? 'info' : 'warning'}>
                {questionType === 'multiple_choice' ? 'MCQ' : questionType === 'true_false' ? 'T/F' : 'Short'}
              </Badge>
            </div>
            <Badge bg={isCorrect ? 'success' : 'danger'} className="result-status-badge">
              {isCorrect ? <><LuCheck /> Correct</> : <><LuX /> Incorrect</>}
            </Badge>
          </div>

          <h5 className="result-q-text">{q.question}</h5>

          {/* MCQ / True-False: Show options with correct/student answer */}
          {(questionType === 'multiple_choice' || questionType === 'true_false') && q.options && (
            <div className="result-options">
              {q.options.map((option, idx) => {
                const isStudentAnswer = q.student_answer == idx;
                const isCorrectAnswer = q.correct_answer == idx;
                
                let optClass = '';
                if (isCorrectAnswer) {
                  optClass = 'correct-option';
                } else if (isStudentAnswer) {
                  optClass = 'wrong-option';
                }

                return (
                  <div key={idx} className={`result-option ${optClass}`}>
                    <span className="result-option-letter">
                      {questionType === 'true_false' ? '' : String.fromCharCode(65 + idx) + '.'}
                    </span>
                    <span className="result-option-text">{option}</span>
                    
                    {/* Mutually exclusive badges for clarity */}
                    {isStudentAnswer && isCorrect ? (
                      <Badge bg="success" className="ms-auto">Your Answer ✓</Badge>
                    ) : isStudentAnswer && !isCorrect ? (
                      <Badge bg="danger" className="ms-auto">Your Answer</Badge>
                    ) : isCorrectAnswer ? (
                      <Badge bg="success" className="ms-auto">Correct Answer</Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Short Answer: Show student's answer + sample answer */}
          {questionType === 'short_answer' && (
            <div className="result-short-answer">
              <div className="result-answer-block student-answer">
                <h6><LuBookOpen style={{ marginRight: '0.25rem' }} /> Your Answer:</h6>
                <p>{q.student_answer || <em className="text-muted">No answer provided</em>}</p>
              </div>
              {q.sample_answer && (
                <div className="result-answer-block correct-answer">
                  <h6><LuTarget style={{ marginRight: '0.25rem' }} /> Sample Answer:</h6>
                  <p>{q.sample_answer}</p>
                </div>
              )}
              {q.key_points && q.key_points.length > 0 && (
                <div className="result-key-points">
                  <h6>Key Points:</h6>
                  <ul>
                    {q.key_points.map((kp, i) => <li key={i}>{kp}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Explanation */}
          {q.explanation && (
            <div className="result-explanation">
              <LuInfo style={{ marginRight: '0.25rem' }} />
              <span>{q.explanation}</span>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  return (
    <div className="quiz-results-page">
      <Button variant="outline-secondary" className="back-btn" onClick={() => navigate('/student')}>
        <LuArrowLeft /> Back to Dashboard
      </Button>

      {/* Score Hero */}
      <div className="score-hero">
        <h2 className="results-title">{results.quiz_title}</h2>
        <div className="score-circle" style={{ '--score-color': getScoreColor(scorePercent) }}>
          <div className="score-value">{Math.round(scorePercent)}%</div>
          <div className="score-label">Score</div>
        </div>
        <div className="score-details">
          <div className="score-detail-item">
            <span className="detail-number">{correctCount}</span>
            <span className="detail-label">Correct</span>
          </div>
          <div className="score-detail-divider" />
          <div className="score-detail-item">
            <span className="detail-number">{totalCount - correctCount}</span>
            <span className="detail-label">Wrong</span>
          </div>
          <div className="score-detail-divider" />
          <div className="score-detail-item">
            <span className="detail-number">{totalCount}</span>
            <span className="detail-label">Total</span>
          </div>
        </div>
        <ProgressBar
          now={scorePercent}
          className="score-progress"
          variant={scorePercent >= 80 ? 'success' : scorePercent >= 60 ? 'warning' : 'danger'}
        />
        <Badge bg={isPassing ? 'success' : 'warning'} className="pass-badge">
          {isPassing ? '🎉 Passed' : '📚 Needs Improvement'}
        </Badge>
      </div>

      {/* Question-by-Question Breakdown */}
      <div className="results-breakdown">
        <h4 className="breakdown-title">Question Breakdown</h4>
        {results.questions && results.questions.map((q, idx) => renderQuestionResult(q, idx))}
      </div>
    </div>
  );
}

export default QuizResultsPage;
