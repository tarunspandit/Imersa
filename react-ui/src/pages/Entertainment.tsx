// Entertainment Areas Page - Complete streaming and position management
import React, { useState, useEffect } from 'react';
import { Plus, Activity, AlertCircle, RefreshCw, Users, Monitor } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Button, 
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Input
} from '@/components/ui';
import { AreaRow } from '@/components/entertainment/AreaRow';
import { PositionEditor } from '@/components/entertainment/PositionEditor';
import { useEntertainment } from '@/hooks/useEntertainment';
import { useGroups } from '@/hooks/useGroups';
import type { Light } from '@/types';
import { EntertainmentArea, CreateAreaRequest } from '@/types';
import { cn } from '@/utils';

const Entertainment: React.FC = () => {
  const {
    areas,
    selectedArea,
    positions,
    isLoading,
    error,
    activeStreamingAreas,
    totalLightsInEntertainment,
    refreshAreas,
    selectArea,
    createArea,
    deleteArea,
    toggleStreaming,
    loadPositions,
    updatePositions,
    clearError,
  } = useEntertainment();

  const {
    ungroupedLights,
    refreshAvailableLights,
  } = useGroups({ includeEntertainment: false });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAreaRequest>({
    name: '',
    lights: [],
    type: 'Entertainment' as const,
    class: 'Other',
  });

  // Handle create area
  const handleCreateArea = async () => {
    if (!createForm.name || createForm.lights.length === 0) {
      return;
    }

    const result = await createArea(createForm);
    
    if (result.success) {
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        lights: [],
        type: 'Entertainment',
        class: 'Other',
      });
    }
  };

  // Handle edit positions
  const handleEditPositions = (area: EntertainmentArea) => {
    selectArea(area);
    setShowPositionEditor(true);
  };

  // Handle close position editor
  const handleClosePositionEditor = () => {
    setShowPositionEditor(false);
    selectArea(null);
  };

  // Handle update positions
  const handleUpdatePositions = async (areaId: string, positions: any[]) => {
    await updatePositions(areaId, positions);
  };

  // Stats
  const stats = [
    {
      label: 'Total Areas',
      value: areas.length,
      icon: Monitor,
      color: 'text-blue-600',
    },
    {
      label: 'Active Streaming',
      value: activeStreamingAreas.length,
      icon: Activity,
      color: 'text-emerald-600',
    },
    {
      label: 'Total Lights',
      value: totalLightsInEntertainment,
      icon: Users,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient flex items-center space-x-3">
            <Activity className="h-8 w-8 text-emerald-600" />
            <span>Entertainment</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up entertainment areas for immersive lighting experiences
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={refreshAreas}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
          
          <Button
            onClick={() => window.location.href = '/entertainment/wizard'}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Area</span>
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-auto text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={cn('h-8 w-8', stat.color)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Entertainment Areas Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>Entertainment Areas</span>
            {activeStreamingAreas.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                {activeStreamingAreas.length} streaming
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && areas.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border border-current border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-2">Loading entertainment areas...</p>
            </div>
          ) : areas.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900 mb-2">No entertainment areas found</p>
              <p className="text-muted-foreground mb-4">
                Create your first entertainment area to start streaming immersive lighting
              </p>
              <Button onClick={() => window.location.href = '/entertainment/wizard'}>
                <Plus className="h-4 w-4 mr-2" />
                Create Entertainment Area
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-6 font-medium text-gray-900">ID</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Name</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Lights</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area) => (
                    <AreaRow
                      key={area.id}
                      area={area}
                      onToggleStreaming={toggleStreaming}
                      onEditPositions={handleEditPositions}
                      onDelete={deleteArea}
                      isProcessing={isLoading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Editor */}
      {showPositionEditor && (
        <PositionEditor
          area={selectedArea}
          positions={selectedArea ? positions[selectedArea.id] || [] : []}
          onUpdatePositions={handleUpdatePositions}
          onLoadPositions={loadPositions}
          isLoading={isLoading}
        />
      )}

      {/* Create Area Modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Create Entertainment Area</ModalTitle>
          </ModalHeader>
          <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area Name
            </label>
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Living Room Entertainment"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Class
            </label>
            <select
              value={createForm.class}
              onChange={(e) => setCreateForm(prev => ({ ...prev, class: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Living room">Living Room</option>
              <option value="Bedroom">Bedroom</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Office">Office</option>
              <option value="Recreation">Recreation</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Lights ({createForm.lights.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
              {ungroupedLights.map((light: Light) => (
                <label key={light.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={createForm.lights.includes(light.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCreateForm(prev => ({
                          ...prev,
                          lights: [...prev.lights, light.id]
                        }));
                      } else {
                        setCreateForm(prev => ({
                          ...prev,
                          lights: prev.lights.filter(id => id !== light.id)
                        }));
                      }
                    }}
                    className="rounded"
                  />
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    light.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                  )} />
                  <span className="text-sm">{light.name}</span>
                </label>
              ))}
            </div>
            {ungroupedLights.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No available lights. All lights are already in groups.
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateArea}
              disabled={!createForm.name || createForm.lights.length === 0 || isLoading}
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full mr-2" />
              ) : null}
              Create Area
            </Button>
          </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Entertainment;
