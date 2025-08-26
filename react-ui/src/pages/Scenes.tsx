import React, { useState, useCallback, useMemo } from 'react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
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
  AlertCircle
} from 'lucide-react';

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Scenes</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage lighting scenes • {stats.total} scenes total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshScenes}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Scene
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div className="flex-1">
            <p className="text-red-800">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <p className="text-2xl font-bold">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium">Favorites</span>
            </div>
            <p className="text-2xl font-bold">{stats.favorites}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm font-medium">Evening</span>
            </div>
            <p className="text-2xl font-bold">{stats.byCategory.Evening}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-sm font-medium">Party</span>
            </div>
            <p className="text-2xl font-bold">{stats.byCategory.Party}</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search scenes by name, ID, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as FilterType)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.id})
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-md">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-l-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedScenes.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-900">
              {selectedScenes.length} scene{selectedScenes.length === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('activate')}>
              <Play className="w-4 h-4 mr-2" />
              Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkAction('favorite')}>
              <Star className="w-4 h-4 mr-2" />
              Favorite
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleBulkAction('delete')}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Scenes Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lighting Scenes</CardTitle>
            <div className="flex items-center gap-2">
              {filteredScenes.length !== scenes.length && (
                <span className="text-sm text-gray-500">
                  {filteredScenes.length} of {scenes.length} scenes
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={selectAllScenes}>
                Select All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredScenes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery || selectedFilter !== 'all' || selectedGroupFilter ? (
                <div>
                  <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No scenes found matching your filters</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilter('all');
                      setSelectedGroupFilter('');
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div>
                  <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No scenes created yet</p>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="mt-2">
                    Create your first scene
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedScenes.length === filteredScenes.length && filteredScenes.length > 0}
                        onChange={() => selectedScenes.length === filteredScenes.length ? clearSelection() : selectAllScenes()}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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
        </CardContent>
      </Card>

      {/* Create Scene Modal */}
      <CreateSceneModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateScene}
        groups={groups}
        availableLights={lights}
        isCreating={isCreatingScene}
      />
    </div>
  );
};

export default Scenes;