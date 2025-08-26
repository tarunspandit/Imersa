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
import { Button, Card, CardContent, CardHeader, CardTitle, Slider } from '@/components/ui';
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
        className="border border-gray-200 rounded bg-gray-50"
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Eye className="w-5 h-5" />
          <span>Review & Create Entertainment Area</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Name:</span>
                <span className="text-sm font-medium">{formData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Type:</span>
                <span className="text-sm font-medium">
                  {formData.configurationType === 'screen' ? '2D Screen' : '3D Space'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Room:</span>
                <span className="text-sm font-medium">{formData.roomClass}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Lights:</span>
                <span className="text-sm font-medium">
                  {formData.selectedLights.length} selected
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Position Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Light Positions</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {renderPositionPreview()}
            </CardContent>
          </Card>
        </div>

        {/* Selected Lights List */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Selected Lights ({formData.selectedLights.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {formData.selectedLights.map((lightId) => {
              const position = formData.positions[lightId];
              return (
                <div
                  key={lightId}
                  className="flex items-center space-x-2 p-2 border border-gray-200 rounded text-sm"
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="font-mono">{lightId}</span>
                  {position && (
                    <span className="text-xs text-gray-500 ml-auto">
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
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Ready to Create Entertainment Area
                </h3>
                <p className="text-gray-600">
                  Click the button below to create your entertainment area with the selected lights and positions.
                </p>
              </div>

              {createError && (
                <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 border border-red-200 rounded p-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{createError}</span>
                </div>
              )}

              <Button
                onClick={handleCreateArea}
                disabled={isLoading}
                size="lg"
                className="min-w-[200px]"
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
              </Button>
            </div>
          </div>
        )}

        {/* Test Section */}
        {createdAreaId && (
          <div className="border-2 border-dashed border-emerald-300 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-600">
                <CheckCircle className="w-6 h-6" />
                <h3 className="text-lg font-medium">Entertainment Area Created!</h3>
              </div>
              
              <p className="text-gray-600">
                Your entertainment area has been successfully created. Test the streaming functionality below.
              </p>

              {/* Test Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <span className="text-sm text-gray-600 w-12">
                      {testSettings.duration}s
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Pattern
                  </label>
                  <select
                    value={testSettings.pattern}
                    onChange={(e) => setTestSettings(prev => ({ 
                      ...prev, 
                      pattern: e.target.value as any 
                    }))}
                    disabled={testState.isRunning}
                    className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
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
                  <Button
                    onClick={handleTestStreaming}
                    disabled={isLoading}
                    size="lg"
                    className="min-w-[160px]"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Test
                  </Button>
                ) : (
                  <Button
                    onClick={stopTest}
                    variant="destructive"
                    size="lg"
                    className="min-w-[160px]"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop Test
                  </Button>
                )}
              </div>

              {/* Test Status */}
              {testState.isRunning && (
                <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2 text-blue-600 mb-2">
                    <Activity className="w-5 h-5 animate-pulse" />
                    <span className="font-medium">Testing Entertainment Streaming</span>
                  </div>
                  <div className="text-sm text-blue-700">
                    Pattern: <span className="font-medium">{testState.currentPattern}</span>
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-600 mt-2">
                    {testState.timeRemaining}s remaining
                  </div>
                </div>
              )}

              {/* Test Results */}
              {testState.success === true && (
                <div className="text-center p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2 text-emerald-600 mb-2">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">Test Completed Successfully!</span>
                  </div>
                  <p className="text-sm text-emerald-700">
                    Your entertainment area is ready for use. You can now use it with compatible apps and services.
                  </p>
                </div>
              )}

              {testState.success === false && (
                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2 text-red-600 mb-2">
                    <AlertCircle className="w-6 h-6" />
                    <span className="font-medium">Test Failed</span>
                  </div>
                  <p className="text-sm text-red-700">
                    There was an issue testing the entertainment streaming. Please check your lights and try again.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {createdAreaId && testState.success && (
          <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">🎉 What's Next?</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Your entertainment area is now available in the Entertainment page</li>
              <li>• Use compatible apps like Philips Hue Sync or screen mirroring software</li>
              <li>• Adjust light positions anytime from the Entertainment area settings</li>
              <li>• Create multiple entertainment areas for different rooms</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestPreview;