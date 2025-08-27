// Entertainment Area Row Component with streaming controls
import React, { useState } from 'react';
import { Play, Square, Edit3, Trash2, Users, Activity } from 'lucide-react';
import { Button, Switch } from '@/components/ui';
import { EntertainmentArea } from '@/types';
import { cn } from '@/utils';

interface AreaRowProps {
  area: EntertainmentArea;
  onToggleStreaming: (areaId: string) => Promise<unknown>;
  onEditPositions: (area: EntertainmentArea) => void;
  onDelete: (areaId: string) => Promise<unknown>;
  isProcessing?: boolean;
}

export const AreaRow: React.FC<AreaRowProps> = ({
  area,
  onToggleStreaming,
  onEditPositions,
  onDelete,
  isProcessing = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleStreaming = async () => {
    setIsLoading(true);
    try {
      await onToggleStreaming(area.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    setIsLoading(true);
    try {
      await onDelete(area.id);
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <tr className={cn(
      'border-b border-gray-200 hover:bg-gray-50 transition-colors',
      isProcessing && 'opacity-60',
      area.isStreaming && 'bg-emerald-50 border-emerald-200'
    )}>
      {/* ID */}
      <td className="px-6 py-4 text-sm font-mono text-gray-900">
        {area.id}
      </td>

      {/* Name */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-900">
            {area.name}
          </span>
          {area.class && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {area.class}
            </span>
          )}
        </div>
        {area.description && (
          <p className="text-xs text-gray-500 mt-1">{area.description}</p>
        )}
      </td>

      {/* Lights Count */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">
            {area.lightIds.length} lights
          </span>
        </div>
        {area.lightIds.length > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            IDs: {area.lightIds.slice(0, 3).join(', ')}
            {area.lightIds.length > 3 && ` +${area.lightIds.length - 3} more`}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <div className={cn(
            'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
            area.isStreaming
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-gray-100 text-gray-800'
          )}>
            <Activity className={cn(
              'h-3 w-3',
              area.isStreaming ? 'text-emerald-600 animate-pulse' : 'text-gray-500'
            )} />
            <span>
              {area.isStreaming ? 'Streaming' : 'Inactive'}
            </span>
          </div>
        </div>
        {area.stream?.owner && (
          <div className="text-xs text-gray-500 mt-1">
            Owner: {area.stream.owner}
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          {/* Streaming Toggle */}
          <Button
            variant={area.isStreaming ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggleStreaming}
            disabled={isLoading || isProcessing}
            className="min-w-[80px]"
          >
            {isLoading ? (
              <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
            ) : area.isStreaming ? (
              <>
                <Square className="h-3 w-3 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Start
              </>
            )}
          </Button>

          {/* Edit Positions */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditPositions(area)}
            disabled={isLoading || isProcessing}
            title="Edit Light Positions"
          >
            <Edit3 className="h-3 w-3" />
          </Button>

          {/* Delete */}
          <div className="flex items-center space-x-1">
            <Button
              variant={showDeleteConfirm ? 'destructive' : 'ghost'}
              size="sm"
              onClick={handleDelete}
              disabled={isLoading || isProcessing}
              title={showDeleteConfirm ? 'Confirm Delete' : 'Delete Area'}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            
            {showDeleteConfirm && (
              <Button
                variant="outline"
                size="sm"
                onClick={cancelDelete}
                disabled={isLoading}
                title="Cancel Delete"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
          {area.stream?.proxymode && (
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              <span>Proxy Mode</span>
            </span>
          )}
          {area.locations && Object.keys(area.locations).length > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              <span>Positioned</span>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

export default AreaRow;
