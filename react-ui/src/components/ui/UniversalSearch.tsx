import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  X, 
  Lightbulb, 
  Layers, 
  Play, 
  Settings, 
  Zap,
  Command,
  ArrowRight,
  Clock,
  Star
} from 'lucide-react';
import { cn } from '@/utils';
import { useLightsStore } from '@/stores';
import { toast } from 'react-hot-toast';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'light' | 'group' | 'scene' | 'action' | 'setting' | 'page';
  icon: React.ElementType;
  path?: string;
  action?: () => void;
  favorite?: boolean;
  recent?: boolean;
}

interface UniversalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { lights, groups, scenes } = useLightsStore();

  // Focus input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      // Load recent searches from localStorage
      const recent = localStorage.getItem('recentSearches');
      if (recent) {
        setRecentSearches(JSON.parse(recent).slice(0, 5));
      }
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Perform search
  useEffect(() => {
    if (!query) {
      // Show quick actions when no query
      setResults(getQuickActions());
      return;
    }

    const searchQuery = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search lights
    lights.forEach(light => {
      if (light.name.toLowerCase().includes(searchQuery)) {
        searchResults.push({
          id: `light-${light.id}`,
          title: light.name,
          subtitle: `Light • ${light.isOn ? 'On' : 'Off'}`,
          type: 'light',
          icon: Lightbulb,
          path: `/lights`,
          action: () => {
            navigate('/lights');
            toast(`Navigating to ${light.name}`);
          }
        });
      }
    });

    // Search groups
    groups.forEach(group => {
      if (group.name.toLowerCase().includes(searchQuery)) {
        searchResults.push({
          id: `group-${group.id}`,
          title: group.name,
          subtitle: `Group • ${group.lights?.length || 0} lights`,
          type: 'group',
          icon: Layers,
          path: `/groups`,
          action: () => {
            navigate('/groups');
            toast(`Navigating to ${group.name}`);
          }
        });
      }
    });

    // Search scenes
    scenes.forEach(scene => {
      if (scene.name.toLowerCase().includes(searchQuery)) {
        searchResults.push({
          id: `scene-${scene.id}`,
          title: scene.name,
          subtitle: `Scene • ${scene.isActive ? 'Active' : 'Inactive'}`,
          type: 'scene',
          icon: Play,
          action: () => {
            // Apply scene
            toast(`Applying scene: ${scene.name}`);
          }
        });
      }
    });

    // Search pages
    const pages = [
      { title: 'Dashboard', path: '/', icon: Lightbulb },
      { title: 'Settings', path: '/settings', icon: Settings },
      { title: 'WLED', path: '/wled', icon: Zap },
      { title: 'Entertainment', path: '/entertainment', icon: Play },
      { title: 'Integrations', path: '/integrations', icon: Layers },
      { title: 'Bridge Management', path: '/bridge', icon: Settings },
      { title: 'Help', path: '/help', icon: Settings },
    ];

    pages.forEach(page => {
      if (page.title.toLowerCase().includes(searchQuery)) {
        searchResults.push({
          id: `page-${page.path}`,
          title: page.title,
          subtitle: 'Page',
          type: 'page',
          icon: page.icon,
          path: page.path,
          action: () => navigate(page.path)
        });
      }
    });

    // Search actions
    const actions = [
      { title: 'Turn All Lights On', action: () => toast('All lights on') },
      { title: 'Turn All Lights Off', action: () => toast('All lights off') },
      { title: 'Set Brightness to 100%', action: () => toast('Brightness set to 100%') },
      { title: 'Set Brightness to 50%', action: () => toast('Brightness set to 50%') },
      { title: 'Create New Scene', action: () => navigate('/scenes') },
      { title: 'Create New Group', action: () => navigate('/groups') },
    ];

    actions.forEach(action => {
      if (action.title.toLowerCase().includes(searchQuery)) {
        searchResults.push({
          id: `action-${action.title}`,
          title: action.title,
          subtitle: 'Action',
          type: 'action',
          icon: Command,
          action: action.action
        });
      }
    });

    setResults(searchResults.slice(0, 8));
  }, [query, lights, groups, scenes, navigate]);

  const getQuickActions = (): SearchResult[] => {
    return [
      {
        id: 'quick-all-on',
        title: 'Turn All Lights On',
        subtitle: 'Quick Action',
        type: 'action',
        icon: Lightbulb,
        action: () => {
          toast('All lights turned on');
          onClose();
        }
      },
      {
        id: 'quick-all-off',
        title: 'Turn All Lights Off',
        subtitle: 'Quick Action',
        type: 'action',
        icon: Lightbulb,
        action: () => {
          toast('All lights turned off');
          onClose();
        }
      },
      {
        id: 'quick-scenes',
        title: 'Manage Scenes',
        subtitle: 'Navigate',
        type: 'page',
        icon: Play,
        path: '/scenes',
        action: () => {
          navigate('/scenes');
          onClose();
        }
      },
      {
        id: 'quick-settings',
        title: 'Settings',
        subtitle: 'Navigate',
        type: 'page',
        icon: Settings,
        path: '/settings',
        action: () => {
          navigate('/settings');
          onClose();
        }
      }
    ];
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, results, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSelect = (result: SearchResult) => {
    // Save to recent searches
    if (query) {
      const updatedRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(updatedRecent);
      localStorage.setItem('recentSearches', JSON.stringify(updatedRecent));
    }

    // Execute action or navigate
    if (result.action) {
      result.action();
    } else if (result.path) {
      navigate(result.path);
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Search Modal */}
      <div className="relative w-full max-w-2xl bg-background border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-5">
        {/* Search Input */}
        <div className="flex items-center border-b">
          <Search className="w-5 h-5 text-muted-foreground ml-4" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lights, scenes, actions, or pages..."
            className="flex-1 px-4 py-4 bg-transparent outline-none text-lg"
          />
          <button
            onClick={onClose}
            className="p-4 hover:bg-accent rounded-tr-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div className="px-4 py-2 border-b">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Recent:</span>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(search)}
                  className="hover:text-foreground transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((result, index) => {
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                      index === selectedIndex 
                        ? 'bg-accent text-accent-foreground' 
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      index === selectedIndex ? 'bg-background/50' : 'bg-accent'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {result.title}
                        {result.favorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                      </div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                      )}
                    </div>
                    {index === selectedIndex && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Enter</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : query ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try searching for something else</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background rounded border">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">Enter</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">Esc</kbd>
              Close
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>Cmd+K</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to manage universal search
export const useUniversalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false)
  };
};

export default UniversalSearch;