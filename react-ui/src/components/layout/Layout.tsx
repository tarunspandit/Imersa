import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { useAppStore } from '@/stores';
import { cn } from '@/utils';

const Layout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { sidebarCollapsed } = useAppStore();

  const handleMobileMenuToggle = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={closeMobileSidebar}
      />

      {/* Main content area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        "md:ml-0", // On mobile, sidebar is overlay so no margin needed
        !sidebarCollapsed ? "md:ml-64" : "md:ml-16" // On desktop, adjust for sidebar
      )}>
        {/* Header */}
        <Header onMenuClick={handleMobileMenuToggle} />

        {/* Page content */}
        <main className="flex-1 relative">
          <div className="h-full">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export { Layout };