// Groups Management Page - Complete group and room organization
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  Home, 
  AlertCircle, 
  RefreshCw, 
  Search,
  Filter,
  Grid,
  List,
  Settings,
  Activity,
  Sparkles,
  Layers,
  Zap,
  ChevronRight
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Button, 
  Input,
  Modal,
  Switch
} from '@/components/ui';
import { GroupCard } from '@/components/groups/GroupCard';
import { useGroups } from '@/hooks/useGroups';
import { GroupCreationRequest, BulkGroupOperation } from '@/types';
import { cn } from '@/utils';
import '@/styles/design-system.css';

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'room' | 'zone' | 'entertainment' | 'custom';
type SortMode = 'name' | 'type' | 'lights' | 'status';

const Groups: React.FC = () => {
  const {
    groups,
    availableLights,
    selectedGroup,
    groupsByRoom,
    roomClasses,
    roomGroupsCount,
    entertainmentGroupsCount,
    totalLightsInGroups,
    activeGroups,
    ungroupedLights,
    isLoading,
    error,
    refreshGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    toggleGroup,
    setGroupBrightness,
    setGroupColor,
    applyGroupAction,
    applyBulkOperation,
    addLightsToGroup,
    removeLightsFromGroup,
    createRoomGroup,
    clearError,
  } = useGroups();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupByRoom, setGroupByRoom] = useState(true);

  // Create form state
  const [createForm, setCreateForm] = useState<GroupCreationRequest>({
    name: '',
    type: 'custom',
    lights: [],
  });

  // Filter and sort groups
  const filteredAndSortedGroups = useMemo(() => {
    let filtered = groups;

    // Apply filters
    if (filterMode !== 'all') {
      filtered = filtered.filter(group => group.type === filterMode);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(query) ||
        group.class?.toLowerCase().includes(query) ||
        group.id.includes(query)
      );
    }

    // Sort groups
    filtered.sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'lights':
          return b.lightIds.length - a.lightIds.length;
        case 'status':
          return (b.isOn ? 1 : 0) - (a.isOn ? 1 : 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [groups, filterMode, searchQuery, sortMode]);

  // Handle create group
  const handleCreateGroup = async () => {
    if (!createForm.name || createForm.lights.length === 0) {
      return;
    }

    const result = await createGroup(createForm);
    
    if (result.success) {
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        type: 'custom',
        lights: [],
      });
    }
  };

  // Handle bulk action
  const handleBulkAction = async (action: 'on' | 'off' | 'delete') => {
    if (selectedGroupIds.length === 0) return;

    if (action === 'delete') {
      const confirmDelete = window.confirm(
        `Are you sure you want to delete ${selectedGroupIds.length} groups? This action cannot be undone.`
      );
      if (!confirmDelete) return;

      for (const groupId of selectedGroupIds) {
        await deleteGroup(groupId);
      }
    } else {
      const bulkOperation: BulkGroupOperation = {
        groupIds: selectedGroupIds,
        action: { on: action === 'on' },
      };
      await applyBulkOperation(bulkOperation);
    }

    setSelectedGroupIds([]);
    setShowBulkActions(false);
  };

  // Toggle group selection
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Stats
  const stats = [
    {
      label: 'Total Groups',
      value: groups.length,
      icon: Users,
      gradient: 'var(--gradient-cool)',
    },
    {
      label: 'Room Groups',
      value: roomGroupsCount,
      icon: Home,
      gradient: 'var(--gradient-warm)',
    },
    {
      label: 'Entertainment',
      value: entertainmentGroupsCount,
      icon: Activity,
      gradient: 'var(--gradient-aurora)',
    },
    {
      label: 'Active Groups',
      value: activeGroups.length,
      icon: Zap,
      gradient: 'var(--gradient-sunset)',
    },
  ];

  return (
    <div className="min-h-screen bg-imersa-void relative overflow-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>

      <div className="relative z-10 p-8 space-y-6">
        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="nav-orb">
                <Layers className="w-8 h-8 text-imersa-dark" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Groups Management</h1>
                <p className="text-gray-400 mt-1">
                  Create and manage light groups and rooms
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={refreshGroups}
                disabled={isLoading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all"
              >
                <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
              </button>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-glow flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group</span>
              </button>
            </div>
          </div>
        </div>

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="glass-card p-6 holo-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: stat.gradient }}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="all">All Types</option>
                <option value="room">Room Groups</option>
                <option value="zone">Zone Groups</option>
                <option value="entertainment">Entertainment</option>
                <option value="custom">Custom</option>
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="lights">Sort by Light Count</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-2">
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
              <button
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'list' 
                    ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900" 
                    : "bg-white/10 hover:bg-white/20 text-gray-400"
                )}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <Switch
                  checked={groupByRoom}
                  onCheckedChange={setGroupByRoom}
                />
                <span>Group by Room</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-400">
                <Switch
                  checked={showBulkActions}
                  onCheckedChange={setShowBulkActions}
                />
                <span>Bulk Actions</span>
              </label>
            </div>

            {showBulkActions && selectedGroupIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  {selectedGroupIds.length} selected
                </span>
                <button
                  onClick={() => handleBulkAction('on')}
                  className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
                >
                  Turn On
                </button>
                <button
                  onClick={() => handleBulkAction('off')}
                  className="px-3 py-1 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-all"
                >
                  Turn Off
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Groups Display */}
        {isLoading && groups.length === 0 ? (
          <div className="glass-card p-8">
            <div className="text-center">
              <div className="loading-pulse mx-auto">
                <Layers className="w-8 h-8 text-imersa-dark" />
              </div>
              <p className="text-gray-400 mt-2">Loading groups...</p>
            </div>
          </div>
        ) : filteredAndSortedGroups.length === 0 ? (
          <div className="glass-card p-8">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-white mb-2">
                {searchQuery || filterMode !== 'all' ? 'No matching groups' : 'No groups found'}
              </p>
              <p className="text-gray-400 mb-4">
                {searchQuery || filterMode !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first group to organize your lights'
                }
              </p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-glow flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Group
              </button>
            </div>
          </div>
      ) : groupByRoom ? (
          // Grouped by Room
          <div className="space-y-6">
            {Object.entries(groupsByRoom).map(([roomName, roomGroups]) => (
              <div key={roomName} className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                    <Home className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {roomName}
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({roomGroups.length} groups)
                    </span>
                  </h3>
                </div>
                <div className={cn(
                  'grid gap-4',
                  viewMode === 'grid' 
                    ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-1'
                )}>
                  {roomGroups.map((group) => (
                    <div key={group.id} className="relative">
                      {showBulkActions && (
                        <div className="absolute top-2 left-2 z-10">
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(group.id)}
                            onChange={() => toggleGroupSelection(group.id)}
                            className="rounded"
                          />
                        </div>
                      )}
                      <GroupCard
                        group={group}
                        availableLights={availableLights}
                        onToggle={toggleGroup}
                        onUpdateBrightness={setGroupBrightness}
                        onUpdateColor={setGroupColor}
                        onApplyAction={applyGroupAction}
                        onEdit={(group) => console.log('Edit group:', group)}
                        onDelete={deleteGroup}
                        onAddLights={addLightsToGroup}
                        onRemoveLights={removeLightsFromGroup}
                        isProcessing={isLoading}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          ) : (
          // All Groups
          <div className={cn(
            'grid gap-4',
            viewMode === 'grid' 
              ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
              : 'grid-cols-1'
          )}>
          {filteredAndSortedGroups.map((group) => (
            <div key={group.id} className="relative">
              {showBulkActions && (
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => toggleGroupSelection(group.id)}
                    className="rounded"
                  />
                </div>
              )}
              <GroupCard
                group={group}
                availableLights={availableLights}
                onToggle={toggleGroup}
                onUpdateBrightness={setGroupBrightness}
                onUpdateColor={setGroupColor}
                onApplyAction={applyGroupAction}
                onEdit={(group) => console.log('Edit group:', group)}
                onDelete={deleteGroup}
                onAddLights={addLightsToGroup}
                onRemoveLights={removeLightsFromGroup}
                isProcessing={isLoading}
              />
            </div>
          ))}
          </div>
        )}

        {/* Create Group Modal */}
        <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Light Group"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Name
            </label>
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Living Room Lights"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group Type
            </label>
            <select
              value={createForm.type}
              onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="room">Room</option>
              <option value="zone">Zone</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {createForm.type === 'room' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Class
              </label>
              <select
                value={createForm.class || 'Other'}
                onChange={(e) => setCreateForm(prev => ({ ...prev, class: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {roomClasses.map(roomClass => (
                  <option key={roomClass} value={roomClass}>
                    {roomClass}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                  <span className="text-xs text-gray-500">({light.type})</span>
                </label>
              ))}
            </div>
            {ungroupedLights.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No ungrouped lights available.
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
              onClick={handleCreateGroup}
              disabled={!createForm.name || createForm.lights.length === 0 || isLoading}
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full mr-2" />
              ) : null}
              Create Group
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
};

export default Groups;