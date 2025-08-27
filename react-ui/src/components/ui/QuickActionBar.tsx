import React from 'react';
import { Button } from './Button';
import { cn } from '@/utils';
import { 
  Power, Sun, Moon, Palette, 
  Play, Home, Zap, Settings 
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  disabled?: boolean;
}

interface QuickActionBarProps {
  actions: QuickAction[];
  position?: 'top' | 'bottom';
  floating?: boolean;
  className?: string;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  actions,
  position = 'bottom',
  floating = true,
  className
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg',
        floating && position === 'bottom' && 'fixed bottom-4 left-1/2 -translate-x-1/2 z-30',
        floating && position === 'top' && 'fixed top-20 left-1/2 -translate-x-1/2 z-30',
        'animate-in slide-in-from-bottom-2',
        className
      )}
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'outline'}
          size="sm"
          onClick={action.action}
          disabled={action.disabled}
          className="flex items-center gap-2"
        >
          <action.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
      ))}
    </div>
  );
};

// Preset action configurations
export const presetActions = {
  allLights: (onAction: (action: string) => void): QuickAction[] => [
    {
      id: 'all-on',
      label: 'All On',
      icon: Power,
      action: () => onAction('all-on'),
      variant: 'default'
    },
    {
      id: 'all-off',
      label: 'All Off',
      icon: Power,
      action: () => onAction('all-off'),
      variant: 'outline'
    },
    {
      id: 'bright',
      label: 'Bright',
      icon: Sun,
      action: () => onAction('bright')
    },
    {
      id: 'dim',
      label: 'Dim',
      icon: Moon,
      action: () => onAction('dim')
    },
    {
      id: 'colors',
      label: 'Colors',
      icon: Palette,
      action: () => onAction('colors')
    }
  ],
  
  scenes: (scenes: any[], onApply: (sceneId: string) => void): QuickAction[] => 
    scenes.slice(0, 5).map(scene => ({
      id: `scene-${scene.id}`,
      label: scene.name,
      icon: Play,
      action: () => onApply(scene.id),
      variant: 'outline'
    })),
    
  rooms: (rooms: any[], onSelect: (roomId: string) => void): QuickAction[] =>
    rooms.map(room => ({
      id: `room-${room.id}`,
      label: room.name,
      icon: Home,
      action: () => onSelect(room.id),
      variant: 'ghost'
    }))
};