import {create} from 'zustand';
import type {LimitsData} from '../types/api';

interface LimitsStore {
  limits: Record<string, LimitsData>;
  setLimits: (sessionId: string, data: LimitsData) => void;
}

export const useLimitsStore = create<LimitsStore>((set) => ({
  limits: {},
  setLimits: (sessionId, data) => set((s) => ({limits: {...s.limits, [sessionId]: data}})),
}));
