import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui';
import { LightRow } from '@/components/lights/LightRow';
import { useLights } from '@/hooks/useLights';
import { RefreshCw, Power, PowerOff, Search, Grid, List, Zap, ZapOff, AlertCircle, Loader2, X, SatelliteDish, Plus } from 'lucide-react';
import lightsApiService from '@/services/lightsApi';
import { useAppStore } from '@/stores';
import type { Light } from '@/types';

type ViewMode = 'table' | 'grid';
type SortField = 'name' | 'type' | 'status' | 'brightness' | 'lastSeen';
type SortDirection = 'asc' | 'desc';

const Lights: React.FC = () => {
  const {
    lights,
    lightTypes,
    isLoading,
    error,
    refreshLights,
    toggleLight,
    setBrightness,
    setColorTemperature,
    setHue,
    setSaturation,
    renameLight,
    deleteLight,
    setLightType,
    allLightsOn,
    allLightsOff,
    clearError,
  } = useLights(true, 5000); // Auto-refresh every 5 seconds

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'error'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedLights, setSelectedLights] = useState<string[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualProtocol, setManualProtocol] = useState('');
  const [manualConfig, setManualConfig] = useState('');
  const { addNotification } = useAppStore();

  // Filter and sort lights
  const filteredAndSortedLights = React.useMemo(() => {
    let filtered = lights;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(light =>
        light.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        light.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        light.brand.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(light => light.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'lastSeen') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [lights, searchQuery, statusFilter, sortField, sortDirection]);

  // Stats
  const stats = React.useMemo(() => {
    const total = lights.length;
    const online = lights.filter(l => l.status === 'online').length;
    const on = lights.filter(l => l.isOn && l.status === 'online').length;
    const averageBrightness = lights.length > 0 
      ? Math.round(lights.reduce((sum, l) => sum + (l.isOn ? l.brightness : 0), 0) / lights.length)
      : 0;
    
    return { total, online, on, averageBrightness };
  }, [lights]);

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const handleSelectLight = useCallback((lightId: string) => {
    setSelectedLights(prev => 
      prev.includes(lightId) 
        ? prev.filter(id => id !== lightId)
        : [...prev, lightId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedLights.length === filteredAndSortedLights.length) {
      setSelectedLights([]);
    } else {
      setSelectedLights(filteredAndSortedLights.map(light => light.id));
    }
  }, [selectedLights.length, filteredAndSortedLights]);

  const handleBulkAction = useCallback(async (action: 'on' | 'off' | 'delete') => {
    if (selectedLights.length === 0) return;

    try {
      if (action === 'delete') {
        // Handle bulk delete
        await Promise.all(selectedLights.map(lightId => deleteLight(lightId)));
      } else {
        // Handle bulk on/off for selected lights
        await Promise.all(
          selectedLights.map(lightId => {
            const light = lights.find(l => l.id === lightId);
            if (light && ((action === 'on' && !light.isOn) || (action === 'off' && light.isOn))) {
              return toggleLight(lightId);
            }
            return Promise.resolve();
          })
        );
      }
      setSelectedLights([]);
    } catch (error) {
      console.error(`Bulk ${action} failed:`, error);
    }
  }, [selectedLights, lights, toggleLight, deleteLight]);

  const handleScanForLights = useCallback(async () => {
    setScanLoading(true);
    try {
      await lightsApiService.initialize();
      await lightsApiService.scanForLights();
      addNotification({ type: 'success', title: 'Discovery Started', message: 'Scanning for lights...' });
      setTimeout(() => {
        refreshLights().catch(() => {});
      }, 3000);
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Discovery Failed', message: e?.message || 'Failed to start discovery' });
    } finally {
      setScanLoading(false);
    }
  }, [refreshLights, addNotification]);

  const handleAddLightManually = useCallback(async () => {
    try {
      await lightsApiService.initialize();
      let parsed: any = {};
      if (manualConfig.trim()) {
        parsed = JSON.parse(manualConfig);
      }
      if (!manualIp.trim() || !manualProtocol.trim()) {
        throw new Error('IP and protocol are required');
      }
      await lightsApiService.manualAddLight(manualIp.trim(), manualProtocol.trim(), parsed);
      addNotification({ type: 'success', title: 'Light Add Requested', message: manualIp.trim() });
      setAddModalOpen(false);
      setManualIp(''); setManualProtocol(''); setManualConfig('');
      setTimeout(() => { refreshLights().catch(() => {}); }, 3000);
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Manual Add Failed', message: e?.message || 'Failed to add light' });
    }
  }, [manualIp, manualProtocol, manualConfig, addNotification, refreshLights]);

  // Clear error on mount
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Lights Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Control and manage your smart lights
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshLights}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="border-r-0 rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="border-l-0 rounded-l-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-red-900 dark:text-red-100">Error</h3>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Lights</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600">{stats.online}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lights On</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.on}</p>
              </div>
              <Power className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Brightness</p>
                <p className="text-2xl font-bold">{stats.averageBrightness}%</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <div 
                  className="h-6 w-6 rounded-full bg-gradient-to-t from-orange-500 to-yellow-400"
                  style={{ opacity: stats.averageBrightness / 100 }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={allLightsOn}
                disabled={isLoading || stats.on === stats.online}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Power className="h-4 w-4" />
                All On
              </Button>
              
              <Button
                onClick={allLightsOff}
                variant="outline"
                disabled={isLoading || stats.on === 0}
                className="flex items-center gap-2"
              >
                <PowerOff className="h-4 w-4" />
                All Off
              </Button>
              
            {selectedLights.length > 0 && (
              <>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
                <span className="text-sm text-muted-foreground">
                  {selectedLights.length} selected
                </span>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('on')}
                  className="flex items-center gap-1"
                >
                  <Zap className="h-3 w-3" />
                  On
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('off')}
                  className="flex items-center gap-1"
                >
                  <ZapOff className="h-3 w-3" />
                  Off
                </Button>
              </>
            )}
            {/* Discovery and manual add controls */}
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <Button
              variant="outline"
              onClick={handleScanForLights}
              disabled={scanLoading}
              className="flex items-center gap-2"
            >
              <SatelliteDish className={`h-4 w-4 ${scanLoading ? 'animate-pulse' : ''}`} />
              Scan for Lights
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Light Manually
            </Button>
            </div>
            
            {/* Search and Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search lights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lights List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Lights ({filteredAndSortedLights.length})
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
            
            {filteredAndSortedLights.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedLights.length === filteredAndSortedLights.length}
                  onChange={handleSelectAll}
                  className="rounded"
                  aria-label="Select all lights"
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {filteredAndSortedLights.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No lights found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {lights.length === 0 
                  ? 'No lights are currently configured. Add some lights to get started.'
                  : 'No lights match your current filters. Try adjusting your search or filters.'
                }
              </p>
              {searchQuery || statusFilter !== 'all' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedLights.map((light) => (
                <div key={light.id} className="p-4 flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedLights.includes(light.id)}
                    onChange={() => handleSelectLight(light.id)}
                    className="rounded"
                    aria-label={`Select ${light.name}`}
                  />
                  
                  <div className="flex-1">
                    <LightRow
                      light={light}
                      lightTypes={lightTypes}
                      onToggle={toggleLight}
                      onBrightnessChange={setBrightness}
                      onColorTemperatureChange={setColorTemperature}
                      onHueChange={setHue}
                      onSaturationChange={setSaturation}
                      onRename={renameLight}
                      onDelete={deleteLight}
                      onTypeChange={setLightType}
                      className="border-0 shadow-none p-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Light Manually Modal */}
      <Modal open={addModalOpen} onOpenChange={setAddModalOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Light Manually</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 p-2">
            <div>
              <label className="block text-sm font-medium mb-1">IP Address</label>
              <Input value={manualIp} onChange={(e) => setManualIp(e.target.value)} placeholder="192.168.1.50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Protocol</label>
              <Input value={manualProtocol} onChange={(e) => setManualProtocol(e.target.value)} placeholder="e.g., yeelight, wled" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Config (JSON)</label>
              <textarea
                className="w-full border rounded p-2 text-sm font-mono"
                rows={6}
                placeholder='{"key":"value"}'
                value={manualConfig}
                onChange={(e) => setManualConfig(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Provide protocol-specific config in JSON format (optional).</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddLightManually}>Add Light</Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Lights;