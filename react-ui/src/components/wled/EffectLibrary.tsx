import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { WLEDDevice, WLEDEffect, WLEDPalette } from '@/types';
import { 
  Search, 
  Play, 
  Pause, 
  Star, 
  StarOff, 
  Filter, 
  Grid, 
  List,
  Palette,
  Zap,
  Music,
  Sun,
  Moon,
  Heart,
  Download,
  Eye
} from 'lucide-react';

interface EffectLibraryProps {
  device: WLEDDevice;
  effects: WLEDEffect[];
  palettes: WLEDPalette[];
  onApplyEffect?: (effectId: number, parameters?: Record<string, any>) => Promise<void>;
  onApplyPalette?: (paletteId: number) => Promise<void>;
  className?: string;
}

interface EffectParameters {
  [key: string]: any;
}

const categoryIcons = {
  'Solid': Sun,
  'Gradient': Palette,
  'Pattern': Grid,
  'Animation': Zap,
  'Music': Music,
  'Ambient': Moon,
  'Special': Heart,
};

const categoryColors = {
  'Solid': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Gradient': 'bg-purple-100 text-purple-800 border-purple-200',
  'Pattern': 'bg-blue-100 text-blue-800 border-blue-200',
  'Animation': 'bg-green-100 text-green-800 border-green-200',
  'Music': 'bg-red-100 text-red-800 border-red-200',
  'Ambient': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Special': 'bg-pink-100 text-pink-800 border-pink-200',
};

export const EffectLibrary: React.FC<EffectLibraryProps> = ({
  device,
  effects,
  palettes,
  onApplyEffect,
  onApplyPalette,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'effects' | 'palettes'>('effects');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedEffect, setSelectedEffect] = useState<WLEDEffect | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<WLEDPalette | null>(null);
  const [effectParameters, setEffectParameters] = useState<EffectParameters>({});
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique categories from effects
  const categories = useMemo(() => {
    const cats = [...new Set(effects.map(effect => effect.category))].filter(Boolean);
    return ['all', ...cats];
  }, [effects]);

  // Filter effects based on search and category
  const filteredEffects = useMemo(() => {
    return effects.filter(effect => {
      const matchesSearch = effect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          effect.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || effect.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [effects, searchQuery, selectedCategory]);

  // Filter palettes based on search
  const filteredPalettes = useMemo(() => {
    return palettes.filter(palette => 
      palette.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      palette.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [palettes, searchQuery]);

  const handleApplyEffect = useCallback(async (effect: WLEDEffect) => {
    if (!onApplyEffect) return;
    
    setIsApplying(true);
    try {
      const params = effectParameters[effect.id] || {};
      await onApplyEffect(effect.id, params);
    } catch (error) {
      console.error('Failed to apply effect:', error);
    } finally {
      setIsApplying(false);
    }
  }, [onApplyEffect, effectParameters]);

  const handleApplyPalette = useCallback(async (palette: WLEDPalette) => {
    if (!onApplyPalette) return;
    
    setIsApplying(true);
    try {
      await onApplyPalette(palette.id);
    } catch (error) {
      console.error('Failed to apply palette:', error);
    } finally {
      setIsApplying(false);
    }
  }, [onApplyPalette]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      return newFavorites;
    });
  }, []);

  const updateEffectParameter = useCallback((effectId: number, paramName: string, value: any) => {
    setEffectParameters(prev => ({
      ...prev,
      [effectId]: {
        ...prev[effectId],
        [paramName]: value,
      },
    }));
  }, []);

  const renderEffectCard = useCallback((effect: WLEDEffect) => {
    const IconComponent = categoryIcons[effect.category as keyof typeof categoryIcons] || Zap;
    const isFavorite = favorites.has(effect.id);
    
    return (
      <Card 
        key={effect.id}
        className={`transition-all hover:shadow-md cursor-pointer ${
          selectedEffect?.id === effect.id ? 'border-blue-500 shadow-md' : ''
        }`}
        onClick={() => setSelectedEffect(effect)}
      >
        {effect.preview && (
          <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
            <img 
              src={effect.preview} 
              alt={effect.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <IconComponent className="w-4 h-4" />
              <CardTitle className="text-sm font-medium">{effect.name}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(effect.id);
              }}
              className="p-1"
            >
              {isFavorite ? (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </Button>
          </div>
          {effect.category && (
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${
              categoryColors[effect.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-800 border-gray-200'
            }`}>
              {effect.category}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {effect.description && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {effect.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {effect.isGradient && (
                <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  Gradient
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleApplyEffect(effect);
              }}
              disabled={isApplying}
              className="flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }, [selectedEffect, favorites, isApplying, handleApplyEffect, toggleFavorite]);

  const renderPaletteCard = useCallback((palette: WLEDPalette) => {
    return (
      <Card 
        key={palette.id}
        className={`transition-all hover:shadow-md cursor-pointer ${
          selectedPalette?.id === palette.id ? 'border-blue-500 shadow-md' : ''
        }`}
        onClick={() => setSelectedPalette(palette)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-medium">{palette.name}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(palette.id);
              }}
              className="p-1"
            >
              {favorites.has(palette.id) ? (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">{palette.category}</div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Color preview */}
          <div className="flex h-6 rounded-md overflow-hidden mb-3 border">
            {palette.colors.map((color, index) => (
              <div
                key={index}
                className="flex-1"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {palette.colors.length} colors
            </div>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleApplyPalette(palette);
              }}
              disabled={isApplying}
              className="flex items-center gap-1"
            >
              <Palette className="w-3 h-3" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }, [selectedPalette, favorites, isApplying, handleApplyPalette, toggleFavorite]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Effect Library
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-muted' : ''}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('effects')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'effects'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Effects ({effects.length})
            </button>
            <button
              onClick={() => setActiveTab('palettes')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'palettes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Palettes ({palettes.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          {showFilters && activeTab === 'effects' && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={Array.from(favorites).length > 0}
                    onCheckedChange={(checked) => {
                      if (!checked) setFavorites(new Set());
                    }}
                  />
                  <span className="text-sm">Show Favorites Only</span>
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Library Grid */}
        <div className="lg:col-span-2">
          {activeTab === 'effects' ? (
            <div className={`grid gap-4 ${
              viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
            }`}>
              {filteredEffects.map(renderEffectCard)}
            </div>
          ) : (
            <div className={`grid gap-4 ${
              viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
            }`}>
              {filteredPalettes.map(renderPaletteCard)}
            </div>
          )}

          {((activeTab === 'effects' && filteredEffects.length === 0) ||
            (activeTab === 'palettes' && filteredPalettes.length === 0)) && (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  No {activeTab} found matching your criteria
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          {selectedEffect && activeTab === 'effects' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedEffect.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFavorite(selectedEffect.id)}
                  >
                    {favorites.has(selectedEffect.id) ? (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEffect.preview && (
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img 
                      src={selectedEffect.preview} 
                      alt={selectedEffect.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {selectedEffect.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedEffect.description}
                  </p>
                )}

                {/* Parameters */}
                {selectedEffect.parameters && selectedEffect.parameters.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm font-medium">Parameters</div>
                    {selectedEffect.parameters.map(param => {
                      const currentValue = effectParameters[selectedEffect.id]?.[param.name] ?? param.default;
                      
                      return (
                        <div key={param.name} className="space-y-2">
                          <label className="text-sm font-medium">{param.name}</label>
                          
                          {param.type === 'slider' && (
                            <div className="space-y-2">
                              <Slider
                                value={[currentValue]}
                                onValueChange={([value]) => 
                                  updateEffectParameter(selectedEffect.id, param.name, value)
                                }
                                min={param.min || 0}
                                max={param.max || 100}
                                step={1}
                              />
                              <div className="text-xs text-muted-foreground text-center">
                                {currentValue}
                              </div>
                            </div>
                          )}
                          
                          {param.type === 'toggle' && (
                            <Switch
                              checked={currentValue}
                              onCheckedChange={(checked) =>
                                updateEffectParameter(selectedEffect.id, param.name, checked)
                              }
                            />
                          )}
                          
                          {param.type === 'select' && param.options && (
                            <select
                              value={currentValue}
                              onChange={(e) =>
                                updateEffectParameter(selectedEffect.id, param.name, e.target.value)
                              }
                              className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            >
                              {param.options.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  onClick={() => handleApplyEffect(selectedEffect)}
                  disabled={isApplying}
                  className="w-full"
                >
                  {isApplying ? 'Applying...' : 'Apply Effect'}
                </Button>
              </CardContent>
            </Card>
          )}

          {selectedPalette && activeTab === 'palettes' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedPalette.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFavorite(selectedPalette.id)}
                  >
                    {favorites.has(selectedPalette.id) ? (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ) : (
                      <StarOff className="w-4 h-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Large color preview */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Colors</div>
                  <div className="flex h-16 rounded-lg overflow-hidden border">
                    {selectedPalette.colors.map((color, index) => (
                      <div
                        key={index}
                        className="flex-1 flex items-end justify-center pb-2"
                        style={{ backgroundColor: color }}
                      >
                        <div className="text-xs text-white bg-black/50 px-1 py-0.5 rounded">
                          {color}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Details</div>
                  <div className="text-sm text-muted-foreground">
                    <div>Category: {selectedPalette.category}</div>
                    <div>Colors: {selectedPalette.colors.length}</div>
                  </div>
                </div>

                <Button
                  onClick={() => handleApplyPalette(selectedPalette)}
                  disabled={isApplying}
                  className="w-full"
                >
                  {isApplying ? 'Applying...' : 'Apply Palette'}
                </Button>
              </CardContent>
            </Card>
          )}

          {!selectedEffect && !selectedPalette && (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  Select an {activeTab === 'effects' ? 'effect' : 'palette'} to view details
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default EffectLibrary;