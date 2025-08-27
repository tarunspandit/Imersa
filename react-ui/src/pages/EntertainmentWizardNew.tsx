import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Tv, Gamepad2, Music, Monitor, Sparkles, 
  ChevronRight, ChevronLeft, Check, AlertCircle,
  Loader2, Zap, Move, Grid, Save, Play,
  Home, Sofa, BedDouble, X, Settings
} from 'lucide-react';
import { useGroups } from '@/hooks/useGroups';
import { useLights } from '@/hooks/useLights';
import { toast } from 'react-hot-toast';
import { cn } from '@/utils';
import '@/styles/design-system.css';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const steps: WizardStep[] = [
  {
    id: 'room',
    title: 'Select Room',
    description: 'Choose the room for your entertainment area',
    icon: Home
  },
  {
    id: 'type',
    title: 'Entertainment Type',
    description: 'What will you be using this area for?',
    icon: Tv
  },
  {
    id: 'lights',
    title: 'Select Lights',
    description: 'Choose which lights to include',
    icon: Sparkles
  },
  {
    id: 'layout',
    title: 'Position Lights',
    description: 'Arrange your lights in 3D space',
    icon: Grid
  },
  {
    id: 'test',
    title: 'Test & Save',
    description: 'Preview and save your setup',
    icon: Play
  }
];

const entertainmentTypes = [
  {
    id: 'tv',
    name: 'TV & Movies',
    icon: Tv,
    description: 'Sync lights with your TV content',
    gradient: 'var(--gradient-aurora)'
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: Gamepad2,
    description: 'Immersive lighting for gaming',
    gradient: 'var(--gradient-cool)'
  },
  {
    id: 'music',
    name: 'Music & Party',
    icon: Music,
    description: 'Lights that dance to the beat',
    gradient: 'var(--gradient-sunset)'
  },
  {
    id: 'desktop',
    name: 'Desktop/PC',
    icon: Monitor,
    description: 'Ambient lighting for your workspace',
    gradient: 'var(--gradient-ocean)'
  }
];

const EntertainmentWizardNew: React.FC = () => {
  const navigate = useNavigate();
  const { groups, createGroup } = useGroups();
  const { lights } = useLights();

  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  
  // Wizard state
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [entertainmentType, setEntertainmentType] = useState<string | null>(null);
  const [selectedLights, setSelectedLights] = useState<string[]>([]);
  const [lightPositions, setLightPositions] = useState<Record<string, { x: number, y: number, z: number }>>({});
  const [groupName, setGroupName] = useState('');
  const [isTestingLights, setIsTestingLights] = useState(false);

  // Get room groups only
  const roomGroups = groups.filter(g => 
    (g.type === 'Room' || g.type === 'Zone') && 
    g.type !== 'Entertainment'
  );

  // Get lights in selected room
  const roomLights = selectedRoom 
    ? lights.filter(l => {
        const group = groups.find(g => g.id === selectedRoom);
        return group?.lightIds?.includes(l.id);
      })
    : [];

  // Initialize light positions when lights are selected
  useEffect(() => {
    const positions: Record<string, { x: number, y: number, z: number }> = {};
    selectedLights.forEach((lightId, index) => {
      if (!lightPositions[lightId]) {
        // Arrange in a grid by default
        const cols = Math.ceil(Math.sqrt(selectedLights.length));
        const x = (index % cols) * 2 - cols + 1;
        const y = Math.floor(index / cols) * 2 - 2;
        positions[lightId] = { x, y, z: 0 };
      }
    });
    if (Object.keys(positions).length > 0) {
      setLightPositions(prev => ({ ...prev, ...positions }));
    }
  }, [selectedLights]);

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const validateStep = () => {
    switch (steps[currentStep].id) {
      case 'room':
        if (!selectedRoom) {
          toast.error('Please select a room');
          return false;
        }
        return true;
      case 'type':
        if (!entertainmentType) {
          toast.error('Please select an entertainment type');
          return false;
        }
        return true;
      case 'lights':
        if (selectedLights.length < 1) {
          toast.error('Please select at least one light');
          return false;
        }
        return true;
      case 'layout':
        return true;
      case 'test':
        if (!groupName.trim()) {
          toast.error('Please enter a name for your entertainment area');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleTestLights = async () => {
    setIsTestingLights(true);
    // Simulate light testing animation
    for (const lightId of selectedLights) {
      // Flash each light
      toast.success(`Testing light ${lights.find(l => l.id === lightId)?.name}`, {
        icon: '💡'
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setIsTestingLights(false);
    toast.success('Light test complete!', { icon: '✨' });
  };

  const handleCreate = async () => {
    if (!validateStep()) return;

    setIsCreating(true);
    try {
      // Create entertainment configuration
      const result = await createGroup({
        name: groupName,
        type: 'Entertainment',
        lights: selectedLights,
        class: 'TV',
        locations: lightPositions
      });

      if (result.success) {
        toast.success('Entertainment area created!', {
          icon: '🎮',
          duration: 5000
        });
        navigate('/entertainment');
      } else {
        toast.error('Failed to create entertainment area');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'room':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-6">
              Which room will host your entertainment area?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roomGroups.map(room => (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={cn(
                    "glass-card p-6 cursor-pointer transition-all",
                    selectedRoom === room.id && "ring-2 ring-yellow-500 bg-yellow-500/10"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        selectedRoom === room.id 
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                          : "bg-white/10"
                      )}>
                        <Home className={cn(
                          "w-6 h-6",
                          selectedRoom === room.id ? "text-gray-900" : "text-gray-400"
                        )} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{room.name}</h4>
                        <p className="text-sm text-gray-400">
                          {room.lightIds?.length || 0} lights available
                        </p>
                      </div>
                    </div>
                    {selectedRoom === room.id && (
                      <Check className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {roomGroups.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No rooms available. Please create a room first.</p>
              </div>
            )}
          </div>
        );

      case 'type':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-6">
              What type of entertainment setup do you want?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entertainmentTypes.map(type => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.id}
                    onClick={() => setEntertainmentType(type.id)}
                    className={cn(
                      "glass-card p-6 cursor-pointer transition-all relative overflow-hidden",
                      entertainmentType === type.id && "ring-2 ring-yellow-500"
                    )}
                  >
                    {entertainmentType === type.id && (
                      <div 
                        className="absolute inset-0 opacity-10"
                        style={{ background: type.gradient }}
                      />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center"
                          style={{ background: type.gradient }}
                        >
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        {entertainmentType === type.id && (
                          <Check className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      <h4 className="font-semibold text-white mb-1">{type.name}</h4>
                      <p className="text-sm text-gray-400">{type.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'lights':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-6">
              Select lights for your entertainment area
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {roomLights.map(light => (
                <div
                  key={light.id}
                  onClick={() => {
                    if (selectedLights.includes(light.id)) {
                      setSelectedLights(prev => prev.filter(id => id !== light.id));
                    } else {
                      setSelectedLights(prev => [...prev, light.id]);
                    }
                  }}
                  className={cn(
                    "glass-card p-4 cursor-pointer transition-all",
                    selectedLights.includes(light.id) && "ring-2 ring-yellow-500 bg-yellow-500/10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        selectedLights.includes(light.id)
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                          : "bg-white/10"
                      )}>
                        <Zap className={cn(
                          "w-5 h-5",
                          selectedLights.includes(light.id) ? "text-gray-900" : "text-gray-400"
                        )} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{light.name}</p>
                        <p className="text-xs text-gray-400">{light.model || 'Generic'}</p>
                      </div>
                    </div>
                    {selectedLights.includes(light.id) && (
                      <Check className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {roomLights.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No lights found in selected room</p>
              </div>
            )}
          </div>
        );

      case 'layout':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-6">
              Position your lights in 3D space
            </h3>
            <div className="glass-card p-8">
              <div className="relative h-96 bg-black/30 rounded-xl border border-white/10 overflow-hidden">
                {/* 3D Grid Background */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* TV/Screen Reference */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-32 h-20 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center border-2 border-gray-600">
                    <Tv className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">Screen</p>
                </div>

                {/* Light Positions */}
                {selectedLights.map((lightId, index) => {
                  const light = lights.find(l => l.id === lightId);
                  const position = lightPositions[lightId] || { x: 0, y: 0, z: 0 };
                  
                  return (
                    <div
                      key={lightId}
                      className="absolute cursor-move"
                      style={{
                        left: `${50 + position.x * 10}%`,
                        top: `${50 + position.y * 10}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      draggable
                      onDragEnd={(e) => {
                        const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                        if (rect) {
                          const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
                          const y = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
                          setLightPositions(prev => ({
                            ...prev,
                            [lightId]: { x, y, z: 0 }
                          }));
                        }
                      }}
                    >
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-xl opacity-50 scale-150" />
                        <div className="relative w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-xs font-bold text-gray-900">{index + 1}</span>
                        </div>
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                          <p className="text-xs text-gray-400 bg-black/50 px-2 py-1 rounded">
                            {light?.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-400 text-center mt-4">
                Drag lights to position them around your screen
              </p>
            </div>
          </div>
        );

      case 'test':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-6">
              Test and save your entertainment area
            </h3>
            
            <div className="glass-card p-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entertainment Area Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={`${entertainmentType === 'tv' ? 'Living Room TV' : 'Gaming Setup'}`}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="glass-card p-6 space-y-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                Configuration Summary
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Room:</span>
                  <span className="text-white">
                    {roomGroups.find(r => r.id === selectedRoom)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white">
                    {entertainmentTypes.find(t => t.id === entertainmentType)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Lights:</span>
                  <span className="text-white">{selectedLights.length} selected</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleTestLights}
                disabled={isTestingLights}
                className="flex-1 btn-glow flex items-center justify-center gap-2 py-3"
              >
                {isTestingLights ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Test Lights
                  </>
                )}
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !groupName.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Create Area
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-imersa-void relative overflow-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>

      <div className="relative z-10 p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="nav-orb">
                <Sparkles className="w-8 h-8 text-imersa-dark" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Entertainment Area Setup
                </h1>
                <p className="text-gray-400">
                  Create an immersive lighting experience
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/entertainment')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                      isActive && "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg scale-110",
                      isCompleted && "bg-gradient-to-br from-green-400 to-emerald-500",
                      !isActive && !isCompleted && "bg-white/10"
                    )}>
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-white" />
                      ) : (
                        <Icon className={cn(
                          "w-6 h-6",
                          isActive ? "text-gray-900" : "text-gray-400"
                        )} />
                      )}
                    </div>
                    <p className={cn(
                      "text-xs mt-2 font-medium",
                      isActive ? "text-white" : "text-gray-500"
                    )}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-4",
                      index < currentStep ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-white/10"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Step Content */}
        <div className="glass-card p-8 mb-8 min-h-[400px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <StepIcon className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {currentStepData.title}
              </h2>
              <p className="text-sm text-gray-400">
                {currentStepData.description}
              </p>
            </div>
          </div>
          
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              "px-6 py-3 rounded-xl flex items-center gap-2 transition-all",
              currentStep === 0 
                ? "bg-white/5 text-gray-500 cursor-not-allowed" 
                : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-semibold flex items-center gap-2 hover:shadow-lg transition-all"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EntertainmentWizardNew;