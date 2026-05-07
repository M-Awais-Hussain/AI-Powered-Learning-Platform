import React from 'react';
import { LuBook, LuFileText, LuTarget, LuTrendingUp, LuGraduationCap, LuTriangleAlert, LuCircleCheck, LuChartPie, LuActivity } from 'react-icons/lu';
import { Row, Col, Button, Spinner } from 'react-bootstrap';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import DashboardHero from '../../shared/components/DashboardHero';
import { SkeletonChart } from '../../shared/components/SkeletonLoader';

const Overview = ({
    groups,
    selectedGroup,
    performance,
    savedNotes,
    onJoinGroup,
    onSelectGroup,
    setActiveSection,
    groupAnalytics,
    analyticsLoading,
    fetchStudentGroupAnalytics
}) => {
    const loading = analyticsLoading;

    React.useEffect(() => {
        if (selectedGroup) {
            fetchStudentGroupAnalytics(selectedGroup.id);
        }
    }, [selectedGroup?.id, fetchStudentGroupAnalytics]);

    // If we're in a specific group view, show that group's overview
    if (selectedGroup) {
        const groupPerf = (performance?.groupStats || []).find((g) => g.group_id === selectedGroup.id);

        return (
            <div className="animate-fade-in">
                <DashboardHero
                    icon={<LuGraduationCap />}
                    eyebrow="Active Group"
                    title={selectedGroup.name}
                    subtitle={selectedGroup.description || 'Welcome to your group learning area.'}
                    stats={[
                        { icon: <LuBook />, value: selectedGroup.materials_count || 0, label: "Study Materials" },
                        { icon: <LuFileText />, value: selectedGroup.quizzes_count || 0, label: "Total Quizzes" },
                        { icon: <LuTarget />, value: `${groupPerf?.averageScore ? Math.round(groupPerf.averageScore) : 0}%`, label: "Your Avg. Score" },
                        { icon: <LuTrendingUp />, value: `${groupPerf?.completionRate || 0}%`, label: "Progress" }
                    ]}
                />

                <div className="mt-4">
                    <h4 className="sd-section-title mb-4">Personal Performance Analytics</h4>
                    
                    {loading ? (
                        <Row>
                            <Col lg={6} className="mb-4"><SkeletonChart /></Col>
                            <Col lg={6} className="mb-4"><SkeletonChart /></Col>
                            <Col lg={6} className="mb-4"><SkeletonChart /></Col>
                            <Col lg={6} className="mb-4"><SkeletonChart /></Col>
                        </Row>
                    ) : groupAnalytics ? (
                        <>
                            <Row>
                                {/* 1. Quiz Performance Over Time */}
                                <Col lg={6} className="mb-4">
                                    <div className="sd-glass-card h-100">
                                        <div className="d-flex align-items-center mb-3">
                                            <div className="sd-icon-box me-2" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                                                <LuActivity size={20} />
                                            </div>
                                            <h5 className="mb-0 fw-bold">Quiz Performance Over Time</h5>
                                        </div>
                                        <p className="text-secondary small mb-4">Learning Progress Trend</p>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer>
                                                <LineChart data={groupAnalytics.performanceOverTime}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                        formatter={(value) => [`${value}%`, 'Score']}
                                                    />
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="score" 
                                                        stroke="#2563eb" 
                                                        strokeWidth={3} 
                                                        dot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                                                        activeDot={{ r: 8, strokeWidth: 0 }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </Col>

                                {/* 2. Weak Topic Distribution */}
                                <Col lg={6} className="mb-4">
                                    <div className="sd-glass-card h-100">
                                        <div className="d-flex align-items-center mb-3">
                                            <div className="sd-icon-box me-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '8px' }}>
                                                <LuTriangleAlert size={20} />
                                            </div>
                                            <h5 className="mb-0 fw-bold">Weak Topic Distribution</h5>
                                        </div>
                                        <p className="text-secondary small mb-4">Topics Needing Improvement (Incorrect %)</p>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer>
                                                <BarChart data={groupAnalytics.weakTopicDistribution} layout="vertical" margin={{ left: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="topic" type="category" stroke="#64748b" fontSize={10} width={100} axisLine={false} tickLine={false} />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                        formatter={(value) => [`${value}%`, 'Incorrect']}
                                                    />
                                                    <Bar dataKey="incorrectPercentage" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </Col>
                            </Row>

                            <Row>
                                {/* 3. Topic Mastery Graph */}
                                <Col lg={6} className="mb-4">
                                    <div className="sd-glass-card h-100">
                                        <div className="d-flex align-items-center mb-3">
                                            <div className="sd-icon-box me-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '8px', borderRadius: '8px' }}>
                                                <LuCircleCheck size={20} />
                                            </div>
                                            <h5 className="mb-0 fw-bold">Topic Mastery Graph</h5>
                                        </div>
                                        <p className="text-secondary small mb-4">Strengths and Weaknesses (%)</p>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer>
                                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={groupAnalytics.topicMastery}>
                                                    <PolarGrid stroke="#e2e8f0" />
                                                    <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10, fill: '#64748b' }} />
                                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                                                    <Radar
                                                        name="Mastery"
                                                        dataKey="mastery"
                                                        stroke="#10b981"
                                                        fill="#10b981"
                                                        fillOpacity={0.6}
                                                    />
                                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </Col>

                                {/* 4. Correct vs Incorrect Answers */}
                                <Col lg={6} className="mb-4">
                                    <div className="sd-glass-card h-100">
                                        <div className="d-flex align-items-center mb-3">
                                            <div className="sd-icon-box me-2" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', padding: '8px', borderRadius: '8px' }}>
                                                <LuChartPie size={20} />
                                            </div>
                                            <h5 className="mb-0 fw-bold">Overall Accuracy</h5>
                                        </div>
                                        <p className="text-secondary small mb-4">Total Question Stats (This Group)</p>
                                        <div style={{ width: '100%', height: 300 }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie
                                                        data={groupAnalytics.correctVsIncorrect}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        <Cell fill="#10b981" /> {/* Correct */}
                                                        <Cell fill="#ef4444" /> {/* Incorrect */}
                                                        <Cell fill="#94a3b8" /> {/* Skipped */}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                                                    <Legend verticalAlign="bottom" height={36}/>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </>
                    ) : (
                        <div className="sd-glass-card text-center p-5">
                            <p className="text-secondary">No analytics data available for this group. Start by taking some quizzes!</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Default global overview if no group is selected
    if (groups.length === 0) {
        return (
            <div className="empty-state sd-glass-card">
                <div className="empty-state-icon"></div>
                <h4>No Groups Joined</h4>
                <p>Use the "Join Group" button above and enter a code from your teacher.</p>
                <Button onClick={onJoinGroup} className="sd-btn-primary">
                    Join a Group
                </Button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ marginTop: '20px' }}>
            <DashboardHero
                icon={<LuGraduationCap />}
                title="Student Dashboard"
                subtitle="Track your overall progress across all learning groups."
                primaryButton={{
                    text: "Join Group",
                    icon: "+",
                    onClick: onJoinGroup
                }}
                stats={[
                    { value: performance?.totalGroupsJoined || 0, label: "Groups Joined" },
                    { value: performance?.totalQuizzesAttempted || 0, label: "Quizzes Done" },
                    { value: `${performance?.averageScore ? Math.round(performance.averageScore) : 0}%`, label: "Avg. Score" },
                    { value: savedNotes?.length || 0, label: "Saved Notes" }
                ]}
            />

            {/* Group cards */}
            <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="sd-section-title mb-0">My Recent Groups</h4>
                    <Button variant="link" onClick={() => setActiveSection('groups')} className="text-decoration-none">View All</Button>
                </div>
                <Row>
                    {groups.slice(0, 3).map((group) => {
                        const groupPerf = (performance?.groupStats || []).find((g) => g.group_id === group.id);
                        return (
                            <Col md={4} key={group.id} className="mb-3">
                                <div
                                    className="sd-glass-card group-card h-100"
                                    onClick={() => {
                                        onSelectGroup(group);
                                        setActiveSection('materials');
                                    }}
                                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                    <h5 className="mb-2 fw-bold">{group.name}</h5>
                                    <div className="d-flex justify-content-between text-secondary small mb-3">
                                        <span> {group.materials_count || 0} Materials</span>
                                        <span> {group.quizzes_count || 0} Quizzes</span>
                                    </div>
                                    {groupPerf && (
                                        <div className="mb-2">
                                            <div className="d-flex justify-content-between small text-muted mb-1">
                                                <span>Progress</span>
                                                <span>{groupPerf.completionRate || 0}%</span>
                                            </div>
                                            <div className="progress" style={{ height: '6px' }}>
                                                <div
                                                    className="progress-bar bg-primary"
                                                    style={{ width: `${groupPerf.completionRate || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-secondary small mt-3 mb-0 text-truncate">{group.description || 'No description provided'}</p>
                                </div>
                            </Col>
                        );
                    })}
                </Row>
            </div>
        </div>
    );
};

export default Overview;
