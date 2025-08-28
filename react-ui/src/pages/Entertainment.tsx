// Entertainment Areas Page - Complete streaming and position management
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Activity, AlertCircle, RefreshCw, Users, Monitor, Sparkles, Tv } from 'lucide-react';
import { Modal } from '@/components/ui';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AreaRow } from '@/components/entertainment/AreaRow';
import { PositionEditor } from '@/components/entertainment/PositionEditor';
import { LightMembershipEditor } from '@/components/entertainment/LightMembershipEditor';
import { useEntertainment } from '@/hooks/useEntertainment';
import { useGroups } from '@/hooks/useGroups';
import { EntertainmentArea, CreateAreaRequest, Light, LightPosition } from '@/types';
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
    availableLights,
    refreshAvailableLights,
    updateGroup,
  } = useGroups({ includeEntertainment: true });

  // Removed redundant create modal - using wizard instead
  const [showPositionEditor, setShowPositionEditor] = useState(false);
  const [showLightEditor, setShowLightEditor] = useState(false);
  const [areaForLightEdit, setAreaForLightEdit] = useState<EntertainmentArea | null>(null);

  const lightMap: Record<string, Light> = React.useMemo(() => {
    const map: Record<string, Light> = {};
    (availableLights as Light[]).forEach(l => { map[l.id] = l; });
    return map;
  }, [availableLights]);
  // Removed create form state - using wizard instead

  // Removed handleCreateArea - using wizard instead

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

  // Handle edit lights
  const handleEditLights = (area: EntertainmentArea) => {
    setAreaForLightEdit(area);
    setShowLightEditor(true);
  };

  const handleLightSave = useCallback(async (lightIds: string[]) => {
    if (!areaForLightEdit) return;
    // 1) Update membership
    const res = await updateGroup(areaForLightEdit.id, { lightIds });
    if (!res.success) return;

    // 2) Merge existing positions and auto-arrange missing
    const current = positions[areaForLightEdit.id] || [];
    const existingMap = new Map(current.map(p => [p.lightId, p]));
    const kept: LightPosition[] = lightIds
      .filter(id => existingMap.has(id))
      .map(id => existingMap.get(id)!)
      .map(p => ({ ...p }));

    const missing = lightIds.filter(id => !existingMap.has(id));
    const missingArranged: LightPosition[] = arrangeMissing(kept, missing);

    const merged = [...kept, ...missingArranged];

    // 3) Save updated positions in bridge
    await updatePositions(areaForLightEdit.id, merged);
    await refreshAreas();
  }, [areaForLightEdit, positions, updateGroup, updatePositions, refreshAreas, lightMap]);

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
                    onEditLights={handleEditLights}
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
          lightMap={lightMap}
          onUpdatePositions={handleUpdatePositions}
          onLoadPositions={loadPositions}
          isLoading={isLoading}
        />
      )}

      {/* Edit Lights Modal */}
      {showLightEditor && (
        <LightMembershipEditor
          isOpen={showLightEditor}
          area={areaForLightEdit}
          availableLights={availableLights as Light[]}
          onRefreshLights={refreshAvailableLights}
          onSave={handleLightSave}
          onClose={() => { setShowLightEditor(false); setAreaForLightEdit(null); }}
          isSaving={isLoading}
        />
      )}

      {/* Removed redundant create modal - using wizard instead */}
    </PageWrapper>
  );
};

export default Entertainment;
  // Arrange missing lights based on existing layout (prefer rectangle edges)
  const arrangeMissing = useCallback((existing: LightPosition[], missingIds: string[]): LightPosition[] => {
    if (missingIds.length === 0) return [];
    const eps = 0.15;
    const counts = { top: 0, bottom: 0, left: 0, right: 0 };
    existing.forEach(p => {
      if (p.y >= 0.8 - eps) counts.top++;
      else if (p.y <= -0.8 + eps) counts.bottom++;
      else if (p.x >= 0.8 - eps) counts.right++;
      else if (p.x <= -0.8 + eps) counts.left++;
    });
    const sides = ['top','right','bottom','left'] as const;
    const sideHas = sides.filter(s => counts[s] > 0);
    if (sideHas.length >= 2) {
      // Rectangle: distribute to least populated sides
      const placements: LightPosition[] = [];
      const totalAfter = existing.length + missingIds.length;
      const perSideIdeal = Math.ceil(totalAfter / 4);
      const assignSide = () => {
        // pick side with smallest count
        let minSide = 'top' as typeof sides[number];
        let minCount = Number.MAX_SAFE_INTEGER;
        for (const s of sides) {
          const c = counts[s];
          if (c < minCount) { minCount = c; minSide = s; }
        }
        counts[minSide]++;
        return minSide;
      };
      missingIds.forEach((lightId) => {
        const light = lightMap[lightId];
        const side = assignSide();
        // Position along side evenly based on new counts
        const cSide = counts[side];
        const idx = cSide - 1;
        const n = Math.max(1, perSideIdeal);
        let x = 0, y = 0, z = 0;
        const t = n === 1 ? 0.5 : idx / (n - 1); // 0..1
        if (side === 'top') { x = -0.8 + t * 1.6; y = 0.8; }
        if (side === 'bottom') { x = -0.8 + t * 1.6; y = -0.8; }
        if (side === 'right') { x = 0.8; y = 0.8 - t * 1.6; }
        if (side === 'left') { x = -0.8; y = -0.8 + t * 1.6; }
        placements.push({ lightId, lightName: light?.name || `Light ${lightId}`, x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z });
      });
      return placements;
    }
    // Fallback circle
    const radius = 0.7;
    return missingIds.map((lightId, index) => {
      const angle = (index / missingIds.length) * 2 * Math.PI;
      const light = lightMap[lightId];
      return {
        lightId,
        lightName: light?.name || `Light ${lightId}`,
        x: Number((Math.cos(angle) * radius).toFixed(3)),
        y: Number((Math.sin(angle) * radius).toFixed(3)),
        z: 0,
      };
    });
  }, [lightMap]);
