import React, { useState, useEffect } from 'react';
import { LuFolderOpen, LuUsers, LuChartBar, LuFileText, LuBook, LuTarget, LuSparkles } from 'react-icons/lu';
import { Badge, Button, Row, Col, Card } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import '../../teacherDashboard/styles/TeacherDashboard.css';
import DashboardHero from '../../shared/components/DashboardHero';
import { useAuth } from '../../auth/AuthContext';
import analyticsService from '../../shared/services/analyticsService';

const GroupsSection = ({
    groups,
    selectedGroup,
    onSelectGroup,
    onLeaveGroup,
    onJoinGroup,
    setActiveSection,
    performance
}) => {
    const { user } = useAuth();
    const [aiInsight, setAiInsight] = useState(null);
    const [loadingInsight, setLoadingInsight] = useState(false);

    // --- Analytics Data ---
    const perf = performance || {};

    const hasPerformanceData = perf?.performanceAcrossGroups?.length > 0;

    useEffect(() => {
        const fetchInsight = async () => {
            if (user?.id && hasPerformanceData) {
                setLoadingInsight(true);
                try {
                    const data = await analyticsService.getStudentPerformanceInsight(user.id);
                    if (data && data.insight) {
                        setAiInsight(data.insight);
                    }
                } catch (error) {
                    console.error("Failed to fetch AI insight:", error);
                } finally {
                    setLoadingInsight(false);
                }
            }
        };
        fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, perf?.totalQuizzesAttempted]);

    const performanceAcrossGroupsRaw = perf?.performanceAcrossGroups || [];
    const performanceAcrossGroupsData = performanceAcrossGroupsRaw.length > 0
        ? performanceAcrossGroupsRaw
        : groups.map(g => ({ groupName: g.name, averageScore: 0 }));

    const quizAttemptsDataRaw = perf?.quizAttemptsPerGroup || [];
    const quizAttemptsData = quizAttemptsDataRaw.length > 0
        ? quizAttemptsDataRaw
        : groups.map(g => ({ groupName: g.name, attempted: 0, missed: 0 }));

    const totalMaterials = groups.reduce((sum, g) => sum + (g.materials_count || 0), 0);
    const totalQuizzes = groups.reduce((sum, g) => sum + (g.quizzes_count || 0), 0);


    return (
        <div className="td-container" style={{ paddingTop: 0, minHeight: 'auto' }}>
            <div className="td-content">
                {/* Groups Section */}
                <div className="td-section">
                    <DashboardHero
                        icon={<LuFolderOpen />}
                        title="My Learning Groups"
                        subtitle="Access your class groups and view overall analytics."
                        primaryButton={{
                            text: "Join New Group",
                            icon: "+",
                            onClick: onJoinGroup
                        }}
                    />

                    {groups.length === 0 ? (
                        <div className="td-empty-state">
                            <div className="td-empty-icon"><LuUsers /></div>
                            <h3 className="td-empty-title">No Groups Joined</h3>
                            <p className="td-empty-text">Ask your teacher for a group code to join a class</p>
                            <button className="td-create-btn" onClick={onJoinGroup}>
                                + Join a Group
                            </button>
                        </div>
                    ) : (
                        <div className="td-groups-grid">
                            {groups.map((group) => (
                                <div
                                    key={group.id}
                                    className="sd-glass-card group-card hover-shadow"
                                    style={{
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        background: '#ffffff',
                                        border: '1px solid #eef2f6',
                                        borderRadius: '18px',
                                        padding: '1.5rem',
                                    }}
                                    onClick={() => {
                                        onSelectGroup(group);
                                        setActiveSection('overview');
                                    }}
                                >
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <h5 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '-0.01em' }}>{group.name}</h5>
                                        {selectedGroup?.id === group.id && (
                                            <Badge bg="primary" className="rounded-pill px-3 shadow-sm">Active</Badge>
                                        )}
                                    </div>

                                    {group.description && (
                                        <p className="text-muted small mb-4 line-clamp-2" style={{ lineHeight: '1.5' }}>{group.description}</p>
                                    )}

                                    <div className="bg-light rounded-4 p-3 mb-4">
                                        <div className="row g-0">
                                            <div className="col text-center border-end">
                                                <div className="text-primary fw-bold fs-5">{group.materials_count || 0}</div>
                                                <div className="text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Materials</div>
                                            </div>
                                            <div className="col text-center">
                                                <div className="text-success fw-bold fs-5">{group.quizzes_count || 0}</div>
                                                <div className="text-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Quizzes</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                                        <Button
                                            size="sm"
                                            className="rounded-pill px-4 py-2 fw-bold shadow-sm border-0"
                                            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontSize: '0.8rem' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectGroup(group);
                                                setActiveSection('overview');
                                            }}
                                        >
                                            View Group →
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="link"
                                            className="text-danger text-decoration-none small fw-bold p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onLeaveGroup(group);
                                            }}
                                        >
                                            Leave
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Analytics Section — only shown when groups exist */}
                {groups.length > 0 && (
                    <div className="td-section td-analytics-section">
                        <div className="td-section-header">
                            <h2 className="td-section-title">
                                <span className="td-title-icon"><LuChartBar /></span>
                                Overall Performance
                            </h2>
                        </div>

                        {/* Stats Cards Row */}
                        <div className="sd-stats-grid" style={{ marginBottom: '2rem' }}>
                            <div className="ds-chart-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#fff' }}><LuUsers /></div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{groups.length}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Groups Joined</div>
                                </div>
                            </div>
                            <div className="ds-chart-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#fff' }}><LuFileText /></div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{totalQuizzes}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Quizzes</div>
                                </div>
                            </div>
                            <div className="ds-chart-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#fff' }}><LuBook /></div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{totalMaterials}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Materials</div>
                                </div>
                            </div>
                            <div className="ds-chart-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#fff' }}><LuTarget /></div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{Math.round(perf.averageScore || 0)}%</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Avg Score</div>
                                </div>
                            </div>
                        </div>

                        {/* Analytics Charts */}
                        <div className="mt-4 pt-2">
                            <h4 className="sd-section-title mb-4" style={{ fontSize: '1.2rem' }}>Detailed Metrics</h4>

                            {/* AI Insight Section */}
                            {(loadingInsight || aiInsight) && (
                                <Card className="mb-4 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))', borderRadius: '18px', borderLeft: '4px solid #8b5cf6' }}>
                                    <Card.Body className="p-4 d-flex align-items-center gap-3">
                                        <div style={{ padding: '12px', borderRadius: '12px', background: '#8b5cf6', color: 'white', display: 'flex' }}>
                                            <LuSparkles size={24} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <h6 className="fw-bold mb-1" style={{ color: '#1e293b' }}>AI Performance Insight</h6>
                                            {loadingInsight ? (
                                                <div className="placeholder-glow">
                                                    <span className="placeholder col-8 rounded" style={{ backgroundColor: '#9ca3af' }}></span>
                                                    <span className="placeholder col-6 rounded" style={{ backgroundColor: '#9ca3af', marginLeft: '5px' }}></span>
                                                </div>
                                            ) : (
                                                <p className="mb-0 text-muted" style={{ lineHeight: '1.6', fontSize: '0.95rem' }}>{aiInsight}</p>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            )}

                            <Row>
                                <Col lg={6} className="mb-4">
                                    <Card className="sd-glass-card h-100 border-0 shadow-sm" style={{ background: '#ffffff', borderRadius: '18px' }}>
                                        <Card.Body className="p-4">
                                            <Card.Title className="fw-bold mb-4" style={{ fontSize: '1.1rem', color: '#1e293b' }}>Performance Across Groups</Card.Title>
                                            <div style={{ height: '300px' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={performanceAcrossGroupsData}
                                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                        <XAxis dataKey="groupName" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <YAxis unit="%" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                            formatter={(value) => [`${value}%`, 'Avg Score']}
                                                        />
                                                        <Bar dataKey="averageScore" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>

                                <Col lg={6} className="mb-4">
                                    <Card className="sd-glass-card h-100 border-0 shadow-sm" style={{ background: '#ffffff', borderRadius: '18px' }}>
                                        <Card.Body className="p-4">
                                            <Card.Title className="fw-bold mb-4" style={{ fontSize: '1.1rem', color: '#1e293b' }}>Quiz Attempts per Group</Card.Title>
                                            <div style={{ height: '300px' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={quizAttemptsData}
                                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                        <XAxis dataKey="groupName" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                        />
                                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                                        <Bar dataKey="attempted" name="Attempted" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} maxBarSize={50} />
                                                        <Bar dataKey="missed" name="Missed" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupsSection;
