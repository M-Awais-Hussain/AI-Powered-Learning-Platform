import React, { useState } from 'react';
import { LuMail, LuArrowLeft } from 'react-icons/lu';
import { Container, Form, Button, Alert, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../Modern.css';

function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);

        try {
            const response = await axios.post('/auth/forgot-password', { email });
            setSuccessMessage(response.data.message || 'Reset link sent to your email.');
        } catch (err) {
            setError(err.response?.data?.detail || 'An error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (successMessage) {
        return (
            <div className="modern-dashboard">
                <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                    <Card className="modern-card text-center p-5" style={{ width: '500px', boxShadow: 'var(--shadow-xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#3B82F6' }}><LuMail /></div>
                        <h3 className="mb-3">Check Your Email</h3>
                        <p className="mb-4 text-muted">{successMessage}</p>
                        <Button className="modern-btn modern-btn-primary" onClick={() => navigate('/login')}>
                            Back to Login
                        </Button>
                    </Card>
                </Container>
            </div>
        );
    }

    return (
        <div className="modern-dashboard">
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Card className="modern-card" style={{ width: '450px', boxShadow: 'var(--shadow-xl)' }}>
                    <Card.Body className="p-4">
                        <div className="mb-4">
                            <span 
                                onClick={() => navigate('/login')} 
                                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', marginBottom: '1rem' }}
                            >
                                <LuArrowLeft className="me-1" /> Back to login
                            </span>
                            <h2 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Forgot Password?</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Enter your email address and we'll send you a link to reset your password.
                            </p>
                        </div>

                        {error && <Alert variant="danger" className="modern-alert alert-danger">{error}</Alert>}

                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-4">
                                <Form.Label className="modern-form-label">Email Address</Form.Label>
                                <Form.Control
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="modern-form-control"
                                    placeholder="Enter your email address"
                                    disabled={loading}
                                />
                            </Form.Group>

                            <Button
                                type="submit"
                                className="w-100 modern-btn modern-btn-primary"
                                disabled={loading || !email}
                                style={{ padding: '0.75rem' }}
                            >
                                {loading ? 'Sending Request...' : 'Send Reset Link'}
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
}

export default ForgotPassword;
