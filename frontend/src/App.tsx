import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { FileExplorer } from './components/files/FileExplorer';
import { AuthModal } from './components/auth/AuthModal';
import { PublicShareView } from './components/files/PublicShareView';
import { TrashView } from './components/files/TrashView';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
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

  // If URL contains a share token, render the public share page (no auth required)
  if (publicShareToken) {
    return (
      <PublicShareView
        shareToken={publicShareToken}
        onExit={handleExitPublicShare}
      />
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
          onOpenAuth={() => setIsAuthOpen(true)}
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

      {/* Auth Modal for Login / Register */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
};

export default App;
