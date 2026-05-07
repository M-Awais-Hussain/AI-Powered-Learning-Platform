import React, { useState, useEffect, useCallback } from 'react';
import { LuSearch, LuUsers, LuActivity, LuTrendingUp, LuCircleAlert, LuBrain, LuCircleCheck, LuCircleX } from 'react-icons/lu';
import { Table, Button, Badge, Card, Form, InputGroup, Spinner } from 'react-bootstrap';
import groupsService from '../../shared/services/groupsService';
import analyticsService from '../../shared/services/analyticsService';
import { useToast } from '../../shared/components/ToastProvider';
import DashboardHero from '../../shared/components/DashboardHero';
import { getTwoWordName } from '../../shared/utils/nameFormat';
import '../styles/ManageStudents.css';

function ManageStudents({ groupId }) {
    const { showSuccess, showError } = useToast();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedStudent, setExpandedStudent] = useState(null);
    const [studentAnalytics, setStudentAnalytics] = useState({});
    const [quizInsights, setQuizInsights] = useState({});
    const [loadingInsights, setLoadingInsights] = useState({});
    const [expandedQuiz, setExpandedQuiz] = useState(null);

    const fetchStudents = useCallback(async () => {
        try {
            setLoading(true);
            const data = await groupsService.getGroupMembers(groupId);
            setStudents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch students:', err);
            showError('Failed to load students.');
        } finally {
            setLoading(false);
        }
    }, [groupId, showError]);

    useEffect(() => {
        if (groupId) {
            fetchStudents();
        }
    }, [groupId, fetchStudents]);

    const handleRemoveStudent = async (studentId, studentName) => {
        if (window.confirm(`Are you sure you want to remove ${studentName} from this group?`)) {
            try {
                await groupsService.removeMember(groupId, studentId);
                showSuccess(`${studentName} removed successfully.`);
                fetchStudents();
            } catch (err) {
                console.error('Failed to remove student:', err);
                showError('Failed to remove student.');
            }
        }
    };

    const fetchStudentDetails = async (studentId) => {
        if (studentAnalytics[studentId]) return;

        try {
            const results = await analyticsService.getStudentQuizRecords(studentId, groupId);
            setStudentAnalytics(prev => ({ ...prev, [studentId]: results }));
        } catch (err) {
            console.error('Failed to fetch student results:', err);
            showError('Failed to load quiz records.');
        }
    };

    const fetchQuizInsights = async (submissionId) => {
        if (quizInsights[submissionId]) {
            setExpandedQuiz(expandedQuiz === submissionId ? null : submissionId);
            return;
        }

        try {
            setLoadingInsights(prev => ({ ...prev, [submissionId]: true }));
            setExpandedQuiz(submissionId);
            const insights = await analyticsService.getQuizInsights(submissionId);
            setQuizInsights(prev => ({ ...prev, [submissionId]: insights }));
        } catch (err) {
            console.error('Failed to fetch quiz insights:', err);
            showError('Failed to generate AI insights.');
        } finally {
            setLoadingInsights(prev => ({ ...prev, [submissionId]: false }));
        }
    };

    const filteredStudents = students.filter(student =>
        (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleAnalytics = (studentId) => {
        if (expandedStudent === studentId) {
            setExpandedStudent(null);
        } else {
            setExpandedStudent(studentId);
            fetchStudentDetails(studentId);
        }
    };

    const stats = [
        {
            value: students.length,
            label: 'Total students',
            icon: <LuUsers />
        },
        {
            value: students.filter(s => s.quiz_count > 0).length,
            label: 'Active',
            icon: <LuActivity />
        },
        {
            value: students.length > 0 ? `${Math.round(students.reduce((acc, s) => acc + (s.avg_score || 0), 0) / students.length)}%` : '0%',
            label: 'Avg score',
            icon: <LuTrendingUp />
        },
        {
            value: students.filter(s => (s.avg_score || 0) < 40).length,
            label: 'Need attention',
            icon: <LuCircleAlert />
        }
    ];

    return (
        <div className="ms-container">
            <DashboardHero
                icon={<LuUsers />}
                title="Students Management"
                subtitle="Manage group members and track individual performance"
                stats={stats}
            />

            <div className="ms-list-header">
                <div className="ms-list-title-box">
                    <h3 className="ms-list-title">All Students</h3>
                    <p className="ms-list-subtitle">{students.length} members in this group</p>
                </div>
                <div className="ms-list-actions">
                    <InputGroup className="ms-search-input-alt">
                        <InputGroup.Text><LuSearch /></InputGroup.Text>
                        <Form.Control
                            placeholder="Search students..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </div>
            </div>

            <Card className="ms-card">
                <Table responsive hover className="ms-table">
                    <thead>
                        <tr>
                            <th>STUDENT</th>
                            <th>QUIZZES</th>
                            <th>AVG SCORE</th>
                            <th>JOINED DATE</th>
                            <th className="text-end">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center py-5 text-muted">
                                    {students.length === 0 ? 'No students enrolled yet.' : 'No students found matching your search.'}
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map((student) => (
                                <React.Fragment key={student.id}>
                                    <tr className={expandedStudent === student.id ? 'ms-row-expanded' : ''}>
                                        <td>
                                            <div className="ms-student-info">
                                                <div className="ms-avatar">
                                                    {(student.name || student.email || 'U')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="ms-student-name">{getTwoWordName(student.name, student.email)}</div>
                                                    <div className="ms-student-email">{student.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge bg="light" text="dark" className="ms-badge">
                                                {student.quiz_count || 0} Quizzes
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="ms-score-cell">
                                                <span className={`ms-score-value ${student.avg_score >= 80 ? 'high' : student.avg_score >= 50 ? 'med' : 'low'}`}>
                                                    {student.avg_score || 0}%
                                                </span>
                                                <div className="ms-mini-progress">
                                                    <div
                                                        className="ms-mini-progress-fill"
                                                        style={{
                                                            width: `${student.avg_score || 0}%`,
                                                            backgroundColor: student.avg_score >= 80 ? '#10b981' : student.avg_score >= 50 ? '#f59e0b' : '#ef4444'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="ms-date">
                                                {student.joined_date ? new Date(student.joined_date * 1000).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <div className="ms-row-actions">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="me-2 ms-btn-action"
                                                    onClick={() => toggleAnalytics(student.id)}
                                                >
                                                    {expandedStudent === student.id ? 'Close' : 'Analytics'}
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    className="ms-btn-action"
                                                    onClick={() => handleRemoveStudent(student.id, student.name || student.email)}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedStudent === student.id && (
                                        <tr className="ms-analytics-row">
                                            <td colSpan="5">
                                                <div className="ms-analytics-content">
                                                    <div className="ms-analytics-header-alt">
                                                        <h6 className="mb-0">Quiz Performance Details</h6>
                                                        <Badge bg="primary" pill>{studentAnalytics[student.id]?.length || 0} Attempts</Badge>
                                                    </div>
                                                    
                                                    <Table responsive className="ms-sub-table mt-3">
                                                        <thead>
                                                            <tr>
                                                                <th>QUIZ NAME</th>
                                                                <th>DATE</th>
                                                                <th>SCORE</th>
                                                                <th>STATISTICS</th>
                                                                <th className="text-end">AI INSIGHTS</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {!studentAnalytics[student.id] ? (
                                                                <tr>
                                                                    <td colSpan="5" className="text-center py-4">
                                                                        <Spinner animation="border" size="sm" variant="primary" />
                                                                    </td>
                                                                </tr>
                                                            ) : studentAnalytics[student.id].length === 0 ? (
                                                                <tr>
                                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                                        No quizzes attempted in this group yet.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                studentAnalytics[student.id].map((record) => (
                                                                    <React.Fragment key={record.submission_id}>
                                                                        <tr className="ms-sub-row">
                                                                            <td>
                                                                                <span className="fw-medium">{record.quiz_name}</span>
                                                                            </td>
                                                                            <td>
                                                                                <span className="text-muted small">
                                                                                    {new Date(record.date * 1000).toLocaleDateString()}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <Badge bg={record.score >= 80 ? 'success' : record.score >= 50 ? 'warning' : 'danger'}>
                                                                                    {record.score}%
                                                                                </Badge>
                                                                            </td>
                                                                            <td>
                                                                                <div className="d-flex align-items-center gap-3">
                                                                                    <span className="text-success d-flex align-items-center gap-1">
                                                                                        <LuCircleCheck size={14} /> {record.correct_count}
                                                                                    </span>
                                                                                    <span className="text-danger d-flex align-items-center gap-1">
                                                                                        <LuCircleX size={14} /> {record.incorrect_count}
                                                                                    </span>
                                                                                    <span className="text-muted small">
                                                                                        Total: {record.total_questions}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-end">
                                                                                <Button 
                                                                                    variant="link" 
                                                                                    size="sm" 
                                                                                    className="p-0 text-decoration-none d-flex align-items-center gap-1 ms-auto"
                                                                                    onClick={() => fetchQuizInsights(record.submission_id)}
                                                                                    disabled={loadingInsights[record.submission_id]}
                                                                                >
                                                                                    {loadingInsights[record.submission_id] ? (
                                                                                        <Spinner animation="border" size="sm" />
                                                                                    ) : (
                                                                                        <>
                                                                                            <LuBrain className="text-purple" />
                                                                                            <span>{expandedQuiz === record.submission_id ? 'Hide' : 'View AI Insights'}</span>
                                                                                        </>
                                                                                    )}
                                                                                </Button>
                                                                            </td>
                                                                        </tr>
                                                                        {expandedQuiz === record.submission_id && quizInsights[record.submission_id] && (
                                                                            <tr className="ms-insight-expanded-row">
                                                                                <td colSpan="5">
                                                                                    <div className="ms-insight-box">
                                                                                        <div className="ms-insight-section">
                                                                                            <h6><LuBrain className="me-2 text-purple" />Weak Topics Identified</h6>
                                                                                            <div className="d-flex flex-wrap gap-2 mt-2">
                                                                                                {quizInsights[record.submission_id].weak_topics.length > 0 ? (
                                                                                                    quizInsights[record.submission_id].weak_topics.map((t, idx) => (
                                                                                                        <Badge key={idx} bg="light" text="dark" className="border">
                                                                                                            {t.topic} ({t.mastery}%)
                                                                                                        </Badge>
                                                                                                    ))
                                                                                                ) : (
                                                                                                    <span className="text-success small">Fantastic! No weak topics identified in this quiz.</span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="ms-insight-section mt-3">
                                                                                            <h6>Areas Needing Attention</h6>
                                                                                            <p className="ms-attention-text mt-1">
                                                                                                {quizInsights[record.submission_id].attention_areas}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </Table>
            </Card>
        </div>
    );
}

export default ManageStudents;
