import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Lightbulb, Layers, Play, Menu } from 'lucide-react';
import { cn } from '@/utils';

interface MobileNavProps {
  onMenuClick?: () => void;
}

const mobileNavItems = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: Lightbulb, label: 'Lights', path: '/lights' },
  { icon: Layers, label: 'Groups', path: '/groups' },
  { icon: Play, label: 'Scenes', path: '/scenes' },
  { icon: Menu, label: 'More', action: true },
];

export const MobileNav: React.FC<MobileNavProps> = ({ onMenuClick }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background backdrop-blur-sm border-t shadow-lg">
      <div className="flex items-center justify-around py-2 safe-area-inset-bottom">
        {mobileNavItems.map((item) => {
          if (item.action) {
            return (
              <button
                key={item.label}
                onClick={onMenuClick}
                className="flex flex-col items-center justify-center p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path!}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center p-2 transition-colors',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;