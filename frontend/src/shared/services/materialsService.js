/**
 * Materials Service
 * Handles material upload, download, and bookmarks
 */
import api, { API_BASE_URL } from './api';

const materialsService = {
    async uploadMaterial(groupId, file, category, lectureTitle) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('lecture_title', lectureTitle);

        const response = await api.post(`/materials/upload/${groupId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    async getGroupMaterials(groupId) {
        const response = await api.get(`/materials/${groupId}`);
        return response.data;
    },

    async searchMaterials(groupId, query) {
        const response = await api.get(`/materials/search/${groupId}`, {
            params: { query }
        });
        return response.data;
    },

    async deleteMaterial(materialId) {
        const response = await api.delete(`/materials/${materialId}`);
        return response.data;
    },

    getDownloadUrl(materialId) {
        const token = localStorage.getItem('access_token');
        return `${API_BASE_URL}/materials/download/${materialId}?token=${token}`;
    },

    // Bookmarks
    async getBookmarks(userId) {
        const response = await api.get(`/materials/bookmarks/${userId}`);
        return response.data;
    },

    async addBookmark(userId, materialId) {
        const response = await api.post(`/materials/bookmark/${materialId}`);
        return response.data;
    },

    async removeBookmark(userId, materialId) {
        const response = await api.post(`/materials/bookmark/${materialId}`);
        return response.data;
    }
};

export default materialsService;
