import { createContext, useContext } from 'react';
import type { Theme, Screen, Tab } from './types';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

interface NavCtx {
  screen: Screen;
  navigate: (screen: Screen, opts?: { replace?: boolean }) => void;
  back: () => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  toggleTheme: () => {},
});

export const NavContext = createContext<NavCtx>({
  screen: 'welcome',
  navigate: () => {},
  back: () => {},
  activeTab: 'home',
  setActiveTab: () => {},
});

export const useTheme = () => useContext(ThemeContext);
export const useNav = () => useContext(NavContext);
