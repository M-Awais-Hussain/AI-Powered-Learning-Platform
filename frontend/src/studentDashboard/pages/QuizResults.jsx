import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Card, Badge, Alert, ListGroup } from 'react-bootstrap';
import { useToast } from './ToastProvider';
import '../GlassyDesign.css';

function QuizResults({ submissionId, userId }) {
  const { showError } = useToast();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [submissionId]);

  const fetchResults = async () => {
    try {
      const response = await axios.get(`/quiz/results/${userId}`);
      const submission = response.data.find(s => s.submission_id === submissionId);
      
      if (submission) {
        // Fetch detailed submission
        const detailResponse = await axios.get(`/submission/${submissionId}`);
        setResults(detailResponse.data);
      } else {
        showError('Results not found');
      }
    } catch (error) {
      showError('Failed to load results');
      console.error('Results fetch error:', error);
    } finally {
      setLoading(false);
    }
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

  if (!results) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Results not available</Alert>
      </Container>
    );
  }

  const grade = results.grade || {};
  const score = grade.score || 0;
  const isPassing = score >= 70;

  return (
    <Container className="mt-4">
      <Card className="glass-card mb-4">
        <Card.Header className="glass-card-header">
          <h4 className="text-white mb-0">Quiz Results</h4>
        </Card.Header>
        <Card.Body>
          <div className="text-center mb-4">
            <h2 className={isPassing ? 'text-success' : 'text-warning'}>
              Score: {score}%
            </h2>
            <Badge bg={isPassing ? 'success' : 'warning'} className="fs-6">
              {isPassing ? 'Passed' : 'Needs Improvement'}
            </Badge>
          </div>

          {grade.overall_feedback && (
            <Alert variant={isPassing ? 'success' : 'warning'}>
              <strong>Overall Feedback:</strong> {grade.overall_feedback}
            </Alert>
          )}

          {grade.strengths && grade.strengths.length > 0 && (
            <div className="mb-3">
              <h5 className="text-white">Strengths:</h5>
              <ul className="text-white-50">
                {grade.strengths.map((strength, idx) => (
                  <li key={idx}>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {grade.areas_for_improvement && grade.areas_for_improvement.length > 0 && (
            <div className="mb-3">
              <h5 className="text-white">Areas for Improvement:</h5>
              <ul className="text-white-50">
                {grade.areas_for_improvement.map((area, idx) => (
                  <li key={idx}>{area}</li>
                ))}
              </ul>
            </div>
          )}

          {grade.detailed_feedback && (
            <div className="mt-4">
              <h5 className="text-white mb-3">Question-by-Question Feedback:</h5>
              <ListGroup>
                {grade.detailed_feedback.map((feedback, idx) => (
                  <ListGroup.Item
                    key={idx}
                    className="glass-card mb-2"
                    style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    <div className="d-flex justify-content-between mb-2">
                      <strong className="text-white">
                        Question {feedback.question_id}
                      </strong>
                      <Badge bg={feedback.correct ? 'success' : 'danger'}>
                        {feedback.points_awarded} points
                      </Badge>
                    </div>
                    <div className="text-white-50">
                      <strong>Explanation:</strong> {feedback.explanation}
                    </div>
                    {feedback.suggestions && (
                      <div className="text-white-50 mt-2">
                        <strong>Suggestions:</strong> {feedback.suggestions}
                      </div>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}

          {grade.recommended_study_materials && grade.recommended_study_materials.length > 0 && (
            <div className="mt-4">
              <h5 className="text-white">Recommended Study Materials:</h5>
              <ul className="text-white-50">
                {grade.recommended_study_materials.map((material, idx) => (
                  <li key={idx}>{material}</li>
                ))}
              </ul>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}

export default QuizResults;

