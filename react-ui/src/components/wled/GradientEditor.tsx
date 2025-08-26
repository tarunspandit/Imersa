import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { GradientZone, WLEDDevice } from '@/types';
import { Palette, Plus, Trash2, Eye, Download, Upload, Copy, Play, Pause } from 'lucide-react';

interface GradientEditorProps {
  device: WLEDDevice;
  zones: GradientZone[];
  onZonesChange: (zones: GradientZone[]) => void;
  onPreview?: (zones: GradientZone[]) => Promise<string | null>;
  onApply?: (zones: GradientZone[]) => Promise<void>;
  className?: string;
}

interface DragState {
  isDragging: boolean;
  zoneId: string | null;
  dragType: 'move' | 'resize-start' | 'resize-end' | null;
  startX: number;
  startPosition: number;
  startEndPosition?: number;
}

export const GradientEditor: React.FC<GradientEditorProps> = ({
  device,
  zones,
  onZonesChange,
  onPreview,
  onApply,
  className = '',
}) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    zoneId: null,
    dragType: null,
    startX: 0,
    startPosition: 0,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addZone = useCallback(() => {
    const newZone: GradientZone = {
      id: generateId(),
      name: `Zone ${zones.length + 1}`,
      startPosition: zones.length > 0 ? Math.max(...zones.map(z => z.endPosition)) : 0,
      endPosition: zones.length > 0 ? Math.min(Math.max(...zones.map(z => z.endPosition)) + 0.2, 1) : 0.2,
      color: { r: 255, g: 255, b: 255 },
      brightness: 100,
      transition: { type: 'smooth', duration: 1000 },
    };
    onZonesChange([...zones, newZone]);
    setSelectedZone(newZone.id);
  }, [zones, onZonesChange]);

  const removeZone = useCallback((zoneId: string) => {
    onZonesChange(zones.filter(z => z.id !== zoneId));
    if (selectedZone === zoneId) {
      setSelectedZone(null);
    }
  }, [zones, onZonesChange, selectedZone]);

  const updateZone = useCallback((zoneId: string, updates: Partial<GradientZone>) => {
    onZonesChange(zones.map(zone => 
      zone.id === zoneId ? { ...zone, ...updates } : zone
    ));
  }, [zones, onZonesChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent, zoneId: string, dragType: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    const zone = zones.find(z => z.id === zoneId);
    if (!zone || !editorRef.current) return;

    const rect = editorRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;

    setDragState({
      isDragging: true,
      zoneId,
      dragType,
      startX,
      startPosition: zone.startPosition,
      startEndPosition: zone.endPosition,
    });
    setSelectedZone(zoneId);
  }, [zones]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.zoneId || !editorRef.current) return;

    const rect = editorRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const deltaX = currentX - dragState.startX;
    const deltaPosition = deltaX / rect.width;

    const zone = zones.find(z => z.id === dragState.zoneId);
    if (!zone) return;

    let updates: Partial<GradientZone> = {};

    switch (dragState.dragType) {
      case 'move': {
        const zoneDuration = zone.endPosition - zone.startPosition;
        const newStart = Math.max(0, Math.min(1 - zoneDuration, dragState.startPosition + deltaPosition));
        updates = {
          startPosition: newStart,
          endPosition: newStart + zoneDuration,
        };
        break;
      }
      case 'resize-start': {
        const newStart = Math.max(0, Math.min(zone.endPosition - 0.01, dragState.startPosition + deltaPosition));
        updates = { startPosition: newStart };
        break;
      }
      case 'resize-end': {
        const newEnd = Math.max(zone.startPosition + 0.01, Math.min(1, (dragState.startEndPosition || zone.endPosition) + deltaPosition));
        updates = { endPosition: newEnd };
        break;
      }
    }

    if (Object.keys(updates).length > 0) {
      updateZone(dragState.zoneId, updates);
    }
  }, [dragState, zones, updateZone]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      zoneId: null,
      dragType: null,
      startX: 0,
      startPosition: 0,
    });
  }, []);

  const handlePreview = useCallback(async () => {
    if (!onPreview) return;
    
    setIsPreviewLoading(true);
    try {
      const url = await onPreview(zones);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [onPreview, zones]);

  const handleApply = useCallback(async () => {
    if (!onApply) return;
    
    setIsApplying(true);
    try {
      await onApply(zones);
    } catch (error) {
      console.error('Apply failed:', error);
    } finally {
      setIsApplying(false);
    }
  }, [onApply, zones]);

  const exportGradient = useCallback(() => {
    const gradientData = {
      name: `${device.name} Gradient`,
      deviceId: device.id,
      zones,
      createdAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(gradientData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gradient-${device.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [device, zones]);

  const importGradient = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.zones && Array.isArray(data.zones)) {
            onZonesChange(data.zones);
          }
        } catch (error) {
          console.error('Failed to import gradient:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [onZonesChange]);

  const duplicateZone = useCallback((zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;

    const newZone: GradientZone = {
      ...zone,
      id: generateId(),
      name: `${zone.name} Copy`,
      startPosition: Math.min(zone.endPosition, 0.9),
      endPosition: Math.min(zone.endPosition + (zone.endPosition - zone.startPosition), 1),
    };
    onZonesChange([...zones, newZone]);
  }, [zones, onZonesChange]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging && editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const deltaX = currentX - dragState.startX;
        const deltaPosition = deltaX / rect.width;

        const zone = zones.find(z => z.id === dragState.zoneId);
        if (!zone) return;

        let updates: Partial<GradientZone> = {};

        switch (dragState.dragType) {
          case 'move': {
            const zoneDuration = zone.endPosition - zone.startPosition;
            const newStart = Math.max(0, Math.min(1 - zoneDuration, dragState.startPosition + deltaPosition));
            updates = {
              startPosition: newStart,
              endPosition: newStart + zoneDuration,
            };
            break;
          }
          case 'resize-start': {
            const newStart = Math.max(0, Math.min(zone.endPosition - 0.01, dragState.startPosition + deltaPosition));
            updates = { startPosition: newStart };
            break;
          }
          case 'resize-end': {
            const newEnd = Math.max(zone.startPosition + 0.01, Math.min(1, (dragState.startEndPosition || zone.endPosition) + deltaPosition));
            updates = { endPosition: newEnd };
            break;
          }
        }

        if (Object.keys(updates).length > 0) {
          updateZone(dragState.zoneId!, updates);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setDragState({
        isDragging: false,
        zoneId: null,
        dragType: null,
        startX: 0,
        startPosition: 0,
      });
    };

    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, zones, updateZone]);

  const selectedZoneData = selectedZone ? zones.find(z => z.id === selectedZone) : null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Toolbar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Gradient Editor
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={importGradient}
                className="flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportGradient}
                className="flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              {onPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className="flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  {isPreviewLoading ? 'Loading...' : 'Preview'}
                </Button>
              )}
              {onApply && (
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isApplying || zones.length === 0}
                  className="flex items-center gap-1"
                >
                  <Play className="w-4 h-4" />
                  {isApplying ? 'Applying...' : 'Apply'}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={addZone}
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Zone
            </Button>
            <div className="text-sm text-muted-foreground">
              Device: {device.name} ({device.gradientMode} mode)
            </div>
          </div>

          {/* Gradient Timeline */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Gradient Timeline</div>
            <div 
              ref={editorRef}
              className="relative h-20 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Background gradient preview */}
              <div 
                className="absolute inset-0"
                style={{
                  background: zones.length > 0 ? `linear-gradient(to right, ${zones
                    .sort((a, b) => a.startPosition - b.startPosition)
                    .map(zone => {
                      const color = `rgb(${zone.color.r}, ${zone.color.g}, ${zone.color.b})`;
                      return `${color} ${zone.startPosition * 100}%, ${color} ${zone.endPosition * 100}%`;
                    }).join(', ')})` : 'transparent'
                }}
              />

              {/* Zone markers */}
              {zones.map(zone => (
                <div
                  key={zone.id}
                  className={`absolute top-0 bottom-0 border-2 transition-all ${
                    selectedZone === zone.id
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/80 bg-white/10 hover:border-blue-300'
                  }`}
                  style={{
                    left: `${zone.startPosition * 100}%`,
                    right: `${(1 - zone.endPosition) * 100}%`,
                  }}
                  onClick={() => setSelectedZone(zone.id)}
                >
                  {/* Zone name */}
                  <div className="absolute -top-6 left-0 text-xs font-medium px-1 py-0.5 bg-black/70 text-white rounded truncate max-w-20">
                    {zone.name}
                  </div>
                  
                  {/* Resize handles */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500/50 cursor-ew-resize hover:bg-blue-500"
                    onMouseDown={(e) => handleMouseDown(e, zone.id, 'resize-start')}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 bg-blue-500/50 cursor-ew-resize hover:bg-blue-500"
                    onMouseDown={(e) => handleMouseDown(e, zone.id, 'resize-end')}
                  />
                  
                  {/* Move handle */}
                  <div
                    className="absolute inset-0 cursor-move"
                    onMouseDown={(e) => handleMouseDown(e, zone.id, 'move')}
                  />
                </div>
              ))}
            </div>
            
            {/* Timeline labels */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Start (0%)</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>End (100%)</span>
            </div>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Preview</div>
              <img 
                src={previewUrl} 
                alt="Gradient preview" 
                className="w-full h-20 object-cover rounded-lg border"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zone Editor */}
      {selectedZoneData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Zone Settings: {selectedZoneData.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicateZone(selectedZoneData.id)}
                  className="flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeZone(selectedZoneData.id)}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Zone Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Zone Name</label>
              <Input
                value={selectedZoneData.name}
                onChange={(e) => updateZone(selectedZoneData.id, { name: e.target.value })}
                placeholder="Enter zone name"
              />
            </div>

            {/* Position */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Position (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={(selectedZoneData.startPosition * 100).toFixed(1)}
                  onChange={(e) => updateZone(selectedZoneData.id, { 
                    startPosition: Math.max(0, Math.min(1, parseFloat(e.target.value) / 100)) 
                  })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Position (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={(selectedZoneData.endPosition * 100).toFixed(1)}
                  onChange={(e) => updateZone(selectedZoneData.id, { 
                    endPosition: Math.max(0, Math.min(1, parseFloat(e.target.value) / 100)) 
                  })}
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Red</label>
                  <Slider
                    value={[selectedZoneData.color.r]}
                    onValueChange={([r]) => updateZone(selectedZoneData.id, { 
                      color: { ...selectedZoneData.color, r } 
                    })}
                    max={255}
                    step={1}
                    className="mt-1"
                  />
                  <div className="text-xs text-center mt-1">{selectedZoneData.color.r}</div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Green</label>
                  <Slider
                    value={[selectedZoneData.color.g]}
                    onValueChange={([g]) => updateZone(selectedZoneData.id, { 
                      color: { ...selectedZoneData.color, g } 
                    })}
                    max={255}
                    step={1}
                    className="mt-1"
                  />
                  <div className="text-xs text-center mt-1">{selectedZoneData.color.g}</div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Blue</label>
                  <Slider
                    value={[selectedZoneData.color.b]}
                    onValueChange={([b]) => updateZone(selectedZoneData.id, { 
                      color: { ...selectedZoneData.color, b } 
                    })}
                    max={255}
                    step={1}
                    className="mt-1"
                  />
                  <div className="text-xs text-center mt-1">{selectedZoneData.color.b}</div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Preview</label>
                  <div 
                    className="w-full h-8 rounded border mt-1"
                    style={{
                      backgroundColor: `rgb(${selectedZoneData.color.r}, ${selectedZoneData.color.g}, ${selectedZoneData.color.b})`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Brightness */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Brightness ({selectedZoneData.brightness}%)</label>
              <Slider
                value={[selectedZoneData.brightness]}
                onValueChange={([brightness]) => updateZone(selectedZoneData.id, { brightness })}
                max={100}
                step={1}
              />
            </div>

            {/* Transition */}
            <div className="space-y-4">
              <label className="text-sm font-medium">Transition</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Type</label>
                  <select
                    value={selectedZoneData.transition.type}
                    onChange={(e) => updateZone(selectedZoneData.id, {
                      transition: {
                        ...selectedZoneData.transition,
                        type: e.target.value as 'linear' | 'smooth' | 'sharp'
                      }
                    })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  >
                    <option value="linear">Linear</option>
                    <option value="smooth">Smooth</option>
                    <option value="sharp">Sharp</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Duration (ms)</label>
                  <Input
                    type="number"
                    min="0"
                    max="10000"
                    step="100"
                    value={selectedZoneData.transition.duration}
                    onChange={(e) => updateZone(selectedZoneData.id, {
                      transition: {
                        ...selectedZoneData.transition,
                        duration: parseInt(e.target.value) || 1000
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone List */}
      {zones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Zones ({zones.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {zones
                .sort((a, b) => a.startPosition - b.startPosition)
                .map((zone, index) => (
                <div
                  key={zone.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedZone === zone.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedZone(zone.id)}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded border-2 border-white shadow-sm"
                      style={{
                        backgroundColor: `rgb(${zone.color.r}, ${zone.color.g}, ${zone.color.b})`
                      }}
                    />
                    <div>
                      <div className="font-medium">{zone.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(zone.startPosition * 100).toFixed(1)}% - {(zone.endPosition * 100).toFixed(1)}% 
                        ({((zone.endPosition - zone.startPosition) * 100).toFixed(1)}% width)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      {zone.brightness}%
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeZone(zone.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GradientEditor;