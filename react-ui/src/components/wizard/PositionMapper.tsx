// Position Mapper Component for Entertainment Wizard
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Move3d, Target, Grid, Maximize2, Sparkles, 
  ChevronDown, Layers, Eye, EyeOff
} from 'lucide-react';
import { Room3DPositioner } from '@/components/entertainment/Room3DPositioner';
import { Slider } from '@/components/ui';
import { LightPosition } from '@/types';
import { cn } from '@/utils';
import '@/styles/design-system.css';

interface PositionMapperProps {
  selectedLights: string[];
  positions: Record<string, LightPosition>;
  configurationType: 'screen' | '3dspace';
  roomTemplates: Array<{
    id: string;
    name: string;
    description: string;
    configurationType: string;
    arrangement: string;
  }>;
  onUpdatePosition: (lightId: string, position: Partial<LightPosition>) => void;
  onApplyTemplate: (template: any) => void;
  onAutoArrange: () => void;
  onResetPositions: () => void;
  className?: string;
}

interface ViewSettings {
  showGrid: boolean;
  gridSize: number;
  show3D: boolean;
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
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showGrid: true,
    gridSize: 10,
    show3D: false,
    canvasSize: 400,
    view3DMode: false,
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    lightId: null,
    startPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
  });

  // Convert world coordinates (-1 to 1) to canvas coordinates
  const worldToCanvas = useCallback((x: number, y: number) => {
    const size = viewSettings.canvasSize;
    const center = size / 2;
    const scale = (size / 2) * 0.85; // 85% of radius to leave margin
    
    return {
      x: center + x * scale,
      y: center - y * scale, // Flip Y axis
    };
  }, [viewSettings.canvasSize]);

  // Convert canvas coordinates to world coordinates (-1 to 1)
  const canvasToWorld = useCallback((canvasX: number, canvasY: number) => {
    const size = viewSettings.canvasSize;
    const center = size / 2;
    const scale = (size / 2) * 0.85;
    
    return {
      x: Math.max(-1, Math.min(1, (canvasX - center) / scale)),
      y: Math.max(-1, Math.min(1, -(canvasY - center) / scale)),
    };
  }, [viewSettings.canvasSize]);

  // Handle mouse down on light
  const handleMouseDown = useCallback((lightId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const position = positions[lightId];
    
    if (position) {
      const canvasPos = worldToCanvas(position.x, position.y);
      
      setDragState({
        isDragging: true,
        lightId,
        startPos: { x: mouseX, y: mouseY },
        offset: {
          x: canvasPos.x - mouseX,
          y: canvasPos.y - mouseY,
        },
      });
      
      setSelectedLightId(lightId);
    }
  }, [positions, worldToCanvas]);

  // Handle mouse move
  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.isDragging || !dragState.lightId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const newCanvasX = mouseX + dragState.offset.x;
    const newCanvasY = mouseY + dragState.offset.y;
    
    const worldPos = canvasToWorld(newCanvasX, newCanvasY);
    
    onUpdatePosition(dragState.lightId, {
      x: worldPos.x,
      y: worldPos.y,
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
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
          )}
          
          {viewSettings.showGrid && (
            <rect width="100%" height="100%" fill="url(#grid)" />
          )}

          {/* Center Reference Lines */}
          <g stroke="#9ca3af" strokeWidth="1">
            <line x1={center - 20} y1={center} x2={center + 20} y2={center} strokeDasharray="4,2" />
            <line x1={center} y1={center - 20} x2={center} y2={center + 20} strokeDasharray="4,2" />
          </g>

          {/* TV/Screen indicator for screen configuration */}
          {configurationType === 'screen' && (
            <rect
              x={center - 80}
              y={center + 100}
              width={160}
              height={8}
              fill="#374151"
              rx={2}
            />
          )}

          {/* Boundary Circle */}
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
                {configurationType === '3dspace' && position.z !== 0 && (
                  <line
                    x1={canvasPos.x}
                    y1={canvasPos.y}
                    x2={canvasPos.x + position.z * 30}
                    y2={canvasPos.y - position.z * 30}
                    stroke="#6b7280"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                    opacity="0.6"
                  />
                )}

                {/* Light ID Label */}
                <text
                  x={canvasPos.x}
                  y={canvasPos.y + (isSelected ? 25 : 20)}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#374151"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {lightId}
                </text>
              </g>
            );
          })}

          {/* Arrow marker for Z-axis */}
          {configurationType === '3dspace' && (
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
                fill="#6b7280"
              >
                <polygon points="0 0, 10 3.5, 0 7" />
              </marker>
            </defs>
          )}
        </svg>

        {/* Legend */}
        <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded-lg p-2 text-xs space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <span>Light</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Selected</span>
          </div>
          {configurationType === '3dspace' && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-gray-600"></div>
              <span>Depth (Z)</span>
            </div>
          )}
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
            <Layers className="w-4 h-4" />
            {viewSettings.view3DMode ? '2D View' : '3D View'}
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
              Please go back and select lights to position
            </p>
          </div>
        )}

        {/* Content */}
        {selectedLights.length > 0 && (
          <>
            {/* Templates */}
            {roomTemplates && roomTemplates.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="w-full flex items-center justify-between px-4 py-3 glass-surface rounded-xl hover:bg-white/10 transition-all"
                >
                  <span className="flex items-center gap-2 text-white">
                    <Sparkles className="w-4 h-4 text-imersa-glow-secondary" />
                    Quick Templates
                  </span>
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform text-gray-400',
                    showTemplates && 'rotate-180'
                  )} />
                </button>
                
                {showTemplates && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {roomTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => onApplyTemplate(template)}
                        className="p-3 glass-surface rounded-xl hover:bg-white/10 transition-all text-left"
                      >
                        <div className="font-medium text-sm text-white">{template.name}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {template.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual Editor */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">
                    2D Position Editor
                  </h3>
                  
                  {/* Render 2D visualization */}
                  {renderVisualization()}
                  
                  {/* Grid Controls */}
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => setViewSettings(prev => ({ ...prev, showGrid: !prev.showGrid }))}
                      className={cn(
                        'px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all',
                        viewSettings.showGrid
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      )}
                    >
                      <Grid className="w-4 h-4" />
                      Grid
                    </button>
                    
                    {viewSettings.showGrid && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Size:</span>
                        <Slider
                          value={[viewSettings.gridSize]}
                          onValueChange={([value]) => setViewSettings(prev => ({ ...prev, gridSize: value }))}
                          min={5}
                          max={20}
                          step={1}
                          className="w-20"
                        />
                      </div>
                    )}
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
                            {['x', 'y', 'z'].map((axis) => (
                              <div key={axis} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 w-4">
                                  {axis.toUpperCase()}
                                </span>
                                <Slider
                                  value={[position[axis as keyof LightPosition] as number]}
                                  onValueChange={([value]) => handleCoordinateChange(
                                    lightId,
                                    axis as 'x' | 'y' | 'z',
                                    value
                                  )}
                                  min={-1}
                                  max={1}
                                  step={0.01}
                                  className="flex-1"
                                />
                                <input
                                  type="number"
                                  value={(position[axis as keyof LightPosition] as number).toFixed(2)}
                                  onChange={(e) => handleCoordinateChange(
                                    lightId,
                                    axis as 'x' | 'y' | 'z',
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PositionMapper;
