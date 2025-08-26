// Entertainment Wizard - Complete Multi-step Setup
import React from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Wand2, 
  Home,
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { WizardSteps } from '@/components/wizard/WizardSteps';
import { LightSelector } from '@/components/wizard/LightSelector';
import { PositionMapper } from '@/components/wizard/PositionMapper';
import { TestPreview } from '@/components/wizard/TestPreview';
import { useWizard } from '@/hooks/useWizard';
import { cn } from '@/utils';

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
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Entertainment Area Information
                </h3>
                
                <div className="space-y-4">
                  {/* Area Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Area Name
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => updateFormData({ name: e.target.value })}
                      placeholder="e.g., Living Room TV, Gaming Setup"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      A descriptive name helps identify the area in entertainment apps
                    </p>
                  </div>

                  {/* Configuration Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Configuration Type
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        className={cn(
                          'border-2 rounded-lg p-4 cursor-pointer transition-all',
                          formData.configurationType === 'screen'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => updateFormData({ configurationType: 'screen' })}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="radio"
                            checked={formData.configurationType === 'screen'}
                            onChange={() => updateFormData({ configurationType: 'screen' })}
                            className="text-blue-600"
                          />
                          <span className="font-medium">Screen (2D)</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Perfect for TV/monitor setups. Lights are positioned around a screen in a 2D plane.
                        </p>
                      </div>
                      
                      <div
                        className={cn(
                          'border-2 rounded-lg p-4 cursor-pointer transition-all',
                          formData.configurationType === '3dspace'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => updateFormData({ configurationType: '3dspace' })}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="radio"
                            checked={formData.configurationType === '3dspace'}
                            onChange={() => updateFormData({ configurationType: '3dspace' })}
                            className="text-blue-600"
                          />
                          <span className="font-medium">3D Space</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          For complex room arrangements. Lights can be positioned anywhere in 3D space.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Room Class */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Type
                    </label>
                    <select
                      value={formData.roomClass}
                      onChange={(e) => updateFormData({ roomClass: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            </CardContent>
          </Card>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Wand2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Entertainment Area Wizard
              </h1>
              <p className="text-gray-600 mt-1">
                Set up your entertainment lighting in 4 simple steps
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate('/entertainment')}
            className="flex items-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Back to Entertainment</span>
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-red-800">
                  <span>{error}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="text-red-600 hover:text-red-700"
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
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
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isLoading}
            className="flex items-center space-x-2 min-w-[120px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isFirstStep ? 'Exit Wizard' : 'Previous'}</span>
          </Button>

          <div className="flex items-center space-x-3">
            {/* Reset Wizard Button (only show if not completed) */}
            {!isCompleted && currentStep > 1 && (
              <Button
                variant="ghost"
                onClick={resetWizard}
                disabled={isLoading}
                className="text-gray-600"
              >
                Reset Wizard
              </Button>
            )}

            {/* Completion Button */}
            {isCompleted ? (
              <Button
                onClick={() => navigate('/entertainment')}
                className="flex items-center space-x-2 min-w-[140px]"
              >
                <CheckCircle className="w-4 w-4" />
                <span>Go to Entertainment</span>
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canGoNext || isLoading || isLastStep}
                className="flex items-center space-x-2 min-w-[120px]"
              >
                {isLoading ? (
                  <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Step {currentStep} of {steps.length}
          {isCompleted && (
            <span className="ml-2 text-emerald-600 font-medium">
              ✓ Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntertainmentWizard;