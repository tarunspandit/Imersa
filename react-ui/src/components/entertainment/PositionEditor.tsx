// 3D Position Editor for Entertainment Lights
import React, { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Move, Grid, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { LightPosition, EntertainmentArea } from '@/types';
import { cn } from '@/utils';

interface PositionEditorProps {
  area: EntertainmentArea | null;
  positions: LightPosition[];
  onUpdatePositions: (areaId: string, positions: LightPosition[]) => Promise<void>;
  onLoadPositions: (areaId: string) => Promise<void>;
  isLoading?: boolean;
}

interface ViewSettings {
  showGrid: boolean;
  show3D: boolean;
  gridSize: number;
  zoom: number;
}

export const PositionEditor: React.FC<PositionEditorProps> = ({
  area,
  positions,
  onUpdatePositions,
  onLoadPositions,
  isLoading = false,
}) => {
  const [localPositions, setLocalPositions] = useState<LightPosition[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showGrid: true,
    show3D: false,
    gridSize: 10,
    zoom: 1,
  });
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Update local positions when props change
  useEffect(() => {
    setLocalPositions(positions);
    setHasChanges(false);
    setValidationErrors({});
  }, [positions]);

  // Load positions when area changes
  useEffect(() => {
    if (area && area.id) {
      onLoadPositions(area.id);
    }
  }, [area, onLoadPositions]);

  // Validate position values
  const validatePosition = useCallback((position: LightPosition): string | null => {
    if (position.x < -1 || position.x > 1) {
      return 'X coordinate must be between -1 and 1';
    }
    if (position.y < -1 || position.y > 1) {
      return 'Y coordinate must be between -1 and 1';
    }
    if (position.z < -1 || position.z > 1) {
      return 'Z coordinate must be between -1 and 1';
    }
    return null;
  }, []);

  // Update position value
  const updatePosition = useCallback((
    lightId: string,
    axis: 'x' | 'y' | 'z',
    value: number
  ) => {
    setLocalPositions(prev => {
      const updated = prev.map(pos => {
        if (pos.lightId === lightId) {
          const newPos = { ...pos, [axis]: value };
          const error = validatePosition(newPos);
          
          setValidationErrors(prevErrors => ({
            ...prevErrors,
            [lightId]: error || '',
          }));
          
          return newPos;
        }
        return pos;
      });
      
      setHasChanges(true);
      return updated;
    });
  }, [validatePosition]);

  // Reset positions
  const resetPositions = useCallback(() => {
    if (area) {
      const defaultPositions = area.lightIds.map((lightId, index) => ({
        lightId,
        lightName: `Light ${lightId}`,
        x: 0,
        y: 0,
        z: 0,
      }));
      setLocalPositions(defaultPositions);
      setHasChanges(true);
      setValidationErrors({});
    }
  }, [area]);

  // Auto-arrange positions in a circle
  const autoArrange = useCallback(() => {
    if (localPositions.length === 0) return;

    const updated = localPositions.map((pos, index) => {
      const angle = (index / localPositions.length) * 2 * Math.PI;
      const radius = 0.8; // Stay within bounds
      return {
        ...pos,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: 0,
      };
    });

    setLocalPositions(updated);
    setHasChanges(true);
    setValidationErrors({});
  }, [localPositions]);

  // Save positions
  const savePositions = useCallback(async () => {
    if (!area || !hasChanges) return;

    // Validate all positions
    const errors: Record<string, string> = {};
    localPositions.forEach(pos => {
      const error = validatePosition(pos);
      if (error) {
        errors[pos.lightId] = error;
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdatePositions(area.id, localPositions);
      setHasChanges(false);
      setValidationErrors({});
    } finally {
      setIsSaving(false);
    }
  }, [area, hasChanges, localPositions, onUpdatePositions, validatePosition]);

  // Visual representation of positions (simplified 2D/3D view)
  const renderPositionVisualization = () => {
    if (localPositions.length === 0) return null;

    const size = 300;
    const center = size / 2;
    const scale = (size / 2) * 0.9; // 90% of radius

    return (
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="border border-gray-200 rounded bg-gray-50"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Grid */}
          {viewSettings.showGrid && (
            <defs>
              <pattern
                id="grid"
                width={size / viewSettings.gridSize}
                height={size / viewSettings.gridSize}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${size / viewSettings.gridSize} 0 L 0 0 0 ${size / viewSettings.gridSize}`}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
          )}
          
          {viewSettings.showGrid && (
            <rect width="100%" height="100%" fill="url(#grid)" />
          )}

          {/* Center cross */}
          <g stroke="#9ca3af" strokeWidth="1">
            <line x1={center - 20} y1={center} x2={center + 20} y2={center} />
            <line x1={center} y1={center - 20} x2={center} y2={center + 20} />
          </g>

          {/* Lights */}
          {localPositions.map((pos) => {
            const x = center + pos.x * scale;
            const y = center - pos.y * scale; // Flip Y axis for display
            const isSelected = selectedLightId === pos.lightId;
            const hasError = validationErrors[pos.lightId];

            return (
              <g key={pos.lightId}>
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 12 : 8}
                  fill={hasError ? '#ef4444' : isSelected ? '#3b82f6' : '#10b981'}
                  stroke={isSelected ? '#1d4ed8' : '#ffffff'}
                  strokeWidth={2}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedLightId(pos.lightId)}
                />
                
                {/* Z-axis indicator (3D mode) */}
                {viewSettings.show3D && pos.z !== 0 && (
                  <line
                    x1={x}
                    y1={y}
                    x2={x + pos.z * 20}
                    y2={y - pos.z * 20}
                    stroke="#6b7280"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                )}

                {/* Light ID label */}
                <text
                  x={x}
                  y={y + (isSelected ? 20 : 16)}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#374151"
                  className="pointer-events-none font-mono"
                >
                  {pos.lightId}
                </text>
              </g>
            );
          })}

          {/* Arrow marker for 3D lines */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
        </svg>

        {/* Legend */}
        <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded p-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span>Light</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Selected</span>
          </div>
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Error</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!area) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Move className="h-5 w-5" />
            <span>Position Editor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Select an entertainment area to edit light positions
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Move className="h-5 w-5" />
            <span>Edit Positions - {area.name}</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {/* View Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewSettings(prev => ({ ...prev, showGrid: !prev.showGrid }))}
              className={cn(viewSettings.showGrid && 'bg-blue-50')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewSettings(prev => ({ ...prev, show3D: !prev.show3D }))}
              className={cn(viewSettings.show3D && 'bg-blue-50')}
            >
              {viewSettings.show3D ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>

            {/* Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={autoArrange}
              disabled={isLoading || isSaving}
            >
              Auto Arrange
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={resetPositions}
              disabled={isLoading || isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            
            <Button
              onClick={savePositions}
              disabled={!hasChanges || isLoading || isSaving || Object.keys(validationErrors).some(key => validationErrors[key])}
              className="min-w-[100px]"
            >
              {isSaving ? (
                <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="text-center py-4">
            <div className="animate-spin h-6 w-6 border border-current border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Loading positions...</p>
          </div>
        )}

        {!isLoading && localPositions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No lights found in this entertainment area
          </div>
        )}

        {!isLoading && localPositions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Editor */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Visual Position Editor
              </h3>
              {renderPositionVisualization()}
              
              <div className="text-xs text-gray-500 mt-2">
                <p>• Click lights to select and edit</p>
                <p>• Coordinates range from -1 to 1</p>
                <p>• Z-axis represents depth (forward/backward)</p>
              </div>
            </div>

            {/* Position Table */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Precise Coordinates
              </h3>
              
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-900">Light</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-900">X</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-900">Y</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-900">Z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localPositions.map((pos) => (
                      <tr
                        key={pos.lightId}
                        className={cn(
                          'border-b border-gray-100',
                          selectedLightId === pos.lightId && 'bg-blue-50',
                          validationErrors[pos.lightId] && 'bg-red-50'
                        )}
                      >
                        <td className="px-3 py-2">
                          <div
                            className="cursor-pointer hover:text-blue-600"
                            onClick={() => setSelectedLightId(pos.lightId)}
                          >
                            <div className="font-mono text-xs">{pos.lightId}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {pos.lightName}
                            </div>
                          </div>
                        </td>
                        
                        {['x', 'y', 'z'].map((axis) => (
                          <td key={axis} className="px-3 py-2">
                            <Input
                              type="number"
                              min="-1"
                              max="1"
                              step="0.01"
                              value={pos[axis as keyof Pick<LightPosition, 'x' | 'y' | 'z'>]}
                              onChange={(e) => updatePosition(pos.lightId, axis as 'x' | 'y' | 'z', parseFloat(e.target.value) || 0)}
                              className={cn(
                                'w-16 h-8 text-xs',
                                validationErrors[pos.lightId] && 'border-red-300 focus:ring-red-500'
                              )}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {Object.keys(validationErrors).length > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                  {Object.entries(validationErrors).map(([lightId, error]) => (
                    error && <div key={lightId}>Light {lightId}: {error}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        {hasChanges && (
          <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded">
            <span className="text-sm text-orange-700">
              You have unsaved changes
            </span>
            <span className="text-xs text-orange-600">
              {localPositions.length} lights positioned
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PositionEditor;