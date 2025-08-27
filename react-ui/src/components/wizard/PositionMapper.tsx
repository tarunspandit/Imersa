// 3D Position Mapper for Entertainment Wizard
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Move, 
  RotateCcw, 
  Grid, 
  Eye, 
  EyeOff, 
  Target, 
  Maximize2,
  Settings,
  Monitor,
  Box,
  Move3d
} from 'lucide-react';
import { Button, Input, Slider } from '@/components/ui';
import { Room3DPositioner } from '@/components/entertainment/Room3DPositioner';
import { LightPosition } from '@/types';
import { RoomTemplate } from '@/hooks/useWizard';
import { cn } from '@/utils';
import '@/styles/design-system.css';

interface PositionMapperProps {
  selectedLights: string[];
  positions: Record<string, LightPosition>;
  configurationType: 'screen' | '3dspace';
  roomTemplates: RoomTemplate[];
  onUpdatePosition: (lightId: string, position: Partial<LightPosition>) => void;
  onApplyTemplate: (template: RoomTemplate) => void;
  onAutoArrange: () => void;
  onResetPositions: () => void;
  className?: string;
}

interface ViewSettings {
  showGrid: boolean;
  show3D: boolean;
  showLabels: boolean;
  gridSize: number;
  canvasSize: number;
  view3DMode: boolean;
}

interface DragState {
  isDragging: boolean;
  lightId: string | null;
  startPos: { x: number; y: number };
  offset: { x: number; y: number };
}

export const PositionMapper: React.FC<PositionMapperProps> = ({
  selectedLights,
  positions,
  configurationType,
  roomTemplates,
  onUpdatePosition,
  onApplyTemplate,
  onAutoArrange,
  onResetPositions,
  className,
}) => {
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    lightId: null,
    startPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
  });
  
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showGrid: true,
    show3D: true,
    showLabels: true,
    gridSize: 10,
    canvasSize: 400,
    view3DMode: true,
  });

  // Filter templates for current configuration type
  const availableTemplates = useMemo(() => {
    return roomTemplates.filter(template => 
      template.configurationType === configurationType
    );
  }, [roomTemplates, configurationType]);

  // Convert world coordinates to canvas coordinates
  const worldToCanvas = useCallback((worldX: number, worldY: number) => {
    const center = viewSettings.canvasSize / 2;
    const scale = (viewSettings.canvasSize / 2) * 0.85; // Use 85% of radius
    
    return {
      x: center + worldX * scale,
      y: center - worldY * scale, // Flip Y axis for display
    };
  }, [viewSettings.canvasSize]);

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = useCallback((canvasX: number, canvasY: number) => {
    const center = viewSettings.canvasSize / 2;
    const scale = (viewSettings.canvasSize / 2) * 0.85;
    
    return {
      x: Math.max(-1, Math.min(1, (canvasX - center) / scale)),
      y: Math.max(-1, Math.min(1, -(canvasY - center) / scale)), // Flip Y axis
    };
  }, [viewSettings.canvasSize]);

  // Handle mouse down on light
  const handleMouseDown = useCallback((lightId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = (event.currentTarget.closest('svg') as SVGElement).getBoundingClientRect();
    const canvasPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    
    const position = positions[lightId];
    if (position) {
      const lightCanvasPos = worldToCanvas(position.x, position.y);
      setDragState({
        isDragging: true,
        lightId,
        startPos: canvasPos,
        offset: {
          x: canvasPos.x - lightCanvasPos.x,
          y: canvasPos.y - lightCanvasPos.y,
        },
      });
      setSelectedLightId(lightId);
    }
  }, [positions, worldToCanvas]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.lightId) return;
    
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const canvasPos = {
      x: event.clientX - rect.left - dragState.offset.x,
      y: event.clientY - rect.top - dragState.offset.y,
    };
    
    const worldPos = canvasToWorld(canvasPos.x, canvasPos.y);
    onUpdatePosition(dragState.lightId, {
      x: Math.round(worldPos.x * 1000) / 1000,
      y: Math.round(worldPos.y * 1000) / 1000,
    });
  }, [dragState, canvasToWorld, onUpdatePosition]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      lightId: null,
      startPos: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
    });
  }, []);

  // Handle direct coordinate input
  const handleCoordinateChange = useCallback((
    lightId: string,
    axis: 'x' | 'y' | 'z',
    value: number
  ) => {
    const clampedValue = Math.max(-1, Math.min(1, value));
    onUpdatePosition(lightId, { [axis]: clampedValue });
  }, [onUpdatePosition]);

  // Render the position visualization
  const renderVisualization = () => {
    const size = viewSettings.canvasSize;
    const center = size / 2;

    return (
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="border border-gray-300 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 cursor-crosshair"
          viewBox={`0 0 ${size} ${size}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid Pattern */}
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
                  strokeWidth="1"
                />
              </pattern>
            </defs>
          )}
          
          {viewSettings.showGrid && (
            <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5" />
          )}

          {/* Configuration Type Guide */}
          {configurationType === 'screen' && (
            <>
              {/* Screen representation */}
              <rect
                x={center - 80}
                y={center + 60}
                width={160}
                height={8}
                fill="#374151"
                rx="4"
              />
              <text
                x={center}
                y={center + 80}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
                className="font-mono"
              >
                SCREEN
              </text>
            </>
          )}

          {/* Center crosshair */}
          <g stroke="#9ca3af" strokeWidth="2" opacity="0.7">
            <line x1={center - 20} y1={center} x2={center + 20} y2={center} />
            <line x1={center} y1={center - 20} x2={center} y2={center + 20} />
          </g>

          {/* Boundary circle */}
          <circle
            cx={center}
            cy={center}
            r={center * 0.85}
            fill="none"
            stroke="#d1d5db"
            strokeWidth="2"
            strokeDasharray="8,4"
            opacity="0.6"
          />

          {/* Lights */}
          {selectedLights.map((lightId) => {
            const position = positions[lightId];
            if (!position) return null;

            const canvasPos = worldToCanvas(position.x, position.y);
            const isSelected = selectedLightId === lightId;
            const isDragging = dragState.lightId === lightId;

            return (
              <g key={lightId}>
                {/* Light circle */}
                <circle
                  cx={canvasPos.x}
                  cy={canvasPos.y}
                  r={isSelected ? 14 : 10}
                  fill={isSelected ? '#3b82f6' : '#10b981'}
                  stroke={isDragging ? '#1d4ed8' : '#ffffff'}
                  strokeWidth={3}
                  className={cn(
                    'cursor-move transition-all',
                    isDragging && 'drop-shadow-lg'
                  )}
                  onMouseDown={(e) => handleMouseDown(lightId, e)}
                  onClick={() => setSelectedLightId(lightId)}
                />

                {/* 3D Z-axis indicator */}
                {viewSettings.show3D && position.z !== 0 && (
                  <line
                    x1={canvasPos.x}
                    y1={canvasPos.y}
                    x2={canvasPos.x + position.z * 30}
                    y2={canvasPos.y - position.z * 30}
                    stroke="#6b7280"
                    strokeWidth="3"
                    markerEnd="url(#arrowhead)"
                  />
                )}

                {/* Light label */}
                {viewSettings.showLabels && (
                  <text
                    x={canvasPos.x}
                    y={canvasPos.y + (isSelected ? 22 : 18)}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#374151"
                    className="pointer-events-none font-mono font-medium"
                  >
                    {lightId}
                  </text>
                )}

                {/* Selection indicator */}
                {isSelected && (
                  <circle
                    cx={canvasPos.x}
                    cy={canvasPos.y}
                    r={18}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    className="animate-pulse"
                  />
                )}
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

        {/* Coordinate display */}
        {selectedLightId && positions[selectedLightId] && (
          <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded-lg p-2 text-xs shadow-md">
            <div className="font-medium text-gray-900 mb-1">
              Light {selectedLightId}
            </div>
            <div className="space-y-1 text-gray-600">
              <div>X: {positions[selectedLightId].x.toFixed(3)}</div>
              <div>Y: {positions[selectedLightId].y.toFixed(3)}</div>
              <div>Z: {positions[selectedLightId].z.toFixed(3)}</div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 right-2 bg-white bg-opacity-90 rounded-lg p-2 text-xs">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span>Light</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Selected</span>
            </div>
            {viewSettings.show3D && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-0.5 bg-gray-600"></div>
                <span>Depth (Z)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Convert positions to format expected by 3D positioner
  const lights3D = useMemo(() => {
    return selectedLights.map(lightId => ({
      lightId,
      lightName: positions[lightId]?.lightName || `Light ${lightId}`,
      x: positions[lightId]?.x || 0,
      y: positions[lightId]?.y || 1,
      z: positions[lightId]?.z || 0,
    }));
  }, [selectedLights, positions]);

  return (
    <div className={cn('glass-card p-6', className)}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Move3d className="w-5 h-5 text-imersa-glow-primary" />
            Position Lights
            <span className="text-sm font-normal text-gray-400">
              ({configurationType === 'screen' ? '2D Screen' : '3D Space'})
            </span>
          </h3>
          
          <div className="flex items-center gap-2">
            {/* Toggle between 2D and 3D views */}
            <button
              onClick={() => setViewSettings(prev => ({ ...prev, view3DMode: !prev.view3DMode }))}
              className={cn(
                'px-3 py-2 rounded-lg transition-all flex items-center gap-2',
                viewSettings.view3DMode
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300'
              )}
            >
              <Move3d className="w-4 h-4" />
              {viewSettings.view3DMode ? '3D View' : '2D View'}
            </button>
          </div>
        </div>

      <div className="space-y-6">
        {/* Empty State */}
        {selectedLights.length === 0 && (
          <div className="text-center py-8">
            <Move3d className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-white mb-2">
              No lights selected
            </p>
            <p className="text-gray-400">
              Select lights in the previous step to position them here.
            </p>
          </div>
        )}

        {selectedLights.length > 0 && (
          <>
            {/* Templates Section */}
            {availableTemplates.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  {configurationType === 'screen' ? <Monitor className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                  <span>Room Templates</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => onApplyTemplate(template)}
                      className="text-left h-auto p-3 glass-card hover:border-imersa-glow-primary/30 transition-all"
                    >
                      <div>
                        <div className="font-medium text-sm text-white">{template.name}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {template.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show 3D Positioner or 2D Editor */}
            {viewSettings.view3DMode ? (
              <Room3DPositioner
                lights={lights3D}
                configurationType={configurationType}
                onUpdatePosition={(lightId, position) => {
                  onUpdatePosition(lightId, position);
                }}
                onAutoArrange={onAutoArrange}
              />
            ) : (

              /* 2D Editor */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual Editor */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">
                    2D Position Editor
                  </h3>
                {renderVisualization()}
                  
                  {/* View Settings */}
                  <div className="mt-4 p-3 glass-card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">Grid Size</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400">{viewSettings.gridSize}</span>
                        <Slider
                        value={[viewSettings.gridSize]}
                        onValueChange={([value]) => setViewSettings(prev => ({ ...prev, gridSize: value }))}
                        min={5}
                        max={20}
                        step={1}
                          className="w-20"
                        />
                      </div>
                    </div>
                  </div>
                
                  <div className="text-xs text-gray-400 mt-2 space-y-1">
                    <p>• Drag lights to position them in your space</p>
                    <p>• Coordinates range from -1 to 1 in each axis</p>
                    <p>• {configurationType === 'screen' ? 'Y=0.6 is typical for screen height' : 'Use Z-axis for depth positioning'}</p>
                  </div>
                </div>

                {/* Position Controls */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300">
                    Precise Coordinates
                  </h3>
                
                <div className="max-h-80 overflow-y-auto space-y-3">
                  {selectedLights.map((lightId) => {
                    const position = positions[lightId];
                    if (!position) return null;
                    
                    const isSelected = selectedLightId === lightId;
                    
                    return (
                      <div
                        key={lightId}
                        className={cn(
                          'p-3 border rounded-lg cursor-pointer transition-all',
                          isSelected
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => setSelectedLightId(lightId)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">
                            Light {lightId}
                          </div>
                          {isSelected && (
                            <Target className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {(['x', 'y', 'z'] as const).map((axis) => (
                            <div key={axis} className="flex items-center space-x-2">
                              <span className="text-xs font-mono uppercase text-gray-500 w-4">
                                {axis}:
                              </span>
                              <Input
                                type="number"
                                min="-1"
                                max="1"
                                step="0.001"
                                value={position[axis]}
                                onChange={(e) => handleCoordinateChange(
                                  lightId,
                                  axis,
                                  parseFloat(e.target.value) || 0
                                )}
                                className="flex-1 h-8 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PositionMapper;