import React from 'react';
import '../styles/DashboardHero.css';

/**
 * DashboardHero
 * Used across Student and Teacher dashboards as the primary hero section.
 * 
 * Props:
 * - icon: ReactNode (e.g. <LuLayoutDashboard />)
 * - title: string
 * - subtitle: string
 * - rightContent: ReactNode (For code copy badges or custom elements)
 * - primaryButton: object { text: string, icon: ReactNode, onClick: function, className: string }
 * - secondaryButton: object { text: string, icon: ReactNode, onClick: function, className: string }
 * - stats: array of { value: string|number, label: string, icon: ReactNode }
 */
const DashboardHero = ({
    icon,
    eyebrow,
    title,
    subtitle,
    rightContent,
    primaryButton,
    secondaryButton,
    stats,
    actions
}) => {

    // Determine the grid columns class for stats based on the count
    const getStatsClass = () => {
        if (!stats) return '';
        if (stats.length === 3) return 'hero-stats hero-stats-3';
        if (stats.length === 2) return 'hero-stats hero-stats-2';
        return 'hero-stats'; // defaults to 4 cols
    };

    return (
        <div className="hero">
            {/* Decorative Blobs */}
            <div className="hero-blob1"></div>
            <div className="hero-blob2"></div>

            {/* Top Row: Icon, Text, Buttons */}
            <div className="hero-top">
                <div className="hero-left">
                    {icon && (
                        <div className="hero-icon">
                            {icon}
                        </div>
                    )}
                    <div className="hero-text">
                        {eyebrow && <div className="hero-eyebrow">{eyebrow}</div>}
                        <h1 className="hero-title">{title}</h1>
                        {subtitle && <p className="hero-sub">{subtitle}</p>}
                    </div>
                </div>

                <div className="hero-actions">
                    {rightContent && (
                        <div className="hero-custom-content">
                            {rightContent}
                        </div>
                    )}
                    {actions && (
                        <div className="hero-custom-actions">
                            {actions}
                        </div>
                    )}
                    {secondaryButton && (
                        <button
                            className={secondaryButton.className || "hero-btn-g"}
                            onClick={secondaryButton.onClick}
                        >
                            {secondaryButton.icon && <span>{secondaryButton.icon}</span>}
                            {secondaryButton.text}
                        </button>
                    )}
                    {primaryButton && (
                        <button
                            className={primaryButton.className || "hero-btn-w"}
                            onClick={primaryButton.onClick}
                        >
                            {primaryButton.icon && <span>{primaryButton.icon}</span>}
                            {primaryButton.text}
                        </button>
                    )}
                </div>
            </div>

            {/* Divider and Stats */}
            {stats && stats.length > 0 && (
                <>
                    <div className="hero-divider"></div>
                    <div className={getStatsClass()}>
                        {stats.map((stat, index) => (
                            <div className="hero-stat" key={index}>
                                <div className="hero-stat-top">
                                    <div className="hero-stat-info">
                                        <div className="hero-stat-value">{stat.value}</div>
                                        <div className="hero-stat-label">{stat.label}</div>
                                    </div>
                                    {stat.icon && (
                                        <div className="hero-stat-icon">{stat.icon}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default DashboardHero;
