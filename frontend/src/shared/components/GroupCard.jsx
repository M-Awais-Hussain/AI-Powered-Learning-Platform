import React from 'react';
import { LuTrash2, LuUsers, LuBook, LuFileText, LuTrendingUp } from 'react-icons/lu';
import { useToast } from './ToastProvider';
import ConfirmModal from './ConfirmModal';
import './GroupCard.css';

function GroupCard({ group, onView, onDelete, loading }) {
    const { showSuccess, showError } = useToast();
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

    const handleCopyCode = async (e) => {
        if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }

        try {
            const code = group?.code || '';
            if (!code) throw new Error('No code available');

            let copied = false;
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(code);
                    copied = true;
                } catch (clipboardErr) {
                    console.warn('Clipboard API failed, falling back', clipboardErr);
                }
            }

            // Fallback to execCommand if modern API failed or is not available
            if (!copied) {
                const textArea = document.createElement("textarea");
                textArea.value = code;
                textArea.style.position = "fixed"; // Prevents scrolling
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (!successful) {
                    throw new Error('Fallback copy failed');
                }
            }
            
            showSuccess('Group code copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy code:', err);
            if (showError) {
                showError('Failed to copy group code. Please try manually.');
            }
        }
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        setShowDeleteConfirm(true);
    };

    const performDelete = () => {
        setShowDeleteConfirm(false);
        onDelete(group.id);
    };

    return (
        <div className="gc-card" onClick={() => onView(group.id)}>
            <div className="gc-card-body">
                <div className="gc-card-header">
                    <div className="gc-title-section">
                        <h3 className="gc-card-title">{group.name}</h3>
                        {group.description && (
                            <p className="gc-card-description">{group.description}</p>
                        )}
                    </div>
                    <button
                        className="gc-delete-btn"
                        onClick={handleDeleteClick}
                        disabled={loading}
                        title="Delete group"
                    >
                        <LuTrash2 />
                    </button>
                </div>

                <div className="gc-stats-grid">
                    <div className="gc-stat-item">
                        <div className="gc-stat-icon"><LuUsers /></div>
                        <div className="gc-stat-info">
                            <span className="gc-stat-value">{group.member_count || 0}</span>
                            <span className="gc-stat-label">Students</span>
                        </div>
                    </div>
                    <div className="gc-stat-item">
                        <div className="gc-stat-icon"><LuBook /></div>
                        <div className="gc-stat-info">
                            <span className="gc-stat-value">{group.materials_count || 0}</span>
                            <span className="gc-stat-label">Materials</span>
                        </div>
                    </div>
                    <div className="gc-stat-item">
                        <div className="gc-stat-icon"><LuFileText /></div>
                        <div className="gc-stat-info">
                            <span className="gc-stat-value">{group.quizzes_count || 0}</span>
                            <span className="gc-stat-label">Quizzes</span>
                        </div>
                    </div>
                    <div className="gc-stat-item">
                        <div className="gc-stat-icon"><LuTrendingUp /></div>
                        <div className="gc-stat-info">
                            <span className="gc-stat-value">{group.average_score || 0}%</span>
                            <span className="gc-stat-label">Avg Score</span>
                        </div>
                    </div>
                </div>

                <div className="gc-card-footer">
                    <div className="gc-code-box" onClick={handleCopyCode} title="Click to copy code">
                        <span className="gc-code-label">CODE:</span>
                        <span className="gc-code-value">{group.code}</span>
                    </div>
                    <button className="gc-view-btn">
                        View Group →
                    </button>
                </div>
            </div>
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="Delete Group"
                message={`Are you sure you want to delete "${group.name}"? This action cannot be undone and all data within this group will be permanently removed.`}
                confirmText="Delete Permanently"
                onConfirm={performDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                variant="danger"
            />
        </div>
    );
}

export default GroupCard;
