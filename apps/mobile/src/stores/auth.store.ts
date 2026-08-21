import { create } from 'zustand';
import type { MeResponse } from '../api/auth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: MeResponse | null;
  needsOnboarding: boolean;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setUser: (user: MeResponse | null) => void;
  setNeedsOnboarding: (value: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  needsOnboarding: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setNeedsOnboarding: (value) => set({ needsOnboarding: value }),
  clearAuth: () => set({ isAuthenticated: false, user: null, needsOnboarding: false }),
}));
