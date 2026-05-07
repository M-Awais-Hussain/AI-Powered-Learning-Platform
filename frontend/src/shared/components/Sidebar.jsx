import React from 'react';
import { LuLayoutDashboard, LuUsers, LuFolder, LuFileText, LuArrowLeft } from 'react-icons/lu';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getTwoWordName } from '../utils/nameFormat';
import './Sidebar.css';

function Sidebar({ groupId, groupName }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const navItems = [
        { id: 'overview', label: 'Overview', icon: <LuLayoutDashboard />, path: `/teacher/group/${groupId}` },
        { id: 'students', label: 'Students', icon: <LuUsers />, path: `/teacher/group/${groupId}/students` },
        { id: 'materials', label: 'Materials', icon: <LuFolder />, path: `/teacher/group/${groupId}/materials` },
        { id: 'quizzes', label: 'Quizzes', icon: <LuFileText />, path: `/teacher/group/${groupId}/quizzes` },
    ];

    const isActive = (path) => {
        const currentPath = location.pathname;
        if (path === `/teacher/group/${groupId}` || path === `/teacher/group/${groupId}/`) {
            return currentPath === `/teacher/group/${groupId}` || currentPath === `/teacher/group/${groupId}/`;
        }
        return currentPath.startsWith(path);
    };

    const handleNavigate = (path) => {
        navigate(path);
    };

    return (
        <aside className="teacher-sidebar">
            <div className="sd-sidebar-header">
                <div className="sd-logo">

                </div>
            </div>
            <div className="sidebar-header">
                <div
                    className="back-nav-item mb-2"
                    onClick={() => navigate('/teacher')}
                >
                    <span className="nav-item-icon"><LuArrowLeft /></span>
                    <span className="nav-item-text fw-bold">Back to Dashboard</span>
                </div>

                <div className="sidebar-group-info">
                    <div className="sidebar-subtitle">Current Group</div>
                    <h3 className="sidebar-group-name">{groupName || 'Group'}</h3>
                </div>
            </div>


            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <div
                        key={item.id}
                        className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                        onClick={() => handleNavigate(item.path)}
                    >
                        <span className="nav-item-icon">{item.icon}</span>
                        <span className="nav-item-text">{item.label}</span>
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-divider"></div>
                <div className="user-profile">
                    <div className="user-avatar">
                        {user?.email?.charAt(0).toUpperCase() || 'T'}
                    </div>
                    <div className="user-info">
                        <div className="user-name text-truncate">{getTwoWordName(user?.full_name, user?.email || 'Teacher')}</div>
                        <div className="user-role">{user?.role || 'teacher'}</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
