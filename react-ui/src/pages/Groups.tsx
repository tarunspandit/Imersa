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
  Activity
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Button, 
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Switch
} from '@/components/ui';
import { GroupCard } from '@/components/groups/GroupCard';
import { useGroups } from '@/hooks/useGroups';
import { GroupCreationRequest, BulkGroupOperation } from '@/types';
import { cn } from '@/utils';

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
      color: 'text-blue-600',
    },
    {
      label: 'Room Groups',
      value: roomGroupsCount,
      icon: Home,
      color: 'text-green-600',
    },
    {
      label: 'Entertainment',
      value: entertainmentGroupsCount,
      icon: Activity,
      color: 'text-purple-600',
    },
    {
      label: 'Active Groups',
      value: activeGroups.length,
      icon: Settings,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <span>Groups</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage light groups and rooms
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={refreshGroups}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
          
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Group</span>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between space-x-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-2">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="lights">Sort by Light Count</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>

            {/* View Mode */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 border border-gray-300 rounded">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="p-2"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="p-2"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm">
                <Switch checked={groupByRoom} onCheckedChange={setGroupByRoom} />
                <span>Group by Room</span>
              </label>

              <label className="flex items-center space-x-2 text-sm">
                <Switch checked={showBulkActions} onCheckedChange={setShowBulkActions} />
                <span>Bulk Actions</span>
              </label>
            </div>

            {showBulkActions && selectedGroupIds.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedGroupIds.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('on')}
                >
                  Turn On
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('off')}
                >
                  Turn Off
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Groups Display */}
      {isLoading && groups.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border border-current border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-2">Loading groups...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredAndSortedGroups.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery || filterMode !== 'all' ? 'No matching groups' : 'No groups found'}
              </p>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterMode !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first group to organize your lights'
                }
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : groupByRoom ? (
        // Grouped by Room
        <div className="space-y-6">
          {Object.entries(groupsByRoom).map(([roomName, roomGroups]) => (
            <Card key={roomName}>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Home className="h-5 w-5" />
                  <span>{roomName}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({roomGroups.length} groups)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
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
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Create Light Group</ModalTitle>
          </ModalHeader>
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
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
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
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Groups;
