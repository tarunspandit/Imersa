import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SimpleFooter } from './SimpleFooter';
import { UniversalSearch, useUniversalSearch } from '@/components/ui/UniversalSearch';
import { QuickActionBar } from '@/components/ui/QuickActionBar';
import { useAppStore } from '@/stores';
import { cn } from '@/utils';
import { Power, Sun, Moon, Play, Home } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Layout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { sidebarCollapsed } = useAppStore();
  const { isOpen: isSearchOpen, close: closeSearch } = useUniversalSearch();
  const navigate = useNavigate();
  const [showQuickActions, setShowQuickActions] = useState(true);

  const handleMobileMenuToggle = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - handles both mobile and desktop */}
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={closeMobileSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header onMenuClick={handleMobileMenuToggle} />

        {/* Page content */}
        <main className="flex-1 relative">
          <div className="h-full">
            <Outlet />
          </div>
        </main>

        {/* Simple Footer */}
        <SimpleFooter />
      </div>


      {/* Universal Search Modal */}
      <UniversalSearch isOpen={isSearchOpen} onClose={closeSearch} />

      {/* Global Quick Action Bar - Desktop Only */}
      {showQuickActions && (
        <div className="hidden md:block">
          <QuickActionBar
            actions={[
              {
                id: 'all-on',
                label: 'All On',
                icon: Power,
                action: () => {
                  toast.success('All lights turned on');
                },
                variant: 'default'
              },
              {
                id: 'all-off',
                label: 'All Off',
                icon: Power,
                action: () => {
                  toast.success('All lights turned off');
                },
                variant: 'outline'
              },
              {
                id: 'bright',
                label: 'Bright',
                icon: Sun,
                action: () => {
                  toast('Setting all lights to maximum brightness');
                }
              },
              {
                id: 'dim',
                label: 'Dim',
                icon: Moon,
                action: () => {
                  toast('Dimming all lights to 30%');
                }
              },
              {
                id: 'scenes',
                label: 'Scenes',
                icon: Play,
                action: () => {
                  navigate('/scenes');
                }
              },
              {
                id: 'rooms',
                label: 'Rooms',
                icon: Home,
                action: () => {
                  navigate('/groups');
                }
              }
            ]}
            position="bottom"
            floating={true}
            className="mb-4"
          />
        </div>
      )}
    </div>
  );
};

export { Layout };