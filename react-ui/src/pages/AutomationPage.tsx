import React, { useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import '@/styles/design-system.css';
import { cn } from '@/utils';
import { useRules } from '@/hooks/useRules';
import { AutomationRule, CreateRuleRequest } from '@/types';
import RuleBuilder from '@/components/automation/RuleBuilder';
import { 
  Plus, 
  Zap, 
  AlertCircle, 
  Activity,
  TrendingUp,
  Pause,
  Play,
  Settings,
  Eye,
  Search
} from 'lucide-react';

const AutomationPage: React.FC = () => {
  const {
    rules,
    loading,
    error,
    stats,
    templates,
    availableAddresses,
    createRule,
    updateRule,
    deleteRule,
    enableRule,
    disableRule,
    triggerRule,
    bulkUpdateRules,
    bulkDeleteRules,
    refresh
  } = useRules();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  const handleCreateRule = async (ruleData: CreateRuleRequest): Promise<boolean> => {
    const success = await createRule(ruleData);
    if (success) {
      setIsCreateModalOpen(false);
      return true;
    }
    return false;
  };

  const handleEditRule = (rule: AutomationRule) => {
    setEditRule(rule);
    setIsCreateModalOpen(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm('Are you sure you want to delete this automation rule?')) {
      await deleteRule(id);
    }
  };

  const handleToggleRuleStatus = async (id: string, enabled: boolean) => {
    if (enabled) {
      await enableRule(id);
    } else {
      await disableRule(id);
    }
  };

  const handleTriggerRule = async (id: string) => {
    await triggerRule(id);
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedRules.length === 0) return;

    if (action === 'delete' && !confirm(`Delete ${selectedRules.length} rules?`)) {
      return;
    }

    if (action === 'enable') {
      await bulkUpdateRules(selectedRules, { enabled: true });
    } else if (action === 'disable') {
      await bulkUpdateRules(selectedRules, { enabled: false });
    } else if (action === 'delete') {
      await bulkDeleteRules(selectedRules);
    }

    setSelectedRules([]);
  };

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRules(prev =>
      prev.includes(ruleId)
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const selectAllRules = () => {
    const filteredRules = getFilteredRules();
    const allIds = filteredRules.map(r => r.id);
    setSelectedRules(selectedRules.length === allIds.length ? [] : allIds);
  };

  const getFilteredRules = () => {
    const rulesArray = Object.values(rules);
    
    return rulesArray.filter(rule => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by status
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'enabled' && rule.enabled) ||
        (filterStatus === 'disabled' && !rule.enabled);
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredRules = getFilteredRules();

  if (loading && Object.keys(rules).length === 0) {
    return (
      <PageWrapper
        icon={<Settings className="w-8 h-8 text-imersa-dark" />}
        title="Automation Rules"
        subtitle="Loading automation rules..."
      >
        <div className="glass-card p-8 text-center">
          <div className="loading-pulse mx-auto">
            <Settings className="w-8 h-8 text-imersa-dark" />
          </div>
          <p className="text-gray-400 mt-2">Loading automation rules...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      icon={<Settings className="w-8 h-8 text-imersa-dark" />}
      title="Automation Rules"
      subtitle="Create intelligent automation rules for your lighting system"
      actions={
        <button 
          onClick={() => setIsCreateModalOpen(true)} 
          className="btn-glow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </button>
      }
    >

      {/* Error Display */}
      {error && (
        <div className="glass-card p-4 border-red-500/20 bg-red-500/10">
          <p className="text-red-400">{error}</p>
          <button 
            onClick={refresh}
            className="mt-2 px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Rules</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Enabled</p>
                <p className="text-2xl font-bold text-white">{stats.enabled}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Triggered (24h)</p>
                <p className="text-2xl font-bold text-white">{stats.triggered24h}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Avg Response</p>
                <p className="text-2xl font-bold text-white">{stats.avgResponseTime}ms</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-imersa-accent focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-imersa-accent"
            >
              <option value="all">All Rules</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <button onClick={refresh} className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRules.length > 0 && (
        <div className="glass-card p-4 border-blue-500/20 bg-blue-500/10">
          <div className="flex items-center justify-between">
            <p className="text-blue-400">
              {selectedRules.length} rule{selectedRules.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('enable')}
                className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all flex items-center gap-1 text-sm"
              >
                <Play className="h-3 w-3" />
                Enable
              </button>
              <button
                onClick={() => handleBulkAction('disable')}
                className="px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all flex items-center gap-1 text-sm"
              >
                <Pause className="h-3 w-3" />
                Disable
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Automation Rules ({filteredRules.length})
          </h2>
          <button 
            onClick={selectAllRules}
            className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all text-sm"
          >
            {selectedRules.length === filteredRules.length && filteredRules.length > 0 
              ? 'Deselect All' 
              : 'Select All'
            }
          </button>
        </div>
        <div>
          {filteredRules.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {Object.keys(rules).length === 0 ? 'No automation rules yet' : 'No rules match your criteria'}
              </h3>
              <p className="text-gray-400 mb-4">
                {Object.keys(rules).length === 0 
                  ? 'Create your first automation rule to make your lighting system intelligent'
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
              {Object.keys(rules).length === 0 && (
                <button onClick={() => setIsCreateModalOpen(true)} className="btn-glow flex items-center gap-2 mx-auto">
                  <Plus className="h-4 w-4" />
                  Create Rule
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedRules.length === filteredRules.length && filteredRules.length > 0}
                        onChange={selectAllRules}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Rule Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Conditions</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Actions</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Triggered</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-800 hover:bg-white/5">
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRules.includes(rule.id)}
                          onChange={() => toggleRuleSelection(rule.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-white">{rule.name}</p>
                          {rule.description && (
                            <p className="text-sm text-gray-400">{rule.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-300">
                            {rule.conditions.length} condition{rule.conditions.length > 1 ? 's' : ''}
                          </p>
                          {rule.conditions.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-32">
                              {rule.conditions[0].address.split('/').pop()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-300">
                            {rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}
                          </p>
                          {rule.actions.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-32">
                              {rule.actions[0].address.split('/').pop()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-white">{rule.timesTriggered}</p>
                          {rule.lastTriggered && rule.lastTriggered !== 'none' && (
                            <p className="text-xs text-gray-500">
                              Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleToggleRuleStatus(rule.id, !rule.enabled)}
                            className="p-1 rounded hover:bg-white/10 transition-all"
                            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                          >
                            {rule.enabled ? (
                              <Pause className="h-4 w-4 text-orange-400" />
                            ) : (
                              <Play className="h-4 w-4 text-green-400" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleTriggerRule(rule.id)}
                            className="p-1 rounded hover:bg-white/10 transition-all"
                            title="Test rule"
                          >
                            <Zap className="h-4 w-4 text-blue-400" />
                          </button>
                          
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="p-1 rounded hover:bg-white/10 transition-all"
                            title="Edit rule"
                          >
                            <Eye className="h-4 w-4 text-gray-400" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 rounded hover:bg-white/10 transition-all"
                            title="Delete rule"
                          >
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rule Templates */}
      {templates.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-white mb-6">Quick Rule Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <div 
                key={template.id}
                className="glass-card p-4 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => {
                  // TODO: Apply template to rule creation
                  setIsCreateModalOpen(true);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{template.icon}</span>
                  <h3 className="font-medium text-white">{template.name}</h3>
                </div>
                <p className="text-sm text-gray-400">{template.description}</p>
                <span className="inline-block mt-2 px-2 py-1 bg-white/10 text-gray-300 text-xs rounded">
                  {template.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Rule Modal */}
      <RuleBuilder
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditRule(null);
        }}
        onSubmit={handleCreateRule}
        templates={templates}
        availableAddresses={availableAddresses}
        editRule={editRule}
      />
    </PageWrapper>
  );
};

export default AutomationPage;