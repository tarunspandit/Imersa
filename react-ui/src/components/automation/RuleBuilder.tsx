import React, { useState, useEffect } from 'react';
import { CreateRuleRequest, RuleCondition, RuleAction, RuleTemplate } from '@/types';
import { Plus, Zap, AlertCircle, Settings, Target, Clock, Trash2, X } from 'lucide-react';
import '@/styles/design-system.css';

interface RuleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rule: CreateRuleRequest) => Promise<boolean>;
  templates: RuleTemplate[];
  availableAddresses?: {
    sensors: Array<{ address: string; name: string; type: string }>;
    groups: Array<{ address: string; name: string }>;
    lights: Array<{ address: string; name: string }>;
    scenes: Array<{ address: string; name: string }>;
  };
  editRule?: {
    id: string;
    name: string;
    description?: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    enabled: boolean;
  } | null;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({
  isOpen,
  onClose,
  onSubmit,
  templates,
  availableAddresses,
  editRule
}) => {
  const [formData, setFormData] = useState<CreateRuleRequest>({
    name: '',
    description: '',
    conditions: [{ address: '', operator: 'eq', value: '' }],
    actions: [{ address: '', method: 'PUT', body: {} }],
    enabled: true
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Reset form when modal opens/closes or edit rule changes
  useEffect(() => {
    if (isOpen) {
      if (editRule) {
        setFormData({
          name: editRule.name,
          description: editRule.description || '',
          conditions: editRule.conditions,
          actions: editRule.actions,
          enabled: editRule.enabled
        });
      } else {
        setFormData({
          name: '',
          description: '',
          conditions: [{ address: '', operator: 'eq', value: '' }],
          actions: [{ address: '', method: 'PUT', body: {} }],
          enabled: true
        });
      }
      setSelectedTemplate('');
      setValidationErrors([]);
    }
  }, [isOpen, editRule]);

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template && template.template) {
      setFormData(prev => ({
        ...prev,
        ...template.template,
        name: prev.name || template.name,
        description: prev.description || template.description
      }));
      setSelectedTemplate(templateId);
    }
  };

  // Condition management
  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { address: '', operator: 'eq', value: '' }]
    }));
  };

  const removeCondition = (index: number) => {
    if (formData.conditions.length > 1) {
      setFormData(prev => ({
        ...prev,
        conditions: prev.conditions.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => 
        i === index ? { ...c, ...updates } : c
      )
    }));
  };

  // Action management
  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { address: '', method: 'PUT', body: {} }]
    }));
  };

  const removeAction = (index: number) => {
    if (formData.actions.length > 1) {
      setFormData(prev => ({
        ...prev,
        actions: prev.actions.filter((_, i) => i !== index)
      }));
    }
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => 
        i === index ? { ...a, ...updates } : a
      )
    }));
  };

  // Validation
  const validate = () => {
    const errors: string[] = [];

    if (!formData.name) errors.push('Rule name is required');
    
    formData.conditions.forEach((c, i) => {
      if (!c.address) errors.push(`Condition ${i + 1}: Address is required`);
      if (!c.value && c.value !== 0) errors.push(`Condition ${i + 1}: Value is required`);
    });
    
    formData.actions.forEach((a, i) => {
      if (!a.address) errors.push(`Action ${i + 1}: Address is required`);
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    const success = await onSubmit(formData);
    setLoading(false);
    
    if (success) {
      onClose();
    }
  };

  const operators = [
    { value: 'eq', label: 'Equals' },
    { value: 'gt', label: 'Greater than' },
    { value: 'lt', label: 'Less than' },
    { value: 'dx', label: 'Changed' },
    { value: 'stable', label: 'Stable' },
    { value: 'in', label: 'In range' },
    { value: 'not in', label: 'Not in range' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {editRule ? 'Edit Rule' : 'Create Automation Rule'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h3 className="text-red-400 font-medium">Please fix the following errors:</h3>
            </div>
            <ul className="list-disc list-inside text-red-300 text-sm">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Templates */}
        {templates.length > 0 && !editRule && (
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
              <label className="text-sm font-medium text-gray-300 mb-1 block">Rule Name</label>
              <input
                className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Motion activated lights"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-300">Status</label>
              <button
                onClick={() => setFormData(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                  formData.enabled 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${formData.enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
                {formData.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1 block">Description (optional)</label>
            <textarea
              className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does this rule do?"
              rows={2}
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">Conditions (IF)</label>
              <button
                onClick={addCondition}
                className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all flex items-center gap-1 text-sm"
              >
                <Plus className="w-3 h-3" />
                Add Condition
              </button>
            </div>
            <div className="space-y-3">
              {formData.conditions.map((condition, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Sensor/Trigger</label>
                        <select
                          className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                          value={condition.address}
                          onChange={(e) => updateCondition(index, { address: e.target.value })}
                        >
                          <option value="" className="bg-imersa-midnight">Select...</option>
                          {availableAddresses && (
                            <>
                              <optgroup label="Sensors" className="bg-imersa-midnight">
                                {availableAddresses.sensors.map(s => (
                                  <option key={s.address} value={s.address} className="bg-imersa-midnight">
                                    {s.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Lights" className="bg-imersa-midnight">
                                {availableAddresses.lights.map(l => (
                                  <option key={l.address} value={l.address} className="bg-imersa-midnight">
                                    {l.name}
                                  </option>
                                ))}
                              </optgroup>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Operator</label>
                        <select
                          className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, { operator: e.target.value })}
                        >
                          {operators.map(op => (
                            <option key={op.value} value={op.value} className="bg-imersa-midnight">
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Value</label>
                        <input
                          className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          placeholder="Value"
                        />
                      </div>
                    </div>
                    {formData.conditions.length > 1 && (
                      <button
                        onClick={() => removeCondition(index)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-all text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-300">Actions (THEN)</label>
              <button
                onClick={addAction}
                className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all flex items-center gap-1 text-sm"
              >
                <Plus className="w-3 h-3" />
                Add Action
              </button>
            </div>
            <div className="space-y-3">
              {formData.actions.map((action, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Target</label>
                          <select
                            className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                            value={action.address}
                            onChange={(e) => updateAction(index, { address: e.target.value })}
                          >
                            <option value="" className="bg-imersa-midnight">Select...</option>
                            {availableAddresses && (
                              <>
                                <optgroup label="Groups" className="bg-imersa-midnight">
                                  {availableAddresses.groups.map(g => (
                                    <option key={g.address} value={g.address} className="bg-imersa-midnight">
                                      {g.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Lights" className="bg-imersa-midnight">
                                  {availableAddresses.lights.map(l => (
                                    <option key={l.address} value={l.address} className="bg-imersa-midnight">
                                      {l.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Scenes" className="bg-imersa-midnight">
                                  {availableAddresses.scenes.map(s => (
                                    <option key={s.address} value={s.address} className="bg-imersa-midnight">
                                      {s.name}
                                    </option>
                                  ))}
                                </optgroup>
                              </>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Method</label>
                          <select
                            className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                            value={action.method}
                            onChange={(e) => updateAction(index, { method: e.target.value as any })}
                          >
                            <option value="PUT" className="bg-imersa-midnight">Update (PUT)</option>
                            <option value="POST" className="bg-imersa-midnight">Create (POST)</option>
                            <option value="DELETE" className="bg-imersa-midnight">Delete</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Action Body (JSON)</label>
                        <textarea
                          className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 font-mono text-xs"
                          value={JSON.stringify(action.body, null, 2)}
                          onChange={(e) => {
                            try {
                              updateAction(index, { body: JSON.parse(e.target.value) });
                            } catch {
                              // Invalid JSON, ignore
                            }
                          }}
                          placeholder='{"on": true, "bri": 254}'
                          rows={3}
                        />
                      </div>
                    </div>
                    {formData.actions.length > 1 && (
                      <button
                        onClick={() => removeAction(index)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-all text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            disabled={loading}
            className="btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : editRule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleBuilder;