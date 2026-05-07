/**
 * useMaterials Hook
 * Manages materials state and operations with deduplication
 */
import { useState, useCallback, useRef } from 'react';
import { materialsService } from '../services';

export default function useMaterials(groupId, userId) {
    const [materials, setMaterials] = useState([]);
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Track last fetched IDs to prevent re-fetching same data
    const lastFetchedRef = useRef({ groupId: null, bookmarksUserId: null });

    const fetchMaterials = useCallback(async (force = false) => {
        if (!groupId) return;
        if (!force && lastFetchedRef.current.groupId === groupId && materials.length > 0) return;
        setLoading(true);
        try {
            const data = await materialsService.getGroupMaterials(groupId);
            setMaterials(data);
            setError(null);
            lastFetchedRef.current.groupId = groupId;
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [groupId, materials.length]);

    const fetchBookmarks = useCallback(async (force = false) => {
        if (!userId) return;
        if (!force && lastFetchedRef.current.bookmarksUserId === userId && bookmarks.length > 0) return;
        try {
            const data = await materialsService.getBookmarks(userId);
            // Normalize: backend returns 'id' but we use 'material_id' internally
            const normalized = (data || []).map(b => ({
                ...b,
                material_id: b.material_id || b.id
            }));
            setBookmarks(normalized);
            lastFetchedRef.current.bookmarksUserId = userId;
        } catch (err) {
            console.error('Error fetching bookmarks:', err);
        }
    }, [userId, bookmarks.length]);

    const uploadMaterial = useCallback(async (file, category, lectureTitle) => {
        if (!groupId) return null;
        setLoading(true);
        try {
            const data = await materialsService.uploadMaterial(groupId, file, category, lectureTitle);
            // Force re-fetch after upload
            lastFetchedRef.current.groupId = null;
            await fetchMaterials(true);
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [groupId, fetchMaterials]);

    const searchMaterials = useCallback(async (query) => {
        if (!groupId || !query) return [];
        try {
            return await materialsService.searchMaterials(groupId, query);
        } catch (err) {
            setError(err.message);
            return [];
        }
    }, [groupId]);

    const toggleBookmark = useCallback(async (materialId) => {
        if (!userId) return;
        try {
            // Backend is a single toggle endpoint
            await materialsService.addBookmark(userId, materialId);
            // Refetch to get accurate state
            const data = await materialsService.getBookmarks(userId);
            const normalized = (data || []).map(b => ({
                ...b,
                material_id: b.material_id || b.id
            }));
            setBookmarks(normalized);
        } catch (err) {
            setError(err.message);
        }
    }, [userId]);

    const deleteMaterial = useCallback(async (materialId) => {
        try {
            await materialsService.deleteMaterial(materialId);
            setMaterials(prev => prev.filter(m => m.id !== materialId));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const isBookmarked = useCallback((materialId) => {
        return bookmarks.some(b => b.material_id === materialId);
    }, [bookmarks]);

    return {
        materials,
        bookmarks,
        loading,
        error,
        fetchMaterials,
        fetchBookmarks,
        uploadMaterial,
        searchMaterials,
        toggleBookmark,
        deleteMaterial,
        isBookmarked,
        getDownloadUrl: materialsService.getDownloadUrl
    };
}
