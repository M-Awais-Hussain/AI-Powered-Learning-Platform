import React from 'react';
import { LuUsers, LuHouse, LuBook, LuFileText, LuBot, LuArrowLeft } from 'react-icons/lu';
import { useAuth } from '../../auth/AuthContext';
import { getTwoWordName } from '../../shared/utils/nameFormat';
import '../styles/StudentDashboard.css';

const StudentSidebar = ({ activeSection, setActiveSection, groupName }) => {
    const { user } = useAuth();

    const mainItems = [
        { id: 'groups', label: 'My Groups', icon: <LuUsers /> },
    ];

    const groupItems = [
        { id: 'overview', label: 'Group Overview', icon: <LuHouse /> },
        { id: 'materials', label: 'Materials', icon: <LuBook /> },
        { id: 'quizzes', label: 'Quizzes', icon: <LuFileText /> },
        { id: 'tutor', label: 'AI Tutor', icon: <LuBot /> },
    ];

    return (
        <aside className="sd-sidebar">
            <div className="sd-sidebar-header">
                <div className="sd-logo">

                </div>
            </div>

            <nav className="sd-nav">

                {groupName ? (
                    <>
                        <div
                            className="sd-nav-item mb-4"
                            onClick={() => setActiveSection('groups')}
                            style={{
                                background: 'rgba(37, 99, 235, 0.08)',
                                color: 'var(--sd-primary)',
                                borderRadius: '14px',
                                border: '1px solid rgba(37, 99, 235, 0.1)'
                            }}
                        >
                            <span className="sd-nav-icon"><LuArrowLeft /></span>
                            <span className="sd-nav-text fw-bold">Back to Groups</span>
                        </div>

                        <div className="px-3 mb-2 small text-uppercase fw-bold"
                            style={{ fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.08em' }}>
                            Current Group
                        </div>

                        <div className="px-3 mb-5 fw-bold text-dark text-truncate"
                            style={{ fontSize: '0.9rem' }}>
                            {groupName}
                        </div>

                        {groupItems.map(item => (
                            <div
                                key={item.id}
                                className={`sd-nav-item ${activeSection === item.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(item.id)}
                            >
                                <span className="sd-nav-icon">{item.icon}</span>
                                <span className="sd-nav-text">{item.label}</span>
                            </div>
                        ))}
                    </>
                ) : (

                    mainItems.map(item => (
                        <div
                            key={item.id}
                            className={`sd-nav-item ${activeSection === item.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(item.id)}
                        >
                            <span className="sd-nav-icon">{item.icon}</span>
                            <span className="sd-nav-text">{item.label}</span>
                        </div>
                    ))

                )}

            </nav>

            <div className="sd-sidebar-footer">
                <div className="sd-sidebar-divider"></div>
                <div className="sd-user-profile">
                    <div className="sd-user-avatar">
                        {user?.email?.charAt(0).toUpperCase() || 'S'}
                    </div>
                    <div className="sd-user-info">
                        <div className="sd-user-name text-truncate">{getTwoWordName(user?.full_name, user?.email || 'Student')}</div>
                        <div className="sd-user-role">{user?.role || 'student'}</div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default StudentSidebar;