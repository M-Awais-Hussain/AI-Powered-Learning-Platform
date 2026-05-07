import React, { useState, useEffect } from 'react';
import { LuChartBar, LuTrendingUp, LuSparkles } from 'react-icons/lu';
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import { Card } from 'react-bootstrap';
import analyticsService from '../services/analyticsService';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function ChartSection({ groups = [], analytics = {}, loading = false }) {
    const userId = localStorage.getItem('user_id');
    const [aiInsight, setAiInsight] = useState(null);
    const [loadingInsight, setLoadingInsight] = useState(false);

    useEffect(() => {
        const fetchInsight = async () => {
            if (userId && groups?.length > 0) {
                setLoadingInsight(true);
                try {
                    const data = await analyticsService.getTeacherPerformanceInsight(userId);
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
    }, [userId, groups?.length]);

    const studentsPerGroup = Array.isArray(groups) ? groups.map(g => ({
        name: (g?.name || 'Unknown').length > 12 ? (g?.name || 'Unknown').substring(0, 12) + '...' : (g?.name || 'Unknown'),
        students: g?.member_count || 0
    })) : [];

    const groupGrowthTrend = analytics?.groupGrowthTrend || [];

    // Extract all group names that appeared in the growth trend to render dynamic lines
    const groupsInGrowthTrend = new Set();
    groupGrowthTrend.forEach(point => {
        Object.keys(point).forEach(key => {
            if (key !== 'quizIndex' && key !== 'timestamp') {
                groupsInGrowthTrend.add(key);
            }
        });
    });
    const growthTrendLineKeys = Array.from(groupsInGrowthTrend);

    if (loading) {
        return (
            <div className="chart-section-loading">
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading charts...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ds-analytics-container">
            {/* AI Insight Section */}
            {(loadingInsight || aiInsight) && (
                <Card className="mb-4 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))', borderRadius: '18px', borderLeft: '4px solid #8b5cf6' }}>
                    <Card.Body className="p-4 d-flex align-items-center gap-3">
                        <div style={{ padding: '12px', borderRadius: '12px', background: '#8b5cf6', color: 'white', display: 'flex' }}>
                            <LuSparkles size={24} />
                        </div>
                        <div className="flex-grow-1">
                            <h6 className="fw-bold mb-1" style={{ color: '#1e293b' }}>AI Class Analysis Insight</h6>
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

            <div className="ds-grid">
                <div className="ds-chart-wrapper">
                    <div className="ds-chart-card">
                        <h4 className="ds-chart-title"><LuChartBar style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Students per Group</h4>
                        {studentsPerGroup.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={studentsPerGroup}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#64748b" fontSize={12} />
                                    <YAxis stroke="#64748b" fontSize={12} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Legend />
                                    <Bar dataKey="students" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="ds-empty-chart">No data available</div>
                        )}
                    </div>
                </div>

                <div className="ds-chart-wrapper">
                    <div className="ds-chart-card">
                        <h4 className="ds-chart-title"><LuTrendingUp style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Group Growth Trend</h4>
                        {groupGrowthTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={groupGrowthTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="quizIndex" stroke="#64748b" fontSize={12} />
                                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                                    <Tooltip />
                                    <Legend />
                                    {growthTrendLineKeys.map((groupName, index) => (
                                        <Line 
                                            key={groupName}
                                            type="monotone" 
                                            dataKey={groupName} 
                                            stroke={COLORS[index % COLORS.length]} 
                                            strokeWidth={3} 
                                            dot={{ fill: COLORS[index % COLORS.length], r: 4, strokeWidth: 2, stroke: '#fff' }} 
                                            activeDot={{ r: 6, strokeWidth: 0 }} 
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="ds-empty-chart">No quiz growth data available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChartSection;
