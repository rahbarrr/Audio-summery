import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  ArrowLeft,
  FileText,
  Sparkles,
  Volume2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function RecordView({ recordId, onBack }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'transcript'
  const [copiedType, setCopiedType] = useState(null); // 'summary' | 'transcript'
  const [audioUrl, setAudioUrl] = useState(null);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function loadRecord() {
      try {
        const { data, error } = await supabase
          .from('audio_files')
          .select('*')
          .eq('id', recordId)
          .single();

        if (!isMounted) return;

        if (error) {
          setFetchError(error.message || 'Failed to fetch audio record.');
        } else {
          setRecord(data);
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err.message || 'Could not load record.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadRecord();

    return () => {
      isMounted = false;
    };
  }, [recordId]);

  // Polling while status is uploaded or processing
  useEffect(() => {
    const isPending = record?.status === 'uploaded' || record?.status === 'processing';
    if (!isPending) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('audio_files')
          .select('*')
          .eq('id', recordId)
          .single();

        if (data) {
          setRecord(data);
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [record?.status, recordId]);

  // Load audio preview signed URL if available
  useEffect(() => {
    if (!record?.file_path) return;

    let isMounted = true;
    supabase.storage
      .from('audio-files')
      .createSignedUrl(record.file_path, 3600)
      .then(({ data: signedData }) => {
        if (isMounted && signedData?.signedUrl) {
          setAudioUrl(signedData.signedUrl);
        }
      })
      .catch(() => {
        // audio preview signed url is optional
      });

    return () => {
      isMounted = false;
    };
  }, [record?.file_path]);

  // Handle retry processing if failed
  const handleRetry = async () => {
    if (!recordId) return;
    setIsRetrying(true);
    try {
      setRecord((prev) => (prev ? { ...prev, status: 'processing' } : prev));

      await supabase
        .from('audio_files')
        .update({ status: 'processing' })
        .eq('id', recordId);

      // Invoke edge function
      await supabase.functions.invoke('process-audio', {
        body: { recordId },
      });

      // Refetch
      const { data } = await supabase
        .from('audio_files')
        .select('*')
        .eq('id', recordId)
        .single();

      if (data) {
        setRecord(data);
      }
    } catch (err) {
      console.error('Retry error:', err);
      setFetchError(`Retry request error: ${err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <RefreshCw size={28} className="spinner" style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem auto' }} />
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading audio summary record...</p>
      </div>
    );
  }

  if (fetchError && !record) {
    return (
      <div className="card">
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Error loading record:</strong> {fetchError}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Upload</span>
        </button>
      </div>
    );
  }

  const isPending = record?.status === 'uploaded' || record?.status === 'processing';
  const isCompleted = record?.status === 'completed';
  const isFailed = record?.status === 'failed';

  return (
    <div>
      {/* Navigation & Header */}
      <div style={{ marginBottom: '1rem' }}>
        <button 
          type="button" 
          className="btn btn-secondary btn-sm" 
          onClick={onBack}
          style={{ marginBottom: '1rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Upload</span>
        </button>
      </div>

      <div className="card">
        {/* Record Header */}
        <div className="record-header">
          <div className="record-title-group">
            <h2>{record.file_name}</h2>
            <div className="record-meta">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} />
                {new Date(record.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} />
                ID: {record.id.slice(0, 8)}...
              </span>
            </div>
          </div>

          <div>
            <span className={`status-badge ${record.status}`}>
              {isPending && <span className="pulse-dot" />}
              {isCompleted && <CheckCircle2 size={14} />}
              {isFailed && <AlertTriangle size={14} />}
              <span>{record.status}</span>
            </span>
          </div>
        </div>

        {/* Audio Player preview if available */}
        {audioUrl && (
          <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Volume2 size={20} style={{ color: 'var(--text-secondary)' }} />
            <audio controls src={audioUrl} style={{ width: '100%', height: '36px' }}>
              Your browser does not support audio playback.
            </audio>
          </div>
        )}

        {/* Status: Processing */}
        {isPending && (
          <div className="processing-notice-card">
            <RefreshCw size={32} className="spinner" style={{ color: '#b45309', margin: '0 auto 1rem auto' }} />
            <h3>Your audio is being processed. You can safely leave this page.</h3>
            <p>
              Transcription with OpenAI Whisper and AI summarization run completely on Supabase server-side.
              Bookmark or save this URL — when you return, your transcript and summary will be ready.
            </p>
          </div>
        )}

        {/* Status: Failed */}
        {isFailed && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="alert alert-error">
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Processing Failed:</strong> We encountered an issue transcribing or summarizing this audio file. This can happen if the audio format was corrupted, the speech was unintelligible, or the OpenAI API key is missing in your Supabase Edge Function secrets.
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ width: 'auto', marginTop: 0 }}
                disabled={isRetrying}
                onClick={handleRetry}
              >
                <RefreshCw size={16} className={isRetrying ? 'spinner' : ''} />
                <span>{isRetrying ? 'Retrying...' : 'Retry Processing'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Status: Completed */}
        {isCompleted && (
          <div>
            {/* Tabs */}
            <div className="tabs-nav">
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                <Sparkles size={16} />
                <span>AI Summary</span>
              </button>
              <button 
                type="button" 
                className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setActiveTab('transcript')}
              >
                <FileText size={16} />
                <span>Full Transcript</span>
              </button>
            </div>

            {/* AI Summary Tab */}
            {activeTab === 'summary' && (
              <div className="result-section">
                <div className="section-title">
                  <span>Structured Meeting & Audio Summary</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(record.summary, 'summary')}
                  >
                    {copiedType === 'summary' ? (
                      <>
                        <Check size={14} style={{ color: '#059669' }} />
                        <span style={{ color: '#059669' }}>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="summary-content-box">
                  {renderFormattedSummary(record.summary)}
                </div>
              </div>
            )}

            {/* Full Transcript Tab */}
            {activeTab === 'transcript' && (
              <div className="result-section">
                <div className="section-title">
                  <span>Full Audio Transcript</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(record.transcript, 'transcript')}
                  >
                    {copiedType === 'transcript' ? (
                      <>
                        <Check size={14} style={{ color: '#059669' }} />
                        <span style={{ color: '#059669' }}>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy Transcript</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="transcript-box">
                  {record.transcript || 'No transcript text available.'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Clean markdown renderer for formatted summary sections
function renderFormattedSummary(summaryText) {
  if (!summaryText) {
    return <p style={{ color: 'var(--text-muted)' }}>No summary generated yet.</p>;
  }

  // Parse lines for markdown-like formatting (headers and bullets)
  const lines = summaryText.split('\n');
  const elements = [];
  let currentList = [];
  let elementKey = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elementKey++}`}>
          {currentList.map((item, idx) => (
            <li key={`li-${idx}`}>{item}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith('## ') || line.startsWith('### ')) {
      flushList();
      const headerText = line.replace(/^#{2,3}\s+/, '');
      elements.push(<h2 key={`h2-${elementKey++}`}>{headerText}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(line.replace(/^[-*]\s+/, ''));
    } else {
      flushList();
      elements.push(<p key={`p-${elementKey++}`}>{line}</p>);
    }
  }

  flushList();

  return elements;
}
