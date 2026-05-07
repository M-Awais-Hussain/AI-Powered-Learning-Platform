import api from './api';

const chatService = {
    // Create a new chat session
    async createNewChat(groupId = null) {
        const response = await api.post(`/chat/new${groupId ? `?group_id=${groupId}` : ''}`);
        return response.data;
    },

    // Get all chat sessions for the user
    async getChatSessions() {
        const response = await api.get('/chat/sessions');
        return response.data;
    },

    // Get history and summary for a specific chat
    async getChatHistory(chatId) {
        const response = await api.get(`/chat/${chatId}/history`);
        return response.data;
    },

    // Send a message to a specific chat session
    async sendMessage(chatId, query, materialIds = []) {
        const response = await api.post(`/chat/${chatId}/message`, {
            query,
            material_ids: materialIds
        });
        return response.data;
    }
};

export default chatService;
