import React, { useState, useEffect } from 'react';
import { LuGraduationCap, LuEye, LuEyeOff } from 'react-icons/lu';
import { Container, Form, Button, Alert, Card } from 'react-bootstrap';
import { useAuth } from './AuthContext';
import { useToast } from '../shared/components/ToastProvider';
import { useNavigate } from 'react-router-dom';
import '../Modern.css';

function Login({ onLogin }) {
    const { login } = useAuth();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const savedEmail = localStorage.getItem('remembered_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password);
        setLoading(false);

        if (result.success) {
            if (rememberMe) {
                localStorage.setItem('remembered_email', email);
            } else {
                localStorage.removeItem('remembered_email');
            }
            
            showSuccess('Login successful!');
            const userInfo = {
                id: localStorage.getItem('user_id'),
                role: localStorage.getItem('user_role'),
                email: localStorage.getItem('email')
            };
            if (onLogin) {
                onLogin(userInfo);
            }
        } else {
            setError(result.error);
            showError(result.error);
        }
    };

    return (
        <div className="modern-dashboard">
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Card className="modern-card" style={{ width: '450px', boxShadow: 'var(--shadow-xl)' }}>
                    <Card.Body className="p-4">
                        <div className="text-center mb-4">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#374151' }}><LuGraduationCap /></div>
                            <h2 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Welcome Back</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                Sign in to your AI Learning Platform account
                            </p>
                        </div>

                        {error && <Alert variant="danger" className="modern-alert alert-danger">{error}</Alert>}

                        <Form onSubmit={handleLogin}>
                            <Form.Group className="mb-3">
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

                            <Form.Group className="mb-3 position-relative">
                                <div className="d-flex justify-content-between align-items-center">
                                    <Form.Label className="modern-form-label mb-0">Password</Form.Label>
                                    <span 
                                        style={{ fontSize: '0.8rem', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 500 }}
                                        onClick={() => navigate('/forgot-password')}
                                    >
                                        Forgot Password?
                                    </span>
                                </div>
                                <div className="position-relative mt-2">
                                    <Form.Control
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="modern-form-control pe-5"
                                        placeholder="Enter your password"
                                        disabled={loading}
                                    />
                                    <div 
                                        className="position-absolute d-flex align-items-center justify-content-center" 
                                        style={{ right: '10px', top: '0', bottom: '0', cursor: 'pointer', color: '#6b7280' }}
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                                    </div>
                                </div>
                            </Form.Group>

                            <Form.Group className="mb-4">
                                <Form.Check
                                    type="checkbox"
                                    id="remember-me"
                                    label="Remember Me"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}
                                />
                            </Form.Group>

                            <Button
                                type="submit"
                                className="w-100 modern-btn modern-btn-primary mb-3"
                                disabled={loading}
                                style={{ padding: '0.75rem' }}
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </Button>

                            <div className="text-center">
                                <small style={{ color: 'var(--text-secondary)' }}>
                                    Don't have an account? <span onClick={() => navigate('/signup')} style={{ color: 'var(--primary-color)', fontWeight: 500, cursor: 'pointer' }}>Create Account</span>
                                </small>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>
            </Container>
        </div>
    );
}

export default Login;
