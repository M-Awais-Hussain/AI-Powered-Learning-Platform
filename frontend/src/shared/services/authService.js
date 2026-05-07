/**
 * Authentication Service
 * Handles login, signup, and user session
 */
import api from './api';

const authService = {
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.access_token) {
            localStorage.setItem('access_token', response.data.access_token);
            localStorage.setItem('user_id', response.data.user_id);
            localStorage.setItem('user_role', response.data.role);
            localStorage.setItem('email', email);
            localStorage.setItem('full_name', response.data.full_name);
        }
        return response.data;
    },

    async signup(email, password, role) {
        const response = await api.post('/auth/signup', { email, password, role });
        return response.data;
    },

    async getCurrentUser() {
        const response = await api.get('/auth/me');
        return response.data;
    },

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('email');
        localStorage.removeItem('full_name');
    },

    isAuthenticated() {
        return !!localStorage.getItem('access_token');
    },

    getUser() {
        return {
            user_id: localStorage.getItem('user_id'),
            role: localStorage.getItem('user_role'),
            email: localStorage.getItem('email'),
            full_name: localStorage.getItem('full_name')
        };
    },

    getToken() {
        return localStorage.getItem('access_token');
    }
};

export default authService;
