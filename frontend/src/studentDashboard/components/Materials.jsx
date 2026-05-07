import React, { useState } from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { LuBookmark, LuBookmarkMinus, LuDownload, LuEye, LuStar, LuSearch, LuBookOpen, LuSave, LuTag } from 'react-icons/lu';
import DashboardHero from '../../shared/components/DashboardHero';

const Materials = ({
    selectedGroup,
    materials,
    bookmarks,
    onBookmarkToggle,
    onDownload,
    onPreview,
    getFileIcon,
    formatFileSize,
    setActiveSection,
    isBookmarksView = false
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const categories = [...new Set(materials.map(m => m.category || 'General'))];

    const filteredMaterials = materials.filter(m => {
        const matchesSearch = m.lecture_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.filename?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !filterCategory || m.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const isBookmarked = (id) => bookmarks.some(b => b.material_id === id);

    return (
        <div className="animate-fade-in">
            <DashboardHero
                icon={<LuBookOpen />}
                title={isBookmarksView ? 'My Bookmarks' : 'Study Materials'}
                subtitle={isBookmarksView ? 'Review your saved resources and important notes.' : `Learning resources for ${selectedGroup?.name || 'your group'}.`}
                secondaryButton={{
                    text: `Bookmarks (${bookmarks.length})`,
                    icon: <LuStar />,
                    onClick: () => setActiveSection('bookmarks')
                }}
                stats={[
                    { icon: <LuBookOpen />, value: materials.length, label: "Total Files" },
                    { icon: <LuSave />, value: formatFileSize(materials.reduce((acc, m) => acc + (m.file_size || 0), 0)), label: "Total Size" },
                    { icon: <LuTag />, value: categories.length, label: "Categories" }
                ]}
            />

            {/* Search and Filter Bar */}
            <div className="sd-glass-card mb-4">
                <Row className="g-3">
                    <Col md={8}>
                        <div className="position-relative">
                            <span className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted"><LuSearch /></span>
                            <Form.Control
                                type="text"
                                placeholder="Search materials by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="ps-5 bg-white border-0 rounded-3 shadow-sm"
                                style={{ height: '50px' }}
                            />
                        </div>
                    </Col>
                    <Col md={4}>
                        <Form.Select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-white border-0 rounded-3 shadow-sm"
                            style={{ height: '50px' }}
                        >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </Form.Select>
                    </Col>
                </Row>
            </div>

            {filteredMaterials.length === 0 ? (
                <div className="empty-state sd-glass-card">
                    <div className="empty-state-icon"></div>
                    <h4>{searchQuery || filterCategory ? 'No Matching Materials' : (isBookmarksView ? 'No Bookmarked Materials' : 'No Materials Available')}</h4>
                    <p>{isBookmarksView ? 'Bookmark materials to see them here.' : 'Materials uploaded by the teacher will appear here.'}</p>
                </div>
            ) : (
                <Row>
                    {filteredMaterials.map((material) => (
                        <Col md={6} lg={4} key={material.id} className="mb-4">
                            <div className="sd-glass-card material-card h-100 p-0 overflow-hidden d-flex flex-column border-0 shadow-sm hover-shadow">
                                <div className="p-4 flex-grow-1">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div
                                            className="rounded-3 d-flex align-items-center justify-content-center"
                                            style={{ width: '48px', height: '48px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontSize: '1.5rem' }}
                                        >
                                            {getFileIcon(material.filename || material.lecture_title)}
                                        </div>
                                        <Button
                                            variant="link"
                                            className="p-0 border-0"
                                            onClick={() => onBookmarkToggle(material.id)}
                                            title={isBookmarked(material.id) ? 'Remove Bookmark' : 'Add Bookmark'}
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: isBookmarked(material.id) ? '#fbbf24' : '#f1f5f9',
                                                color: isBookmarked(material.id) ? '#fff' : '#94a3b8',
                                                fontSize: '1.1rem',
                                                transition: 'all 0.2s ease',
                                                textDecoration: 'none',
                                                boxShadow: isBookmarked(material.id) ? '0 2px 8px rgba(251, 191, 36, 0.4)' : 'none'
                                            }}
                                        >
                                            {isBookmarked(material.id) ? <LuBookmark /> : <LuBookmarkMinus />}
                                        </Button>
                                    </div>

                                    <h6 className="fw-bold mb-1 text-dark line-clamp-2" title={material.lecture_title || material.filename}>
                                        {material.lecture_title || material.filename}
                                    </h6>
                                    <span className="badge bg-light text-muted fw-normal mb-3">
                                        {material.category || 'General'}
                                    </span>
                                </div>

                                <div className="p-3 bg-light bg-opacity-50 border-top d-flex justify-content-between align-items-center">
                                    <span className="text-muted small fw-medium">
                                        {formatFileSize(material.file_size)}
                                    </span>
                                    <div className="d-flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="light"
                                            className="rounded-circle p-2 shadow-sm"
                                            onClick={() => onPreview(material)}
                                            style={{ width: '36px', height: '36px' }}
                                        >
                                            <LuEye />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            className="rounded-pill px-3 shadow-sm border-0"
                                            onClick={() => onDownload(material.id, material.filename)}
                                            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
                                        >
                                            <LuDownload className="me-1" /> Download
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Col>
                    ))}
                </Row>
            )}
        </div>
    );
};

export default Materials;
