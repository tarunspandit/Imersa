import React, { useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import '@/styles/design-system.css';
import { cn } from '@/utils';
import { useSchedules } from '@/hooks/useSchedules';
import { Schedule, CreateScheduleRequest } from '@/types';
import ScheduleRow from '@/components/schedules/ScheduleRow';
import CreateScheduleModal from '@/components/schedules/CreateScheduleModal';
import { 
  Plus, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  Pause,
  Play
} from 'lucide-react';

const Scheduler: React.FC = () => {
  const {
    schedules,
    loading,
    error,
    stats,
    templates,
    conflicts,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    enableSchedule,
    disableSchedule,
    triggerSchedule,
    bulkUpdateSchedules,
    bulkDeleteSchedules,
    refresh
  } = useSchedules();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);

  const handleCreateSchedule = async (scheduleData: CreateScheduleRequest): Promise<boolean> => {
    const success = await createSchedule(scheduleData);
    if (success) {
      setIsCreateModalOpen(false);
      return true;
    }
    return false;
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setEditSchedule(schedule);
    setIsCreateModalOpen(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      await deleteSchedule(id);
    }
  };

  const handleToggleScheduleStatus = async (id: string, enabled: boolean) => {
    if (enabled) {
      await enableSchedule(id);
    } else {
      await disableSchedule(id);
    }
  };

  const handleTriggerSchedule = async (id: string) => {
    await triggerSchedule(id);
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete') => {
    if (selectedSchedules.length === 0) return;

    if (action === 'delete' && !confirm(`Delete ${selectedSchedules.length} schedules?`)) {
      return;
    }

    if (action === 'enable') {
      await bulkUpdateSchedules(selectedSchedules, { status: 'enabled' });
    } else if (action === 'disable') {
      await bulkUpdateSchedules(selectedSchedules, { status: 'disabled' });
    } else if (action === 'delete') {
      await bulkDeleteSchedules(selectedSchedules);
    }

    setSelectedSchedules([]);
  };

  const toggleScheduleSelection = (scheduleId: string) => {
    setSelectedSchedules(prev =>
      prev.includes(scheduleId)
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const selectAllSchedules = () => {
    const allIds = Object.keys(schedules);
    setSelectedSchedules(selectedSchedules.length === allIds.length ? [] : allIds);
  };

  const schedulesArray = Object.values(schedules);
  const conflictedScheduleIds = conflicts.flatMap(c => c.scheduleIds);

  if (loading && schedulesArray.length === 0) {
    return (
      <PageWrapper
        icon={<Clock className="w-8 h-8 text-imersa-dark" />}
        title="Scheduler"
        subtitle="Loading schedules..."
      >
        <div className="glass-card p-8 text-center">
          <div className="loading-pulse mx-auto">
            <Clock className="w-8 h-8 text-imersa-dark" />
          </div>
          <p className="text-gray-400 mt-2">Loading schedules...</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      icon={<Clock className="w-8 h-8 text-imersa-dark" />}
      title="Scheduler"
      subtitle="Manage lighting schedules and automation timing"
      actions={
        <button 
          onClick={() => setIsCreateModalOpen(true)} 
          className="btn-glow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Schedule
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
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Schedules</p>
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
                <p className="text-sm text-gray-400">Active</p>
                <p className="text-2xl font-bold text-white">{stats.active}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-white">{stats.completed}</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-4 holo-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Conflicts</p>
                <p className="text-2xl font-bold text-white">{conflicts.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conflicts Alert */}
      {conflicts.length > 0 && showConflicts && (
        <div className="glass-card p-4 border-red-500/20 bg-red-500/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div>
                <h3 className="font-semibold text-red-400">Schedule Conflicts Detected</h3>
                <p className="text-red-300 text-sm mt-1">
                  {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} found that may affect scheduling
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowConflicts(false)}
              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all text-sm"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {conflicts.map((conflict, index) => (
              <div key={index} className="text-sm text-red-300 bg-red-500/10 p-2 rounded-lg">
                <strong>{conflict.conflictType.replace('_', ' ')}:</strong> {conflict.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedSchedules.length > 0 && (
        <div className="glass-card p-4 border-blue-500/20 bg-blue-500/10">
          <div className="flex items-center justify-between">
            <p className="text-blue-400">
              {selectedSchedules.length} schedule{selectedSchedules.length > 1 ? 's' : ''} selected
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

      {/* Schedules Table */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedules ({schedulesArray.length})
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={selectAllSchedules}
              className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all text-sm"
            >
              {selectedSchedules.length === Object.keys(schedules).length ? 'Deselect All' : 'Select All'}
            </button>
            <button 
              onClick={refresh}
              className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-all text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
        <div>
          {schedulesArray.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No schedules yet</h3>
              <p className="text-gray-400 mb-4">
                Create your first schedule to automate your lighting system
              </p>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn-glow flex items-center gap-2 mx-auto">
                <Plus className="h-4 w-4" />
                Create Schedule
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-300">
                      <input
                        type="checkbox"
                        checked={selectedSchedules.length === schedulesArray.length}
                        onChange={selectAllSchedules}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Schedule</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Time</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedulesArray.map((schedule) => (
                    <tr key={schedule.id}>
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedSchedules.includes(schedule.id)}
                          onChange={() => toggleScheduleSelection(schedule.id)}
                          className="rounded"
                        />
                      </td>
                      <ScheduleRow
                        schedule={schedule}
                        onEdit={handleEditSchedule}
                        onDelete={handleDeleteSchedule}
                        onToggleStatus={handleToggleScheduleStatus}
                        onTrigger={handleTriggerSchedule}
                        conflicts={conflictedScheduleIds}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Schedule Modal */}
      <CreateScheduleModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditSchedule(null);
        }}
        onSubmit={handleCreateSchedule}
        templates={templates}
        editSchedule={editSchedule}
      />
    </PageWrapper>
  );
};

export default Scheduler;