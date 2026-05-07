import React, { useState } from 'react';
import { LuUpload } from 'react-icons/lu';
import axios from 'axios';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useToast } from '../../shared/components/ToastProvider';
import '../../styles/modals.css';

function UploadMaterialModal({ show, onHide, groupId, onUploadSuccess }) {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    files: [],
  });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      // Validate file size (10MB limit per file)
      const oversized = selectedFiles.some(f => f.size > 10 * 1024 * 1024);
      if (oversized) {
        setError('One or more files exceed the 10MB limit');
        return;
      }

      setError('');
      setFormData(prev => ({
        ...prev,
        files: [...(prev.files || []), ...selectedFiles]
      }));
    }
  };

  const removeFile = (indexToRemove) => {
    if (uploading) return;
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.files || formData.files.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = formData.files.length;
      let completed = 0;

      for (const file of formData.files) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        // Use original filename (without extension) as lecture_title
        uploadFormData.append('lecture_title', file.name.replace(/\.[^/.]+$/, ''));

        await axios.post(
          `/materials/upload/${groupId}`,
          uploadFormData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              const currentFileProgress = progressEvent.loaded / progressEvent.total;
              const overallProgress = Math.round(((completed + currentFileProgress) / totalFiles) * 100);
              setUploadProgress(overallProgress);
            },
          }
        );
        completed++;
        setUploadProgress(Math.round((completed / totalFiles) * 100));
      }

      showSuccess(`Successfully uploaded ${totalFiles} material(s)!`);
      setFormData({ files: [] });
      setUploadProgress(0);

      if (onUploadSuccess) {
        onUploadSuccess();
      } else {
        onHide();
      }
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to upload material. Please try again.';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFormData({ files: [] });
    setError('');
    onHide();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg" className="upload-material-modal">
      <Modal.Header closeButton>
        <Modal.Title> Upload Material</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          )}



          <Form.Group className="mb-3">
            <Form.Label>File <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="file"
              onChange={handleFileChange}
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mov"
            />
            <Form.Text className="text-muted">
              Supported formats: PDF, Documents, Images, Videos, Presentations (Max 10MB per file)
            </Form.Text>
            {formData.files && formData.files.length > 0 && (
              <div className="file-preview mt-3">
                <h6 className="mb-2 text-muted fw-bold" style={{ fontSize: '0.9rem' }}>Selected Files ({formData.files.length})</h6>
                <div className="d-flex flex-column gap-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {formData.files.map((file, index) => (
                    <div key={index} className="file-info d-flex justify-content-between align-items-center p-2 border rounded bg-light">
                      <div className="d-flex flex-column text-truncate me-2">
                        <span className="file-name fw-medium text-truncate" style={{ fontSize: '0.9rem' }}>{file.name}</span>
                        <span className="file-size text-muted" style={{ fontSize: '0.8rem' }}>
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button 
                        type="button" 
                        className="btn-close flex-shrink-0" 
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                        aria-label="Remove"
                      ></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {uploading && (
              <div className="mt-3">
                <div className="progress">
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated"
                    role="progressbar"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {uploadProgress}%
                  </div>
                </div>
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={uploading || !formData.files || formData.files.length === 0}>
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Uploading... {uploadProgress}%
              </>
            ) : (
              <><LuUpload style={{ marginRight: '0.25rem' }} /> Upload Material</>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default UploadMaterialModal;

