/**
 * Quiz Service
 * Handles quiz generation, taking, and submission
 */
import api from './api';

const quizService = {
    async generateQuiz(groupId, settings, materialIds = []) {
        const response = await api.post(`/quiz/generate/${groupId}`, {
            settings,
            material_ids: materialIds,
            start_time: settings.start_time,
            end_time: settings.end_time,
            duration_minutes: settings.duration_minutes
        });
        return response.data;
    },

    async getActiveQuizzes(groupId) {
        const response = await api.get(`/quiz/active/${groupId}`);
        return response.data;
    },

    async getQuizDetails(quizId) {
        const response = await api.get(`/quiz/${quizId}`);
        return response.data;
    },

    async submitQuiz(quizId, answers, completed = true) {
        const response = await api.post(`/quiz/submit/${quizId}`, {
            answers,
            completed
        });
        return response.data;
    },

    async getQuizResults(quizId) {
        const response = await api.get(`/quiz/results/${quizId}`);
        return response.data;
    },

    async getMySubmission(quizId) {
        const response = await api.get(`/quiz/submission/${quizId}/me`);
        return response.data;
    },

    async getStudentResults(studentId, groupId = null) {
        const params = groupId ? { group_id: groupId } : {};
        const response = await api.get(`/quiz/results/student/${studentId}`, { params });
        return response.data;
    },

    async getGroupQuizzes(groupId) {
        const response = await api.get(`/groups/${groupId}/quizzes`);
        return response.data;
    },

    async deleteQuiz(quizId) {
        const response = await api.delete(`/quiz/${quizId}`);
        return response.data;
    },

    async getSubmission(submissionId) {
        const response = await api.get(`/submission/${submissionId}`);
        return response.data;
    }
};

export default quizService;
