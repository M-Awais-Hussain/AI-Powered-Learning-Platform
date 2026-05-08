import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Configure axios to include JWT token in requests
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle 401 errors (unauthorized)
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        // Only redirect to login for 401s that are NOT from the login endpoint itself
        if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('user_role');
            localStorage.removeItem('email');
            localStorage.removeItem('full_name');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        const userId = localStorage.getItem('user_id');
        const userRole = localStorage.getItem('user_role');
        const email = localStorage.getItem('email');
        const fullName = localStorage.getItem('full_name');

        // Check for corrupted user_id (string "undefined")
        if (userId === 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('user_role');
            localStorage.removeItem('email');
            localStorage.removeItem('full_name');
            window.location.href = '/login';
            return;
        }

        if (token && userId && userRole) {
            // Set user IMMEDIATELY from localStorage — no network wait
            setUser({ id: userId, role: userRole, email: email || '', full_name: fullName || '' });
            setLoading(false);

            // Validate session in background (non-blocking)
            axios.get('/auth/me')
                .then((response) => {
                    // Update with fresh data if different
                    setUser({
                        id: response.data.user_id,
                        role: response.data.role,
                        email: response.data.email,
                        full_name: response.data.full_name
                    });
                })
                .catch(() => {
                    // Token expired or invalid — logout
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_id');
                    localStorage.removeItem('user_role');
                    localStorage.removeItem('email');
                    localStorage.removeItem('full_name');
                    setUser(null);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        try {
            const response = await axios.post('/auth/login', { email, password });
            const { access_token, user_id, role, email: resEmail, full_name } = response.data;

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('user_id', user_id);
            localStorage.setItem('user_role', role);
            localStorage.setItem('email', resEmail);
            localStorage.setItem('full_name', full_name);

            setUser({ id: user_id, role, email: resEmail, full_name });
            return { success: true, user_id, role };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.detail || 'Login failed'
            };
        }
    };

    const signup = async (email, full_name, password, role) => {
        try {
            await axios.post('/auth/signup', { email, full_name, password, role });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.detail || 'Signup failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('email');
        localStorage.removeItem('full_name');
        setUser(null);
    };

    const value = {
        user,
        login,
        signup,
        logout,
        loading
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
