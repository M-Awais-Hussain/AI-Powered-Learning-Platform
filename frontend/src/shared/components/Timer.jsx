import React, { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import './Timer.css';

function Timer({ endTime, onTimeUp, startTime = null }) {
    const [timeLeft, setTimeLeft] = useState(null);
    const [warningShown, setWarningShown] = useState(false);

    useEffect(() => {
        if (!endTime) return;

        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = endTime - now;

            if (remaining <= 0) {
                setTimeLeft(0);
                if (onTimeUp && !warningShown) {
                    setWarningShown(true);
                    onTimeUp();
                }
                return;
            }

            setTimeLeft(remaining);

            if (remaining <= 300 && !warningShown) {
                setWarningShown(true);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [endTime, onTimeUp, warningShown]);

    if (timeLeft === null) {
        return null;
    }

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    };

    const isWarning = timeLeft <= 300 && timeLeft > 0;
    const isDanger = timeLeft <= 60 && timeLeft > 0;
    const isExpired = timeLeft === 0;

    return (
        <div className={`timer-container ${isExpired ? 'timer-expired' : isDanger ? 'timer-danger' : isWarning ? 'timer-warning' : ''}`}>
            <Alert variant={isExpired ? 'danger' : isDanger ? 'danger' : isWarning ? 'warning' : 'info'} className="timer-alert">
                <div className="timer-content">
                    <span className="timer-icon">⏱️</span>
                    <div className="timer-text">
                        <div className="timer-label">
                            {isExpired ? 'Time\'s Up!' : 'Time Remaining'}
                        </div>
                        <div className="timer-value">{formatTime(timeLeft)}</div>
                    </div>
                </div>
                {isWarning && !isDanger && (
                    <div className="timer-message">
                         Less than 5 minutes remaining!
                    </div>
                )}
                {isDanger && (
                    <div className="timer-message">
                         Less than 1 minute remaining! Quiz will auto-submit soon.
                    </div>
                )}
                {isExpired && (
                    <div className="timer-message">
                        Quiz has ended. Your answers have been auto-submitted.
                    </div>
                )}
            </Alert>
        </div>
    );
}

export default Timer;
