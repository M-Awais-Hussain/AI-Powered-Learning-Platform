/**
 * Analytics Service
 * Handles student, group, and teacher analytics with TTL-based caching
 */
import api from './api';

// ─── In-memory cache ───────────────────────────────────────────────
const cache = new Map();
const ANALYTICS_TTL = 5 * 60 * 1000;   // 5 minutes
const INSIGHT_TTL  = 10 * 60 * 1000;   // 10 minutes

function getCached(key, ttl) {
    const entry = cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < ttl) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

/** Invalidate all analytics cache entries (call after quiz submission, etc.) */
function invalidateAnalyticsCache() {
    cache.clear();
}

/** Invalidate cache entries matching a prefix */
function invalidateCacheByPrefix(prefix) {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

// ─── Service methods ───────────────────────────────────────────────
const analyticsService = {
    async getStudentAnalytics(studentId) {
        const key = `student_analytics_${studentId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/student/${studentId}`);
        setCache(key, response.data);
        return response.data;
    },

    async getGroupAnalytics(groupId) {
        const key = `group_analytics_${groupId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/${groupId}`);
        setCache(key, response.data);
        return response.data;
    },

    async getTeacherAnalytics(teacherId, groupId = '') {
        const key = `teacher_analytics_${teacherId}_${groupId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/teacher/${teacherId}${groupId ? `?group_id=${groupId}` : ''}`);
        setCache(key, response.data);
        return response.data;
    },

    async getTeacherPerformanceInsight(teacherId) {
        const key = `teacher_insight_${teacherId}`;
        const cached = getCached(key, INSIGHT_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/teacher/${teacherId}/insight`);
        setCache(key, response.data);
        return response.data;
    },

    async getStudentPerformance(studentId) {
        const key = `student_performance_${studentId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/performance/${studentId}`);
        setCache(key, response.data);
        return response.data;
    },

    async getStudentPerformanceInsight(studentId) {
        const key = `student_insight_${studentId}`;
        const cached = getCached(key, INSIGHT_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/performance/${studentId}/insight`);
        setCache(key, response.data);
        return response.data;
    },

    async getStudyRecommendations(studentId) {
        const key = `recommendations_${studentId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/recommendations/${studentId}`);
        setCache(key, response.data);
        return response.data;
    },

    async getStudentGroupAnalytics(studentId, groupId) {
        const key = `student_group_analytics_${studentId}_${groupId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/student/${studentId}/group/${groupId}`);
        setCache(key, response.data);
        return response.data;
    },

    async getStudentQuizRecords(studentId, groupId) {
        const key = `student_quiz_records_${studentId}_${groupId}`;
        const cached = getCached(key, ANALYTICS_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/student/${studentId}/group/${groupId}/records`);
        setCache(key, response.data);
        return response.data;
    },

    async getQuizInsights(submissionId) {
        const key = `quiz_insights_${submissionId}`;
        const cached = getCached(key, INSIGHT_TTL);
        if (cached) return cached;

        const response = await api.get(`/analytics/submission/${submissionId}/insights`);
        setCache(key, response.data);
        return response.data;
    },

    /**
     * Unified dashboard endpoint — fetches all analytics in a single call.
     * Uses stale-while-revalidate: returns stale data immediately while refreshing.
     */
    async getDashboard(forceRefresh = false) {
        const key = 'unified_dashboard';
        if (!forceRefresh) {
            const cached = getCached(key, ANALYTICS_TTL);
            if (cached) return cached;
        }

        const response = await api.get('/api/dashboard');
        setCache(key, response.data);
        return response.data;
    },

    /** Invalidate dashboard cache specifically */
    invalidateDashboardCache() {
        cache.delete('unified_dashboard');
    },

    // Cache management exports
    invalidateAnalyticsCache,
    invalidateCacheByPrefix
};

export default analyticsService;
