import React, { useState, useEffect } from 'react';
import { LuCheck, LuX } from 'react-icons/lu';
import axios from 'axios';
import { Container, Card, Button, Form, ProgressBar, Alert } from 'react-bootstrap';
import { useToast } from './ToastProvider';
import { useNavigate } from 'react-router-dom';
import '../GlassyDesign.css';

function QuizPage({ quizId, groupId, userId }) {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quiz && quiz.settings?.time_limit) {
      const limit = quiz.settings.time_limit * 60; // Convert to seconds
      setTimeRemaining(limit);

      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quiz]);

  const fetchQuiz = async () => {
    try {
      const response = await axios.get(`/groups/${groupId}/quizzes`);
      const foundQuiz = response.data.find(q => q.id === quizId);
      if (foundQuiz) {
        // Fetch full quiz details
        const fullQuiz = await axios.get(`/quiz/${quizId}`);
        setQuiz(fullQuiz.data);
        setAnswers({});
      } else {
        showError('Quiz not found');
      }
    } catch (error) {
      showError('Failed to load quiz');
      console.error('Quiz fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const answerArray = quiz.questions.map((q, idx) => ({
        question_id: q.id || idx + 1,
        answer: answers[q.id || idx + 1] || ''
      }));

      const response = await axios.post(`/quiz/submit/${quizId}`, {
        answers: answerArray,
        category: quiz.settings?.subject || 'General'
      });

      showSuccess('Quiz submitted successfully!');
      navigate(`/quiz-results/${response.data.submission_id}`);
    } catch (error) {
      showError('Failed to submit quiz');
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Container className="mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </Container>
    );
  }

  if (!quiz) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Quiz not found</Alert>
      </Container>
    );
  }

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

  return (
    <Container className="mt-4">
      <Card className="glass-card">
        <Card.Header className="glass-card-header">
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="text-white mb-0">{quiz.settings?.name || 'Quiz'}</h4>
            {timeRemaining !== null && (
              <div className="text-white">
                ⏱️ Time Remaining: {formatTime(timeRemaining)}
              </div>
            )}
          </div>
          <ProgressBar
            now={progress}
            className="mt-3"
            style={{ height: '8px' }}
          />
          <div className="text-white-50 mt-2">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </div>
        </Card.Header>
        <Card.Body>
          <div className="mb-4">
            <div className="d-flex align-items-center mb-3 gap-2">
              <h5 className="text-white mb-0">{question.question}</h5>
              <span className={`badge ${question.type === 'multiple_choice' ? 'bg-primary' :
                  question.type === 'true_false' ? 'bg-info' : 'bg-warning'
                }`}>
                {question.type === 'multiple_choice' ? 'MCQ' :
                  question.type === 'true_false' ? 'True/False' : 'Short Answer'}
              </span>
            </div>

            {/* Multiple Choice Questions */}
            {question.type === 'multiple_choice' && question.options && (
              <div className="question-options">
                {question.options.map((option, idx) => (
                  <div
                    key={idx}
                    className={`option-card mb-2 p-3 rounded ${answers[question.id || currentQuestion] === idx
                        ? 'selected-option'
                        : 'unselected-option'
                      }`}
                    onClick={() => handleAnswerChange(question.id || currentQuestion, idx)}
                    style={{
                      cursor: 'pointer',
                      border: answers[question.id || currentQuestion] === idx
                        ? '2px solid #6366f1'
                        : '1px solid rgba(255,255,255,0.2)',
                      background: answers[question.id || currentQuestion] === idx
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(255,255,255,0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Form.Check
                      type="radio"
                      id={`option-${question.id}-${idx}`}
                      name={`question-${question.id}`}
                      label={<span className="text-white">{String.fromCharCode(65 + idx)}. {option}</span>}
                      checked={answers[question.id || currentQuestion] === idx}
                      onChange={() => handleAnswerChange(question.id || currentQuestion, idx)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* True/False Questions */}
            {question.type === 'true_false' && (
              <div className="d-flex gap-3">
                {['True', 'False'].map((option, idx) => (
                  <div
                    key={idx}
                    className={`true-false-btn p-4 rounded text-center flex-fill ${answers[question.id || currentQuestion] === idx ? 'selected' : ''
                      }`}
                    onClick={() => handleAnswerChange(question.id || currentQuestion, idx)}
                    style={{
                      cursor: 'pointer',
                      border: answers[question.id || currentQuestion] === idx
                        ? '2px solid ' + (idx === 0 ? '#10b981' : '#ef4444')
                        : '1px solid rgba(255,255,255,0.2)',
                      background: answers[question.id || currentQuestion] === idx
                        ? (idx === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)')
                        : 'rgba(255,255,255,0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{idx === 0 ? <LuCheck /> : <LuX />}</span>
                    <div className="text-white mt-2 fw-bold">{option}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Short Answer Questions */}
            {question.type === 'short_answer' && (
              <div>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={answers[question.id || currentQuestion] || ''}
                  onChange={(e) => handleAnswerChange(question.id || currentQuestion, e.target.value)}
                  placeholder="Type your answer here..."
                  className="glass-form-control"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff'
                  }}
                />
                <small className="text-white-50 mt-2 d-block">
                   Tip: Provide a detailed answer based on the course materials
                </small>
              </div>
            )}

            {/* Fallback for unknown types - treat as short answer */}
            {!['multiple_choice', 'true_false', 'short_answer'].includes(question.type) && (
              <Form.Control
                as="textarea"
                rows={5}
                value={answers[question.id || currentQuestion] || ''}
                onChange={(e) => handleAnswerChange(question.id || currentQuestion, e.target.value)}
                placeholder="Type your answer here..."
                className="glass-form-control"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff'
                }}
              />
            )}
          </div>

          <div className="d-flex justify-content-between">
            <Button
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="glass-btn"
            >
              ← Previous
            </Button>

            <div>
              {quiz.questions.map((q, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant={answers[q.id || idx] !== undefined ? 'primary' : 'outline-secondary'}
                  onClick={() => setCurrentQuestion(idx)}
                  className="me-1 mb-1"
                >
                  {idx + 1}
                </Button>
              ))}
            </div>

            {currentQuestion === quiz.questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="glass-btn glass-btn-primary"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="glass-btn glass-btn-primary"
              >
                Next →
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default QuizPage;

