// Entertainment Wizard - Complete Multi-step Setup
import React from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Wand2, 
  Home,
  CheckCircle,
  Tv,
  Monitor,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { WizardSteps } from '@/components/wizard/WizardSteps';
import { LightSelector } from '@/components/wizard/LightSelector';
import { PositionMapper } from '@/components/wizard/PositionMapper';
import { TestPreview } from '@/components/wizard/TestPreview';
import { useWizard } from '@/hooks/useWizard';
import { cn } from '@/utils';
import '@/styles/design-system.css';

const EntertainmentWizard: React.FC = () => {
  const navigate = useNavigate();
  
  const {
    currentStep,
    steps,
    formData,
    isLoading,
    error,
    isCompleted,
    canGoNext,
    canGoPrev,
    isFirstStep,
    isLastStep,
    progress,
    goToStep,
    nextStep,
    prevStep,
    updateFormData,
    toggleLight,
    selectAllLights,
    clearLightSelection,
    updateLightPosition,
    generateDefaultPositions,
    roomTemplates,
    applyTemplate,
    createEntertainmentArea,
    testStreaming,
    resetWizard,
    clearError,
  } = useWizard({
    onComplete: (areaId) => {
      console.log('Entertainment area created:', areaId);
    },
    onError: (error) => {
      console.error('Wizard error:', error);
    },
  });

  // Handle navigation
  const handleBack = () => {
    if (isFirstStep) {
      navigate('/entertainment');
    } else {
      prevStep();
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      nextStep();
    }
  };

  // Auto-arrange positions wrapper
  const handleAutoArrange = () => {
    generateDefaultPositions();
  };

  // Reset positions wrapper  
  const handleResetPositions = () => {
    const resetPositions: typeof formData.positions = {};
    formData.selectedLights.forEach(lightId => {
      const light = formData.availableLights.find(l => l.id === lightId);
      resetPositions[lightId] = {
        lightId,
        lightName: light?.name || `Light ${lightId}`,
        x: 0,
        y: 0,
        z: 0,
      };
    });
    updateFormData({ positions: resetPositions });
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="glass-card p-6 space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-imersa-glow-primary" />
                Entertainment Area Information
              </h3>
                
                <div className="space-y-4">
                  {/* Area Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Area Name
                    </label>
                    <input
                      value={formData.name}
                      onChange={(e) => updateFormData({ name: e.target.value })}
                      placeholder="e.g., Living Room TV, Gaming Setup"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      A descriptive name helps identify the area in entertainment apps
                    </p>
                  </div>

                  {/* Configuration Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Configuration Type
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        className={cn(
                          'glass-card p-4 cursor-pointer transition-all',
                          formData.configurationType === 'screen'
                            ? 'border-imersa-glow-primary/50 holo-card'
                            : 'hover:border-imersa-glow-primary/30'
                        )}
                        onClick={() => updateFormData({ configurationType: 'screen' })}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="radio"
                            checked={formData.configurationType === 'screen'}
                            onChange={() => updateFormData({ configurationType: 'screen' })}
                            className="accent-imersa-glow-primary"
                          />
                          <span className="font-medium text-white">Screen (2D)</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          Perfect for TV/monitor setups. Lights are positioned around a screen in a 2D plane.
                        </p>
                      </div>
                      
                      <div
                        className={cn(
                          'glass-card p-4 cursor-pointer transition-all',
                          formData.configurationType === '3dspace'
                            ? 'border-imersa-glow-primary/50 holo-card'
                            : 'hover:border-imersa-glow-primary/30'
                        )}
                        onClick={() => updateFormData({ configurationType: '3dspace' })}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="radio"
                            checked={formData.configurationType === '3dspace'}
                            onChange={() => updateFormData({ configurationType: '3dspace' })}
                            className="accent-imersa-glow-primary"
                          />
                          <span className="font-medium text-white">3D Space</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          For complex room arrangements. Lights can be positioned anywhere in 3D space.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Room Class */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Room Type
                    </label>
                    <select
                      value={formData.roomClass}
                      onChange={(e) => updateFormData({ roomClass: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="Living room">Living Room</option>
                      <option value="Bedroom">Bedroom</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Dining">Dining Room</option>
                      <option value="Office">Office</option>
                      <option value="Recreation">Recreation Room</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
        );

      case 2:
        return (
          <LightSelector
            availableLights={formData.availableLights}
            selectedLights={formData.selectedLights}
            onToggleLight={toggleLight}
            onSelectAll={selectAllLights}
            onClearSelection={clearLightSelection}
            isLoading={isLoading}
          />
        );

      case 3:
        return (
          <PositionMapper
            selectedLights={formData.selectedLights}
            positions={formData.positions}
            configurationType={formData.configurationType}
            roomTemplates={roomTemplates}
            onUpdatePosition={updateLightPosition}
            onApplyTemplate={applyTemplate}
            onAutoArrange={handleAutoArrange}
            onResetPositions={handleResetPositions}
          />
        );

      case 4:
        return (
          <TestPreview
            formData={formData}
            createdAreaId={formData.createdAreaId}
            onTestStreaming={testStreaming}
            onCreateArea={createEntertainmentArea}
            isLoading={isLoading}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-imersa-void relative overflow-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="nav-orb">
                <Tv className="w-8 h-8 text-imersa-dark" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Entertainment Area Wizard
                </h1>
                <p className="text-gray-400 mt-1">
                  Set up your entertainment lighting in 4 simple steps
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/entertainment')}
              className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Back to Entertainment</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="glass-card p-4 border-red-500/20 bg-red-500/10 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-red-400">
                <span>{error}</span>
              </div>
              <button
                onClick={clearError}
                className="text-red-300 hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Wizard Steps Navigation */}
        <div className="mb-8">
          <WizardSteps
            steps={steps}
            currentStep={currentStep}
            progress={progress}
            onStepClick={goToStep}
          />
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {renderStepContent()}
        </div>

        {/* Navigation Controls */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all flex items-center gap-2 min-w-[120px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isFirstStep ? 'Exit Wizard' : 'Previous'}</span>
            </button>

            <div className="flex items-center gap-3">
              {/* Reset Wizard Button (only show if not completed) */}
              {!isCompleted && currentStep > 1 && (
                <button
                  onClick={resetWizard}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Reset Wizard
                </button>
              )}

              {/* Completion Button */}
              {isCompleted ? (
                <button
                  onClick={() => navigate('/entertainment')}
                  className="btn-glow flex items-center gap-2 min-w-[140px]"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Go to Entertainment</span>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canGoNext || isLoading || isLastStep}
                  className={cn(
                    "flex items-center gap-2 min-w-[120px] px-4 py-2 rounded-xl transition-all",
                    !canGoNext || isLoading || isLastStep
                      ? "bg-imersa-surface border border-gray-700 text-gray-500 cursor-not-allowed"
                      : "btn-glow"
                  )}
                >
                  {isLoading ? (
                    <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-6 text-center text-sm text-gray-400">
          Step {currentStep} of {steps.length}
          {isCompleted && (
            <span className="ml-2 text-emerald-400 font-medium">
              ✓ Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntertainmentWizard;