import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LuCheck, LuShieldAlert, LuMaximize, LuClock, LuChevronLeft, LuChevronRight, LuSend } from 'react-icons/lu';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Alert, ProgressBar, Spinner, Badge } from 'react-bootstrap';
import { quizService } from '../../shared/services';
import Timer from '../../shared/components/Timer';
import { useToast } from '../../shared/components/ToastProvider';
import { ConfirmModal } from '../../shared/components';
import '../styles/QuizTakingPage.css';

// Anti-cheat: max tab switches before auto-submit
const MAX_TAB_SWITCHES = 3;

function QuizTakingPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const autoSaveIntervalRef = useRef(null);
  const tabSwitchCountRef = useRef(0);
  const isSubmittedRef = useRef(false);
  const answersRef = useRef({});

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [errorDetail, setErrorDetail] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // ──────────────────────────────────────────────
  // Fetch Quiz
  // ──────────────────────────────────────────────
  const fetchQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setErrorDetail(null);
      const data = await quizService.getQuizDetails(quizId);
      setQuiz(data);
    } catch (err) {
      console.error('Failed to fetch quiz:', err);
      const detail = err.response?.data?.detail || 'Failed to load quiz.';
      setErrorDetail(detail);
      showError(detail);
      
      // If it's a 403 (Ended, Not started, Already done), we stay on page and show error
      // Only navigate back if it's not a handled 403
      if (err.response?.status !== 403) {
        navigate('/student');
      }
    } finally {
      setLoading(false);
    }
  }, [quizId, navigate, showError]);

  // ──────────────────────────────────────────────
  // Auto-save answers
  // ──────────────────────────────────────────────
  const autoSaveAnswers = useCallback(async (completed = false) => {
    if (isSubmittedRef.current) return;
    try {
      // Use answersRef so we always read the freshest answers without stale closure
      const answerArray = Object.entries(answersRef.current).map(([questionId, answer]) => ({
        question_id: questionId,
        selected_answer: answer
      }));

      if (answerArray.length === 0) return;

      await quizService.submitQuiz(quizId, answerArray, completed);


    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [quizId]);

  // ──────────────────────────────────────────────
  // Init: Fetch quiz + auto-save interval
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (quizId) {
      fetchQuiz();
    }
  }, [quizId, fetchQuiz]);

  useEffect(() => {
    // Auto-save every 30 seconds
    autoSaveIntervalRef.current = setInterval(() => {
      if (quiz && !isSubmittedRef.current) {
        autoSaveAnswers(false);
      }
    }, 30000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [quiz, autoSaveAnswers]);

  // ──────────────────────────────────────────────
  // Fullscreen Mode
  // ──────────────────────────────────────────────
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      // Only call exitFullscreen if the document is currently in fullscreen
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        setIsFullscreen(false);
        return;
      }
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  }, []);

  // Fullscreen is triggered by the Start Quiz button click instead of useEffect
  // (browsers block requestFullscreen unless called from a direct user gesture)

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      
      // If student exits fullscreen during quiz, warn them
      if (!isCurrentlyFullscreen && quiz && !isSubmittedRef.current) {
        showWarning?.('Please stay in fullscreen mode during the quiz.');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [quiz, showWarning]);

  // ──────────────────────────────────────────────
  // Submit Quiz
  // ──────────────────────────────────────────────
  const submitQuiz = useCallback(async (autoSubmit = false) => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;

    try {
      setSubmitting(true);
      // Use answersRef.current to always read the latest answers (avoids stale closure)
      const latestAnswers = answersRef.current;
      const answerArray = quiz.questions.map((q, index) => {
        const key = (q.id !== undefined && q.id !== null) ? q.id : index;
        return {
          question_id: key,
          selected_answer: latestAnswers[key] ?? null
        };
      });

      const response = await quizService.submitQuiz(quizId, answerArray, true);

      setResults(response);
      setSubmitted(true);

      // Exit fullscreen on submit
      exitFullscreen();

      if (autoSubmit) {
        if (tabSwitchCountRef.current >= MAX_TAB_SWITCHES) {
          showError('Quiz auto-submitted due to multiple tab switches.');
        } else {
          showSuccess("Time's up! Quiz has been auto-submitted.");
        }
      } else {
        showSuccess('Quiz submitted successfully!');
      }

      // Redirect to results after 3 seconds
      setTimeout(() => {
        navigate(`/student/quiz/${quizId}/results`);
      }, 3000);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      isSubmittedRef.current = false;
      showError(err.response?.data?.detail || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  }, [quiz, exitFullscreen, showError, showSuccess, navigate, quizId]);

  // ──────────────────────────────────────────────
  // Keyboard Shortcut Blocking
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!quiz || isSubmittedRef.current) return;

    const handleKeyDown = (e) => {
      // Block: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+S, Ctrl+P
      if (e.ctrlKey && ['c', 'v', 'x', 'a', 's', 'p'].includes(e.key.toLowerCase())) {
        // Allow Ctrl+A only in textarea/input for short answers
        if (e.key.toLowerCase() === 'a' && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block: F12 (DevTools), PrintScreen
      if (e.key === 'F12' || e.key === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block: Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block: Alt+Tab is handled by OS, we detect via visibilitychange instead
    };

    // Block right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [quiz]);

  // ──────────────────────────────────────────────
  // Tab-Switch / Visibility Change Detection
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!quiz || isSubmittedRef.current) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittedRef.current) {
        tabSwitchCountRef.current += 1;
        setTabSwitchCount(tabSwitchCountRef.current);

        if (tabSwitchCountRef.current >= MAX_TAB_SWITCHES) {
          // Auto-submit after too many tab switches
          submitQuiz(true);
        } else {
          setTabSwitchWarning(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [quiz, submitQuiz]);

  // ──────────────────────────────────────────────
  // Answer Handling
  // ──────────────────────────────────────────────
  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: answer };
      answersRef.current = next;
      return next;
    });

  };

  // ──────────────────────────────────────────────
  // Timer: Auto-submit when time is up
  // ──────────────────────────────────────────────
  const handleTimeUp = useCallback(() => {
    if (!isSubmittedRef.current) {
      submitQuiz(true);
    }
  }, [submitQuiz]);

  // ──────────────────────────────────────────────
  // Navigation
  // ──────────────────────────────────────────────
  const goToQuestion = (index) => setCurrentQuestionIndex(index);
  const nextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // ──────────────────────────────────────────────
  // Render: Loading / Error states
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="quiz-loading">
        <Spinner animation="border" variant="primary" />
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-error p-5 text-center">
        <Alert variant="danger">
          <h4 className="alert-heading">Quiz Unavailable</h4>
          <p>{errorDetail || 'Quiz not found or not available.'}</p>
          <hr />
          <div className="d-flex justify-content-center">
            <Button variant="outline-danger" onClick={() => navigate('/student')}>
              Back to Dashboard
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // ── Start Quiz Overlay ──
  if (!quizStarted) {
    return (
      <div className="quiz-start-overlay">
        <div className="quiz-start-card">
          <div className="quiz-start-icon">📋</div>
          <h2 className="quiz-start-title">{quiz.title}</h2>
          {quiz.description && <p className="quiz-start-desc">{quiz.description}</p>}
          <div className="quiz-start-meta">
            <span>🧮 {quiz.questions.length} Questions</span>
            {quiz.difficulty && <span>📊 {quiz.difficulty}</span>}
            {quiz.end_time && <span>⏱ Timed Quiz</span>}
          </div>
          <div className="quiz-start-notice">
            <LuMaximize size={18} />
            <span>This quiz will open in <strong>fullscreen mode</strong>. Tab switching is monitored.</span>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="quiz-start-btn"
            onClick={async () => {
              await enterFullscreen();
              setQuizStarted(true);
            }}
          >
            <LuMaximize style={{ marginRight: '0.5rem' }} />
            Start Quiz in Fullscreen
          </Button>
          <button
            className="quiz-start-skip"
            onClick={() => setQuizStarted(true)}
          >
            Continue without fullscreen
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  const answeredCount = Object.keys(answers).filter(
    key => answers[key] !== null && answers[key] !== undefined && answers[key] !== ''
  ).length;

  // ──────────────────────────────────────────────
  // Render: Question Content by Type
  // ──────────────────────────────────────────────
  const renderQuestion = (question) => {
    const qKey = (question.id !== undefined && question.id !== null) ? question.id : currentQuestionIndex;
    const questionType = question.type || 'multiple_choice';

    switch (questionType) {
      case 'multiple_choice':
        return (
          <div className="answer-options mcq-options">
            {question.options && question.options.map((option, index) => (
              <div
                key={index}
                className={`answer-option-card ${answers[qKey] === index ? 'selected' : ''}`}
                onClick={() => handleAnswerChange(qKey, index)}
              >
                <div className="option-letter">{String.fromCharCode(65 + index)}</div>
                <div className="option-text">{option}</div>
                {answers[qKey] === index && (
                  <div className="option-check"><LuCheck /></div>
                )}
              </div>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="answer-options tf-options">
            {['True', 'False'].map((option, index) => (
              <div
                key={index}
                className={`tf-option-card ${answers[qKey] === index ? 'selected' : ''} ${index === 0 ? 'tf-true' : 'tf-false'}`}
                onClick={() => handleAnswerChange(qKey, index)}
              >
                <div className="tf-icon">
                  {index === 0 ? <LuCheck size={32} /> : <span style={{fontSize: '2rem', fontWeight: 700}}>✕</span>}
                </div>
                <div className="tf-label">{option}</div>
              </div>
            ))}
          </div>
        );

      case 'short_answer':
        return (
          <div className="short-answer-section">
            <Form.Group>
              <Form.Control
                as="textarea"
                rows={5}
                placeholder="Type your detailed answer here..."
                value={answers[qKey] || ''}
                onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                className="short-answer-textarea"
              />
              <Form.Text className="text-muted mt-2 d-block">
                💡 Tip: Provide a thorough answer based on the course materials.
              </Form.Text>
            </Form.Group>
          </div>
        );

      default:
        // Fallback: treat unknown types as short answer
        return (
          <div className="short-answer-section">
            <Form.Group>
              <Form.Control
                as="textarea"
                rows={5}
                placeholder="Type your answer here..."
                value={answers[qKey] || ''}
                onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                className="short-answer-textarea"
              />
            </Form.Group>
          </div>
        );
    }
  };

  const getQuestionTypeBadge = (type) => {
    switch (type) {
      case 'multiple_choice': return <Badge bg="primary">MCQ</Badge>;
      case 'true_false': return <Badge bg="info">True / False</Badge>;
      case 'short_answer': return <Badge bg="warning" text="dark">Short Answer</Badge>;
      default: return <Badge bg="secondary">{type}</Badge>;
    }
  };

  // ──────────────────────────────────────────────
  // Render: Main UI
  // ──────────────────────────────────────────────
  return (
    <div className={`quiz-taking-page ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Tab Switch Warning Overlay */}
      {tabSwitchWarning && (
        <div className="tab-switch-overlay">
          <div className="tab-switch-modal">
            <div className="tab-switch-icon"><LuShieldAlert size={48} /></div>
            <h3>⚠️ Tab Switch Detected!</h3>
            <p>
              You switched away from the quiz tab. This activity is being monitored.
            </p>
            <p className="tab-switch-count">
              Warning {tabSwitchCount} of {MAX_TAB_SWITCHES}. 
              After {MAX_TAB_SWITCHES} switches, your quiz will be <strong>auto-submitted</strong>.
            </p>
            <Button
              variant="danger"
              size="lg"
              onClick={() => {
                setTabSwitchWarning(false);
                enterFullscreen();
              }}
            >
              Return to Quiz
            </Button>
          </div>
        </div>
      )}

      {/* Fullscreen re-enter prompt */}
      {!isFullscreen && !submitted && !tabSwitchWarning && (
        <div className="fullscreen-prompt">
          <Alert variant="warning" className="d-flex align-items-center gap-2">
            <LuMaximize />
            <span>Quiz requires fullscreen mode.</span>
            <Button variant="warning" size="sm" onClick={enterFullscreen}>
              Enter Fullscreen
            </Button>
          </Alert>
        </div>
      )}

      {/* Quiz Header */}
      <div className="quiz-header">
        <h1>{quiz.title}</h1>
        {quiz.description && <p className="quiz-description">{quiz.description}</p>}
        <div className="quiz-header-badges">
          <Badge bg="secondary">{quiz.questions.length} Questions</Badge>
          {quiz.difficulty && <Badge bg="outline-secondary">{quiz.difficulty}</Badge>}
        </div>
      </div>

      {/* Timer */}
      {quiz.end_time && (
        <Timer
          endTime={quiz.end_time}
          startTime={quiz.start_time}
          onTimeUp={handleTimeUp}
        />
      )}



      <div className="quiz-body">
        {/* Question Navigation Panel (sidebar) */}
        <div className="question-nav-panel">
          <h6 className="nav-panel-title">Questions</h6>
          <div className="nav-panel-grid">
            {quiz.questions.map((q, index) => {
              const qKey = (q.id !== undefined && q.id !== null) ? q.id : index;
              const isAnswered = answers[qKey] !== undefined && answers[qKey] !== null && answers[qKey] !== '';
              const isCurrent = index === currentQuestionIndex;
              return (
                <button
                  key={index}
                  className={`nav-dot ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                  onClick={() => goToQuestion(index)}
                  title={`Question ${index + 1}${isAnswered ? ' ✓' : ''}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="nav-panel-legend">
            <span><span className="legend-dot answered" /> Answered</span>
            <span><span className="legend-dot current" /> Current</span>
            <span><span className="legend-dot" /> Unanswered</span>
          </div>
          <div className="nav-panel-stats">
            <p>{answeredCount}/{quiz.questions.length} answered</p>
          </div>
        </div>

        {/* Main Question Area */}
        <div className="question-area">
          {/* Progress */}
          <div className="quiz-progress-section">
            <div className="progress-info">
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <span>Answered: {answeredCount}/{quiz.questions.length}</span>
            </div>
            <ProgressBar now={progress} label={`${Math.round(progress)}%`} className="quiz-progress-bar" />
          </div>

          {/* Question Card */}
          <Card className="question-card">
            <Card.Body>
              <div className="question-header">
                <div className="question-header-left">
                  <Badge bg="secondary" className="question-number-badge">
                    Q{currentQuestionIndex + 1}
                  </Badge>
                  {getQuestionTypeBadge(currentQuestion.type)}
                </div>
                <Badge bg={answers[(currentQuestion.id !== undefined && currentQuestion.id !== null) ? currentQuestion.id : currentQuestionIndex] !== undefined &&
                  answers[(currentQuestion.id !== undefined && currentQuestion.id !== null) ? currentQuestion.id : currentQuestionIndex] !== null &&
                  answers[(currentQuestion.id !== undefined && currentQuestion.id !== null) ? currentQuestion.id : currentQuestionIndex] !== '' ? 'success' : 'outline-secondary'}>
                  {(answers[(currentQuestion.id !== undefined && currentQuestion.id !== null) ? currentQuestion.id : currentQuestionIndex] !== undefined &&
                    answers[(currentQuestion.id !== undefined && currentQuestion.id !== null) ? currentQuestion.id : currentQuestionIndex] !== null &&
                    answers[(currentQuestion.id !== undefined && currentQuestion.id !== null) ? currentQuestion.id : currentQuestionIndex] !== '') ? '✓ Answered' : 'Not Answered'}
                </Badge>
              </div>

              <div className="question-content">
                <h4 className="question-text">{currentQuestion.question}</h4>
                {currentQuestion.difficulty && (
                  <Badge bg={currentQuestion.difficulty === 'easy' ? 'success' : currentQuestion.difficulty === 'hard' ? 'danger' : 'warning'} className="difficulty-badge">
                    {currentQuestion.difficulty}
                  </Badge>
                )}
                {renderQuestion(currentQuestion)}
              </div>
            </Card.Body>
          </Card>

          {/* Navigation Buttons */}
          <div className="quiz-navigation">
            <Button
              variant="outline-secondary"
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0}
              className="nav-btn"
            >
              <LuChevronLeft /> Previous
            </Button>

            <div className="nav-center-info">
              {currentQuestionIndex + 1} / {quiz.questions.length}
            </div>

            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting || submitted}
                className="nav-btn submit-btn"
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Submitting...
                  </>
                ) : submitted ? (
                  <><LuCheck /> Submitted</>
                ) : (
                  <><LuSend /> Submit Quiz</>
                )}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={nextQuestion}
                className="nav-btn"
              >
                Next <LuChevronRight />
              </Button>
            )}
          </div>

          {/* Submit Section (always visible) */}
          {!submitted && (
            <div className="quiz-submit-section">
              <p className="submit-info">
                <LuClock style={{ marginRight: '0.25rem' }} />
                You have answered <strong>{answeredCount}</strong> out of <strong>{quiz.questions.length}</strong> questions.
              </p>
              <Button
                variant="success"
                size="lg"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting || submitted}
                className="final-submit-btn"
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Submitting...
                  </>
                ) : (
                  <><LuSend style={{ marginRight: '0.5rem' }} /> Submit Quiz</>
                )}
              </Button>
            </div>
          )}

          {/* Results Preview */}
          {results && (
            <Alert variant="success" className="results-preview">
              <h5>🎉 Quiz Submitted!</h5>
              <p className="results-score">Score: {results.score}% ({results.correct}/{results.total} correct)</p>
              <p>Redirecting to results page...</p>
            </Alert>
          )}
        </div>
      </div>
      {/* Confirm Submission Modal */}
      <ConfirmModal
        isOpen={showSubmitConfirm}
        title="Confirm Submission"
        message="Are you sure you want to submit? You cannot change answers after submission."
        confirmText="Yes, Submit"
        cancelText="No, Keep Answering"
        onConfirm={() => {
          setShowSubmitConfirm(false);
          submitQuiz(false);
        }}
        onCancel={() => setShowSubmitConfirm(false)}
        variant="success"
      />
    </div>
  );
}

export default QuizTakingPage;
