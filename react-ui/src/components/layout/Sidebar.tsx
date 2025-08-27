import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Lightbulb, 
  Layers, 
  Play,
  Settings, 
  Users,
  UserCheck,
  Zap,
  Gamepad2,
  Calendar,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Activity,
  Server,
  Plug
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

interface NavSection {
  title?: string;
  items: NavItem[];
}

// Organized navigation structure following UX strategy
const navSections: NavSection[] = [
  {
    // Primary Navigation (Most Used)
    items: [
      { icon: Home, label: 'Dashboard', path: '/' },
      { icon: Lightbulb, label: 'Lights', path: '/lights' },
      { icon: Layers, label: 'Groups & Scenes', path: '/groups' },
      { icon: Calendar, label: 'Automations', path: '/scheduler' },
    ]
  },
  {
    // Secondary Navigation (Configuration)
    title: 'Configuration',
    items: [
      { icon: Users, label: 'Devices & Sensors', path: '/devices' },
      { icon: Plug, label: 'Integrations', path: '/integrations' },
      { icon: Gamepad2, label: 'Entertainment', path: '/entertainment' },
      { icon: Zap, label: 'WLED', path: '/wled' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ]
  },
  {
    // Tertiary Navigation (Support)
    title: 'Support',
    items: [
      { icon: Server, label: 'Bridge Status', path: '/bridge' },
      { icon: UserCheck, label: 'App Users', path: '/users' },
      { icon: HelpCircle, label: 'Help & Docs', path: '/help' },
    ]
  },
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
          "h-screen bg-background border-r transition-all duration-300 ease-in-out",
          // Mobile: fixed overlay
          "fixed left-0 top-0 z-50 md:sticky",
          // Mobile: slide in/out, Desktop: always visible
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Width based on collapsed state
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-r from-imersa-primary to-imersa-secondary flex items-center justify-center shadow-md">
                <span className="text-white font-bold">I</span>
              </div>
              <div>
                <h1 className="font-semibold">Imersa</h1>
                <p className="text-xs text-muted-foreground -mt-1">Smart Lighting</p>
              </div>
            </div>
          )}

          {/* Sidebar toggle - always visible on desktop, close on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={sidebarCollapsed ? handleToggleCollapse : (window.innerWidth < 768 ? onClose : handleToggleCollapse)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex-1 px-3 py-4 space-y-4">
            {navSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-1">
                {/* Section Title */}
                {section.title && !sidebarCollapsed && (
                  <div className="px-3 pt-2 pb-1">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                  </div>
                )}
                {section.title && sidebarCollapsed && sectionIndex > 0 && (
                  <div className="px-3 py-1">
                    <div className="h-px bg-border"></div>
                  </div>
                )}
                
                {/* Section Items */}
                {section.items.map((item) => (
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
            ))}
          </div>

        </nav>
      </aside>
    </>
  );
};

export { Sidebar };