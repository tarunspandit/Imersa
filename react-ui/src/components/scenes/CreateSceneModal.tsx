import React, { useState, useCallback } from 'react';
import { Modal, Button, Input, Card } from '@/components/ui';
import { CreateSceneRequest, LightGroup, Light, Scene } from '@/types';
import { X, Palette, Users, Lightbulb } from 'lucide-react';

interface CreateSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (request: CreateSceneRequest) => Promise<string | null>;
  groups: LightGroup[];
  availableLights?: Light[];
  isCreating: boolean;
}

const SCENE_CATEGORIES = ['Evening', 'Party', 'Work', 'Relax', 'Custom'] as const;
type SceneCategory = typeof SCENE_CATEGORIES[number];

const CATEGORY_ICONS: Record<SceneCategory, string> = {
  Evening: '🌙',
  Party: '🎉',
  Work: '💼',
  Relax: '🧘',
  Custom: '⚙️',
};

const CATEGORY_DESCRIPTIONS: Record<SceneCategory, string> = {
  Evening: 'Warm, cozy lighting for evening relaxation',
  Party: 'Vibrant, dynamic lighting for celebrations',
  Work: 'Bright, focused lighting for productivity',
  Relax: 'Soft, calming lighting for rest',
  Custom: 'Custom scene with your own settings',
};

export const CreateSceneModal: React.FC<CreateSceneModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  groups,
  availableLights = [],
  isCreating,
}) => {
  const [formData, setFormData] = useState<CreateSceneRequest>({
    name: '',
    group: '',
    lights: [],
    storelightstate: true,
    recycle: false,
    type: 'GroupScene',
    category: 'Custom',
  });

  const [selectedLights, setSelectedLights] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      group: '',
      lights: [],
      storelightstate: true,
      recycle: false,
      type: 'GroupScene',
      category: 'Custom',
    });
    setSelectedLights(new Set());
    setErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Scene name is required';
    }

    if (formData.type === 'GroupScene' && !formData.group) {
      newErrors.group = 'Group selection is required for Group Scene';
    }

    if (formData.type === 'LightScene' && selectedLights.size === 0) {
      newErrors.lights = 'At least one light must be selected for Light Scene';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, selectedLights]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const request: CreateSceneRequest = {
      ...formData,
      name: formData.name.trim(),
      lights: formData.type === 'LightScene' ? Array.from(selectedLights) : undefined,
    };

    const sceneId = await onCreate(request);
    if (sceneId) {
      resetForm();
      onClose();
    }
  }, [formData, selectedLights, validateForm, onCreate, resetForm, onClose]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const toggleLightSelection = useCallback((lightId: string) => {
    setSelectedLights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lightId)) {
        newSet.delete(lightId);
      } else {
        newSet.add(lightId);
      }
      return newSet;
    });
  }, []);

  const selectAllLights = useCallback(() => {
    setSelectedLights(new Set(availableLights.map(light => light.id)));
  }, [availableLights]);

  const clearLightSelection = useCallback(() => {
    setSelectedLights(new Set());
  }, []);

  const selectedGroup = groups.find(g => g.id === formData.group);

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
            <Palette className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Scene</h2>
            <p className="text-sm text-gray-600">Capture current lighting state as a scene</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Scene Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scene Name *
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter scene name..."
            className={errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Scene Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <div className="grid grid-cols-5 gap-2">
            {SCENE_CATEGORIES.map((category) => (
              <Button
                key={category}
                type="button"
                variant={formData.category === category ? 'default' : 'outline'}
                className={`flex flex-col items-center gap-1 h-auto py-3 ${
                  formData.category === category ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setFormData(prev => ({ ...prev, category }))}
              >
                <span className="text-lg">{CATEGORY_ICONS[category]}</span>
                <span className="text-xs">{category}</span>
              </Button>
            ))}
          </div>
          {formData.category && (
            <p className="mt-2 text-sm text-gray-600">
              {CATEGORY_DESCRIPTIONS[(formData.category || 'Custom') as keyof typeof CATEGORY_DESCRIPTIONS]}
            </p>
          )}
        </div>

        {/* Scene Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scene Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${
                formData.type === 'GroupScene' 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, type: 'GroupScene', lights: [] }))}
            >
              <div className="p-4 flex flex-col items-center text-center gap-2">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="font-medium">Group Scene</h3>
                  <p className="text-sm text-gray-600">Apply to all lights in a group</p>
                </div>
              </div>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${
                formData.type === 'LightScene' 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, type: 'LightScene', group: '' }))}
            >
              <div className="p-4 flex flex-col items-center text-center gap-2">
                <Lightbulb className="w-8 h-8 text-amber-600" />
                <div>
                  <h3 className="font-medium">Light Scene</h3>
                  <p className="text-sm text-gray-600">Apply to selected individual lights</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Group Selection (for Group Scene) */}
        {formData.type === 'GroupScene' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Group *
            </label>
            <select
              value={formData.group}
              onChange={(e) => setFormData(prev => ({ ...prev, group: e.target.value }))}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 ${
                errors.group 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            >
              <option value="">Select a group...</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.id}) - {group.lightIds.length} lights
                </option>
              ))}
            </select>
            {errors.group && (
              <p className="mt-1 text-sm text-red-600">{errors.group}</p>
            )}
            {selectedGroup && (
              <div className="mt-2 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  Scene will be created for <strong>{selectedGroup.name}</strong> with {selectedGroup.lightIds.length} lights
                </p>
              </div>
            )}
          </div>
        )}

        {/* Light Selection (for Light Scene) */}
        {formData.type === 'LightScene' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Lights * ({selectedLights.size}/{availableLights.length})
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllLights}
                  disabled={availableLights.length === 0}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearLightSelection}
                  disabled={selectedLights.size === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
            
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
              {availableLights.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No lights available
                </div>
              ) : (
                <div className="divide-y">
                  {availableLights.map((light) => (
                    <label
                      key={light.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                        selectedLights.has(light.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLights.has(light.id)}
                        onChange={() => toggleLightSelection(light.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              light.status === 'online' ? 'bg-green-400' : 'bg-gray-300'
                            }`}
                          />
                          <span className="font-medium">{light.name}</span>
                          <span className="text-sm text-gray-500">({light.id})</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {light.brand} {light.model} • {light.status}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {errors.lights && (
              <p className="mt-1 text-sm text-red-600">{errors.lights}</p>
            )}
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.storelightstate}
              onChange={(e) => setFormData(prev => ({ ...prev, storelightstate: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium">Store Current Light State</span>
              <p className="text-sm text-gray-600">
                Capture the current brightness, color, and state of lights
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.recycle}
              onChange={(e) => setFormData(prev => ({ ...prev, recycle: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium">Recyclable Scene</span>
              <p className="text-sm text-gray-600">
                Scene can be automatically cleaned up when not used
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isCreating}
            className="min-w-[100px]"
          >
            {isCreating ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating...
              </div>
            ) : (
              'Create Scene'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
