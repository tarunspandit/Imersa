import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Switch, Button, Input, Card } from '@/components/ui';
import { ColorControls } from './ColorControls';
import { Trash2, Edit3, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { Light } from '@/types';

interface LightRowProps {
  light: Light;
  lightTypes: Array<{ id: string; name: string; manufacturer: string }>;
  onToggle: (lightId: string) => void;
  onBrightnessChange: (lightId: string, brightness: number) => void;
  onColorTemperatureChange: (lightId: string, ct: number) => void;
  onHueChange: (lightId: string, hue: number) => void;
  onSaturationChange: (lightId: string, sat: number) => void;
  onRename: (lightId: string, name: string) => void;
  onDelete: (lightId: string) => void;
  onTypeChange: (lightId: string, modelId: string) => void;
  className?: string;
}

export const LightRow: React.FC<LightRowProps> = ({
  light,
  lightTypes,
  onToggle,
  onBrightnessChange,
  onColorTemperatureChange,
  onHueChange,
  onSaturationChange,
  onRename,
  onDelete,
  onTypeChange,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(light.name);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleToggle = useCallback(() => {
    onToggle(light.id);
  }, [light.id, onToggle]);

  const handleStartEdit = useCallback(() => {
    setEditName(light.name);
    setIsEditing(true);
  }, [light.name]);

  const handleCancelEdit = useCallback(() => {
    setEditName(light.name);
    setIsEditing(false);
  }, [light.name]);

  const handleSaveEdit = useCallback(() => {
    if (editName.trim() && editName !== light.name) {
      onRename(light.id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, light.id, light.name, onRename]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onTypeChange(light.id, e.target.value);
  }, [light.id, onTypeChange]);

  const handleDelete = useCallback(() => {
    onDelete(light.id);
    setShowDeleteConfirm(false);
  }, [light.id, onDelete]);

  const getStatusColor = useCallback(() => {
    switch (light.status) {
      case 'online':
        return 'text-green-500';
      case 'offline':
        return 'text-gray-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  }, [light.status]);

  const getStatusIcon = useCallback(() => {
    return (
      <div
        className={`w-2 h-2 rounded-full ${
          light.status === 'online' ? 'bg-green-500' : 
          light.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
        }`}
        aria-label={`Light status: ${light.status}`}
      />
    );
  }, [light.status]);

  return (
    <Card className={`p-4 ${className}`}>
      {/* Main Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Status & Expand Button */}
        <div className="lg:col-span-1 flex items-center gap-2">
          {getStatusIcon()}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 h-6 w-6"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </Button>
        </div>

        {/* Name */}
        <div className="lg:col-span-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyPress}
                className="h-8 text-sm"
                aria-label="Edit light name"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveEdit}
                className="p-1 h-6 w-6 text-green-600"
                aria-label="Save name"
              >
                <Check size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="p-1 h-6 w-6 text-red-600"
                aria-label="Cancel edit"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{light.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Edit light name"
              >
                <Edit3 size={12} />
              </Button>
            </div>
          )}
        </div>

        {/* Model & Type */}
        <div className="lg:col-span-2">
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {light.model || 'Unknown Model'}
            </div>
            <select
              value={light.model || ''}
              onChange={handleTypeChange}
              className="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              aria-label="Light model type"
            >
              <option value="">Select type...</option>
              {lightTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* On/Off Toggle */}
        <div className="lg:col-span-1 flex justify-center">
          <Switch
            checked={light.isOn}
            onCheckedChange={handleToggle}
            aria-label={`Turn light ${light.isOn ? 'off' : 'on'}`}
          />
        </div>

        {/* Basic Controls - Mobile Stacked, Desktop Inline */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Brightness */}
          {light.capabilities.hasBrightness && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">Bri</span>
              <input
                type="range"
                min="0"
                max="100"
                value={light.brightness}
                onChange={(e) => onBrightnessChange(light.id, parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                aria-label="Brightness control"
              />
              <span className="text-xs text-gray-500 w-8">{light.brightness}</span>
            </div>
          )}

          {/* Color Temperature */}
          {light.capabilities.hasTemperature && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">CT</span>
              <input
                type="range"
                min="153"
                max="500"
                value={light.temperature || 300}
                onChange={(e) => onColorTemperatureChange(light.id, parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                aria-label="Color temperature control"
              />
              <span className="text-xs text-gray-500 w-8">{light.temperature || 300}</span>
            </div>
          )}

          {/* Color Preview */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-8">Color</span>
            <div
              className="w-8 h-6 rounded border border-gray-300 dark:border-gray-600"
              style={{
                backgroundColor: `rgb(${light.color.r}, ${light.color.g}, ${light.color.b})`,
              }}
              aria-label={`Current color: RGB(${light.color.r}, ${light.color.g}, ${light.color.b})`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="lg:col-span-2 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            aria-label="Delete light"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                Advanced Controls
              </h4>
              <ColorControls
                light={light}
                onBrightnessChange={(brightness) => onBrightnessChange(light.id, brightness)}
                onColorTemperatureChange={(ct) => onColorTemperatureChange(light.id, ct)}
                onHueChange={(hue) => onHueChange(light.id, hue)}
                onSaturationChange={(sat) => onSaturationChange(light.id, sat)}
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                Light Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Brand:</span>
                  <span>{light.brand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Type:</span>
                  <span className="capitalize">{light.type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={getStatusColor()}>{light.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Last Seen:</span>
                  <span>{new Date(light.lastSeen).toLocaleString()}</span>
                </div>
                {light.ip && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">IP Address:</span>
                    <span className="font-mono text-xs">{light.ip}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium mb-4">Delete Light</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{light.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default LightRow;