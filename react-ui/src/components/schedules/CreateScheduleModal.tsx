import React, { useState, useEffect } from 'react';
import { CreateScheduleRequest, ScheduleTemplate, LightGroup, Scene } from '@/types';
import { useGroups } from '@/hooks/useGroups';
import { useScenes } from '@/hooks/useScenes';
import { Clock, Calendar, Sun, Moon, Timer, Repeat, Layout, Lightbulb, Palette, X } from 'lucide-react';
import '@/styles/design-system.css';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (schedule: CreateScheduleRequest) => Promise<boolean>;
  templates: ScheduleTemplate[];
  editSchedule?: {
    id: string;
    name: string;
    description?: string;
    time?: string;
    type?: string;
    command: any;
  } | null;
}

const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  templates,
  editSchedule
}) => {
  const { groups } = useGroups();
  const { scenes } = useScenes();
  
  // Form state
  const [formData, setFormData] = useState<CreateScheduleRequest>({
    name: '',
    description: '',
    time: '19:00',
    type: 'one-time',
    command: {
      address: '',
      method: 'PUT',
      body: {}
    },
    status: 'enabled',
    days: [],
    offset: 0,
    randomization: 0
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [commandType, setCommandType] = useState<'group' | 'light' | 'scene'>('group');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [actionType, setActionType] = useState<'on' | 'off' | 'scene' | 'custom'>('on');
  const [customAction, setCustomAction] = useState('{}');
  const [loading, setLoading] = useState(false);
  
  // Reset form when modal opens/closes or edit schedule changes
  useEffect(() => {
    if (isOpen) {
      if (editSchedule) {
        setFormData({
          name: editSchedule.name,
          description: editSchedule.description || '',
          time: editSchedule.time || '19:00',
          type: (editSchedule.type as any) || 'one-time',
          command: editSchedule.command,
          status: 'enabled',
          days: [],
          offset: 0,
          randomization: 0
        });
      } else {
        setFormData({
          name: '',
          description: '',
          time: '19:00',
          type: 'one-time',
          command: {
            address: '',
            method: 'PUT',
            body: {}
          },
          status: 'enabled',
          days: [],
          offset: 0,
          randomization: 0
        });
      }
      setSelectedTemplate('');
      setSelectedTarget('');
      setCustomAction('{}');
    }
  }, [isOpen, editSchedule]);

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        description: template.description,
        time: template.defaultTime || prev.time,
        type: template.scheduleType || prev.type
      }));
      setSelectedTemplate(templateId);
    }
  };

  // Build command based on selection
  const buildCommand = () => {
    let address = '';
    let body = {};

    if (commandType === 'group' && selectedTarget) {
      address = `/api/${selectedTarget}/action`;
      if (actionType === 'on') {
        body = { on: true, bri: 254 };
      } else if (actionType === 'off') {
        body = { on: false };
      } else if (actionType === 'custom') {
        try {
          body = JSON.parse(customAction);
        } catch {
          body = {};
        }
      }
    } else if (commandType === 'scene' && selectedTarget) {
      // For scenes, we apply them to group 0 (all lights)
      address = '/api/groups/0/action';
      body = { scene: selectedTarget };
    }

    return {
      address,
      method: 'PUT' as const,
      body
    };
  };

  const handleSubmit = async () => {
    setLoading(true);
    const command = buildCommand();
    const success = await onSubmit({
      ...formData,
      command
    });
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {editSchedule ? 'Edit Schedule' : 'Create Schedule'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Templates */}
        {templates.length > 0 && !editSchedule && (
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-300 mb-3 block">Quick Templates</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedTemplate === template.id
                      ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <div className="text-2xl mb-1">{template.icon}</div>
                  <div className="text-xs font-medium">{template.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Schedule Name</label>
              <input
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Evening Lights"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Time</label>
              <input
                type="time"
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1 block">Description (optional)</label>
            <textarea
              className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this schedule do?"
              rows={2}
            />
          </div>

          {/* Schedule Type */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Schedule Type</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setFormData(prev => ({ ...prev, type: 'one-time' }))}
                className={`p-3 rounded-lg border transition-all ${
                  formData.type === 'one-time'
                    ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Timer className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">One Time</div>
              </button>
              <button
                onClick={() => setFormData(prev => ({ ...prev, type: 'recurring' }))}
                className={`p-3 rounded-lg border transition-all ${
                  formData.type === 'recurring'
                    ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Repeat className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">Recurring</div>
              </button>
              <button
                onClick={() => setFormData(prev => ({ ...prev, type: 'sunset' }))}
                className={`p-3 rounded-lg border transition-all ${
                  formData.type === 'sunset'
                    ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Sun className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">Sunset/Sunrise</div>
              </button>
            </div>
          </div>

          {/* Days Selection (for recurring) */}
          {formData.type === 'recurring' && (
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Days</label>
              <div className="flex gap-2">
                {weekDays.map((day, index) => (
                  <button
                    key={day}
                    onClick={() => {
                      const dayNum = index + 1;
                      setFormData(prev => ({
                        ...prev,
                        days: prev.days?.includes(dayNum)
                          ? prev.days.filter(d => d !== dayNum)
                          : [...(prev.days || []), dayNum]
                      }));
                    }}
                    className={`px-3 py-1 rounded-lg border transition-all text-sm ${
                      formData.days?.includes(index + 1)
                        ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Type */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Action Type</label>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                onClick={() => setCommandType('group')}
                className={`p-3 rounded-lg border transition-all ${
                  commandType === 'group'
                    ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Layout className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">Group</div>
              </button>
              <button
                onClick={() => setCommandType('scene')}
                className={`p-3 rounded-lg border transition-all ${
                  commandType === 'scene'
                    ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Palette className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">Scene</div>
              </button>
              <button
                onClick={() => setCommandType('light')}
                className={`p-3 rounded-lg border transition-all ${
                  commandType === 'light'
                    ? 'bg-imersa-accent/20 border-imersa-accent text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Lightbulb className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs">Light</div>
              </button>
            </div>

            {/* Target Selection */}
            {commandType === 'group' && (
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Select Group</label>
                <select
                  className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                >
                  <option value="" className="bg-imersa-midnight">Choose a group...</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id} className="bg-imersa-midnight">
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {commandType === 'scene' && (
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Select Scene</label>
                <select
                  className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                >
                  <option value="" className="bg-imersa-midnight">Choose a scene...</option>
                  {Object.values(scenes).map(scene => (
                    <option key={scene.id} value={scene.id} className="bg-imersa-midnight">
                      {scene.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action for Groups */}
            {commandType === 'group' && selectedTarget && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Action</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setActionType('on')}
                    className={`p-2 rounded-lg border transition-all text-sm ${
                      actionType === 'on'
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    Turn On
                  </button>
                  <button
                    onClick={() => setActionType('off')}
                    className={`p-2 rounded-lg border transition-all text-sm ${
                      actionType === 'off'
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    Turn Off
                  </button>
                  <button
                    onClick={() => setActionType('custom')}
                    className={`p-2 rounded-lg border transition-all text-sm ${
                      actionType === 'custom'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {actionType === 'custom' && (
                  <textarea
                    className="w-full mt-3 p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 font-mono text-sm"
                    value={customAction}
                    onChange={(e) => setCustomAction(e.target.value)}
                    placeholder='{"on": true, "bri": 150, "hue": 25500}'
                    rows={3}
                  />
                )}
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <details className="bg-white/5 rounded-lg p-4">
            <summary className="text-sm font-medium text-gray-300 cursor-pointer">Advanced Settings</summary>
            <div className="mt-4 space-y-4">
              {formData.type === 'sunset' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-1 block">
                      Offset (minutes from sunset/sunrise)
                    </label>
                    <input
                      type="number"
                      className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      value={formData.offset}
                      onChange={(e) => setFormData(prev => ({ ...prev, offset: parseInt(e.target.value) || 0 }))}
                      placeholder="-30 for 30 min before, 30 for 30 min after"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">
                  Randomization (±minutes)
                </label>
                <input
                  type="number"
                  className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  value={formData.randomization}
                  onChange={(e) => setFormData(prev => ({ ...prev, randomization: parseInt(e.target.value) || 0 }))}
                  min="0"
                  max="60"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Add randomness to make schedules less predictable
                </p>
              </div>
            </div>
          </details>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.name || !selectedTarget}
            className="btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : editSchedule ? 'Update Schedule' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateScheduleModal;