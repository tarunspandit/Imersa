import React, { useState, useCallback } from 'react';
import { Button, Input, Card } from '@/components/ui';
import { Scene, LightGroup } from '@/types';
import { Trash2, Edit3, Play, Palette, Star, Clock, Eye } from 'lucide-react';

interface SceneRowProps {
  scene: Scene;
  groups: LightGroup[];
  isSelected: boolean;
  onSelect: (sceneId: string) => void;
  onRename: (sceneId: string, newName: string) => Promise<void>;
  onDelete: (sceneId: string) => Promise<void>;
  onRecall: (groupId: string, sceneId: string) => Promise<void>;
  onStoreLightState: (sceneId: string) => Promise<void>;
  onPreview: (sceneId: string) => Promise<void>;
  onToggleFavorite?: (sceneId: string) => void;
}

export const SceneRow: React.FC<SceneRowProps> = ({
  scene,
  groups,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  onRecall,
  onStoreLightState,
  onPreview,
  onToggleFavorite,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(scene.name);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const associatedGroup = scene.group ? groups.find(g => g.id === scene.group) : null;

  const handleRename = useCallback(async () => {
    if (editName.trim() === scene.name) {
      setIsEditing(false);
      return;
    }

    setIsActionLoading('rename');
    try {
      await onRename(scene.id, editName.trim());
      setIsEditing(false);
    } catch (error) {
      // Error handling is done in parent component
      setEditName(scene.name); // Reset on error
    } finally {
      setIsActionLoading(null);
    }
  }, [editName, scene.name, scene.id, onRename]);

  const handleRecall = useCallback(async () => {
    if (!associatedGroup) return;
    
    setIsActionLoading('recall');
    try {
      await onRecall(associatedGroup.id, scene.id);
    } finally {
      setIsActionLoading(null);
    }
  }, [associatedGroup, scene.id, onRecall]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Are you sure you want to delete the scene "${scene.name}"?`)) return;
    
    setIsActionLoading('delete');
    try {
      await onDelete(scene.id);
    } finally {
      setIsActionLoading(null);
    }
  }, [scene.id, scene.name, onDelete]);

  const handleStoreLightState = useCallback(async () => {
    setIsActionLoading('store');
    try {
      await onStoreLightState(scene.id);
    } finally {
      setIsActionLoading(null);
    }
  }, [scene.id, onStoreLightState]);

  const handlePreview = useCallback(async () => {
    setIsActionLoading('preview');
    try {
      await onPreview(scene.id);
    } finally {
      setIsActionLoading(null);
    }
  }, [scene.id, onPreview]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(scene.name);
      setIsEditing(false);
    }
  }, [handleRename, scene.name]);

  const getCategoryColor = (category: Scene['category']) => {
    switch (category) {
      case 'Evening': return 'bg-purple-100 text-purple-800';
      case 'Party': return 'bg-pink-100 text-pink-800';
      case 'Work': return 'bg-blue-100 text-blue-800';
      case 'Relax': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatLastUpdated = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        'day'
      );
    } catch {
      return 'Unknown';
    }
  };

  return (
    <tr 
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50' : ''
      } ${scene.isActive ? 'bg-green-50 border-green-200' : ''}`}
    >
      {/* Selection checkbox */}
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(scene.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>

      {/* Scene ID */}
      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
        {scene.id}
      </td>

      {/* Scene Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {scene.isFavorite && (
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          )}
          {scene.isActive && (
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyPress}
              className="min-w-0 flex-1"
              autoFocus
              disabled={isActionLoading === 'rename'}
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium text-gray-900 truncate">
                {scene.name}
              </span>
              {scene.category && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(scene.category)}`}>
                  {scene.category}
                </span>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Scene Type */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          scene.type === 'GroupScene' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {scene.type === 'GroupScene' ? 'Group Scene' : 'Light Scene'}
        </span>
      </td>

      {/* Associated Group */}
      <td className="px-4 py-3">
        {associatedGroup ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900">{associatedGroup.name}</span>
            <span className="text-xs text-gray-500">({associatedGroup.id})</span>
          </div>
        ) : scene.lights.length > 0 ? (
          <span className="text-sm text-gray-500">
            {scene.lights.length} light{scene.lights.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-sm text-gray-400">No group</span>
        )}
      </td>

      {/* Last Updated */}
      <td className="px-4 py-3 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatLastUpdated(scene.lastUpdated)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* Preview button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreview}
            disabled={!!isActionLoading}
            className="h-8 w-8 p-0"
            title="Preview scene"
          >
            {isActionLoading === 'preview' ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>

          {/* Store current state */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStoreLightState}
            disabled={!!isActionLoading}
            className="h-8 w-8 p-0"
            title="Store current light state"
          >
            {isActionLoading === 'store' ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            ) : (
              <Palette className="h-3 w-3" />
            )}
          </Button>

          {/* Recall scene button - only show if group is available */}
          {associatedGroup && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRecall}
              disabled={!!isActionLoading}
              className="h-8 w-8 p-0"
              title={`Activate scene in ${associatedGroup.name}`}
            >
              {isActionLoading === 'recall' ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          )}

          {/* Favorite toggle */}
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleFavorite(scene.id)}
              disabled={!!isActionLoading}
              className="h-8 w-8 p-0"
              title={scene.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`h-3 w-3 ${scene.isFavorite ? 'text-yellow-500 fill-yellow-500' : ''}`} />
            </Button>
          )}

          {/* Edit button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            disabled={!!isActionLoading}
            className="h-8 w-8 p-0"
            title="Rename scene"
          >
            <Edit3 className="h-3 w-3" />
          </Button>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={!!isActionLoading}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete scene"
          >
            {isActionLoading === 'delete' ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
};