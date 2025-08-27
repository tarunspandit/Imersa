// Entertainment Areas Page - Complete streaming and position management
import React, { useState, useEffect } from 'react';
import { Plus, Activity, AlertCircle, RefreshCw, Users, Monitor, Sparkles, Tv } from 'lucide-react';
import { Modal } from '@/components/ui';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AreaRow } from '@/components/entertainment/AreaRow';
import { PositionEditor } from '@/components/entertainment/PositionEditor';
import { useEntertainment } from '@/hooks/useEntertainment';
import { useGroups } from '@/hooks/useGroups';
import { EntertainmentArea, CreateAreaRequest } from '@/types';
import { cn } from '@/utils';
import '@/styles/design-system.css';

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
    <PageWrapper
      icon={<Tv className="w-8 h-8 text-imersa-dark" />}
      title="Entertainment"
      subtitle="Set up entertainment areas for immersive lighting experiences"
      actions={
        <>
          <button
            onClick={refreshAreas}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all"
          >
            <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={() => window.location.href = '/entertainment/wizard'}
            className="btn-glow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Area
          </button>
        </>
      }
    >

      {/* Error Alert */}
      {error && (
        <div className="glass-card p-4 border-red-500/20 bg-red-500/10">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={clearError}
              className="ml-auto text-red-300 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-6 holo-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Entertainment Areas Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Entertainment Areas
            {activeStreamingAreas.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                {activeStreamingAreas.length} streaming
              </span>
            )}
          </h3>
        </div>
          {isLoading && areas.length === 0 ? (
            <div className="text-center py-8">
              <div className="loading-pulse mx-auto">
                <Tv className="w-8 h-8 text-imersa-dark" />
              </div>
              <p className="text-gray-400 mt-2">Loading entertainment areas...</p>
            </div>
          ) : areas.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-white mb-2">No entertainment areas found</p>
              <p className="text-gray-400 mb-4">
                Create your first entertainment area to start streaming immersive lighting
              </p>
              <button 
                onClick={() => window.location.href = '/entertainment/wizard'}
                className="btn-glow flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Entertainment Area
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-6 font-medium text-gray-400">ID</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-400">Name</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-400">Lights</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-400">Status</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-400">Actions</th>
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
      </div>

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
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Entertainment Area"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Area Name
            </label>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Living Room Entertainment"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Room Class
            </label>
            <select
              value={createForm.class}
              onChange={(e) => setCreateForm(prev => ({ ...prev, class: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
              {ungroupedLights.map((light) => (
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
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateArea}
              disabled={!createForm.name || createForm.lights.length === 0 || isLoading}
              className="btn-glow flex items-center gap-2"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full mr-2" />
              ) : null}
              Create Area
            </button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
};

export default Entertainment;