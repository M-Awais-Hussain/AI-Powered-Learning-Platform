import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Form } from 'react-bootstrap';
import { LuImage, LuPaperclip, LuSave, LuTag, LuSearch, LuCalendar, LuEye, LuFileText, LuVideo, LuPresentation, LuFile, LuBookOpen, LuFolderOpen, LuTrash2 } from 'react-icons/lu';
import axios from 'axios';
import UploadMaterialModal from '../modals/UploadMaterialModal';
import { useToast } from '../../shared/components/ToastProvider';
import DashboardHero from '../../shared/components/DashboardHero';
import { SkeletonCard } from '../../shared/components/SkeletonLoader';
import '../styles/GroupMaterials.css';

function GroupMaterials({ groupId }) {
  const { showSuccess, showError } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch materials from backend
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/materials/${groupId}`);
      const materialsData = Array.isArray(response.data) ? response.data : [];
      setMaterials(materialsData);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
      showError('Failed to load materials. Please try again.');
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [groupId, showError]);

  useEffect(() => {
    if (groupId) {
      fetchMaterials();
    }
  }, [groupId, fetchMaterials]);

  // Handle material upload success
  const handleUploadSuccess = () => {
    fetchMaterials();
    setShowUploadModal(false);
  };

  // Handle material view/download
  const handleView = (materialId, filename) => {
    // Find the material to get its file_url
    const material = materials.find(m => m.id === materialId);
    const url = material?.file_url;
    if (url) {
      window.open(url, '_blank');
    } else {
      showError('File URL not available for this material.');
    }
  };

  // Handle material delete
  const handleDelete = async (materialId) => {
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return;
    }

    try {
      await axios.delete(`/materials/${materialId}`);
      showSuccess('Material deleted successfully!');
      fetchMaterials();
    } catch (err) {
      console.error('Failed to delete material:', err);
      showError('Failed to delete material. Please try again.');
    }
  };

  const categories = ['All', ...new Set(materials.map(m => m.category).filter(Boolean))];

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = (material.lecture_title || material.filename || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || material.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileType = (category, type) => {
    const cat = (category || type || '').toLowerCase();
    if (cat.includes('pdf') || type?.includes('pdf')) return 'pdf';
    if (cat.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => type?.includes(ext))) return 'image';
    if (cat.includes('video') || type?.includes('video')) return 'video';
    if (cat.includes('slide') || type?.includes('powerpoint') || type?.includes('presentation')) return 'slide';
    if (cat.includes('document') || type?.includes('word') || type?.includes('doc')) return 'document';
    return 'file';
  };

  const getFileIconData = (fileType) => {
    const icons = {
      pdf: { icon: <LuFileText />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
      image: { icon: <LuImage />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
      video: { icon: <LuVideo />, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
      slide: { icon: <LuPresentation />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
      document: { icon: <LuFile />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
      file: { icon: <LuPaperclip />, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
    };
    return icons[fileType] || icons.file;
  };

  // Stats calculations
  const totalSize = materials.reduce((sum, m) => sum + (m.file_size || 0), 0);
  const categoryStats = materials.reduce((acc, mat) => {
    const cat = mat.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="materials-container">
      {/* Header Section */}
      <DashboardHero
        icon={<LuBookOpen />}
        title="Learning Materials"
        subtitle="Manage, organize, and share learning resources with your students"
        primaryButton={{
          text: "Upload Material",
          icon: "+",
          onClick: () => setShowUploadModal(true)
        }}
        stats={[
          { icon: <LuFolderOpen />, value: materials.length, label: "Total Files" },
          { icon: <LuSave />, value: formatFileSize(totalSize), label: "Total Size" },
          { icon: <LuTag />, value: Object.keys(categoryStats).length, label: "Categories" }
        ]}
      />

      {/* Search and Filter Bar */}
      <div className="sd-glass-card mb-4">
        <Row className="g-3">
          <Col md={8}>
            <div className="position-relative">
              <span className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted">
                <LuSearch />
              </span>
              <Form.Control
                type="text"
                placeholder="Search materials by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-5 bg-white border-0 rounded-3 shadow-sm"
                style={{ height: "50px" }}
              />
            </div>
          </Col>
          <Col md={4}>
            <Form.Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white border-0 rounded-3 shadow-sm"
              style={{ height: "50px" }}
            >
              <option value="All">All Categories</option>
              {categories
                .filter((cat) => cat !== "All")
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </Form.Select>
          </Col>
        </Row>
      </div>

      {/* Materials Content */}
      <div className="materials-content">
        {loading ? (
          <Row className="g-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Col key={i} md={6} lg={4}>
                <SkeletonCard lines={4} />
              </Col>
            ))}
          </Row>
        ) : filteredMaterials.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration">
              <span className="empty-icon"><LuFolderOpen /></span>
              <div className="empty-circles">
                <div className="circle c1"></div>
                <div className="circle c2"></div>
                <div className="circle c3"></div>
              </div>
            </div>
            <h3 className="empty-title">
              {searchTerm ? 'No materials found' : 'No materials yet'}
            </h3>
            <p className="empty-text">
              {searchTerm
                ? `No materials match "${searchTerm}". Try a different search.`
                : 'Upload your first learning material to get started.'}
            </p>
            {!searchTerm && (
              <button
                className="empty-btn"
                onClick={() => setShowUploadModal(true)}
              >
                <span style={{ marginRight: '0.25rem' }}>+</span>
                Upload Your First Material
              </button>
            )}
          </div>
        ) : (
          <Row className="g-4">
            {filteredMaterials.map((material, index) => {
              const fileType = getFileType(material.category, material.type);
              const iconData = getFileIconData(fileType);

              return (
                <Col key={material.id} md={6} lg={4}>
                  <div
                    className="sd-glass-card material-card h-100 p-0 overflow-hidden d-flex flex-column border-0 shadow-sm hover-shadow"
                    style={{ '--delay': `${index * 0.05}s` }}
                  >
                    {/* Top Section */}
                    <div className="p-4 flex-grow-1">
                      <div
                        className="mb-3 d-flex align-items-center justify-content-center rounded-3"
                        style={{
                          width: '48px',
                          height: '48px',
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                          fontSize: '1.5rem'
                        }}
                      >
                        {iconData.icon}
                      </div>

                      <h5 className="fw-bold mb-1 text-dark line-clamp-2" title={material.lecture_title || material.filename}>
                        {material.lecture_title || material.filename}
                      </h5>

                      <div className="d-flex align-items-center justify-content-between mt-3">
                        <span className="badge bg-light text-muted fw-normal">
                          {material.category || 'FILE'}
                        </span>

                        <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '0.85rem' }}>
                          <LuCalendar />
                          <span>
                            {material.uploaded_at
                              ? new Date(material.uploaded_at * 1000).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Section */}
                    <div className="p-3 bg-light bg-opacity-50 border-top d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2 text-dark opacity-75">
                        <LuSave size={18} />
                        <span className="fw-medium small">
                          {formatFileSize(material.file_size || 0)}
                        </span>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-white btn-sm rounded-circle d-flex align-items-center justify-content-center border-0 shadow-sm"
                          style={{ width: '36px', height: '36px', background: 'white' }}
                          onClick={() => handleView(material.id, material.filename)}
                          title="View Material"
                        >
                          <LuEye size={18} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm rounded-circle d-flex align-items-center justify-content-center border-0 shadow-sm"
                          style={{ width: '36px', height: '36px', background: '#fff1f2', color: '#f43f5e' }}
                          onClick={() => handleDelete(material.id)}
                          title="Delete Material"
                        >
                          <LuTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      {/* Results count */}
      {!loading && filteredMaterials.length > 0 && (
        <div className="results-footer">
          <span className="results-count">
            Showing {filteredMaterials.length} of {materials.length} materials
          </span>
        </div>
      )}

      {/* Upload Modal */}
      <UploadMaterialModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
        groupId={groupId}
      />
    </div>
  );
}

export default GroupMaterials;
