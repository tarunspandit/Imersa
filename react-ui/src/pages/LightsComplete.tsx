import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Slider, Switch } from '@/components/ui';
import { Wizard } from '@/components/ui/Wizard';
import discoveryService from '@/services/discoveryApi';
import '@/styles/design-system.css';
import { cn } from '@/utils';

interface LightCatalogItem {
  id: string;
  name: string;
  modelid: string;
  type: string;
  manufacturername?: string;
  swversion?: string;
}
import { useLights } from '@/hooks/useLights';
import { 
  Search, Plus, Power, Lightbulb, Trash2, Edit, 
  Palette, Sun, Loader2, CheckCircle,
  AlertCircle, Grid, List, RefreshCw, Zap, ZapOff,
  Sparkles, Settings, Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LightRowProps {
  light: any;
  lightTypes: any[];
  onToggle: (id: string) => void;
  onBrightnessChange: (id: string, bri: number) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, modelId: string) => void;
  onIdentify: (id: string) => void;
}

const LightRow: React.FC<LightRowProps> = ({
  light,
  lightTypes,
  onToggle,
  onBrightnessChange,
  onRename,
  onDelete,
  onTypeChange,
  onIdentify
}) => {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(light.name);

  const handleSaveName = () => {
    onRename(light.id, newName);
    setEditingName(false);
  };

  return (
    <div className="glass-card p-4 hover:border-imersa-glow-primary/30 transition-all">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Name */}
          <div className="md:col-span-2">
            {editingName ? (
              <div className="flex gap-1">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8"
                />
                <Button size="sm" onClick={handleSaveName}>
                  <CheckCircle className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  light.isOn 
                    ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg" 
                    : "bg-gray-800"
                )}>
                  <Lightbulb className={cn(
                    "w-4 h-4",
                    light.isOn ? 'text-gray-900' : 'text-gray-400'
                  )} />
                </div>
                <span className="font-medium text-white">{light.name}</span>
                <button 
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                  onClick={() => setEditingName(true)}
                >
                  <Edit className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            )}
          </div>

          {/* Model */}
          <div className="md:col-span-2">
            <select
              className="w-full p-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={light.model || ''}
              onChange={(e) => onTypeChange(light.id, e.target.value)}
            >
              <option value="">Select model</option>
              {lightTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Power */}
          <div className="md:col-span-1 flex justify-center">
            <Switch
              checked={light.isOn || false}
              onCheckedChange={() => onToggle(light.id)}
            />
          </div>

          {/* Brightness */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-2">
              <Sun className={cn(
                "w-4 h-4 transition-colors",
                light.isOn ? "text-yellow-400" : "text-gray-400"
              )} />
              <Slider
                value={[light.brightness || 0]}
                onValueChange={([value]) => onBrightnessChange(light.id, value)}
                max={100}
                className="flex-1"
                disabled={!light.isOn}
              />
              <span className="text-xs w-12 text-gray-400">{light.brightness || 0}%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="md:col-span-2 flex gap-2">
            <button
              className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors"
              onClick={() => onIdentify(light.id)}
              title="Identify light"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
              onClick={() => setEditingName(true)}
              title="Edit settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Delete */}
          <div className="md:col-span-1 flex justify-end">
            <button
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              onClick={() => onDelete(light.id)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
    </div>
  );
};

const LightsComplete: React.FC = () => {
  const {
    lights,
    lightTypes,
    isLoading,
    refreshLights,
    toggleLight,
    setBrightness,
    setColorTemperature,
    setHue,
    setSaturation,
    renameLight,
    deleteLight,
    setLightType,
    identifyLight,
    allLightsOn,
    allLightsOff
  } = useLights(true, 5000);

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchWizard, setShowSearchWizard] = useState(false);
  const [showCatalogWizard, setShowCatalogWizard] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [lightsCatalog, setLightsCatalog] = useState<Record<string, LightCatalogItem>>({});
  const [modelIds, setModelIds] = useState<string[]>([]);

  useEffect(() => {
    fetchLightTypes();
    fetchCatalog();
  }, []);

  const fetchLightTypes = async () => {
    try {
      const types = await discoveryService.getLightTypes();
      setModelIds(types);
    } catch (error) {
      console.error('Failed to fetch light types:', error);
    }
  };

  const fetchCatalog = async () => {
    try {
      const catalog = await discoveryService.getLightsCatalog();
      setLightsCatalog(catalog);
    } catch (error) {
      console.error('Failed to fetch lights catalog:', error);
    }
  };

  const handleSearchForLights = async () => {
    setIsSearching(true);
    try {
      await discoveryService.searchForLights();
      toast.success('Searching for new lights...');
      setShowSearchWizard(false);
      
      // Check for results after 10 seconds
      setTimeout(async () => {
        const newLights = await discoveryService.getNewLights();
        const foundCount = Object.keys(newLights).filter(k => k !== 'lastscan').length;
        if (foundCount > 0) {
          toast.success(`Found ${foundCount} new light(s)`);
          await refreshLights();
        } else {
          toast('No new lights found');
        }
        setIsSearching(false);
      }, 10000);
    } catch (error) {
      toast.error('Search failed');
      setIsSearching(false);
    }
  };

  const handleIdentify = async (lightId: string) => {
    try {
      await identifyLight(lightId);
      toast.success('Light will blink briefly');
    } catch (error) {
      toast.error('Failed to identify light');
    }
  };

  const filteredLights = lights.filter(light => 
    light.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    light.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="nav-orb">
                <Lightbulb className="w-8 h-8 text-imersa-dark" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Lights Management</h1>
                <p className="text-gray-400 mt-1">
                  Control and configure all your lights
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={allLightsOn}
                className="btn-glow flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                All On
              </button>
              <button 
                onClick={allLightsOff}
                className="px-4 py-2 rounded-xl bg-imersa-surface border border-gray-700 text-gray-300 hover:border-imersa-glow-primary transition-all flex items-center gap-2"
              >
                <ZapOff className="w-4 h-4" />
                All Off
              </button>
              <button 
                onClick={() => setShowSearchWizard(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search for Lights
              </button>
            </div>
          </div>
        </div>

        {/* Search and View Controls */}
        <div className="glass-card p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                placeholder="Search lights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="flex gap-2">
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
            <button 
              onClick={refreshLights} 
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowCatalogWizard(true)} 
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
            >
              Catalog
            </button>
          </div>
        </div>

        {/* Lights List/Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="loading-pulse">
              <Sparkles className="w-8 h-8 text-imersa-dark" />
            </div>
          </div>
      ) : viewMode === 'table' ? (
        <div className="space-y-2">
          {filteredLights.map(light => (
            <LightRow
              key={light.id}
              light={light}
              lightTypes={lightTypes}
              onToggle={toggleLight}
              onBrightnessChange={(id, bri) => setBrightness(id, Math.round((bri / 100) * 254))}
              onRename={renameLight}
              onDelete={deleteLight}
              onTypeChange={setLightType}
              onIdentify={handleIdentify}
            />
          ))}
        </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLights.map(light => (
              <div 
                key={light.id}
                className={cn(
                  "glass-card p-6 light-beam",
                  light.isOn && "holo-card"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all interactive-glow",
                      light.isOn 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg" 
                        : "bg-gray-800"
                    )}>
                      <Lightbulb className={cn(
                        "w-5 h-5",
                        light.isOn ? 'text-gray-900' : 'text-gray-400'
                      )} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{light.name}</h3>
                  </div>
                  <Switch
                    checked={light.isOn || false}
                    onCheckedChange={() => toggleLight(light.id)}
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Brightness</label>
                    <Slider
                      value={[light.brightness || 0]}
                      onValueChange={([value]) => setBrightness(light.id, Math.round((value / 100) * 254))}
                      max={100}
                      disabled={!light.isOn}
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={() => handleIdentify(light.id)}
                      className="flex-1 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Identify
                    </button>
                    <button 
                      onClick={() => deleteLight(light.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Wizard */}
        <Wizard
        isOpen={showSearchWizard}
        onClose={() => setShowSearchWizard(false)}
        title="Search for New Lights"
      >
        <div className="space-y-4">
          <p>The bridge will search for new lights on your network. This process takes about 40 seconds.</p>
          
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <p className="text-sm">
              <strong>Tips for discovery:</strong>
            </p>
            <ul className="text-sm mt-2 space-y-1">
              <li>• Make sure lights are powered on</li>
              <li>• Ensure lights are on the same network</li>
              <li>• For Zigbee lights, put them in pairing mode</li>
              <li>• For WiFi lights, ensure they're connected to your network</li>
            </ul>
          </div>

          {isSearching && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Searching for lights...</span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowSearchWizard(false)}>
              Cancel
            </Button>
            <Button onClick={handleSearchForLights} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Start Search'}
            </Button>
          </div>
        </div>
      </Wizard>

      {/* Catalog Wizard */}
      <Wizard
        isOpen={showCatalogWizard}
        onClose={() => setShowCatalogWizard(false)}
        title="Light Models Catalog"
        size="xl"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Browse available light models from the DiyHue catalog
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(lightsCatalog).map(([id, item]) => (
              <div key={id} className="p-3 border rounded-lg">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.manufacturer} · {item.modelid}
                </div>
                <div className="text-xs mt-1">
                  Type: {item.type} · Archetype: {item.archetype}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Wizard>
      </div>
    </div>
  );
};

export default LightsComplete;