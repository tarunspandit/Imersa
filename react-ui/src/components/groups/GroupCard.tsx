// Group Card Component with drag-drop support and controls
import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Palette, 
  Sun, 
  Trash2, 
  Edit3,
  Home,
  Activity,
  ChevronDown,
  ChevronRight,
  GripHorizontal
} from 'lucide-react';
import { Button, Card, CardContent, Slider, Switch } from '@/components/ui';
import { LightGroup, GroupAction, Light } from '@/types';
import { cn } from '@/utils';

interface GroupCardProps {
  group: LightGroup;
  availableLights?: Light[];
  onToggle: (groupId: string) => Promise<void>;
  onUpdateBrightness: (groupId: string, brightness: number) => Promise<void>;
  onUpdateColor: (groupId: string, color: { r: number; g: number; b: number }) => Promise<void>;
  onApplyAction: (groupId: string, action: GroupAction) => Promise<void>;
  onEdit: (group: LightGroup) => void;
  onDelete: (groupId: string) => Promise<void>;
  onAddLights: (groupId: string, lightIds: string[]) => Promise<void>;
  onRemoveLights: (groupId: string, lightIds: string[]) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  availableLights = [],
  onToggle,
  onUpdateBrightness,
  onUpdateColor,
  onApplyAction,
  onEdit,
  onDelete,
  onAddLights,
  onRemoveLights,
  isProcessing = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localBrightness, setLocalBrightness] = useState(group.brightness);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Get lights in this group
  const groupLights = useMemo(() => {
    return availableLights.filter(light => group.lightIds.includes(light.id));
  }, [availableLights, group.lightIds]);

  // Get available lights to add
  const availableLightsToAdd = useMemo(() => {
    return availableLights.filter(light => !group.lightIds.includes(light.id));
  }, [availableLights, group.lightIds]);

  // Handle toggle
  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onToggle(group.id);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle brightness change (with debouncing)
  const handleBrightnessChange = async (brightness: number) => {
    setLocalBrightness(brightness);
    
    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        await onUpdateBrightness(group.id, brightness);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle color change
  const handleColorChange = async (color: { r: number; g: number; b: number }) => {
    setIsLoading(true);
    try {
      await onUpdateColor(group.id, color);
      setShowColorPicker(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    setIsLoading(true);
    try {
      await onDelete(group.id);
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Get group type icon
  const getGroupTypeIcon = () => {
    switch (group.type) {
      case 'room':
        return <Home className="h-4 w-4" />;
      case 'entertainment':
        return <Activity className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (!group.isOn) return 'bg-gray-100 text-gray-600';
    if (group.type === 'entertainment' && group.stream?.active) {
      return 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200';
    }
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <Card className={cn(
      'transition-all duration-200',
      isProcessing && 'opacity-60',
      group.isOn && 'ring-2 ring-blue-200',
      group.type === 'entertainment' && group.stream?.active && 'ring-emerald-200',
      className
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* Drag Handle */}
            <div className="cursor-move text-gray-400 hover:text-gray-600">
              <GripHorizontal className="h-4 w-4" />
            </div>

            {/* Group Info */}
            <div className="flex items-center space-x-2">
              {getGroupTypeIcon()}
              <div>
                <h3 className="font-medium text-gray-900">{group.name}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{group.lightIds.length} lights</span>
                  {group.class && (
                    <>
                      <span>•</span>
                      <span>{group.class}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status & Controls */}
          <div className="flex items-center space-x-2">
            {/* Status Indicator */}
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              getStatusColor()
            )}>
              {group.type === 'entertainment' && group.stream?.active
                ? 'Streaming'
                : group.isOn
                ? 'On'
                : 'Off'
              }
            </div>

            {/* Power Toggle */}
            <Switch
              checked={group.isOn}
              onCheckedChange={() => handleToggle()}
              disabled={isLoading || isProcessing}
            />

            {/* Expand/Collapse */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Quick Controls (Always Visible) */}
        {group.isOn && (
          <div className="space-y-3 mb-3">
            {/* Brightness */}
            <div className="flex items-center space-x-3">
              <Sun className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <Slider
                  value={[localBrightness]}
                  onValueChange={(value) => handleBrightnessChange(value[0])}
                  max={100}
                  step={1}
                  className="w-full"
                  disabled={isLoading || isProcessing}
                />
              </div>
              <span className="text-sm text-gray-500 min-w-[3rem] text-right">
                {localBrightness}%
              </span>
            </div>

            {/* Color Preview */}
            <div className="flex items-center space-x-3">
              <Palette className="h-4 w-4 text-gray-400" />
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center space-x-2 px-3 py-1 rounded border hover:bg-gray-50"
                disabled={isLoading || isProcessing}
              >
                <div 
                  className="w-4 h-4 rounded border"
                  style={{
                    backgroundColor: `rgb(${group.color.r}, ${group.color.g}, ${group.color.b})`
                  }}
                />
                <span className="text-sm text-gray-600">Change Color</span>
              </button>
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t border-gray-100">
            {/* Group Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Type</label>
                <p className="text-gray-600 capitalize">{group.type}</p>
              </div>
              <div>
                <label className="font-medium text-gray-700">Sync Mode</label>
                <p className="text-gray-600 capitalize">{group.syncMode}</p>
              </div>
              {group.room && (
                <div className="col-span-2">
                  <label className="font-medium text-gray-700">Room</label>
                  <p className="text-gray-600">{group.room.name} ({group.room.class})</p>
                </div>
              )}
            </div>

            {/* Lights in Group */}
            {groupLights.length > 0 && (
              <div>
                <label className="font-medium text-gray-700 mb-2 block">
                  Lights ({groupLights.length})
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                  {groupLights.map((light) => (
                    <div
                      key={light.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          light.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                        )} />
                        <span>{light.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveLights(group.id, [light.id])}
                        className="p-1 h-6 w-6"
                        title="Remove from group"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Lights to Add */}
            {availableLightsToAdd.length > 0 && (
              <div>
                <label className="font-medium text-gray-700 mb-2 block">
                  Available Lights
                </label>
                <div className="grid grid-cols-1 gap-1 max-h-24 overflow-y-auto">
                  {availableLightsToAdd.slice(0, 5).map((light) => (
                    <button
                      key={light.id}
                      onClick={() => onAddLights(group.id, [light.id])}
                      className="flex items-center space-x-2 p-1 text-sm hover:bg-gray-50 rounded text-left"
                      disabled={isLoading || isProcessing}
                    >
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        light.status === 'online' ? 'bg-green-400' : 'bg-gray-400'
                      )} />
                      <span>{light.name}</span>
                    </button>
                  ))}
                  {availableLightsToAdd.length > 5 && (
                    <p className="text-xs text-gray-500 p-1">
                      +{availableLightsToAdd.length - 5} more lights available
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Entertainment Specific */}
            {group.type === 'entertainment' && (
              <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                <h4 className="font-medium text-emerald-800 mb-2">Entertainment Settings</h4>
                <div className="text-sm text-emerald-700">
                  <p>Streaming: {group.stream?.active ? 'Active' : 'Inactive'}</p>
                  {group.stream?.owner && <p>Owner: {group.stream.owner}</p>}
                  <p>Positioned Lights: {group.locations ? Object.keys(group.locations).length : 0}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(group)}
                  disabled={isLoading || isProcessing}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  disabled={isLoading || isProcessing}
                >
                  <Palette className="h-3 w-3 mr-1" />
                  Color
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                {showDeleteConfirm ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isLoading}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isLoading || isProcessing}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Color Picker Modal (Simple) */}
        {showColorPicker && (
          <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            <h4 className="font-medium mb-3">Choose Color</h4>
            <div className="grid grid-cols-8 gap-2">
              {[
                { r: 255, g: 255, b: 255 }, // White
                { r: 255, g: 0, b: 0 },     // Red
                { r: 0, g: 255, b: 0 },     // Green
                { r: 0, g: 0, b: 255 },     // Blue
                { r: 255, g: 255, b: 0 },   // Yellow
                { r: 255, g: 0, b: 255 },   // Magenta
                { r: 0, g: 255, b: 255 },   // Cyan
                { r: 255, g: 165, b: 0 },   // Orange
              ].map((color, index) => (
                <button
                  key={index}
                  onClick={() => handleColorChange(color)}
                  className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-500"
                  style={{
                    backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`
                  }}
                />
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowColorPicker(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded">
            <div className="animate-spin h-5 w-5 border border-current border-t-transparent rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GroupCard;
