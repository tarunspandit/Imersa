import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, Lightbulb, Layers, Calendar, Activity,
  Users, Plug, Settings, HelpCircle, X, Menu,
  Sparkles, Palette, Shield, Zap, ChevronRight,
  Moon, Sun, Play, Grid
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { cn } from '@/utils';
import '@/styles/design-system.css';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  color?: string;
  badge?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarNew: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const primaryNav: NavItem[] = [
    { icon: Home, label: 'Dashboard', path: '/', color: 'from-yellow-400 to-orange-500' },
    { icon: Lightbulb, label: 'Lights', path: '/lights', color: 'from-blue-400 to-cyan-500' },
    { icon: Grid, label: 'Rooms', path: '/groups', color: 'from-purple-400 to-pink-500' },
    { icon: Sparkles, label: 'Scenes', path: '/scenes', color: 'from-green-400 to-emerald-500' },
    { icon: Calendar, label: 'Schedule', path: '/scheduler', color: 'from-indigo-400 to-purple-500' },
  ];

  const secondaryNav: NavItem[] = [
    { icon: Activity, label: 'Automation', path: '/automation' },
    { icon: Play, label: 'Entertainment', path: '/entertainment' },
    { icon: Users, label: 'Devices', path: '/devices' },
    { icon: Plug, label: 'Integrations', path: '/integrations' },
  ];

  const bottomNav: NavItem[] = [
    { icon: Shield, label: 'Bridge', path: '/bridge' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help', path: '/help' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const NavItemComponent = ({ item, index }: { item: NavItem; index?: number }) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    const isHovered = hoveredItem === item.path;
    
    return (
      <NavLink
        to={item.path}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300",
          "hover:bg-white/5",
          active && "bg-white/10"
        )}
        onMouseEnter={() => setHoveredItem(item.path)}
        onMouseLeave={() => setHoveredItem(null)}
        style={{ animationDelay: `${index ? index * 50 : 0}ms` }}
      >
        {/* Glow effect on hover */}
        {isHovered && !active && (
          <div 
            className="absolute inset-0 rounded-xl opacity-20"
            style={{
              background: item.color ? `linear-gradient(135deg, ${item.color})` : 'var(--gradient-warm)',
              filter: 'blur(10px)'
            }}
          />
        )}

        {/* Active indicator */}
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-yellow-400 to-orange-500 rounded-r-full" />
        )}

        {/* Icon with gradient on active/hover */}
        <div className={cn(
          "relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300",
          active && "bg-gradient-to-br shadow-lg",
          active && item.color && `bg-gradient-to-br ${item.color}`,
          !active && "bg-white/5"
        )}>
          <Icon className={cn(
            "w-5 h-5 transition-all duration-300",
            active ? "text-gray-900" : "text-gray-400",
            isHovered && !active && "text-white scale-110"
          )} />
        </div>

        {/* Label */}
        {!sidebarCollapsed && (
          <>
            <span className={cn(
              "font-medium transition-colors duration-300",
              active ? "text-white" : "text-gray-400",
              isHovered && !active && "text-white"
            )}>
              {item.label}
            </span>

            {/* Arrow indicator on hover */}
            {isHovered && (
              <ChevronRight className="ml-auto w-4 h-4 text-gray-400 animate-pulse" />
            )}

            {/* Badge if present */}
            {item.badge && (
              <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-semibold">
                {item.badge}
              </span>
            )}
          </>
        )}

        {/* Collapsed tooltip */}
        {sidebarCollapsed && isHovered && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 rounded-lg whitespace-nowrap z-50">
            <span className="text-white text-sm">{item.label}</span>
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:sticky top-0 left-0 h-screen z-50 md:z-30 transition-all duration-300",
        "bg-imersa-surface/95 backdrop-blur-xl border-r border-white/10",
        sidebarCollapsed ? "w-20" : "w-64",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Glass effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        <div className="relative h-full flex flex-col p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <Zap className="w-6 h-6 text-gray-900" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Imersa</h1>
                  <p className="text-xs text-gray-500">Smart Lighting</p>
                </div>
              </div>
            )}
            
            {/* Collapse/Expand button - Desktop only */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "hidden md:flex items-center justify-center w-8 h-8 rounded-lg",
                "bg-white/5 hover:bg-white/10 transition-colors",
                sidebarCollapsed && "mx-auto"
              )}
            >
              <Menu className="w-4 h-4 text-gray-400" />
            </button>

            {/* Close button - Mobile only */}
            <button
              onClick={onClose}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-6 overflow-y-auto">
            {/* Primary Navigation */}
            <div className="space-y-1">
              {primaryNav.map((item, index) => (
                <NavItemComponent key={item.path} item={item} index={index} />
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Secondary Navigation */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Features
                </p>
              )}
              {secondaryNav.map((item) => (
                <NavItemComponent key={item.path} item={item} />
              ))}
            </div>
          </nav>

          {/* Bottom Navigation */}
          <div className="space-y-1 pt-4 border-t border-white/10">
            {bottomNav.map((item) => (
              <NavItemComponent key={item.path} item={item} />
            ))}
          </div>

          {/* Theme Toggle */}
          {!sidebarCollapsed && (
            <div className="mt-4 p-3 rounded-xl bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Dark Mode</span>
                </div>
                <button className="relative w-12 h-6 rounded-full bg-white/10 transition-colors">
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg transition-transform transform translate-x-6" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default SidebarNew;