import { Mic, Plus, LogIn, LogOut, User } from 'lucide-react';

export default function Navbar({ onNewUpload, currentRecordId, user, onOpenAuth, onSignOut }) {
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
              <Plus size={15} />
              <span>New Upload</span>
            </button>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div 
                className="user-pill"
                title={user.email}
              >
                <User size={14} />
                <span className="user-email-text">{user.email?.split('@')[0]}</span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={onSignOut}
                title="Sign out"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={onOpenAuth}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          )}

          <span className="header-badge">AI Powered</span>
        </div>
      </div>
    </header>
  );
}
