import React from 'react';
import { LuHouse, LuBook, LuFileText, LuBot } from 'react-icons/lu';
import '../styles/StudentDashboard.css';

const BottomBar = ({ activeSection, setActiveSection, hasSelectedGroup }) => {

    const groupItems = [
        { id: 'overview', label: 'Home', icon: <LuHouse /> },
        { id: 'materials', label: 'Materials', icon: <LuBook /> },
        { id: 'quizzes', label: 'Quizzes', icon: <LuFileText /> },
        { id: 'tutor', label: 'AI Tutor', icon: <LuBot /> },
    ];

    // show bottom bar ONLY if group selected
    if (!hasSelectedGroup) return null;

    return (
        <nav className="sd-bottom-bar">
            <div className="sd-bottom-bar-items">
                {groupItems.map((item) => (
                    <button
                        key={item.id}
                        className={`sd-bottom-bar-item ${activeSection === item.id ? 'active' : ''}`}
                        onClick={() => setActiveSection(item.id)}
                        title={item.label}
                        aria-label={item.label}
                    >
                        <span className="sd-bottom-bar-icon">{item.icon}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default BottomBar;