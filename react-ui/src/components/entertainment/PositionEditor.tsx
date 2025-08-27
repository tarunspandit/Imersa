// 3D Position Editor for Entertainment Lights
import React, { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Move, Grid, Eye, EyeOff } from 'lucide-react';
import { LightPosition, EntertainmentArea } from '@/types';
import { cn } from '@/utils';
import '@/styles/design-system.css';

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
          className="border border-white/10 rounded-xl"
          viewBox={`0 0 ${size} ${size}`}
          style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03), rgba(236, 72, 153, 0.03))' }}
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
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
          )}
          
          {viewSettings.showGrid && (
            <rect width="100%" height="100%" fill="url(#grid)" />
          )}

          {/* Center cross */}
          <g stroke="#fbbf24" strokeWidth="1">
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
                  fill={hasError ? '#ef4444' : isSelected ? '#8b5cf6' : '#10b981'}
                  stroke={isSelected ? '#c084fc' : '#ffffff'}
                  strokeWidth={2}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedLightId(pos.lightId)}
                  filter={isSelected ? 'url(#glow)' : ''}
                />
                
                {/* Z-axis indicator (3D mode) */}
                {viewSettings.show3D && pos.z !== 0 && (
                  <line
                    x1={x}
                    y1={y}
                    x2={x + pos.z * 20}
                    y2={y - pos.z * 20}
                    stroke="#94a3b8"
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
                  fill="#cbd5e1"
                  className="pointer-events-none font-mono"
                >
                  {pos.lightId}
                </text>
              </g>
            );
          })}

          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Arrow marker for 3D lines */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>

        {/* Legend */}
        <div className="absolute top-2 right-2 glass-surface rounded-xl p-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span className="text-gray-300">Light</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-gray-300">Selected</span>
          </div>
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-300">Error</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!area) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Move className="w-5 h-5 text-imersa-glow-primary" />
          Position Editor
        </h3>
        <div className="text-center py-8 text-gray-400">
          Select an entertainment area to edit light positions
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <Move className="w-5 h-5 text-imersa-glow-primary" />
          Edit Positions - {area.name}
        </h3>
        
        <div className="flex items-center space-x-2">
          {/* View Controls */}
          <button
            onClick={() => setViewSettings(prev => ({ ...prev, showGrid: !prev.showGrid }))}
            className={cn(
              'p-2 rounded-xl transition-all',
              viewSettings.showGrid 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            )}
          >
            <Grid className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => setViewSettings(prev => ({ ...prev, show3D: !prev.show3D }))}
            className={cn(
              'p-2 rounded-xl transition-all',
              viewSettings.show3D 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            )}
          >
            {viewSettings.show3D ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>

          {/* Actions */}
          <button
            onClick={autoArrange}
            disabled={isLoading || isSaving}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-all disabled:opacity-50"
          >
            Auto Arrange
          </button>
          
          <button
            onClick={resetPositions}
            disabled={isLoading || isSaving}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-all disabled:opacity-50 flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          
          <button
            onClick={savePositions}
            disabled={!hasChanges || isLoading || isSaving || Object.keys(validationErrors).some(key => validationErrors[key])}
            className="btn-glow px-4 py-1.5 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="space-y-6">
        {isLoading && (
          <div className="text-center py-4">
            <div className="loading-pulse mx-auto">
              <Move className="w-6 h-6 text-imersa-dark" />
            </div>
            <p className="text-sm text-gray-400 mt-2">Loading positions...</p>
          </div>
        )}

        {!isLoading && localPositions.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No lights found in this entertainment area
          </div>
        )}

        {!isLoading && localPositions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Editor */}
            <div>
              <h3 className="text-sm font-medium text-white mb-3">
                Visual Position Editor
              </h3>
              {renderPositionVisualization()}
              
              <div className="text-xs text-gray-400 mt-2">
                <p>• Click lights to select and edit</p>
                <p>• Coordinates range from -1 to 1</p>
                <p>• Z-axis represents depth (forward/backward)</p>
              </div>
            </div>

            {/* Position Table */}
            <div>
              <h3 className="text-sm font-medium text-white mb-3">
                Precise Coordinates
              </h3>
              
              <div className="max-h-80 overflow-y-auto border border-white/10 rounded-xl glass-surface">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-300">Light</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-300">X</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-300">Y</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-300">Z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localPositions.map((pos) => (
                      <tr
                        key={pos.lightId}
                        className={cn(
                          'border-b border-white/5',
                          selectedLightId === pos.lightId && 'bg-purple-500/10',
                          validationErrors[pos.lightId] && 'bg-red-500/10'
                        )}
                      >
                        <td className="px-3 py-2">
                          <div
                            className="cursor-pointer hover:text-imersa-glow-primary transition-colors"
                            onClick={() => setSelectedLightId(pos.lightId)}
                          >
                            <div className="font-mono text-xs text-gray-300">{pos.lightId}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {pos.lightName}
                            </div>
                          </div>
                        </td>
                        
                        {['x', 'y', 'z'].map((axis) => (
                          <td key={axis} className="px-3 py-2">
                            <input
                              type="number"
                              min="-1"
                              max="1"
                              step="0.01"
                              value={pos[axis as keyof Pick<LightPosition, 'x' | 'y' | 'z'>]}
                              onChange={(e) => updatePosition(pos.lightId, axis as 'x' | 'y' | 'z', parseFloat(e.target.value) || 0)}
                              className={cn(
                                'w-16 h-8 text-xs px-2 bg-white/5 border rounded-lg text-white',
                                validationErrors[pos.lightId] 
                                  ? 'border-red-500/50 focus:ring-red-500' 
                                  : 'border-white/10 focus:ring-yellow-500 focus:outline-none focus:ring-2'
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
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
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
          <div className="flex items-center justify-between p-3 glass-card bg-orange-500/10 border border-orange-500/20">
            <span className="text-sm text-orange-400">
              You have unsaved changes
            </span>
            <span className="text-xs text-orange-300">
              {localPositions.length} lights positioned
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionEditor;