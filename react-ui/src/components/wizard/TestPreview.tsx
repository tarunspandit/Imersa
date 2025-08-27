// Entertainment Test Preview Component
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Square, 
  Eye, 
  Zap, 
  Palette, 
  Timer, 
  Activity,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button, Input, Slider } from '@/components/ui';
import '@/styles/design-system.css';
import { WizardFormData } from '@/hooks/useWizard';
import { cn } from '@/utils';

interface TestPreviewProps {
  formData: WizardFormData;
  createdAreaId: string | null;
  onTestStreaming: () => Promise<boolean>;
  onCreateArea: () => Promise<boolean>;
  isLoading?: boolean;
  className?: string;
}

interface TestSettings {
  duration: number; // seconds
  intensity: number; // 0-100
  pattern: 'sync' | 'wave' | 'pulse' | 'rainbow';
  speed: number; // 1-10
}

interface TestState {
  isRunning: boolean;
  timeRemaining: number;
  currentPattern: string;
  success: boolean | null;
}

const TEST_PATTERNS = [
  {
    id: 'sync',
    name: 'Synchronized',
    description: 'All lights change color together',
    icon: Activity,
  },
  {
    id: 'wave',
    name: 'Wave Effect',
    description: 'Colors flow from left to right',
    icon: RefreshCw,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    description: 'Gentle breathing effect',
    icon: Timer,
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    description: 'Cycle through all colors',
    icon: Palette,
  },
];

export const TestPreview: React.FC<TestPreviewProps> = ({
  formData,
  createdAreaId,
  onTestStreaming,
  onCreateArea,
  isLoading = false,
  className,
}) => {
  const [testSettings, setTestSettings] = useState<TestSettings>({
    duration: 10,
    intensity: 75,
    pattern: 'sync',
    speed: 5,
  });

  const [testState, setTestState] = useState<TestState>({
    isRunning: false,
    timeRemaining: 0,
    currentPattern: '',
    success: null,
  });

  const [createError, setCreateError] = useState<string | null>(null);

  // Handle test countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (testState.isRunning && testState.timeRemaining > 0) {
      interval = setInterval(() => {
        setTestState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
        }));
      }, 1000);
    } else if (testState.isRunning && testState.timeRemaining === 0) {
      setTestState(prev => ({
        ...prev,
        isRunning: false,
        success: true,
      }));
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [testState.isRunning, testState.timeRemaining]);

  // Handle create area
  const handleCreateArea = useCallback(async () => {
    setCreateError(null);
    const success = await onCreateArea();
    if (!success) {
      setCreateError('Failed to create entertainment area. Please try again.');
    }
  }, [onCreateArea]);

  // Handle test streaming
  const handleTestStreaming = useCallback(async () => {
    if (!createdAreaId) return;

    setTestState({
      isRunning: true,
      timeRemaining: testSettings.duration,
      currentPattern: testSettings.pattern,
      success: null,
    });

    const success = await onTestStreaming();
    if (!success) {
      setTestState({
        isRunning: false,
        timeRemaining: 0,
        currentPattern: '',
        success: false,
      });
    }
  }, [createdAreaId, testSettings, onTestStreaming]);

  // Stop test
  const stopTest = useCallback(() => {
    setTestState({
      isRunning: false,
      timeRemaining: 0,
      currentPattern: '',
      success: false,
    });
  }, []);

  // Render position preview
  const renderPositionPreview = () => {
    const size = 200;
    const center = size / 2;
    const scale = (size / 2) * 0.8;

    return (
      <svg
        width={size}
        height={size}
        className="border border-white/10 rounded-xl"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Center reference */}
        <circle
          cx={center}
          cy={center}
          r="2"
          fill="#9ca3af"
        />
        
        {/* Configuration type indicator */}
        {formData.configurationType === 'screen' && (
          <rect
            x={center - 40}
            y={center + 30}
            width={80}
            height={4}
            fill="#374151"
            rx={2}
          />
        )}

        {/* Lights */}
        {Object.entries(formData.positions).map(([lightId, position]) => {
          const x = center + position.x * scale;
          const y = center - position.y * scale;
          
          return (
            <g key={lightId}>
              <circle
                cx={x}
                cy={y}
                r="6"
                fill={testState.isRunning ? '#3b82f6' : '#10b981'}
                stroke="#ffffff"
                strokeWidth="1"
                className={testState.isRunning ? 'animate-pulse' : ''}
              />
              <text
                x={x}
                y={y + 14}
                textAnchor="middle"
                fontSize="8"
                fill="#374151"
                className="font-mono"
              >
                {lightId}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className={cn('glass-card p-6', className)}>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
          <Eye className="w-5 h-5 text-imersa-glow-primary" />
          Review & Create Entertainment Area
        </h3>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configuration Summary */}
          <div className="glass-card p-4 holo-card">
            <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-imersa-glow-secondary" />
              Configuration Summary
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Name:</span>
                <span className="text-sm font-medium text-white">{formData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Type:</span>
                <span className="text-sm font-medium text-white">
                  {formData.configurationType === 'screen' ? '2D Screen' : '3D Space'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Lights:</span>
                <span className="text-sm font-medium text-white">
                  {formData.selectedLights.length} selected
                </span>
              </div>
            </div>
          </div>

          {/* Position Preview */}
          <div className="glass-card p-4 holo-card">
            <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-imersa-glow-secondary" />
              Light Positions
            </h4>
            <div className="flex justify-center">
              {renderPositionPreview()}
            </div>
          </div>
        </div>

        {/* Selected Lights List */}
        <div>
          <h3 className="text-sm font-medium text-white mb-3">
            Selected Lights ({formData.selectedLights.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {formData.selectedLights.map((lightId) => {
              const position = formData.positions[lightId];
              return (
                <div
                  key={lightId}
                  className="flex items-center space-x-2 p-2 glass-surface rounded-xl text-sm"
                >
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="font-mono text-gray-300">{lightId}</span>
                  {position && (
                    <span className="text-xs text-gray-400 ml-auto">
                      ({position.x.toFixed(1)}, {position.y.toFixed(1)})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Create Area Section */}
        {!createdAreaId && (
          <div className="glass-card p-6 text-center border-2 border-dashed border-imersa-glow-primary/30">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Ready to Create Entertainment Area
                </h3>
                <p className="text-gray-400">
                  Click the button below to create your entertainment area with the selected lights and positions.
                </p>
              </div>

              {createError && (
                <div className="flex items-center justify-center space-x-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm text-red-300">{createError}</span>
                </div>
              )}

              <button
                onClick={handleCreateArea}
                disabled={isLoading}
                className="btn-glow min-w-[200px] px-6 py-3"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full" />
                    <span>Creating Area...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>Create Entertainment Area</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Test Section */}
        {createdAreaId && (
          <div className="glass-card p-6 border-2 border-dashed border-emerald-400/30">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-400">
                <CheckCircle className="w-6 h-6" />
                <h3 className="text-lg font-medium">Entertainment Area Created!</h3>
              </div>
              
              <p className="text-gray-400">
                Your entertainment area has been successfully created. Test the streaming functionality below.
              </p>

              {/* Test Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 glass-surface rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Test Duration
                  </label>
                  <div className="flex items-center space-x-2">
                    <Slider
                      value={[testSettings.duration]}
                      onValueChange={([value]) => setTestSettings(prev => ({ ...prev, duration: value }))}
                      min={5}
                      max={60}
                      step={5}
                      className="flex-1"
                      disabled={testState.isRunning}
                    />
                    <span className="text-sm text-gray-400 w-12">
                      {testSettings.duration}s
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Test Pattern
                  </label>
                  <select
                    value={testSettings.pattern}
                    onChange={(e) => setTestSettings(prev => ({ 
                      ...prev, 
                      pattern: e.target.value as any 
                    }))}
                    disabled={testState.isRunning}
                    className="w-full px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                  >
                    {TEST_PATTERNS.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.name} - {pattern.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Test Controls */}
              <div className="flex items-center justify-center space-x-3">
                {!testState.isRunning ? (
                  <button
                    onClick={handleTestStreaming}
                    disabled={isLoading}
                    className="btn-glow min-w-[160px] px-6 py-3 flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Start Test
                  </button>
                ) : (
                  <button
                    onClick={stopTest}
                    className="px-6 py-3 min-w-[160px] rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Square className="w-5 h-5" />
                    Stop Test
                  </button>
                )}
              </div>

              {/* Test Status */}
              {testState.isRunning && (
                <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center justify-center space-x-2 text-blue-400 mb-2">
                    <Activity className="w-5 h-5 animate-pulse" />
                    <span className="font-medium">Testing Entertainment Streaming</span>
                  </div>
                  <div className="text-sm text-blue-300">
                    Pattern: <span className="font-medium">{testState.currentPattern}</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-400 mt-2">
                    {testState.timeRemaining}s remaining
                  </div>
                </div>
              )}

              {/* Test Results */}
              {testState.success === true && (
                <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center justify-center space-x-2 text-emerald-400 mb-2">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">Test Completed Successfully!</span>
                  </div>
                  <p className="text-sm text-emerald-300">
                    Your entertainment area is ready for use. You can now use it with compatible apps and services.
                  </p>
                </div>
              )}

              {testState.success === false && (
                <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex items-center justify-center space-x-2 text-red-400 mb-2">
                    <AlertCircle className="w-6 h-6" />
                    <span className="font-medium">Test Failed</span>
                  </div>
                  <p className="text-sm text-red-300">
                    There was an issue testing the entertainment streaming. Please check your lights and try again.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {createdAreaId && testState.success && (
          <div className="glass-card p-4 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-emerald-500/20">
            <h4 className="font-medium text-white mb-2">🎉 What's Next?</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Your entertainment area is now available in the Entertainment page</li>
              <li>• Use compatible apps like Philips Hue Sync or screen mirroring software</li>
              <li>• Adjust light positions anytime from the Entertainment area settings</li>
              <li>• Create multiple entertainment areas for different rooms</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPreview;