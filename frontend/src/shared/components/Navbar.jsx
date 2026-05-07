import React, { useState } from 'react';
import { LuLink } from 'react-icons/lu';
import { Button } from 'react-bootstrap';
import { useAuth } from '../../auth/AuthContext';
import ConfirmModal from './ConfirmModal';
import './TopBar.css';

function Navbar({ onJoinGroupClick, onNotificationsClick, notificationsCount = 0 }) {
    const { user, logout } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const performLogout = () => {
        logout();
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <span className="topbar-title">
                    {user?.role === 'student' ? 'Student Dashboard' : 'Dashboard'}
                </span>
            </div>

            <div className="topbar-right">
                <Button
                    variant="link"
                    className="topbar-btn"
                    onClick={onNotificationsClick}
                    title="Notifications"
                >
                    
                    {notificationsCount > 0 && (
                        <span className="badge bg-danger ms-1">
                            {notificationsCount}
                        </span>
                    )}
                </Button>
                <Button
                    variant="link"
                    className="topbar-btn"
                    onClick={onJoinGroupClick}
                >
                    <LuLink style={{ marginRight: '0.25rem' }} /> Join Group
                </Button>
                <Button
                    variant="link"
                    className="topbar-btn"
                    onClick={handleLogout}
                >
                     Logout
                </Button>
            </div>
            <ConfirmModal
                isOpen={showLogoutConfirm}
                title="Confirm Logout"
                message="Are you sure you want to log out of your account?"
                confirmText="Logout"
                onConfirm={performLogout}
                onCancel={() => setShowLogoutConfirm(false)}
                variant="danger"
            />
        </header>
    );
}

export default Navbar;
