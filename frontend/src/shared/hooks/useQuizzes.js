/**
 * useQuizzes Hook
 * Manages quiz state and operations with deduplication
 */
import { useState, useCallback, useRef } from 'react';
import { quizService } from '../services';

export default function useQuizzes(groupId) {
    const [quizzes, setQuizzes] = useState([]);
    const [activeQuizzes, setActiveQuizzes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Track last fetched group to prevent re-fetching same data
    const lastFetchedRef = useRef({ groupQuizzes: null, activeQuizzes: null });

    const fetchGroupQuizzes = useCallback(async (force = false) => {
        if (!groupId) return;
        if (!force && lastFetchedRef.current.groupQuizzes === groupId && quizzes.length > 0) return;
        setLoading(true);
        try {
            const data = await quizService.getGroupQuizzes(groupId);
            setQuizzes(data);
            setError(null);
            lastFetchedRef.current.groupQuizzes = groupId;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [groupId, quizzes.length]);

    const fetchActiveQuizzes = useCallback(async (force = false) => {
        if (!groupId) return;
        if (!force && lastFetchedRef.current.activeQuizzes === groupId && activeQuizzes.length > 0) return;
        setLoading(true);
        try {
            const data = await quizService.getActiveQuizzes(groupId);
            setActiveQuizzes(data);
            setError(null);
            lastFetchedRef.current.activeQuizzes = groupId;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [groupId, activeQuizzes.length]);

    const generateQuiz = useCallback(async (settings, materialIds) => {
        if (!groupId) return null;
        setLoading(true);
        try {
            const data = await quizService.generateQuiz(groupId, settings, materialIds);
            // Force re-fetch after generating
            lastFetchedRef.current.groupQuizzes = null;
            await fetchGroupQuizzes(true);
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [groupId, fetchGroupQuizzes]);

    const submitQuiz = useCallback(async (quizId, answers, completed = true) => {
        setLoading(true);
        try {
            const result = await quizService.submitQuiz(quizId, answers, completed);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteQuiz = useCallback(async (quizId) => {
        try {
            await quizService.deleteQuiz(quizId);
            setQuizzes(prev => prev.filter(q => q.id !== quizId));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        quizzes,
        activeQuizzes,
        loading,
        error,
        fetchGroupQuizzes,
        fetchActiveQuizzes,
        generateQuiz,
        submitQuiz,
        deleteQuiz
    };
}
