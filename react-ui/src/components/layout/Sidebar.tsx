import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Lightbulb, 
  Layers, 
  Play, 
  Palette,
  Settings, 
  Users, 
  BarChart3,
  Zap,
  Gamepad2,
  Calendar,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useAppStore } from '@/stores';
import { cn } from '@/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badge?: string | number;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: Lightbulb, label: 'Lights', path: '/lights' },
  { icon: Layers, label: 'Groups', path: '/groups' },
  { icon: Play, label: 'Scenes', path: '/scenes' },
  { icon: Gamepad2, label: 'Entertainment', path: '/entertainment' },
  { icon: Calendar, label: 'Scheduler', path: '/scheduler' },
  { icon: Activity, label: 'Sensors', path: '/sensors' },
  // Analytics removed for parity with legacy UI
  { icon: Users, label: 'Devices', path: '/devices' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: HelpCircle, label: 'Help', path: '/help' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  const handleToggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-background border-r transition-all duration-300 ease-in-out",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-imersa-primary to-imersa-secondary flex items-center justify-center">
                <span className="text-white font-bold text-sm">I</span>
              </div>
              <span className="text-lg font-semibold text-gradient">Imersa</span>
            </div>
          )}

          {/* Collapse toggle (desktop only) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleCollapse}
            className="hidden md:flex"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          {/* Close button (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  // Close mobile sidebar when navigating
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    "sidebar-link group relative",
                    isActive && "active bg-accent text-accent-foreground",
                    item.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
                    sidebarCollapsed && "justify-center"
                  )
                }
              >
                <item.icon className={cn("h-5 w-5 shrink-0", sidebarCollapsed && "mx-auto")} />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto h-5 min-w-[20px] rounded-full bg-imersa-primary text-white text-xs flex items-center justify-center px-1">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}

                {/* Tooltip for collapsed state */}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                    {item.badge && (
                      <span className="ml-2 h-4 min-w-[16px] rounded-full bg-imersa-primary text-white text-xs flex items-center justify-center px-1">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t p-3">
            {!sidebarCollapsed ? (
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>Imersa v1.0.0</p>
                <p>React UI</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="h-2 w-2 rounded-full bg-imersa-primary"></div>
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
};

export { Sidebar };
