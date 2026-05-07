/**
 * Notifications Service
 * Handles user notifications
 */
import api from './api';

const notificationsService = {
    async getNotifications(userId, limit = 20, unreadOnly = false) {
        const response = await api.get(`/notifications/${userId}`, {
            params: { limit, unread_only: unreadOnly }
        });
        return response.data;
    },

    async getUnreadCount(userId) {
        const response = await api.get(`/notifications/${userId}/count`);
        return response.data;
    },

    async markAsRead(notificationId) {
        const response = await api.post(`/notifications/${notificationId}/read`);
        return response.data;
    },

    async markAllAsRead() {
        const response = await api.post(`/notifications/mark-all-read`);
        return response.data;
    }
};

export default notificationsService;
