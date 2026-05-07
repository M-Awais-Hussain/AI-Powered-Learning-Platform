import React, { useEffect, useState, useRef } from 'react';
import { LuCircleCheck, LuCircleX, LuLoaderCircle } from 'react-icons/lu';
import { Container, Card, Button } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../Modern.css';

function VerifyEmail() {
    const navigate = useNavigate();
    const { token } = useParams();
    
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('Verifying your email address...');
    
    // Use ref to prevent double-firing in React Strict Mode
    const verificationAttempted = useRef(false);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Verification token is missing from the URL.');
            return;
        }

        if (verificationAttempted.current) return;
        verificationAttempted.current = true;

        const verifyEmailToken = async () => {
            try {
                const response = await axios.get(`/auth/verify-email/${token}`);
                setStatus('success');
                setMessage(response.data.message || 'Email successfully verified!');
            } catch (err) {
                setStatus('error');
                setMessage(err.response?.data?.detail || 'The verification link is invalid or has expired.');
            }
        };

        verifyEmailToken();
    }, [token]);

    return (
        <div className="modern-dashboard">
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <Card className="modern-card text-center p-5" style={{ width: '450px', boxShadow: 'var(--shadow-xl)' }}>
                    
                    {status === 'verifying' && (
                        <>
                            <div className="mb-4" style={{ color: '#3B82F6', display: 'flex', justifyContent: 'center' }}>
                                <LuLoaderCircle size={64} className="spinner-border text-primary" style={{ animation: 'spin 1s linear infinite' }} />
                            </div>
                            <h3 className="mb-3">Verifying</h3>
                            <p className="mb-0 text-muted">{message}</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem', color: '#10B981' }}><LuCircleCheck /></div>
                            <h3 className="mb-3">Email Verified!</h3>
                            <p className="mb-4 text-muted">{message}</p>
                            <Button className="modern-btn modern-btn-primary w-100" onClick={() => navigate('/login')}>
                                Continue to Login
                            </Button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem', color: '#EF4444' }}><LuCircleX /></div>
                            <h3 className="mb-3">Verification Failed</h3>
                            <p className="mb-4 text-muted">{message}</p>
                            <Button className="modern-btn modern-btn-outline-primary mb-3 w-100" onClick={() => navigate('/signup')}>
                                Go to Signup
                            </Button>
                            <Button className="modern-btn modern-btn-outline-secondary w-100" onClick={() => navigate('/login')}>
                                Back to Login
                            </Button>
                        </>
                    )}
                    
                </Card>
            </Container>
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default VerifyEmail;
