import { useState, useRef } from 'react';
import { UploadCloud, FileAudio, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'mp4', 'webm'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function UploadSection({ onUploadComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStep, setUploadStep] = useState(null); // 'uploading' | 'saving' | 'triggering'
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!file) return false;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setErrorMessage(`Unsupported format (.${extension}). Please upload MP3, WAV, M4A, MP4, or WEBM.`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File is too large (${formatFileSize(file.size)}). Max allowed size is 25 MB for OpenAI processing.`);
      return false;
    }
    return true;
  };

  const handleFileSelect = (file) => {
    setErrorMessage('');
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile) return;

    if (!isSupabaseConfigured) {
      setErrorMessage('Supabase is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      return;
    }

    setErrorMessage('');

    try {
      // Step 1: Upload audio file to Supabase Storage bucket 'audio-files'
      setUploadStep('uploading');
      const uniqueId = crypto.randomUUID();
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `audio/${uniqueId}-${sanitizedName}`;

      const { error: storageError } = await supabase.storage
        .from('audio-files')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Step 2: Insert record into Supabase PostgreSQL table 'audio_files'
      setUploadStep('saving');
      const { data: dbData, error: dbError } = await supabase
        .from('audio_files')
        .insert({
          file_name: selectedFile.name,
          file_path: storagePath,
          status: 'uploaded',
        })
        .select()
        .single();

      if (dbError || !dbData) {
        throw new Error(`Database record creation failed: ${dbError?.message || 'Unknown error'}`);
      }

      const recordId = dbData.id;

      // Step 3: Trigger server-side background processing function
      setUploadStep('triggering');
      try {
        // Trigger Edge Function in non-blocking manner
        supabase.functions.invoke('process-audio', {
          body: { recordId },
        }).catch((err) => {
          console.warn('Background function invocation dispatched:', err);
        });
      } catch (invokeErr) {
        console.warn('Trigger error (processing will continue if scheduled):', invokeErr);
      }

      // Save to local storage for quick access
      try {
        const recent = JSON.parse(localStorage.getItem('audio_summarizer_recent') || '[]');
        const updated = [{ id: recordId, name: selectedFile.name, date: new Date().toISOString() }, ...recent.filter(item => item.id !== recordId)].slice(0, 8);
        localStorage.setItem('audio_summarizer_recent', JSON.stringify(updated));
      } catch {
        // ignore localStorage errors
      }

      // Hand over to the result view immediately so the user doesn't wait
      onUploadComplete(recordId);

    } catch (err) {
      console.error('Upload flow error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during upload.');
    } finally {
      setUploadStep(null);
    }
  };

  const isUploading = uploadStep !== null;

  return (
    <div className="card">
      {!isSupabaseConfigured && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Configuration Needed:</strong> Please set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file to connect your Supabase project.
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".mp3,.wav,.m4a,.mp4,.webm,audio/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* Drag & Drop Area */}
      <div
        className={`dropzone-container ${isDragOver ? 'is-dragover' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <div className="dropzone-icon-circle">
          <UploadCloud size={30} />
        </div>
        <h3 className="dropzone-title">Click to upload or drag & drop audio</h3>
        <p className="dropzone-subtitle">Recordings, lectures, meetings, interviews, or voice notes</p>
        <span className="formats-tag">MP3, WAV, M4A, MP4, WEBM (Max 25 MB)</span>
      </div>

      {/* Selected File Details */}
      {selectedFile && (
        <div className="selected-file-box">
          <div className="file-info-group">
            <div className="file-icon-box">
              <FileAudio size={22} />
            </div>
            <div className="file-text-details">
              <div className="file-name" title={selectedFile.name}>{selectedFile.name}</div>
              <div className="file-size">{formatFileSize(selectedFile.size)}</div>
            </div>
          </div>
          {!isUploading && (
            <button
              type="button"
              className="remove-file-btn"
              onClick={() => setSelectedFile(null)}
              title="Remove file"
              aria-label="Remove selected file"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Button */}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!selectedFile || isUploading}
        onClick={handleUploadAndProcess}
      >
        {isUploading ? (
          <>
            <Loader2 size={18} className="spinner" />
            <span>
              {uploadStep === 'uploading' && 'Uploading audio to storage...'}
              {uploadStep === 'saving' && 'Creating database record...'}
              {uploadStep === 'triggering' && 'Triggering server-side AI processing...'}
            </span>
          </>
        ) : (
          <span>Upload & Process Audio</span>
        )}
      </button>
    </div>
  );
}
