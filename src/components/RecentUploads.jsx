import { useState } from 'react';
import { History, FileAudio, ChevronRight, Trash2 } from 'lucide-react';

export default function RecentUploads({ onSelectRecord }) {
  const [recentItems, setRecentItems] = useState(() => {
    try {
      const stored = localStorage.getItem('audio_summarizer_recent');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleClear = () => {
    localStorage.removeItem('audio_summarizer_recent');
    setRecentItems([]);
  };

  if (!recentItems || recentItems.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
          <History size={16} />
          <span>Recently Uploaded</span>
        </div>
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
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
