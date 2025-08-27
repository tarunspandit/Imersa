import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarNew } from './SidebarNew';
import { SimpleFooter } from './SimpleFooter';
import { UniversalSearch, useUniversalSearch } from '@/components/ui/UniversalSearch';
import { Menu } from 'lucide-react';
import '@/styles/design-system.css';

const Layout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isOpen: isSearchOpen, close: closeSearch } = useUniversalSearch();

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-imersa-void">
      {/* Sidebar - handles both mobile and desktop */}
      <SidebarNew 
        isOpen={isMobileSidebarOpen} 
        onClose={closeMobileSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header - Optional, can be removed for cleaner look */}
        {/* <Header onMenuClick={handleMobileMenuToggle} /> */}

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 md:hidden p-2 rounded-lg bg-imersa-surface/90 backdrop-blur-sm border border-white/10"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>

        {/* Page content */}
        <main className="flex-1 relative overflow-hidden">
          <div className="h-full">
            <Outlet />
          </div>
        </main>

        {/* Simple Footer - Made more subtle */}
        <div className="relative z-10">
          <SimpleFooter />
        </div>
      </div>

      {/* Universal Search Modal */}
      <UniversalSearch isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
  );
};

export { Layout };