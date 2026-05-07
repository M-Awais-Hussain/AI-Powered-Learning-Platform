import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../shared/components/ToastProvider';
import TopBar from '../../shared/components/TopBar';
import Sidebar from '../../shared/components/Sidebar';
import GroupOverview from '../components/GroupOverview';
import GroupMaterials from '../components/GroupMaterials';
import GroupQuizzes from '../components/GroupQuizzes';
import ManageStudents from '../components/ManageStudents';
import { DashboardSkeleton } from '../../shared/components/SkeletonLoader';
import '../styles/GroupDetailPage.css';

function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useToast();
  const userId = localStorage.getItem('user_id');

  const [group, setGroup] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  // Track which tabs have been visited (lazy-mount on first visit)
  const [visitedTabs, setVisitedTabs] = useState({ overview: true });

  // Determine active section from URL path
  useEffect(() => {
    const path = location.pathname;
    let section = 'overview';
    if (path.includes('/materials')) {
      section = 'materials';
    } else if (path.includes('/quizzes')) {
      section = 'quizzes';
    } else if (path.includes('/students')) {
      section = 'students';
    }
    setActiveSection(section);
    setVisitedTabs(prev => ({ ...prev, [section]: true }));
  }, [location.pathname, groupId]);

  // Fetch group details
  const fetchGroupDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/groups/detail/${groupId}`);
      if (response.data) {
        setGroup(response.data);
      } else {
        throw new Error('Group not found');
      }
    } catch (err) {
      console.error('Failed to fetch group:', err);
      showError('Failed to load group details.');
      navigate('/teacher');
    } finally {
      setLoading(false);
    }
  }, [groupId, userId, showError, navigate]);


  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
    }
  }, [groupId, fetchGroupDetails]);

  if (loading && !group) {
    return (
      <div className="group-detail-wrapper">
        <TopBar />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="group-detail-wrapper">
        <TopBar />
        <div className="group-detail-error">
          <h3>Group not found</h3>
          <button onClick={() => navigate('/teacher')}>Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-detail-wrapper">
      {/* Top Bar */}
      <TopBar
        showCreateButton={false}
      />

      {/* Sidebar */}
      <Sidebar groupId={groupId} groupName={group.name} />

      {/* Main Content — CSS-based tab switching keeps components alive */}
      <main className="group-detail-content">
        {/* Overview Section — always mounted */}
        <div style={{ display: activeSection === 'overview' ? 'block' : 'none' }}>
          <GroupOverview group={group} />
        </div>

        {/* Materials Section — lazy mount, then keep alive */}
        <div style={{ display: activeSection === 'materials' ? 'block' : 'none' }}>
          {visitedTabs.materials && <GroupMaterials groupId={groupId} />}
        </div>

        {/* Quizzes Section — lazy mount, then keep alive */}
        <div style={{ display: activeSection === 'quizzes' ? 'block' : 'none' }}>
          {visitedTabs.quizzes && <GroupQuizzes groupId={groupId} />}
        </div>

        {/* Manage Students Section — lazy mount, then keep alive */}
        <div style={{ display: activeSection === 'students' ? 'block' : 'none' }}>
          {visitedTabs.students && <ManageStudents groupId={groupId} group={group} />}
        </div>
      </main>
    </div>
  );
}

export default GroupDetailPage;

