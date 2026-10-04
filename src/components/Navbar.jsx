import { Mic, Plus } from 'lucide-react';

export default function Navbar({ onNewUpload, currentRecordId }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div 
          className="brand-logo" 
          onClick={onNewUpload}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNewUpload()}
        >
          <div className="brand-icon-box">
            <Mic size={20} />
          </div>
          <div>
            <h1 className="brand-title">Audio Summarizer</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {currentRecordId && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={onNewUpload}
            >
              <Plus size={16} />
              <span>New Upload</span>
            </button>
          )}
          <span className="header-badge">AI Powered</span>
        </div>
      </div>
    </header>
  );
}
