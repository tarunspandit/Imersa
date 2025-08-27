import React from 'react';
import { Menu, Search, Sun, Moon, Monitor, Command } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAppStore } from '@/stores';
import { useUniversalSearch } from '@/components/ui/UniversalSearch';
import { cn } from '@/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { theme, setTheme, sidebarCollapsed } = useAppStore();
  const { open: openSearch } = useUniversalSearch();

  const handleThemeChange = () => {
    const themes = ['light', 'dark', 'system'] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side - Menu button for mobile only */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-4 md:mx-8">
          <button
            onClick={openSearch}
            className="relative w-full flex items-center text-left text-sm border border-input bg-background rounded-md px-3 py-2 hover:bg-accent transition-colors group"
          >
            <Search className="text-muted-foreground h-4 w-4 mr-2" />
            <span className="text-muted-foreground flex-1 hidden sm:inline">Search lights, scenes, groups...</span>
            <span className="text-muted-foreground flex-1 sm:hidden">Search...</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-medium text-muted-foreground group-hover:text-foreground hidden md:flex items-center gap-1">
              <Command className="h-3 w-3" />
              K
            </kbd>
          </button>
        </div>

        {/* Right side - Theme toggle only */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeChange}
            aria-label="Toggle theme"
          >
            {getThemeIcon()}
          </Button>
        </div>
      </div>

    </header>
  );
};

export { Header };