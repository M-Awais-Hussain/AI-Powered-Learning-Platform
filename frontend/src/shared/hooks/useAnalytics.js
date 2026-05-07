/**
 * useAnalytics Hook
 * Manages analytics data fetching with deduplication and unified dashboard support
 */
import { useState, useCallback, useRef } from 'react';
import { analyticsService } from '../services';

export default function useAnalytics(userId, role) {
    const [analytics, setAnalytics] = useState(null);
    const [performance, setPerformance] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [groupAnalytics, setGroupAnalytics] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Track what has already been fetched to prevent duplicate calls
    const fetchedRef = useRef({
        studentAnalytics: false,
        performance: false,
        recommendations: false,
        teacherAnalytics: false,
        dashboard: false,
        groupAnalytics: {},    // keyed by groupId
        studentGroup: {}       // keyed by groupId
    });

    const fetchStudentAnalytics = useCallback(async (force = false) => {
        if (!userId) return;
        if (!force && fetchedRef.current.studentAnalytics) return;
        setLoading(true);
        try {
            const data = await analyticsService.getStudentAnalytics(userId);
            setAnalytics(data);
            setError(null);
            fetchedRef.current.studentAnalytics = true;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchTeacherAnalytics = useCallback(async (groupId = null, force = false) => {
        if (!userId) return;
        if (!force && !groupId && fetchedRef.current.teacherAnalytics) return;
        setLoading(true);
        try {
            const data = await analyticsService.getTeacherAnalytics(userId, groupId);
            setAnalytics(data);
            setError(null);
            if (!groupId) fetchedRef.current.teacherAnalytics = true;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchGroupAnalytics = useCallback(async (groupId, force = false) => {
        if (!groupId) return;
        if (!force && fetchedRef.current.groupAnalytics[groupId]) return;
        setLoading(true);
        try {
            const data = await analyticsService.getGroupAnalytics(groupId);
            setAnalytics(data);
            setError(null);
            fetchedRef.current.groupAnalytics[groupId] = true;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPerformance = useCallback(async (force = false) => {
        if (!userId) return;
        if (!force && fetchedRef.current.performance) return;
        try {
            const data = await analyticsService.getStudentPerformance(userId);
            setPerformance(data);
            fetchedRef.current.performance = true;
        } catch (err) {
            console.error('Error fetching performance:', err);
        }
    }, [userId]);

    const fetchRecommendations = useCallback(async (force = false) => {
        if (!userId) return;
        if (!force && fetchedRef.current.recommendations) return;
        try {
            const data = await analyticsService.getStudyRecommendations(userId);
            setRecommendations(data);
            fetchedRef.current.recommendations = true;
        } catch (err) {
            console.error('Error fetching recommendations:', err);
        }
    }, [userId]);

    const fetchStudentGroupAnalytics = useCallback(async (groupId, force = false) => {
        if (!userId || !groupId) return;
        if (!force && fetchedRef.current.studentGroup[groupId]) return;
        setLoading(true);
        try {
            const data = await analyticsService.getStudentGroupAnalytics(userId, groupId);
            setGroupAnalytics(data);
            setError(null);
            fetchedRef.current.studentGroup[groupId] = true;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    /**
     * Fetch unified dashboard data (single API call).
     * Uses stale-while-revalidate: returns stale data if available, refreshes in background.
     */
    const fetchDashboard = useCallback(async (force = false) => {
        if (!userId) return;
        if (!force && fetchedRef.current.dashboard) return;
        setLoading(true);
        try {
            const data = await analyticsService.getDashboard(force);
            setDashboard(data);
            // Also populate performance from unified response
            if (data.performance) {
                setPerformance(data.performance);
                fetchedRef.current.performance = true;
            }
            setError(null);
            fetchedRef.current.dashboard = true;
        } catch (err) {
            // Fallback: if unified endpoint fails, use individual endpoints
            console.warn('Unified dashboard failed, falling back:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchAll = useCallback(async (force = false) => {
        // Try unified dashboard first
        try {
            await fetchDashboard(force);
        } catch {
            // Fallback to individual calls
        }

        if (role === 'student') {
            await Promise.all([
                fetchStudentAnalytics(force),
                fetchPerformance(force),
                fetchRecommendations(force)
            ]);
        } else {
            await fetchTeacherAnalytics(null, force);
        }
    }, [role, fetchDashboard, fetchStudentAnalytics, fetchTeacherAnalytics, fetchPerformance, fetchRecommendations]);

    /** Force refresh all data (call after quiz submission) */
    const invalidateAndRefetch = useCallback(async () => {
        fetchedRef.current = {
            studentAnalytics: false,
            performance: false,
            recommendations: false,
            teacherAnalytics: false,
            dashboard: false,
            groupAnalytics: {},
            studentGroup: {}
        };
        analyticsService.invalidateAnalyticsCache();
        analyticsService.invalidateDashboardCache();
        await fetchAll(true);
    }, [fetchAll]);

    return {
        analytics,
        performance,
        dashboard,
        recommendations,
        groupAnalytics,
        loading,
        error,
        fetchStudentAnalytics,
        fetchTeacherAnalytics,
        fetchGroupAnalytics,
        fetchPerformance,
        fetchRecommendations,
        fetchStudentGroupAnalytics,
        fetchDashboard,
        fetchAll,
        invalidateAndRefetch
    };
}
