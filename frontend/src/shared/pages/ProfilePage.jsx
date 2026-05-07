import React, { useState, useEffect, useRef } from 'react';
import { 
    LuUser, LuCamera, LuLock, LuEye, LuEyeOff, 
    LuSave, LuX, LuPencil, LuCircleCheck
} from 'react-icons/lu';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../components/ToastProvider';
import axios from 'axios';
import TopBar from '../components/TopBar';
import './ProfilePage.css';

const ProfilePage = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    
    // UI State
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    
    // Form and Data State
    const [profileData, setProfileData] = useState({
        email: '',
        display_name: '',
        role: '',
        created_at: '',
        profile_picture: null,
        bio: '',
        stats: {}
    });
    
    // Editable temp state for cancelling
    const [editData, setEditData] = useState({});
    
    // Password State
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState({
        current: false,
        new: false,
        confirm: false
    });
    
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;
            setIsLoading(true);
            try {
                const response = await axios.get(`/profile/${user.id}`);
                setProfileData(response.data);
                setEditData({
                    email: response.data.email || '',
                    display_name: response.data.display_name || '',
                    bio: response.data.bio || '',
                    profile_picture: response.data.profile_picture || null
                });
            } catch (error) {
                console.error('Failed to fetch profile', error);
                showToast('Failed to load profile data', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [user?.id, showToast]);

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const togglePasswordVisibility = (field) => {
        setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a JPG or PNG image', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) { // 2MB
            showToast('Image must be less than 2MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            setEditData(prev => ({ ...prev, profile_picture: base64String }));
            if (!isEditing) {
                // If they upload while in view mode, auto switch to edit mode to save
                setIsEditing(true);
            }
        };
        reader.readAsDataURL(file);
    };

    const removePhoto = () => {
        setEditData(prev => ({ ...prev, profile_picture: null }));
        if (!isEditing) setIsEditing(true);
    };

    const triggerFileInput = () => {
        if (!isEditing) setIsEditing(true); // Allow immediate upload via overlay
        fileInputRef.current.click();
    };

    const toggleEditMode = () => {
        if (isEditing) {
            // Cancel edits
            setEditData({
                email: profileData.email || '',
                display_name: profileData.display_name || '',
                bio: profileData.bio || '',
                profile_picture: profileData.profile_picture || null
            });
        }
        setIsEditing(!isEditing);
    };

    const validateProfileForm = () => {
        if (!editData.display_name.trim()) return "Full name is required";
        
        if (editData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(editData.email)) return "Invalid email address";
        }
        return null;
    };

    const handleProfileSubmit = async () => {
        const error = validateProfileForm();
        if (error) {
            showToast(error, 'error');
            return;
        }

        setIsSaving(true);
        try {
            await axios.put(`/profile/${user.id}`, {
                email: editData.email,
                display_name: editData.display_name,
                bio: editData.bio,
                profile_picture: editData.profile_picture
            });
            
            setProfileData(prev => ({
                ...prev,
                ...editData
            }));
            
            showToast('Profile updated successfully', 'success');
            setIsEditing(false);
        } catch (error) {
            const msg = error.response?.data?.detail || 'Failed to update profile';
            showToast(msg, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const validatePasswordForm = () => {
        if (!passwordData.currentPassword) return "Current password is required";
        if (passwordData.newPassword.length < 8) return "New password must be at least 8 characters";
        
        // At least one number, one special char
        const numRegex = /\d/;
        const specialRegex = /[!@#$%^&*(),.?":{}|<>]/;
        if (!numRegex.test(passwordData.newPassword)) return "New password must contain at least one number";
        if (!specialRegex.test(passwordData.newPassword)) return "New password must contain at least one special character";
        
        if (passwordData.newPassword !== passwordData.confirmPassword) return "Passwords do not match";
        
        return null;
    };

    const handlePasswordSubmit = async () => {
        const error = validatePasswordForm();
        if (error) {
            showToast(error, 'error');
            return;
        }

        setIsChangingPassword(true);
        try {
            await axios.post(`/profile/${user.id}/password`, {
                current_password: passwordData.currentPassword,
                new_password: passwordData.newPassword
            });
            
            showToast('Password changed successfully', 'success');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            const msg = error.response?.data?.detail || 'Failed to change password';
            showToast(msg, 'error');
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (isLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page-wrapper">
            <TopBar title="My Profile" />
            <div className="profile-page-container">
            <div className="profile-page-header">
                <h1 className="profile-page-title">Profile Settings</h1>
                <div className="profile-actions">
                    {isEditing ? (
                        <>
                            <button className="cancel-btn" onClick={toggleEditMode} disabled={isSaving}>
                                <LuX /> Cancel
                            </button>
                            <button className="save-btn" onClick={handleProfileSubmit} disabled={isSaving}>
                                {isSaving ? <span className="spinner-border spinner-border-sm" /> : < LuSave />} 
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <button className="edit-btn" onClick={toggleEditMode}>
                            <LuPencil /> Edit Profile
                        </button>
                    )}
                </div>
            </div>

            <div className="profile-content-grid">
                {/* LEFT COLUMN: IDENTITY & STATS */}
                <div className="profile-card user-identity-card">
                    <div className="profile-image-container">
                        {editData.profile_picture ? (
                            <img src={editData.profile_picture} alt="Profile" className="profile-image" />
                        ) : (
                            <div className="profile-image-placeholder">
                                {editData.display_name ? editData.display_name.charAt(0).toUpperCase() : <LuUser />}
                            </div>
                        )}
                        
                        {(isEditing || !isEditing) && ( // Allow click to upload even in view mode (which triggers edit mode)
                            <div className="image-upload-overlay" onClick={triggerFileInput}>
                                <LuCamera />
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden-file-input" 
                            accept=".jpg,.jpeg,.png"
                            onChange={handleImageUpload}
                        />
                    </div>
                    {isEditing && editData.profile_picture && (
                        <button className="remove-photo-btn" onClick={removePhoto}>Remove Photo</button>
                    )}

                    <h2 className="user-name-display">{profileData.display_name || profileData.email}</h2>
                    <p className="user-email-display">{profileData.email}</p>
                    
                    <span className={`role-badge ${profileData.role}`}>
                        {profileData.role}
                    </span>

                    {/* Quick Stats extracted from profile if available */}
                    <div className="profile-stats-mini">
                        {profileData.role === 'student' && profileData.stats && (
                            <>
                                <div className="stat-item">
                                    <span className="stat-label">Quizzes Completed</span>
                                    <span className="stat-value">{profileData.stats.total_quizzes_completed || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Average Score</span>
                                    <span className="stat-value">{profileData.stats.average_score || 0}%</span>
                                </div>
                            </>
                        )}
                        {(profileData.role === 'teacher' || profileData.role === 'student') && profileData.stats && (
                            <div className="stat-item">
                                <span className="stat-label">Groups {profileData.role === 'teacher' ? 'Managed' : 'Joined'}</span>
                                <span className="stat-value">{profileData.stats.total_groups || 0}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: FORMS */}
                <div className="details-column">
                    {/* Personal Info Card */}
                    <div className="profile-card">
                        <div className="card-header">
                            <LuUser className="card-icon" />
                            <h3>Personal Information</h3>
                        </div>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label className="form-label">Full Name</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    name="display_name"
                                    value={isEditing ? editData.display_name : profileData.display_name} 
                                    onChange={handleEditChange}
                                    readOnly={!isEditing}
                                    placeholder="Enter your full name"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input 
                                    type="email" 
                                    className="form-input" 
                                    name="email"
                                    value={isEditing ? editData.email : profileData.email} 
                                    onChange={handleEditChange}
                                    readOnly={!isEditing}
                                    placeholder="name@example.com"
                                />
                            </div>

                            <div className="form-group full-width">
                                <label className="form-label">Bio / Short Description</label>
                                <textarea 
                                    className="form-input form-textarea" 
                                    name="bio"
                                    value={isEditing ? editData.bio : profileData.bio} 
                                    onChange={handleEditChange}
                                    readOnly={!isEditing}
                                    placeholder="Tell us a little about yourself..."
                                    maxLength="300"
                                />
                                {isEditing && (
                                    <p className="form-hint">
                                        Max length: 300 characters. Current: {editData.bio.length}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Change Password Card */}
                    <div className="profile-card">
                        <div className="card-header">
                            <LuLock className="card-icon" />
                            <h3>Change Password</h3>
                        </div>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label className="form-label">Current Password</label>
                                <div className="password-input-wrapper">
                                    <input 
                                        type={showPassword.current ? "text" : "password"}
                                        className="form-input" 
                                        name="currentPassword"
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter current password"
                                    />
                                    <button 
                                        type="button" 
                                        className="password-toggle" 
                                        onClick={() => togglePasswordVisibility('current')}
                                    >
                                        {showPassword.current ? <LuEyeOff /> : <LuEye />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <div className="password-input-wrapper">
                                    <input 
                                        type={showPassword.new ? "text" : "password"}
                                        className="form-input" 
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Min 8 chars, 1 num, 1 special"
                                    />
                                    <button 
                                        type="button" 
                                        className="password-toggle" 
                                        onClick={() => togglePasswordVisibility('new')}
                                    >
                                        {showPassword.new ? <LuEyeOff /> : <LuEye />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Confirm New Password</label>
                                <div className="password-input-wrapper">
                                    <input 
                                        type={showPassword.confirm ? "text" : "password"}
                                        className="form-input" 
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Confirm new password"
                                    />
                                    <button 
                                        type="button" 
                                        className="password-toggle" 
                                        onClick={() => togglePasswordVisibility('confirm')}
                                    >
                                        {showPassword.confirm ? <LuEyeOff /> : <LuEye />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="password-actions">
                            <button 
                                className="save-btn" 
                                onClick={handlePasswordSubmit} 
                                disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                            >
                                {isChangingPassword ? <span className="spinner-border spinner-border-sm" /> : <LuCircleCheck />} 
                                Update Password
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

export default ProfilePage;
