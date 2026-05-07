/**
 * useNotifications Hook
 * Manages notification state and operations
 */
import { useState, useCallback, useEffect } from 'react';
import { notificationsService } from '../services';

export default function useNotifications(userId, pollInterval = 30000) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async (limit = 20) => {
        if (!userId) return;
        setLoading(true);
        try {
            const data = await notificationsService.getNotifications(userId, limit);
            setNotifications(data.notifications || data);
            setUnreadCount(data.unread_count || data.filter(n => !n.is_read).length);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchUnreadCount = useCallback(async () => {
        if (!userId) return;
        try {
            const data = await notificationsService.getUnreadCount(userId);
            setUnreadCount(data.count || 0);
        } catch (err) {
            console.error('Error fetching unread count:', err);
        }
    }, [userId]);

    const markAsRead = useCallback(async (notificationId) => {
        try {
            await notificationsService.markAsRead(notificationId);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!userId) return;
        try {
            await notificationsService.markAllAsRead(userId);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    }, [userId]);

    // Poll for new notifications
    useEffect(() => {
        if (!userId || !pollInterval) return;

        fetchNotifications();
        const interval = setInterval(fetchUnreadCount, pollInterval);

        return () => clearInterval(interval);
    }, [userId, pollInterval, fetchNotifications, fetchUnreadCount]);

    return {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead
    };
}
