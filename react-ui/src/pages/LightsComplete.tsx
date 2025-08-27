import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Slider, Switch } from '@/components/ui';
import { Wizard } from '@/components/ui/Wizard';
import discoveryService, { LightCatalogItem } from '@/services/discoveryApi';
import { useLights } from '@/hooks/useLights';
import { 
  Search, Plus, Power, Lightbulb, Trash2, Edit, 
  Palette, Thermometer, Sun, Loader2, CheckCircle,
  AlertCircle, Grid, List, RefreshCw, Zap, ZapOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LightRowProps {
  light: any;
  lightTypes: string[];
  onToggle: (id: string) => void;
  onBrightnessChange: (id: string, bri: number) => void;
  onColorChange: (id: string, hue: number, sat: number) => void;
  onColorTempChange: (id: string, ct: number) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, modelId: string) => void;
}

const LightRow: React.FC<LightRowProps> = ({
  light,
  lightTypes,
  onToggle,
  onBrightnessChange,
  onColorChange,
  onColorTempChange,
  onRename,
  onDelete,
  onTypeChange
}) => {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(light.name);

  const handleSaveName = () => {
    onRename(light.id, newName);
    setEditingName(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
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
                <Lightbulb className={`w-4 h-4 ${light.state?.on ? 'text-yellow-500' : 'text-gray-400'}`} />
                <span className="font-medium">{light.name}</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setEditingName(true)}
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Model */}
          <div className="md:col-span-2">
            <select
              className="w-full p-1 text-sm border rounded"
              value={light.modelid || ''}
              onChange={(e) => onTypeChange(light.id, e.target.value)}
            >
              <option value="">Select model</option>
              {lightTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Power */}
          <div className="md:col-span-1 flex justify-center">
            <Switch
              checked={light.state?.on || false}
              onCheckedChange={() => onToggle(light.id)}
            />
          </div>

          {/* Brightness */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-gray-400" />
              <Slider
                value={[light.state?.bri || 0]}
                onValueChange={([value]) => onBrightnessChange(light.id, value)}
                max={254}
                className="flex-1"
              />
              <span className="text-xs w-8">{light.state?.bri || 0}</span>
            </div>
          </div>

          {/* Color Temp */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-gray-400" />
              <Input
                type="number"
                min={153}
                max={500}
                value={light.state?.ct || 300}
                onChange={(e) => onColorTempChange(light.id, parseInt(e.target.value))}
                className="h-8"
              />
            </div>
          </div>

          {/* Hue & Saturation */}
          <div className="md:col-span-2">
            <div className="flex gap-1">
              <Input
                type="number"
                min={0}
                max={65535}
                value={light.state?.hue || 0}
                onChange={(e) => onColorChange(light.id, parseInt(e.target.value), light.state?.sat || 0)}
                placeholder="Hue"
                className="h-8"
              />
              <Input
                type="number"
                min={0}
                max={254}
                value={light.state?.sat || 0}
                onChange={(e) => onColorChange(light.id, light.state?.hue || 0, parseInt(e.target.value))}
                placeholder="Sat"
                className="h-8"
              />
            </div>
          </div>

          {/* Delete */}
          <div className="md:col-span-1 flex justify-end">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(light.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
          toast.info('No new lights found');
        }
        setIsSearching(false);
      }, 10000);
    } catch (error) {
      toast.error('Search failed');
      setIsSearching(false);
    }
  };

  const handleColorChange = (lightId: string, hue: number, sat: number) => {
    setHue(lightId, hue);
    setSaturation(lightId, sat);
  };

  const filteredLights = lights.filter(light => 
    light.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    light.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lights Management</h1>
          <p className="text-muted-foreground mt-1">
            Control and configure all your lights
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={allLightsOn} variant="outline">
            <Zap className="w-4 h-4 mr-2" />
            All On
          </Button>
          <Button onClick={allLightsOff} variant="outline">
            <ZapOff className="w-4 h-4 mr-2" />
            All Off
          </Button>
          <Button onClick={() => setShowSearchWizard(true)}>
            <Search className="w-4 h-4 mr-2" />
            Search for Lights
          </Button>
        </div>
      </div>

      {/* Search and View Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search lights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'outline'}
                onClick={() => setViewMode('table')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={refreshLights} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowCatalogWizard(true)} variant="outline" size="sm">
              Catalog
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lights List/Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : viewMode === 'table' ? (
        <div className="space-y-2">
          {filteredLights.map(light => (
            <LightRow
              key={light.id}
              light={light}
              lightTypes={modelIds}
              onToggle={toggleLight}
              onBrightnessChange={setBrightness}
              onColorChange={handleColorChange}
              onColorTempChange={setColorTemperature}
              onRename={renameLight}
              onDelete={deleteLight}
              onTypeChange={setLightType}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredLights.map(light => (
            <Card key={light.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lightbulb className={`w-5 h-5 ${light.state?.on ? 'text-yellow-500' : 'text-gray-400'}`} />
                    {light.name}
                  </span>
                  <Switch
                    checked={light.state?.on || false}
                    onCheckedChange={() => toggleLight(light.id)}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Brightness</label>
                  <Slider
                    value={[light.state?.bri || 0]}
                    onValueChange={([value]) => setBrightness(light.id, value)}
                    max={254}
                  />
                </div>
                {light.capabilities?.control?.ct && (
                  <div>
                    <label className="text-xs text-muted-foreground">Color Temperature</label>
                    <Slider
                      value={[light.state?.ct || 300]}
                      onValueChange={([value]) => setColorTemperature(light.id, value)}
                      min={153}
                      max={500}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteLight(light.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
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
  );
};

export default LightsComplete;