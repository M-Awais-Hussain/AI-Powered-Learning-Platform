import React, { useState, useEffect, useCallback } from 'react';
import { LuBrain, LuLayoutDashboard, LuCopy, LuUsers, LuBook, LuFileText, LuTarget, LuTrendingUp, LuChartBar } from 'react-icons/lu';
import api from '../../shared/services/api';
import { Row, Col } from 'react-bootstrap';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import { useToast } from '../../shared/components/ToastProvider';
import DashboardHero from '../../shared/components/DashboardHero';
import { SkeletonChart, SkeletonLeaderboard } from '../../shared/components/SkeletonLoader';
import '../styles/GroupOverview.css';

function GroupOverview({ group }) {
  const { showSuccess, showError } = useToast();

  const [analytics, setAnalytics] = useState({
    classPerformance: [],
    courseProgress: [],
    studentProgress: [],
    weakAreas: [],
    lastUpdated: null
  });
  const [loading, setLoading] = useState(true);

  const groupId = group?.id;

  // Fetch analytics for charts (fast path — no LLM)
  const fetchAnalytics = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const response = await api.get(`/analytics/${groupId}`);
      const data = response.data || {};
      setAnalytics(prev => ({
        ...prev,
        averageScoreOverTime: Array.isArray(data.averageScoreOverTime) ? data.averageScoreOverTime : [],
        topicPerformance: Array.isArray(data.topicPerformance) ? data.topicPerformance : (prev?.topicPerformance || []),
        scoreDistribution: Array.isArray(data.scoreDistribution) ? data.scoreDistribution : [],
        studentPerformance: Array.isArray(data.studentPerformance) ? data.studentPerformance : [],
        weakAreas: Array.isArray(data.weakAreas) ? data.weakAreas : (prev?.weakAreas || []),
        lastUpdated: data.last_updated || null
      }));
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Lazily fetch topic performance (LLM-dependent, cached separately)
  const fetchTopics = useCallback(async () => {
    if (!groupId) return;
    try {
      const response = await api.get(`/analytics/${groupId}/topics`);
      const data = response.data || {};
      setAnalytics(prev => ({
        ...prev,
        topicPerformance: Array.isArray(data.topicPerformance) ? data.topicPerformance : [],
        weakAreas: Array.isArray(data.weakAreas) ? data.weakAreas : []
      }));
    } catch (err) {
      console.error('Failed to fetch topic performance:', err);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      // Load core analytics first (fast — no LLM), then topics in background
      fetchAnalytics().then(() => fetchTopics());
    }
  }, [groupId, fetchAnalytics, fetchTopics]);


  const handleCopyCode = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    try {
      const code = group?.code || '';
      if (!code) {
        throw new Error('No code available');
      }

      let copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(code);
          copied = true;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed, falling back', clipboardErr);
        }
      }

      if (!copied) {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed"; // Prevents scrolling
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Fallback copy failed');
        }
      }
      
      showSuccess('Group code copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy code:', err);
      if (showError) {
        showError('Failed to copy group code. Please try manually.');
      }
    }
  };


  return (
    <div className="ov-container">
      {/* Hero Section */}
      <DashboardHero 
        icon={<LuLayoutDashboard />}
        title={group?.name || 'Group Overview'}
        subtitle={group?.description}
        rightContent={
          <div onClick={handleCopyCode} title="Click to copy group code" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
            <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'bold' }}>CODE:</span>
            <strong style={{ fontSize: '14px', letterSpacing: '1px' }}>{group?.code || 'XXXX-XXXX'}</strong>
            <span><LuCopy /></span>
          </div>
        }
        stats={[
          { icon: <LuUsers />, value: group?.member_count || 0, label: "Total Students" },
          { icon: <LuBook />, value: group?.materials_count || 0, label: "Materials" },
          { icon: <LuFileText />, value: group?.quizzes_count || 0, label: "Quizzes" },
          { icon: <LuTarget />, value: `${group?.average_score || 0}%`, label: "Avg Score" }
        ]}
      />

      {/* Main Charts Section */}
      {loading ? (
        <Row className="ov-charts-row g-4">
          <Col lg={6} md={12}><SkeletonChart /></Col>
          <Col lg={6} md={12}><SkeletonChart /></Col>
          <Col lg={6} md={12}><SkeletonChart /></Col>
          <Col lg={6} md={12}><SkeletonLeaderboard /></Col>
        </Row>
      ) : (
      <>
      <Row className="ov-charts-row g-4">
        {/* 1. Class Average Score Over Time */}
        <Col lg={6} md={12}>
          <div className="ov-chart-card h-100">
            <div className="ov-chart-header">
              <h5 className="ov-chart-title">
                <LuTrendingUp className="me-2" /> Class Average Score Over Time
              </h5>
            </div>
            <div className="ov-chart-body">
              {analytics.averageScoreOverTime?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.averageScoreOverTime}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tick={{fill: '#64748b'}} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tick={{fill: '#64748b'}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="ov-empty-chart">Insufficient data to track progress</div>
              )}
            </div>
          </div>
        </Col>

        {/* 2. Topic Performance */}
        <Col lg={6} md={12}>
          <div className="ov-chart-card h-100">
            <div className="ov-chart-header">
              <h5 className="ov-chart-title">
                <LuBrain className="me-2" /> Topic Performance Overview
              </h5>
            </div>
            <div className="ov-chart-body">
              {analytics.topicPerformance?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.topicPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={11} />
                    <YAxis dataKey="topic" type="category" width={100} stroke="#64748b" fontSize={11} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="score" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="ov-empty-chart">No topic performance data available</div>
              )}
            </div>
          </div>
        </Col>

        {/* 3. Student Score Distribution */}
        <Col lg={6} md={12}>
          <div className="ov-chart-card h-100">
            <div className="ov-chart-header">
              <h5 className="ov-chart-title">
                <LuChartBar className="me-2" /> Student Performance Distribution
              </h5>
            </div>
            <div className="ov-chart-body">
              {analytics.scoreDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="ov-empty-chart">No distribution data available</div>
              )}
            </div>
          </div>
        </Col>

        {/* 4. Top vs Weak Students */}
        <Col lg={6} md={12}>
          <div className="ov-chart-card h-100">
            <div className="ov-chart-header">
              <h5 className="ov-chart-title">
                <LuTarget className="me-2" /> Student Leaderboard (Avg Score)
              </h5>
            </div>
            <div className="ov-chart-body">
              {analytics.studentPerformance?.length > 0 ? (
                <div className="ov-leaderboard-list">
                  {analytics.studentPerformance.slice(0, 5).map((student, idx) => (
                    <div key={idx} className="ov-leaderboard-item d-flex align-items-center justify-content-between p-2 mb-2 border-bottom">
                      <div className="d-flex align-items-center">
                        <span className={`badge ${idx === 0 ? 'bg-warning' : 'bg-light text-dark'} me-3`}>{idx + 1}</span>
                        <span className="fw-medium">{student.name}</span>
                      </div>
                      <span className="text-primary fw-bold">{student.score}%</span>
                    </div>
                  ))}
                  {analytics.studentPerformance.length > 5 && (
                    <div className="text-center mt-2 small text-muted">Showing top performers...</div>
                  )}
                </div>
              ) : (
                <div className="ov-empty-chart">No student submissions yet</div>
              )}
            </div>
          </div>
        </Col>
      </Row>
      {/* Last Updated Timestamp */}
      {analytics.lastUpdated && (
        <div className="text-end text-muted mt-3" style={{ fontSize: '0.875rem' }}>
          Last updated: {new Date(analytics.lastUpdated * 1000).toLocaleString()}
        </div>
      )}
      </>
      )}

    </div>
  );
}

export default GroupOverview;

