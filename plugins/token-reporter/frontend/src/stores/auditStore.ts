import {create} from 'zustand';
import type {AuditStatus} from '../types/api';
import {getAuditStatus, ackAuditPrompt} from '../services/api';

interface AuditStore {
  status: AuditStatus | null;
  dismissed: boolean;
  /** When true, banner is shown regardless of auditPromptedAt/dismissed state. */
  forceShow: boolean;
  fetchStatus: () => Promise<void>;
  dismiss: () => Promise<void>;
  /** Show the banner again (triggered by the header icon). */
  requestShow: () => void;
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  status: null,
  dismissed: false,
  forceShow: false,
  fetchStatus: async () => {
    try {
      const status = await getAuditStatus();
      set({status});
    } catch {
      set({status: null});
    }
  },
  dismiss: async () => {
    set({dismissed: true, forceShow: false});
    try {
      await ackAuditPrompt();
    } finally {
      await get().fetchStatus();
    }
  },
  requestShow: () => set({dismissed: false, forceShow: true}),
}));
