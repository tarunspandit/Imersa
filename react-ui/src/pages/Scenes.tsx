import React, { useState, useCallback, useMemo } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { SceneRow } from '@/components/scenes/SceneRow';
import { CreateSceneModal } from '@/components/scenes/CreateSceneModal';
import { useScenes } from '@/hooks/useScenes';
import { useLights } from '@/hooks/useLights';
import { Scene, ScenePreview, SceneBulkAction } from '@/types';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Play, 
  Star,
  Grid,
  List,
  Download,
  Upload,
  Settings,
  Eye,
  AlertCircle,
  Sparkles,
  Palette
} from 'lucide-react';
import { cn } from '@/utils';
import '@/styles/design-system.css';

type ViewMode = 'table' | 'grid';
type FilterType = 'all' | 'active' | 'favorites' | Scene['category'];

const Scenes: React.FC = () => {
  const {
    scenes,
    groups,
    selectedScenes,
    isLoading,
    error,
    refreshScenes,
    createScene,
    updateScene,
    deleteScene,
    recallScene,
    storeLightState,
    bulkAction,
    generatePreview,
    getScenesByGroup,
    getScenesByCategory,
    toggleSceneSelection,
    selectAllScenes,
    clearSelection,
    clearError,
  } = useScenes();

  const { lights } = useLights();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingScene, setIsCreatingScene] = useState(false);
  const [scenePreviews, setScenePreviews] = useState<Record<string, ScenePreview>>({});
  const [previewLoading, setPreviewLoading] = useState<Set<string>>(new Set());

  // Filter and search scenes
  const filteredScenes = useMemo(() => {
    let filtered = scenes;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(scene => 
        scene.name.toLowerCase().includes(query) ||
        scene.id.toLowerCase().includes(query) ||
        scene.category?.toLowerCase().includes(query)
      );
    }

    // Apply category/status filter
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'active') {
        filtered = filtered.filter(scene => scene.isActive);
      } else if (selectedFilter === 'favorites') {
        filtered = filtered.filter(scene => scene.isFavorite);
      } else {
        filtered = getScenesByCategory(selectedFilter);
      }
    }

    // Apply group filter
    if (selectedGroupFilter) {
      filtered = getScenesByGroup(selectedGroupFilter);
    }

    return filtered;
  }, [scenes, searchQuery, selectedFilter, selectedGroupFilter, getScenesByCategory, getScenesByGroup]);

  // Scene creation handler
  const handleCreateScene = useCallback(async (request: any) => {
    setIsCreatingScene(true);
    try {
      const sceneId = await createScene(request);
      return sceneId;
    } finally {
      setIsCreatingScene(false);
    }
  }, [createScene]);

  // Scene rename handler
  const handleRenameScene = useCallback(async (sceneId: string, newName: string) => {
    await updateScene(sceneId, { name: newName });
  }, [updateScene]);

  // Scene preview handler
  const handlePreviewScene = useCallback(async (sceneId: string) => {
    if (scenePreviews[sceneId] || previewLoading.has(sceneId)) return;

    setPreviewLoading(prev => new Set([...prev, sceneId]));
    try {
      const preview = await generatePreview(sceneId);
      if (preview) {
        setScenePreviews(prev => ({ ...prev, [sceneId]: preview }));
      }
    } finally {
      setPreviewLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(sceneId);
        return newSet;
      });
    }
  }, [generatePreview, scenePreviews, previewLoading]);

  // Bulk actions handler
  const handleBulkAction = useCallback(async (action: 'delete' | 'activate' | 'favorite' | 'unfavorite') => {
    if (selectedScenes.length === 0) return;

    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${selectedScenes.length} scenes?`)) return;
    }

    if (action === 'activate') {
      const groupId = prompt('Enter group ID to activate scenes in:');
      if (!groupId) return;
      
      const bulkActionData: SceneBulkAction = {
        sceneIds: selectedScenes,
        action,
        groupId,
      };
      await bulkAction(bulkActionData);
    } else {
      const bulkActionData: SceneBulkAction = {
        sceneIds: selectedScenes,
        action,
      };
      await bulkAction(bulkActionData);
    }
  }, [selectedScenes, bulkAction]);

  // Statistics
  const stats = useMemo(() => ({
    total: scenes.length,
    active: scenes.filter(s => s.isActive).length,
    favorites: scenes.filter(s => s.isFavorite).length,
    byCategory: {
      Evening: scenes.filter(s => s.category === 'Evening').length,
      Party: scenes.filter(s => s.category === 'Party').length,
      Work: scenes.filter(s => s.category === 'Work').length,
      Relax: scenes.filter(s => s.category === 'Relax').length,
      Custom: scenes.filter(s => s.category === 'Custom').length,
    }
  }), [scenes]);

  return (
    <PageWrapper
      icon={<Palette className="w-8 h-8 text-imersa-dark" />}
      title="Scenes"
      subtitle={`Create and manage lighting scenes • ${stats.total} scenes total`}
      actions={
        <>
          <button
            onClick={refreshScenes}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all"
          >
            <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-glow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Scene
          </button>
        </>
      }
    >

      {/* Error Display */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-gray-400">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-400">Active</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.active}</p>
        </div>
        <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-2">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium text-gray-400">Favorites</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.favorites}</p>
        </div>
        <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm font-medium text-gray-400">Evening</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.byCategory.Evening}</p>
        </div>
        <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-sm font-medium text-gray-400">Party</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.byCategory.Party}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                placeholder="Search scenes by name, ID, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as FilterType)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="all">All Scenes</option>
            <option value="active">Active</option>
            <option value="favorites">Favorites</option>
            <option value="Evening">Evening</option>
            <option value="Party">Party</option>
            <option value="Work">Work</option>
            <option value="Relax">Relax</option>
            <option value="Custom">Custom</option>
          </select>

          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="">All Groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.id})
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'table' 
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900" 
                  : "bg-white/10 hover:bg-white/20 text-gray-400"
              )}
              onClick={() => setViewMode('table')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grid' 
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900" 
                  : "bg-white/10 hover:bg-white/20 text-gray-400"
              )}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedScenes.length > 0 && (
        <div className="glass-card p-4 border-imersa-glow-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white">
                {selectedScenes.length} scene{selectedScenes.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleBulkAction('activate')}
                className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Activate
              </button>
              <button 
                onClick={() => handleBulkAction('favorite')}
                className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-all flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                Favorite
              </button>
              <button 
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button 
                onClick={clearSelection}
                className="px-3 py-1 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenes Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Lighting Scenes</h3>
          <div className="flex items-center gap-2">
            {filteredScenes.length !== scenes.length && (
              <span className="text-sm text-gray-400">
                {filteredScenes.length} of {scenes.length} scenes
              </span>
            )}
            <button 
              onClick={selectAllScenes}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-all"
            >
              Select All
            </button>
          </div>
        </div>
          {filteredScenes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery || selectedFilter !== 'all' || selectedGroupFilter ? (
                <div>
                  <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No scenes found matching your filters</p>
                  <button 
                    className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilter('all');
                      setSelectedGroupFilter('');
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div>
                  <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No scenes created yet</p>
                  <button 
                    onClick={() => setIsCreateModalOpen(true)} 
                    className="mt-2 btn-glow flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first scene
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedScenes.length === filteredScenes.length && filteredScenes.length > 0}
                        onChange={() => selectedScenes.length === filteredScenes.length ? clearSelection() : selectAllScenes()}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Updated</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredScenes.map((scene) => (
                    <SceneRow
                      key={scene.id}
                      scene={scene}
                      groups={groups}
                      isSelected={selectedScenes.includes(scene.id)}
                      onSelect={toggleSceneSelection}
                      onRename={handleRenameScene}
                      onDelete={deleteScene}
                      onRecall={recallScene}
                      onStoreLightState={storeLightState}
                      onPreview={handlePreviewScene}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Create Scene Modal */}
      <CreateSceneModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateScene}
        groups={groups}
        availableLights={lights}
        isCreating={isCreatingScene}
      />
    </PageWrapper>
  );
};

export default Scenes;