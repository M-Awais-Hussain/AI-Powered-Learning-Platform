import React, { useState } from 'react';
import { LuCircleCheck } from 'react-icons/lu';
import { Container, Form, Button, Alert, Card } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../Modern.css';

function ResetPassword() {
    const navigate = useNavigate();
    const { token } = useParams();
    
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const validateForm = () => {
        if (newPassword.length < 8) {
            return "Password must be at least 8 characters.";
        }
        if (!/[A-Z]/.test(newPassword)) {
            return "Password must contain at least one uppercase letter.";
        }
        if (!/[0-9]/.test(newPassword)) {
            return "Password must contain at least one number.";
        }
        if (newPassword !== confirmPassword) {
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
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/auth/reset-password', { 
                token: token,
                new_password: newPassword 
            });
            setSuccessMessage(response.data.message || 'Password successfully updated.');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid or expired reset link. Please request a new one.');
        } finally {
            setLoading(false);
        }
    };

    if (successMessage) {
        return (
            <div className="modern-dashboard">
                <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                    <Card className="modern-card text-center p-5" style={{ width: '450px', boxShadow: 'var(--shadow-xl)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#10B981' }}><LuCircleCheck /></div>
                        <h3 className="mb-3">Password Updated</h3>
                        <p className="mb-4 text-muted">{successMessage}</p>
                        <Button className="modern-btn modern-btn-primary" onClick={() => navigate('/login')}>
                            Sign In Now
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
                        <div className="mb-4 text-center">
                            <h2 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Create New Password</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Enter a strong new password for your account.
                            </p>
                        </div>

                        {error && <Alert variant="danger" className="modern-alert alert-danger">{error}</Alert>}

                        <Form onSubmit={handleSubmit}>
                            <Form.Group className="mb-3">
                                <Form.Label className="modern-form-label">New Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    className="modern-form-control"
                                    placeholder="Enter new password"
                                    disabled={loading}
                                />
                                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                    Must be 8+ chars, with an uppercase letter and a number.
                                </small>
                            </Form.Group>

                            <Form.Group className="mb-4">
                                <Form.Label className="modern-form-label">Confirm New Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="modern-form-control"
                                    placeholder="Confirm new password"
                                    disabled={loading}
                                />
                            </Form.Group>

                            <Button
                                type="submit"
                                className="w-100 modern-btn modern-btn-primary"
                                disabled={loading}
                                style={{ padding: '0.75rem' }}
                            >
                                {loading ? 'Updating Password...' : 'Reset Password'}
                            </Button>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
}

export default ResetPassword;
