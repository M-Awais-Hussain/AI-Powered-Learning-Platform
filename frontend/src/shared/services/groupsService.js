/**
 * Groups Service
 * Handles group CRUD operations and membership
 */
import api from './api';

const groupsService = {
    async getTeacherGroups(teacherId) {
        const response = await api.get(`/groups/teacher/${teacherId}`);
        return response.data;
    },

    async getStudentGroups(studentId) {
        const response = await api.get(`/groups/user/${studentId}`);
        return response.data;
    },

    async createGroup(name, description) {
        const response = await api.post('/groups/create', { name, description });
        return response.data;
    },

    async joinGroup(code) {
        const response = await api.post('/groups/join', { code });
        return response.data;
    },

    async leaveGroup(groupId) {
        const response = await api.post('/groups/leave', { group_id: groupId });
        return response.data;
    },

    async getGroupDetails(groupId) {
        const response = await api.get(`/groups/${groupId}`);
        return response.data;
    },

    async getGroupMembers(groupId) {
        const response = await api.get(`/groups/${groupId}/members`);
        return response.data;
    },

    async regenerateCode(groupId) {
        const response = await api.post(`/groups/${groupId}/regenerate-code`);
        return response.data;
    },

    async deleteGroup(groupId) {
        const response = await api.delete(`/groups/${groupId}`);
        return response.data;
    },

    async removeMember(groupId, memberId) {
        const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
        return response.data;
    }
};

export default groupsService;
