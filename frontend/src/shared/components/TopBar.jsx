import React, { useState } from 'react';
import { LuGraduationCap, LuPlus, LuUser, LuLogOut } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useAuth } from '../../auth/AuthContext';
import ConfirmModal from './ConfirmModal';
import './TopBar.css';

function TopBar({ title = 'Teacher Dashboard', showCreateButton = false, onCreateGroup }) {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const performLogout = () => {
        logout();
        navigate('/login');
    };

    const handleProfile = () => {
        navigate('/profile');
    };
    
    const handleLogoClick = () => {
        navigate('/');
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <div className="topbar-logo" onClick={handleLogoClick} role="button" tabIndex="0">
                    <span><LuGraduationCap /></span>
                    <span>LearningApp</span>
                </div>
            </div>

            <div className="topbar-center">
                <h1 className="topbar-title">{title}</h1>
            </div>

            <div className="topbar-right">
                {showCreateButton && (
                    <Button
                        variant="primary"
                        className="topbar-btn create-group-btn"
                        onClick={onCreateGroup}
                    >
                        <LuPlus style={{ marginRight: '0.25rem' }} /> Create Group
                    </Button>
                )}
                <button
                    className="topbar-btn profile-btn"
                    onClick={handleProfile}
                >
                    <LuUser style={{ marginRight: '0.25rem' }} /> Profile
                </button>
                <button
                    className="topbar-btn logout-btn"
                    onClick={handleLogout}
                >
                    <LuLogOut style={{ marginRight: '0.25rem' }} /> Logout
                </button>
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

export default TopBar;
