import { useState, useEffect } from 'react';
import { History, FileAudio, ChevronRight, Trash2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function RecentUploads({ onSelectRecord, user }) {
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRecent() {
      if (user && user.id) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('audio_files')
            .select('id, file_name, created_at, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (!error && data && isMounted) {
            setRecentItems(
              data.map((item) => ({
                id: item.id,
                name: item.file_name,
                date: item.created_at,
                status: item.status,
              }))
            );
          }
        } catch (err) {
          console.warn('Error fetching user audio history:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        // Fallback to local storage for guests
        try {
          const stored = localStorage.getItem('audio_summarizer_recent');
          if (stored && isMounted) {
            setRecentItems(JSON.parse(stored));
          }
        } catch {
          if (isMounted) setRecentItems([]);
        }
      }
    }

    loadRecent();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleClear = () => {
    localStorage.removeItem('audio_summarizer_recent');
    if (!user) {
      setRecentItems([]);
    }
  };

  if (!loading && (!recentItems || recentItems.length === 0)) {
    return null;
  }

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
          <History size={16} />
          <span>{user ? 'Your Saved Summaries' : 'Recently Uploaded'}</span>
        </div>
        {!user && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            title="Clear recent list"
          >
            <Trash2 size={13} />
            <span>Clear history</span>
          </button>
        )}
      </div>

      <div className="recent-list">
        {recentItems.map((item) => (
          <div
            key={item.id}
            className="recent-item"
            onClick={() => onSelectRecord(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectRecord(item.id)}
          >
            <div className="recent-item-info">
              <FileAudio size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div>
                <div className="recent-item-name">{item.name}</div>
                <div className="recent-item-date">
                  {new Date(item.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {item.status && (
                <span className={`status-badge ${item.status}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                  {item.status === 'completed' && <CheckCircle2 size={12} />}
                  {item.status === 'processing' && <Clock size={12} />}
                  {item.status === 'failed' && <AlertTriangle size={12} />}
                  <span>{item.status}</span>
                </span>
              )}
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
