import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/ToastProvider';
import TopBar from '../../shared/components/TopBar';
import { LuFileText, LuImage, LuVideo, LuPresentation, LuFile } from 'react-icons/lu';
import {
  useMaterials,
  useQuizzes,
  useNotifications,
  useAnalytics
} from '../../shared/hooks';
import groupsService from '../../shared/services/groupsService';
import chatService from '../../shared/services/chatService';
import JoinGroupModal from '../modals/JoinGroupModal';
import { ConfirmModal } from '../../shared/components';
import Overview from '../components/Overview';
import Materials from '../components/Materials';
import Quizzes from '../components/Quizzes';
import ChatSection from '../components/ChatSection';
import GroupsSection from '../components/GroupsSection';
import StudentSidebar from '../components/StudentSidebar';
import BottomBar from '../components/BottomBar';
import '../styles/StudentDashboard.css';

function StudentDashboard() {
  const navigate = useNavigate();
  const { groupId: urlGroupId } = useParams();
  const { user, logout: contextLogout } = useAuth();
  const { showSuccess, showError } = useToast();
  const userId = user?.user_id || user?.id;

  const [activeSection, setActiveSection] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatSummary, setChatSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [groupToLeave, setGroupToLeave] = useState(null);

  // Custom Hooks
  // ... (keep hooks as they are)
  const {
    materials,
    bookmarks,
    fetchMaterials,
    fetchBookmarks,
    toggleBookmark
  } = useMaterials(selectedGroup?.id, userId);

  const {
    quizzes,
    fetchGroupQuizzes
  } = useQuizzes(selectedGroup?.id);

  useNotifications(userId);

  const {
    performance,
    groupAnalytics,
    loading: analyticsLoading,
    fetchStudentGroupAnalytics,
    fetchAll: fetchAllAnalytics
  } = useAnalytics(userId, 'student');

  const defaultPerformance = {
    totalGroupsJoined: 0,
    totalQuizzesAttempted: 0,
    averageScore: 0,
    progressTrend: [],
    groupStats: []
  };

  // File icon helper
  const getFileIcon = (filename) => {
    if (!filename) return <LuFile />;
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <LuFileText />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <LuImage />;
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return <LuVideo />;
    if (['ppt', 'pptx'].includes(ext)) return <LuPresentation />;
    if (['doc', 'docx'].includes(ext)) return <LuFileText />;
    return <LuFile />;
  };

  // Format file size helper
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Initialization
  // ... (keep handlers as they are)
  const fetchGroups = useCallback(async () => {
    try {
      const data = await groupsService.getStudentGroups(userId);
      setGroups(data);
      if (urlGroupId) {
        const group = data.find(g => g.id === urlGroupId);
        if (group) setSelectedGroup(group);
      }
    } catch (err) {
      showError('Failed to fetch groups');
    }
  }, [userId, urlGroupId, showError]);

  useEffect(() => {
    if (userId) {
      fetchGroups();
      fetchAllAnalytics();
    }
  }, [userId, fetchGroups, fetchAllAnalytics]);

  useEffect(() => {
    if (userId) {
      chatService.getChatSessions().then(setChatSessions).catch(console.error);
    }
  }, [userId]);

  useEffect(() => {
    if (selectedGroup) {
      fetchMaterials();
      fetchBookmarks();
      fetchGroupQuizzes();
    }
  }, [selectedGroup, fetchMaterials, fetchBookmarks, fetchGroupQuizzes]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const performLogout = () => {
    contextLogout();
    navigate('/login');
  };

  // Handle file preview (open in new tab)
  const handlePreview = (material) => {
    const url = material.file_url;
    if (url) {
      window.open(url, '_blank');
    } else {
      showError('File URL not available for this material.');
    }
  };

  // Handle file download
  const handleDownload = (materialId, filename) => {
    // Find the material to get its file_url
    const material = materials.find(m => m.id === materialId);
    const url = material?.file_url;
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      showError('File URL not available for this material.');
    }
  };

  // ... (keep renderSection switch)
  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <Overview
            groups={groups}
            selectedGroup={selectedGroup}
            performance={performance || defaultPerformance}
            savedNotes={[]}
            onJoinGroup={() => setShowJoinModal(true)}
            onSelectGroup={(g) => {
              setSelectedGroup(g);
              setActiveSection('overview');
            }}
            setActiveSection={setActiveSection}
            groupAnalytics={groupAnalytics}
            analyticsLoading={analyticsLoading}
            fetchStudentGroupAnalytics={fetchStudentGroupAnalytics}
          />
        );
      case 'materials':
        return (
          <Materials
            selectedGroup={selectedGroup}
            materials={materials}
            bookmarks={bookmarks}
            onBookmarkToggle={toggleBookmark}
            onDownload={handleDownload}
            onPreview={handlePreview}
            getFileIcon={getFileIcon}
            formatFileSize={formatFileSize}
            setActiveSection={setActiveSection}
          />
        );
      case 'quizzes':
        return <Quizzes selectedGroup={selectedGroup} quizzes={quizzes} />;
          case 'tutor':
        return (
          <ChatSection
            selectedGroup={selectedGroup}
            materials={materials}
            messages={chatMessages}
            sessions={chatSessions}
            activeChatId={activeChatId}
            summary={chatSummary}
            onChat={async (query, materialIds) => {
              if (!activeChatId) {
                const newChat = await chatService.createNewChat(selectedGroup?.id);
                setActiveChatId(newChat.chat_id);
                setChatSessions(prev => [newChat, ...prev]);
                // Continue with message sending
              }
              
              setLoading(true);
              try {
                const response = await chatService.sendMessage(activeChatId || (await chatService.createNewChat(selectedGroup?.id)).chat_id, query, materialIds);
                setChatMessages(prev => [...prev,
                  { role: 'user', content: query },
                  { role: 'assistant', content: response.content }
                ]);
                
                // If title was generated, refresh sessions
                if (response.title) {
                  const updatedSessions = await chatService.getChatSessions();
                  setChatSessions(updatedSessions);
                }
              } catch (err) {
                showError('Failed to send message');
              } finally {
                setLoading(false);
              }
            }}
            onSelectChat={async (chatId) => {
              setActiveChatId(chatId);
              try {
                const history = await chatService.getChatHistory(chatId);
                setChatMessages(history.messages);
                setChatSummary(history.summary);
              } catch (err) {
                showError('Failed to load chat history');
              }
            }}
            onNewChat={async () => {
              try {
                const newChat = await chatService.createNewChat(selectedGroup?.id);
                setActiveChatId(newChat.chat_id);
                setChatSessions(prev => [newChat, ...prev]);
                setChatMessages([]);
                setChatSummary("");
              } catch (err) {
                showError('Failed to create new chat');
              }
            }}
            loading={loading}
          />
        );
      case 'groups':
        return (
          <GroupsSection
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={(g) => {
              setSelectedGroup(g);
              setActiveSection('overview');
            }}
            onJoinGroup={() => setShowJoinModal(true)}
            onLeaveGroup={(group) => {
              setGroupToLeave(group);
              setShowLeaveConfirm(true);
            }}
            setActiveSection={setActiveSection}
            performance={performance || defaultPerformance}
          />
        );
      case 'bookmarks':
        return (
          <Materials
            selectedGroup={selectedGroup}
            materials={materials.filter(m => bookmarks.some(b => b.material_id === m.id))}
            bookmarks={bookmarks}
            onBookmarkToggle={toggleBookmark}
            onDownload={handleDownload}
            onPreview={handlePreview}
            getFileIcon={getFileIcon}
            formatFileSize={formatFileSize}
            setActiveSection={setActiveSection}
            isBookmarksView={true}
          />
        );
      default:
        return <div>Section coming soon...</div>;
    }
  };

  return (
    <div className="sd-layout">
      {selectedGroup && (
        <StudentSidebar
          activeSection={activeSection}
          setActiveSection={(section) => {
            if (section === 'groups') setSelectedGroup(null);
            setActiveSection(section);
          }}
          groupName={selectedGroup?.name}
          onLogout={handleLogout}
        />
      )}

      <TopBar title="Student Dashboard" />

      <main className="sd-main" style={!selectedGroup ? { marginLeft: 0, paddingTop: '64px' } : { paddingTop: '64px' }}>
        {renderSection()}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomBar
        activeSection={activeSection}
        setActiveSection={(section) => {
          if (section === 'groups') setSelectedGroup(null);
          setActiveSection(section);
        }}
        hasSelectedGroup={!!selectedGroup}
      />

      <JoinGroupModal
        show={showJoinModal}
        onHide={() => setShowJoinModal(false)}
        onJoined={fetchGroups}
      />

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        onConfirm={performLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        variant="danger"
      />

      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave Group"
        message={`Are you sure you want to leave "${groupToLeave?.name}"? You will lose access to all materials and quizzes in this group.`}
        confirmText="Leave Group"
        onConfirm={async () => {
          setShowLeaveConfirm(false);
          try {
            await groupsService.leaveGroup(groupToLeave.id);
            showSuccess('Left group successfully');
            fetchGroups();
            if (selectedGroup?.id === groupToLeave.id) setSelectedGroup(null);
          } catch (err) {
            showError('Failed to leave group');
          }
        }}
        onCancel={() => setShowLeaveConfirm(false)}
        variant="danger"
      />
    </div>
  );
}

export default StudentDashboard;
