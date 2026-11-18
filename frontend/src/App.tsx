import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { FileExplorer } from './components/files/FileExplorer';
import { AuthModal } from './components/auth/AuthModal';
import { PublicShareView } from './components/files/PublicShareView';
import { TrashView } from './components/files/TrashView';
import { useAuth } from './context/AuthContext';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [searchQuery, setSearchQuery] = useState('');

  // Detect ?share=TOKEN in the URL for public share page routing
  const [publicShareToken, setPublicShareToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (token) {
      setPublicShareToken(token);
    }
  }, []);

  const handleExitPublicShare = () => {
    setPublicShareToken(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Public share links work without auth
  if (publicShareToken) {
    return (
      <PublicShareView
        shareToken={publicShareToken}
        onExit={handleExitPublicShare}
      />
    );
  }

  // Show spinner while checking auth state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                d="M12 4v4m0 8v4M4 12H8m8 0h4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-400">Loading CloudVault...</p>
        </div>
      </div>
    );
  }

  // Not logged in → force login screen, nothing else accessible
  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 w-full max-w-md px-4">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">CloudVault</h1>
            <p className="text-sm text-indigo-300 mt-1">Secure cloud storage & file collaboration</p>
          </div>
          <AuthModal isOpen={true} onClose={() => {}} forced={true} />
        </div>
      </div>
    );
  }

  const handleNavigateToFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    setCurrentTab('all_files');
  };

  const handleUploadClick = () => {
    setSelectedFolderId('root');
    setCurrentTab('all_files');
  };

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'all_files':
        return 'All Files';
      case 'recent':
        return 'Recent Files';
      case 'favorites':
        return 'Favorites';
      case 'shared':
        return 'Shared Files';
      case 'pictures':
        return 'Images';
      case 'videos':
        return 'Videos';
      case 'documents':
        return 'Documents';
      case 'trash':
        return 'Trash';
      default:
        return 'CloudVault';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'all_files') {
            setSelectedFolderId('root');
          }
          setCurrentTab(tab);
        }}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          pageTitle={getPageTitle()}
          onOpenAuth={() => {}}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onUploadClick={handleUploadClick}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 scroll-smooth">
          {currentTab === 'dashboard' ? (
            <DashboardView onNavigateToFolder={handleNavigateToFolder} />
          ) : currentTab === 'all_files' ? (
            <FileExplorer
              initialFolderId={selectedFolderId}
              searchQuery={searchQuery}
            />
          ) : currentTab === 'favorites' ? (
            <FileExplorer
              onlyFavorites={true}
              searchQuery={searchQuery}
            />
          ) : currentTab === 'recent' ? (
            <FileExplorer
              searchQuery={searchQuery}
            />
          ) : currentTab === 'pictures' ? (
            <FileExplorer
              filterCategory="pictures"
              searchQuery={searchQuery}
            />
          ) : currentTab === 'videos' ? (
            <FileExplorer
              filterCategory="videos"
              searchQuery={searchQuery}
            />
          ) : currentTab === 'documents' ? (
            <FileExplorer
              filterCategory="documents"
              searchQuery={searchQuery}
            />
          ) : currentTab === 'trash' ? (
            <TrashView />
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center max-w-xl mx-auto mt-12">
              <h2 className="text-xl font-bold text-slate-800 capitalize mb-2">
                {currentTab.replace('_', ' ')}
              </h2>
              <p className="text-sm text-slate-400">
                This module is scheduled in our 8-week progressive roadmap.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* No auth modal needed here — user is already logged in */}
    </div>
  );
};

export default App;
