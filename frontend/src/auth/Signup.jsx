import React, { useState } from 'react';
import { LuGraduationCap, LuUser, LuBookOpen } from 'react-icons/lu';
import { Container, Form, Button, Alert, Card, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useToast } from '../shared/components/ToastProvider';
import '../Modern.css';

function Signup() {
    const { signup } = useAuth();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        fullName: '',
        password: '',
        confirmPassword: '',
        role: 'student'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const validateForm = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            return "Please enter a valid email address.";
        }
        if (formData.password.length < 8) {
            return "Password must be at least 8 characters.";
        }
        if (!/[A-Z]/.test(formData.password)) {
            return "Password must contain at least one uppercase letter.";
        }
        if (!/[0-9]/.test(formData.password)) {
            return "Password must contain at least one number.";
        }
        if (formData.password !== formData.confirmPassword) {
            return "Passwords do not match.";
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            showError(validationError);
            return;
        }

        setLoading(true);
        const result = await signup(
            formData.email, 
            formData.fullName, 
            formData.password, 
            formData.role
        );
        setLoading(false);

        if (result.success) {
            showSuccess('Account created successfully! Please check your email.');
            setSuccessMessage("Account created successfully! We've sent a verification link to your email address. Please verify your email before logging in.");
        } else {
            setError(result.error);
            showError(result.error);
        }
    };

    if (successMessage) {
        return (
            <div className="modern-dashboard">
                <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                    <Card className="modern-card text-center p-5" style={{ width: '500px', boxShadow: 'var(--shadow-xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#10B981' }}><LuGraduationCap /></div>
                        <h3 className="mb-3">Check Your Email</h3>
                        <p className="mb-4 text-muted">{successMessage}</p>
                        <Button className="modern-btn modern-btn-primary" onClick={() => navigate('/login')}>
                            Go to Login
                        </Button>
                    </Card>
                </Container>
            </div>
        );
    }

    return (
        <div className="modern-dashboard">
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', padding: '2rem 0' }}>
                <Card className="modern-card" style={{ width: '500px', boxShadow: 'var(--shadow-xl)' }}>
                    <Card.Body className="p-4">
                        <div className="text-center mb-4">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#374151' }}><LuGraduationCap /></div>
                            <h2 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Create Account</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Join the AI Learning Platform today
                            </p>
                        </div>

                        {error && <Alert variant="danger" className="modern-alert alert-danger">{error}</Alert>}

                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3">
                                <Form.Label className="modern-form-label">Full Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    required
                                    className="modern-form-control"
                                    placeholder="John Doe"
                                    disabled={loading}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label className="modern-form-label">Email Address</Form.Label>
                                <Form.Control
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    className="modern-form-control"
                                    placeholder="john@example.com"
                                    disabled={loading}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label className="modern-form-label">Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    className="modern-form-control"
                                    placeholder="Create a strong password"
                                    disabled={loading}
                                />
                                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                    Must be 8+ chars, with an uppercase letter and a number.
                                </small>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label className="modern-form-label">Confirm Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    required
                                    className="modern-form-control"
                                    placeholder="Confirm your password"
                                    disabled={loading}
                                />
                            </Form.Group>

                            <Form.Group className="mb-4">
                                <Form.Label className="modern-form-label">I am a</Form.Label>
                                <Row>
                                    <Col>
                                        <div
                                            onClick={() => !loading && setFormData({ ...formData, role: 'student' })}
                                            style={{
                                                padding: '1rem',
                                                border: `2px solid ${formData.role === 'student' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                borderRadius: 'var(--radius)',
                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                textAlign: 'center',
                                                backgroundColor: formData.role === 'student' ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                                                transition: 'var(--transition)'
                                            }}
                                        >
                                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#374151' }}><LuUser /></div>
                                            <strong>Student</strong>
                                        </div>
                                    </Col>
                                    <Col>
                                        <div
                                            onClick={() => !loading && setFormData({ ...formData, role: 'teacher' })}
                                            style={{
                                                padding: '1rem',
                                                border: `2px solid ${formData.role === 'teacher' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                borderRadius: 'var(--radius)',
                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                textAlign: 'center',
                                                backgroundColor: formData.role === 'teacher' ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                                                transition: 'var(--transition)'
                                            }}
                                        >
                                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#374151' }}><LuBookOpen /></div>
                                            <strong>Teacher</strong>
                                        </div>
                                    </Col>
                                </Row>
                            </Form.Group>

                            <Button
                                type="submit"
                                className="w-100 modern-btn modern-btn-primary mb-3"
                                disabled={loading}
                                style={{ padding: '0.75rem' }}
                            >
                                {loading ? 'Creating Account & Sending Email...' : 'Create Account'}
                            </Button>

                            <div className="text-center">
                                <small style={{ color: 'var(--text-secondary)' }}>
                                    Already have an account? <span onClick={() => !loading && navigate('/login')} style={{ color: 'var(--primary-color)', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>Sign In</span>
                                </small>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
}

export default Signup;
