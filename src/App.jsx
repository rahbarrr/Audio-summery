import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import UploadSection from './components/UploadSection';
import RecordView from './components/RecordView';
import RecentUploads from './components/RecentUploads';

export default function App() {
  const [currentRecordId, setCurrentRecordId] = useState(() => {
    return new URLSearchParams(window.location.search).get('id');
  });

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
      <Navbar onNewUpload={navigateToHome} currentRecordId={currentRecordId} />

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

            <UploadSection onUploadComplete={navigateToRecord} />

            <RecentUploads onSelectRecord={navigateToRecord} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Audio Summarizer • Powered by OpenAI Whisper & Supabase Edge Functions</p>
      </footer>
    </div>
  );
}
