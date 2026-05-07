import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { DashboardSkeleton } from '../shared/components/SkeletonLoader';

// Auth pages
import Login from '../auth/Login';
import Signup from '../auth/Signup';
import ForgotPassword from '../auth/ForgotPassword';
import ResetPassword from '../auth/ResetPassword';
import VerifyEmail from '../auth/VerifyEmail';

// Teacher Dashboard
import TeacherGroupsPage from '../teacherDashboard/pages/TeacherGroupsPage';
import TeacherGroupDetailPage from '../teacherDashboard/pages/TeacherGroupDetailPage';

// Student Dashboard
import StudentDashboardPage from '../studentDashboard/pages/StudentDashboardPage';
import QuizTakingPage from '../studentDashboard/pages/QuizTakingPage';
import QuizResultsPage from '../studentDashboard/pages/QuizResultsPage';

// Shared pages
import GroupSelector from '../pages/GroupSelector';
import ProfilePage from '../shared/pages/ProfilePage';

/**
 * Protected Route wrapper — redirects to /login if unauthenticated.
 */
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <DashboardSkeleton />;
    }

    return user ? children : <Navigate to="/login" />;
};

/**
 * Application Routes
 */
function AppRoutes() {
    const { user, logout } = useAuth();

    const handleLogin = () => {
        // User state is managed by AuthContext
    };

    return (
        <Routes>
            {/* ─── Public Routes ─── */}
            <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />

            {/* ─── Root: role-based redirect ─── */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        {!user ? (
                            <Navigate to="/login" />
                        ) : user.role === 'teacher' ? (
                            <TeacherGroupsPage />
                        ) : user.role === 'student' ? (
                            <StudentDashboardPage />
                        ) : (
                            <Navigate to="/login" />
                        )}
                    </ProtectedRoute>
                }
            />

            {/* ─── Teacher Routes ─── */}
            <Route
                path="/teacher"
                element={<ProtectedRoute><TeacherGroupsPage /></ProtectedRoute>}
            />
            <Route
                path="/teacher/group/:groupId"
                element={<ProtectedRoute><TeacherGroupDetailPage /></ProtectedRoute>}
            />
            <Route
                path="/teacher/group/:groupId/*"
                element={<ProtectedRoute><TeacherGroupDetailPage /></ProtectedRoute>}
            />

            {/* ─── Student Routes ─── */}
            <Route
                path="/student"
                element={<ProtectedRoute><StudentDashboardPage /></ProtectedRoute>}
            />
            <Route
                path="/student/:groupId"
                element={<ProtectedRoute><StudentDashboardPage /></ProtectedRoute>}
            />
            <Route
                path="/student/quiz/:quizId"
                element={<ProtectedRoute><QuizTakingPage /></ProtectedRoute>}
            />
            <Route
                path="/student/quiz/:quizId/results"
                element={<ProtectedRoute><QuizResultsPage /></ProtectedRoute>}
            />

            {/* ─── Shared Routes ─── */}
            <Route
                path="/groups"
                element={
                    <ProtectedRoute>
                        <GroupSelector userId={user?.id} userRole={user?.role} onLogout={logout} />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <ProfilePage />
                    </ProtectedRoute>
                }
            />

            {/* ─── Catch-all ─── */}
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default AppRoutes;
