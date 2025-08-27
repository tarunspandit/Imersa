// Entertainment Area Row Component with streaming controls
import React, { useState } from 'react';
import { Play, Square, Edit3, Trash2, Users, Activity } from 'lucide-react';
import '@/styles/design-system.css';
import { EntertainmentArea } from '@/types';
import { cn } from '@/utils';

interface AreaRowProps {
  area: EntertainmentArea;
  onToggleStreaming: (areaId: string) => Promise<void>;
  onEditPositions: (area: EntertainmentArea) => void;
  onDelete: (areaId: string) => Promise<void>;
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
      'border-b border-white/10 hover:bg-white/5 transition-all',
      isProcessing && 'opacity-60',
      area.isStreaming && 'bg-emerald-500/10'
    )}>
      {/* ID */}
      <td className="px-6 py-4 text-sm font-mono text-gray-400">
        {area.id}
      </td>

      {/* Name */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-white">
            {area.name}
          </span>
          {area.class && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
              {area.class}
            </span>
          )}
        </div>
        {area.description && (
          <p className="text-xs text-gray-400 mt-1">{area.description}</p>
        )}
      </td>

      {/* Lights Count */}
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-imersa-glow-secondary" />
          <span className="text-sm text-gray-300">
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
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-white/10 text-gray-400'
          )}>
            <Activity className={cn(
              'h-3 w-3',
              area.isStreaming ? 'text-emerald-400 animate-pulse' : 'text-gray-500'
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
          <button
            onClick={handleToggleStreaming}
            disabled={isLoading || isProcessing}
            className={cn(
              'px-3 py-1 rounded-xl text-sm transition-all flex items-center gap-1 min-w-[80px] justify-center',
              area.isStreaming 
                ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30',
              (isLoading || isProcessing) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
            ) : area.isStreaming ? (
              <>
                <Square className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Start
              </>
            )}
          </button>

          {/* Edit Positions */}
          <button
            onClick={() => onEditPositions(area)}
            disabled={isLoading || isProcessing}
            title="Edit Light Positions"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
          >
            <Edit3 className="h-3 w-3" />
          </button>

          {/* Delete */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handleDelete}
              disabled={isLoading || isProcessing}
              title={showDeleteConfirm ? 'Confirm Delete' : 'Delete Area'}
              className={cn(
                'p-1.5 rounded-lg transition-all disabled:opacity-50',
                showDeleteConfirm 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-red-400'
              )}
            >
              <Trash2 className="h-3 w-3" />
            </button>
            
            {showDeleteConfirm && (
              <button
                onClick={cancelDelete}
                disabled={isLoading}
                title="Cancel Delete"
                className="px-3 py-1 rounded-xl text-xs border border-white/10 text-gray-400 hover:border-white/20 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
          {area.stream?.proxymode && (
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-blue-400 rounded-full glow-dot"></span>
              <span>Proxy Mode</span>
            </span>
          )}
          {area.locations && Object.keys(area.locations).length > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-purple-400 rounded-full glow-dot"></span>
              <span>Positioned</span>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

export default AreaRow;