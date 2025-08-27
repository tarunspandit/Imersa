// Light Selection Component for Entertainment Wizard
import React, { useState, useMemo } from 'react';
import { 
  Lightbulb, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Zap,
  Wifi,
  WifiOff,
  RefreshCw,
  Users
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import '@/styles/design-system.css';
import { Light } from '@/types';
import { cn } from '@/utils';

interface LightSelectorProps {
  availableLights: Light[];
  selectedLights: string[];
  onToggleLight: (lightId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRefreshLights?: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

interface FilterOptions {
  search: string;
  showOnlineOnly: boolean;
  groupByType: boolean;
}

export const LightSelector: React.FC<LightSelectorProps> = ({
  availableLights,
  selectedLights,
  onToggleLight,
  onSelectAll,
  onClearSelection,
  onRefreshLights,
  isLoading = false,
  className,
}) => {
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    showOnlineOnly: false,
    groupByType: false,
  });

  // Filter and group lights
  const { filteredLights, lightGroups, totalOnline, totalSelected } = useMemo(() => {
    let lights = availableLights;

    // Apply search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      lights = lights.filter(light =>
        light.name.toLowerCase().includes(search) ||
        light.id.toLowerCase().includes(search) ||
        (light.manufacturername && light.manufacturername.toLowerCase().includes(search))
      );
    }

    // Apply online filter
    if (filters.showOnlineOnly) {
      lights = lights.filter(light => light.status === 'online');
    }

    const totalOnline = lights.filter(light => light.status === 'online').length;
    const totalSelected = lights.filter(light => selectedLights.includes(light.id)).length;

    // Group by type if requested
    const lightGroups = filters.groupByType
      ? lights.reduce((groups, light) => {
          const type = light.manufacturername || 'Unknown';
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push(light);
          return groups;
        }, {} as Record<string, Light[]>)
      : { 'All Lights': lights };

    return {
      filteredLights: lights,
      lightGroups,
      totalOnline,
      totalSelected,
    };
  }, [availableLights, filters, selectedLights]);

  // Handle refresh with loading state
  const handleRefresh = async () => {
    if (onRefreshLights && !isLoading) {
      await onRefreshLights();
    }
  };

  // Render individual light item
  const renderLightItem = (light: Light) => {
    const isSelected = selectedLights.includes(light.id);
    const isOnline = light.status === 'online';

    return (
      <div
        key={light.id}
        className={cn(
          'flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-gray-50',
          isSelected
            ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
            : 'border-gray-200',
          !isOnline && 'opacity-60'
        )}
        onClick={() => onToggleLight(light.id)}
      >
        {/* Selection Checkbox */}
        <div className="flex-shrink-0">
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {/* Status Indicator */}
        <div className="flex-shrink-0">
          {isOnline ? (
            <div className="w-3 h-3 bg-emerald-400 rounded-full" title="Online" />
          ) : (
            <div className="w-3 h-3 bg-red-400 rounded-full" title="Offline" />
          )}
        </div>

        {/* Light Icon */}
        <div className="flex-shrink-0">
          <Lightbulb 
            className={cn(
              'w-5 h-5',
              isSelected ? 'text-blue-600' : 'text-gray-500'
            )} 
          />
        </div>

        {/* Light Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className={cn(
              'font-medium truncate',
              isSelected ? 'text-blue-900' : 'text-gray-900'
            )}>
              {light.name}
            </span>
            {light.uniqueid && (
              <span className="text-xs text-gray-500 font-mono">
                {light.uniqueid.slice(-6)}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-500">
              ID: {light.id}
            </span>
            {light.manufacturername && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {light.manufacturername}
                </span>
              </>
            )}
            {light.modelid && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {light.modelid}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Brightness/State Info */}
        {isOnline && light.state && (
          <div className="flex-shrink-0 text-right">
            {light.state.on && (
              <div className="flex items-center space-x-1 text-xs text-emerald-600">
                <Zap className="w-3 h-3" />
                <span>{Math.round((light.state.bri || 0) / 2.54)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Network Status */}
        <div className="flex-shrink-0">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('glass-card p-6', className)}>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-imersa-glow-primary" />
            Select Lights
            <span className="text-sm font-normal text-gray-400">
              ({totalSelected} of {filteredLights.length} selected)
            </span>
          </h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all flex items-center gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              placeholder="Search lights by name, ID, or manufacturer..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilters(prev => ({ ...prev, showOnlineOnly: !prev.showOnlineOnly }))}
              className={cn(
                'px-4 py-2 rounded-xl border transition-all flex items-center gap-2',
                filters.showOnlineOnly 
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                  : 'border-white/10 text-gray-400 hover:border-white/20'
              )}
            >
              <Filter className="w-4 h-4" />
              <span>Online Only</span>
            </button>
            
            <button
              onClick={() => setFilters(prev => ({ ...prev, groupByType: !prev.groupByType }))}
              className={cn(
                'px-4 py-2 rounded-xl border transition-all',
                filters.groupByType 
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                  : 'border-white/10 text-gray-400 hover:border-white/20'
              )}
            >
              Group by Type
            </button>
          </div>
        </div>

        {/* Selection Actions */}
        <div className="flex items-center justify-between py-2 border-b border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{totalOnline}</span> online lights, 
            <span className="font-medium ml-1">{totalSelected}</span> selected
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={filteredLights.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              disabled={totalSelected === 0}
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border border-current border-t-transparent rounded-full" />
            <span className="ml-3 text-gray-600">Loading lights...</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredLights.length === 0 && (
          <div className="text-center py-8">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              No lights found
            </p>
            <p className="text-gray-600 mb-4">
              {availableLights.length === 0
                ? 'No ungrouped lights are available for entertainment areas.'
                : 'Try adjusting your search or filters to find lights.'
              }
            </p>
            {onRefreshLights && (
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Lights
              </Button>
            )}
          </div>
        )}

        {/* Light Groups */}
        {!isLoading && filteredLights.length > 0 && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(lightGroups).map(([groupName, lights]) => (
              <div key={groupName}>
                {filters.groupByType && (
                  <h4 className="font-medium text-gray-900 mb-2 sticky top-0 bg-white py-1">
                    {groupName} ({lights.length})
                  </h4>
                )}
                <div className="space-y-2">
                  {lights.map(renderLightItem)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selection Summary */}
        {totalSelected > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {totalSelected} light{totalSelected !== 1 ? 's' : ''} selected for entertainment area
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              These lights will be used to create your entertainment area. You can adjust their positions in the next step.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LightSelector;