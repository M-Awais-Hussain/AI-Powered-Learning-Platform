import React, { useState, useEffect, useCallback } from 'react';
import { LuFolderOpen, LuUsers, LuChartBar } from 'react-icons/lu';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../shared/components/ToastProvider';
import TopBar from '../../shared/components/TopBar';
import GroupCard from '../../shared/components/GroupCard';
import CreateGroupModal from '../modals/CreateGroupModal';
import ChartSection from '../../shared/components/ChartSection';
import DashboardHero from '../../shared/components/DashboardHero';
import '../styles/TeacherDashboard.css';

function TeacherDashboard() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  let userId = localStorage.getItem('user_id');
  
  // Quick fix for corrupted user_id from previous bug where backend token stripped user_id
  if (userId === 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    window.location.href = '/login';
  }

  const [groups, setGroups] = useState([]);
  const [globalAnalytics, setGlobalAnalytics] = useState({
    groupGrowthTrend: []
  });
  const [loading, setLoading] = useState(true);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState(null);

  // Fetch all groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/groups/teacher/${userId}`);
      const groupsData = Array.isArray(response.data) ? response.data : [];
      setGroups(groupsData);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      showError('Failed to fetch groups. Please try again.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [userId, showError]);

  // Fetch global analytics
  const fetchGlobalAnalytics = useCallback(async () => {
    try {
      const response = await axios.get(`/analytics/teacher/${userId}`);
      setGlobalAnalytics({
        groupGrowthTrend: Array.isArray(response.data?.groupGrowthTrend) ? response.data.groupGrowthTrend : []
      });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setGlobalAnalytics({
        groupGrowthTrend: []
      });
    }
  }, [userId]);

  // Create new group
  const handleCreateGroup = async (groupData) => {
    try {
      setLoading(true);
      await axios.post('/groups/create', groupData);
      await fetchGroups();
      setShowCreateGroupModal(false);
      showSuccess('Group created successfully!');
    } catch (err) {
      showError('Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async (groupIdToDelete) => {
    try {
      setDeletingGroupId(groupIdToDelete);
      await axios.delete(`/groups/${groupIdToDelete}`);
      await fetchGroups();
      showSuccess('Group deleted successfully!');
    } catch (err) {
      showError('Failed to delete group. Please try again.');
    } finally {
      setDeletingGroupId(null);
    }
  };

  // View group details
  const handleViewGroup = (groupIdToView) => {
    navigate(`/teacher/group/${groupIdToView}`);
  };

  useEffect(() => {
    fetchGroups();
    fetchGlobalAnalytics();
  }, [fetchGroups, fetchGlobalAnalytics]);

  return (
    <div className="td-container">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <main className="td-content">
        {/* Groups Section */}
        <div className="td-section">
          <DashboardHero
            icon={<LuFolderOpen />}
            title="My Learning Groups"
            subtitle="Create and manage your class groups, and track global analytics."
            primaryButton={{
              text: "Create Group",
              icon: "+",
              onClick: () => setShowCreateGroupModal(true)
            }}
          />

          {loading ? (
            <div className="td-groups-grid" style={{ marginTop: '20px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="td-skeleton-card td-loading-animation" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="td-empty-state">
              <div className="td-empty-icon"><LuUsers /></div>
              <h3 className="td-empty-title">No Groups Found</h3>
              <p className="td-empty-text">Create your first group to start organizing your class materials and quizzes.</p>
              <button
                className="td-create-btn"
                onClick={() => setShowCreateGroupModal(true)}
              >
                + Create New Group
              </button>
            </div>
          ) : (
            <div className="td-groups-grid">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onView={handleViewGroup}
                  onDelete={handleDeleteGroup}
                  loading={deletingGroupId === group.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Analytics Section */}
        {!loading && Array.isArray(groups) && groups.length > 0 && (
          <div className="td-analytics-section">
            <div className="td-section-header">
              <h2 className="td-section-title">
                <span className="td-title-icon"><LuChartBar /></span>
                Dashboard Performance
              </h2>
            </div>
            <ChartSection
              groups={groups}
              analytics={globalAnalytics || {}}
              loading={false}
            />
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        show={showCreateGroupModal}
        onHide={() => setShowCreateGroupModal(false)}
        onCreate={handleCreateGroup}
        loading={loading}
      />
    </div>
  );
}

export default TeacherDashboard;
