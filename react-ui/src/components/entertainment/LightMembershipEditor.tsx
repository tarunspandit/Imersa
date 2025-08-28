// Editor for adding/removing lights in an Entertainment Area
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Save, RefreshCw } from 'lucide-react';
import { Light, EntertainmentArea } from '@/types';
import { Modal } from '@/components/ui';
import { LightSelector } from '@/components/wizard/LightSelector';
import { cn } from '@/utils';

interface LightMembershipEditorProps {
  isOpen: boolean;
  area: EntertainmentArea | null;
  availableLights: Light[];
  onRefreshLights?: () => Promise<void>;
  onSave: (lightIds: string[]) => Promise<void>;
  onClose: () => void;
  isSaving?: boolean;
}

export const LightMembershipEditor: React.FC<LightMembershipEditorProps> = ({
  isOpen,
  area,
  availableLights,
  onRefreshLights,
  onSave,
  onClose,
  isSaving = false,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (area) setSelected(area.lightIds);
  }, [area]);

  const onToggleLight = useCallback((lightId: string) => {
    setSelected(prev => prev.includes(lightId) ? prev.filter(id => id !== lightId) : [...prev, lightId]);
  }, []);

  const onSelectAll = useCallback(() => {
    setSelected(availableLights.map(l => l.id));
  }, [availableLights]);

  const onClearSelection = useCallback(() => setSelected([]), []);

  const hasChanges = useMemo(() => {
    const original = new Set(area?.lightIds || []);
    if (selected.length !== original.size) return true;
    return selected.some(id => !original.has(id));
  }, [area, selected]);

  const handleSave = useCallback(async () => {
    if (!area || !hasChanges) return;
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [area, hasChanges, onSave, selected, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <div className="p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="nav-orb">
            <Users className="w-5 h-5 text-imersa-dark" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Edit Lights</h2>
            <p className="text-sm text-gray-400">{area?.name} — {selected.length} selected</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshLights}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
            title="Refresh lights"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || isSaving}
            className={cn('btn-glow px-4 py-1.5 flex items-center gap-2', (!hasChanges || saving || isSaving) && 'opacity-50 cursor-not-allowed')}
          >
            {saving ? (
              <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="p-6">
        <LightSelector
          availableLights={availableLights}
          selectedLights={selected}
          onToggleLight={onToggleLight}
          onSelectAll={onSelectAll}
          onClearSelection={onClearSelection}
          onRefreshLights={onRefreshLights}
        />
      </div>
    </Modal>
  );
};

export default LightMembershipEditor;

