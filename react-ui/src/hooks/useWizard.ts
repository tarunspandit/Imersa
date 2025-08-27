// Entertainment Wizard State Management Hook
import { useState, useCallback, useEffect } from 'react';
import { entertainmentApi } from '@/services/entertainmentApi';
import lightsApiService from '@/services/lightsApi';
import { LightPosition, Light, ApiResponse } from '@/types';

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  isValid: boolean;
  isCompleted: boolean;
}

export interface WizardFormData {
  // Step 1: Basic Info
  name: string;
  configurationType: 'screen' | '3dspace';
  roomClass: string;
  
  // Step 2: Light Selection
  selectedLights: string[];
  availableLights: Light[];
  
  // Step 3: Positioning
  positions: Record<string, LightPosition>;
  
  // Step 4: Review & Create
  createdAreaId: string | null;
}

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  configurationType: 'screen' | '3dspace';
  arrangement: 'linear' | 'circle' | 'rectangle' | 'custom';
  positions?: Record<string, [number, number, number]>;
}

const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'tv-ambient',
    name: 'TV Ambient Setup',
    description: 'Perfect for TV backlighting with lights arranged around screen',
    configurationType: 'screen',
    arrangement: 'rectangle',
  },
  {
    id: 'ceiling-grid',
    name: 'Ceiling Grid',
    description: 'Overhead lighting arranged in a grid pattern',
    configurationType: '3dspace',
    arrangement: 'rectangle',
  },
  {
    id: 'immersive-circle',
    name: 'Immersive Circle',
    description: 'Surround lighting in a circular arrangement',
    configurationType: '3dspace',
    arrangement: 'circle',
  },
  {
    id: 'gaming-setup',
    name: 'Gaming Setup',
    description: 'Optimized for gaming with front-focused lighting',
    configurationType: 'screen',
    arrangement: 'linear',
  },
];

interface UseWizardOptions {
  onComplete?: (areaId: string) => void;
  onError?: (error: string) => void;
}

export function useWizard(options: UseWizardOptions = {}) {
  const { onComplete, onError } = options;

  // Core wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<WizardFormData>({
    name: 'Entertainment Area',
    configurationType: 'screen',
    roomClass: 'Living room',
    selectedLights: [],
    availableLights: [],
    positions: {},
    createdAreaId: null,
  });

  // Wizard steps configuration
  const [steps, setSteps] = useState<WizardStep[]>([
    {
      id: 1,
      title: 'Name & Layout',
      description: 'Set up basic area information',
      isValid: false,
      isCompleted: false,
    },
    {
      id: 2,
      title: 'Select Lights',
      description: 'Choose lights for this entertainment area',
      isValid: false,
      isCompleted: false,
    },
    {
      id: 3,
      title: 'Position Lights',
      description: 'Set physical positions in your space',
      isValid: false,
      isCompleted: false,
    },
    {
      id: 4,
      title: 'Review & Create',
      description: 'Review settings and create the area',
      isValid: false,
      isCompleted: false,
    },
  ]);

  // Initialize wizard - load available lights
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Initialize entertainment API
      await entertainmentApi.initialize();

      // Load available lights (convert from Hue API)
      await lightsApiService.initialize();
      const hueLights = await lightsApiService.fetchLights();
      const allLights = Object.entries(hueLights).map(([id, hue]) =>
        lightsApiService.convertHueLightToLight(id, hue)
      );
      // Legacy UI surfaces all lights for selection; group membership can be refined later
      setFormData(prev => ({
        ...prev,
        availableLights: allLights,
      }));

      // Validate initial step
      validateCurrentStep();
    } catch (err) {
      const errorMsg = `Failed to initialize wizard: ${err}`;
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    setSteps(prevSteps => {
      return prevSteps.map(step => {
        if (step.id === 1) {
          // Step 1: Name validation
          const isValid = formData.name.trim().length > 0;
          return { ...step, isValid, isCompleted: isValid };
        }
        
        if (step.id === 2) {
          // Step 2: Light selection validation
          const isValid = formData.selectedLights.length > 0;
          return { ...step, isValid, isCompleted: isValid };
        }
        
        if (step.id === 3) {
          // Step 3: Position validation
          const hasAllPositions = formData.selectedLights.every(
            lightId => formData.positions[lightId] != null
          );
          const validPositions = Object.values(formData.positions).every(
            pos => pos.x >= -1 && pos.x <= 1 && 
                   pos.y >= -1 && pos.y <= 1 && 
                   pos.z >= -1 && pos.z <= 1
          );
          const isValid = hasAllPositions && validPositions;
          return { ...step, isValid, isCompleted: isValid };
        }
        
        if (step.id === 4) {
          // Step 4: All previous steps must be completed
          const allPreviousValid = prevSteps
            .filter(s => s.id < 4)
            .every(s => s.isCompleted);
          return { ...step, isValid: allPreviousValid, isCompleted: false };
        }
        
        return step;
      });
    });
  }, [formData]);

  // Update form data
  const updateFormData = useCallback((updates: Partial<WizardFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation functions
  const goToStep = useCallback((stepNumber: number) => {
    if (stepNumber >= 1 && stepNumber <= 4) {
      setCurrentStep(stepNumber);
    }
  }, []);

  const nextStep = useCallback(() => {
    const currentStepData = steps.find(s => s.id === currentStep);
    if (currentStepData?.isValid && currentStep < 4) {
      setCurrentStep(prev => prev + 1);
      
      // Auto-generate positions when moving to step 3
      if (currentStep === 2) {
        generateDefaultPositions();
      }
    }
  }, [currentStep, steps]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Light selection functions
  const toggleLight = useCallback((lightId: string) => {
    setFormData(prev => {
      const selectedLights = prev.selectedLights.includes(lightId)
        ? prev.selectedLights.filter(id => id !== lightId)
        : [...prev.selectedLights, lightId];
      
      // Remove position for deselected lights
      const positions = { ...prev.positions };
      if (!selectedLights.includes(lightId)) {
        delete positions[lightId];
      }
      
      return { ...prev, selectedLights, positions };
    });
  }, []);

  const selectAllLights = useCallback(() => {
    const allLightIds = formData.availableLights.map(light => light.id);
    setFormData(prev => ({ ...prev, selectedLights: allLightIds }));
  }, [formData.availableLights]);

  const clearLightSelection = useCallback(() => {
    setFormData(prev => ({ 
      ...prev, 
      selectedLights: [], 
      positions: {} 
    }));
  }, []);

  // Position management functions
  const updateLightPosition = useCallback((
    lightId: string,
    position: Partial<LightPosition>
  ) => {
    setFormData(prev => {
      const existingPosition = prev.positions[lightId] || {
        lightId,
        lightName: prev.availableLights.find(l => l.id === lightId)?.name || `Light ${lightId}`,
        x: 0,
        y: 0,
        z: 0,
      };
      
      return {
        ...prev,
        positions: {
          ...prev.positions,
          [lightId]: { ...existingPosition, ...position }
        }
      };
    });
  }, []);

  const generateDefaultPositions = useCallback(() => {
    const { selectedLights, configurationType } = formData;
    const newPositions: Record<string, LightPosition> = {};
    
    selectedLights.forEach((lightId, index) => {
      const light = formData.availableLights.find(l => l.id === lightId);
      const total = selectedLights.length;
      
      let x, y, z;
      
      if (configurationType === 'screen') {
        // Linear arrangement for screen setup
        if (total === 1) {
          x = 0;
        } else {
          x = -0.8 + (index / (total - 1)) * 1.6; // -0.8 to 0.8
        }
        y = 0.6; // Above screen level
        z = 0;
      } else {
        // Circular arrangement for 3D space
        const angle = (index / total) * 2 * Math.PI;
        const radius = 0.7;
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
        z = 0;
      }
      
      newPositions[lightId] = {
        lightId,
        lightName: light?.name || `Light ${lightId}`,
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        z: Math.round(z * 1000) / 1000,
      };
    });
    
    setFormData(prev => ({ ...prev, positions: newPositions }));
  }, [formData]);

  // Template application
  const applyTemplate = useCallback((template: RoomTemplate) => {
    setFormData(prev => ({ 
      ...prev, 
      configurationType: template.configurationType 
    }));
    
    // Generate positions based on template
    if (formData.selectedLights.length > 0) {
      generateTemplatePositions(template);
    }
  }, [formData.selectedLights]);

  const generateTemplatePositions = useCallback((template: RoomTemplate) => {
    const { selectedLights } = formData;
    const newPositions: Record<string, LightPosition> = {};
    
    selectedLights.forEach((lightId, index) => {
      const light = formData.availableLights.find(l => l.id === lightId);
      const total = selectedLights.length;
      let x, y, z;
      
      switch (template.arrangement) {
        case 'linear':
          x = total === 1 ? 0 : -0.8 + (index / (total - 1)) * 1.6;
          y = template.configurationType === 'screen' ? 0.6 : 0;
          z = 0;
          break;
          
        case 'circle':
          const angle = (index / total) * 2 * Math.PI;
          const radius = 0.7;
          x = Math.cos(angle) * radius;
          y = Math.sin(angle) * radius;
          z = 0;
          break;
          
        case 'rectangle':
          const perSide = Math.ceil(total / 4);
          const side = Math.floor(index / perSide);
          const posInSide = index % perSide;
          
          switch (side) {
            case 0: // Top
              x = perSide === 1 ? 0 : -0.8 + (posInSide / (perSide - 1)) * 1.6;
              y = 0.8;
              break;
            case 1: // Right
              x = 0.8;
              y = perSide === 1 ? 0 : 0.8 - (posInSide / (perSide - 1)) * 1.6;
              break;
            case 2: // Bottom
              x = perSide === 1 ? 0 : 0.8 - (posInSide / (perSide - 1)) * 1.6;
              y = -0.8;
              break;
            default: // Left
              x = -0.8;
              y = perSide === 1 ? 0 : -0.8 + (posInSide / (perSide - 1)) * 1.6;
          }
          z = 0;
          break;
          
        default:
          x = 0;
          y = 0;
          z = 0;
      }
      
      newPositions[lightId] = {
        lightId,
        lightName: light?.name || `Light ${lightId}`,
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        z: Math.round(z * 1000) / 1000,
      };
    });
    
    setFormData(prev => ({ ...prev, positions: newPositions }));
  }, [formData]);

  // Create entertainment area
  const createEntertainmentArea = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Create the area
      const createResult = await entertainmentApi.createEntertainmentArea({
        name: formData.name,
        lights: formData.selectedLights,
        type: 'Entertainment',
        class: formData.roomClass,
      });
      
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create area');
      }
      
      const areaId = createResult.data!;
      
      // Update positions
      const positions = Object.values(formData.positions);
      const positionResult = await entertainmentApi.updateLightPositions(areaId, positions);
      
      if (!positionResult.success) {
        throw new Error(positionResult.error || 'Failed to update positions');
      }
      
      // Update form data with created area ID
      setFormData(prev => ({ ...prev, createdAreaId: areaId }));
      
      // Mark final step as completed
      setSteps(prevSteps => 
        prevSteps.map(step => 
          step.id === 4 ? { ...step, isCompleted: true } : step
        )
      );
      
      onComplete?.(areaId);
      return true;
      
    } catch (err) {
      const errorMsg = `Failed to create entertainment area: ${err}`;
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formData, onComplete, onError]);

  // Test streaming
  const testStreaming = useCallback(async (): Promise<boolean> => {
    if (!formData.createdAreaId) return false;
    
    setIsLoading(true);
    try {
      const result = await entertainmentApi.startStreaming(formData.createdAreaId);
      if (result.success) {
        // Stop after 5 seconds for demo
        setTimeout(() => {
          entertainmentApi.stopStreaming(formData.createdAreaId!);
        }, 5000);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to test streaming:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formData.createdAreaId]);

  // Reset wizard
  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setFormData({
      name: 'Entertainment Area',
      configurationType: 'screen',
      roomClass: 'Living room',
      selectedLights: [],
      availableLights: formData.availableLights, // Keep loaded lights
      positions: {},
      createdAreaId: null,
    });
    setError(null);
  }, [formData.availableLights]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-validate when form data changes
  useEffect(() => {
    validateCurrentStep();
  }, [validateCurrentStep]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Computed properties
  const canGoNext = steps.find(s => s.id === currentStep)?.isValid ?? false;
  const canGoPrev = currentStep > 1;
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === 4;
  const isCompleted = steps[3]?.isCompleted ?? false;
  const totalSteps = steps.length;
  const progress = (currentStep - 1) / (totalSteps - 1) * 100;

  return {
    // State
    currentStep,
    steps,
    formData,
    isLoading,
    error,
    isCompleted,
    
    // Computed
    canGoNext,
    canGoPrev,
    isFirstStep,
    isLastStep,
    progress,
    totalSteps,
    
    // Navigation
    goToStep,
    nextStep,
    prevStep,
    
    // Form updates
    updateFormData,
    
    // Light management
    toggleLight,
    selectAllLights,
    clearLightSelection,
    
    // Position management
    updateLightPosition,
    generateDefaultPositions,
    
    // Templates
    roomTemplates: ROOM_TEMPLATES,
    applyTemplate,
    
    // Actions
    createEntertainmentArea,
    testStreaming,
    resetWizard,
    clearError,
    initialize,
  };
}

export default useWizard;
