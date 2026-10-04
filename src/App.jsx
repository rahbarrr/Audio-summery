import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import UploadSection from './components/UploadSection';
import RecordView from './components/RecordView';
import RecentUploads from './components/RecentUploads';
import AuthModal from './components/AuthModal';
import { supabase } from './lib/supabase';

export default function App() {
  const [currentRecordId, setCurrentRecordId] = useState(() => {
    return new URLSearchParams(window.location.search).get('id');
  });
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Synchronize state on browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      setCurrentRecordId(id);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Monitor Supabase Auth state
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const navigateToRecord = (id) => {
    setCurrentRecordId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('id', id);
    window.history.pushState({}, '', url.toString());
  };

  const navigateToHome = () => {
    setCurrentRecordId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url.pathname);
  };

  return (
    <div className="app-layout">
      <Navbar 
        onNewUpload={navigateToHome} 
        currentRecordId={currentRecordId}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
      />

      <main className="app-main">
        {currentRecordId ? (
          <RecordView recordId={currentRecordId} onBack={navigateToHome} />
        ) : (
          <div>
            <div className="hero-section">
              <h2 className="hero-title">Audio Summarizer</h2>
              <p className="hero-subtitle">
                Upload an audio file and get an AI-generated transcript and summary.
              </p>
            </div>

            <UploadSection 
              onUploadComplete={navigateToRecord} 
              user={user}
              onOpenAuth={() => setIsAuthOpen(true)}
            />

            <RecentUploads 
              onSelectRecord={navigateToRecord} 
              user={user}
            />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Audio Summarizer • Powered by OpenAI Whisper & Supabase Edge Functions</p>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(authUser) => {
          setUser(authUser);
        }}
      />
    </div>
  );
}
