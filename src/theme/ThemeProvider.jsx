import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

export const THEME_STORAGE_KEY = 'ldrs.theme';

// Storage can be unavailable (private mode, blocked cookies); the theme still works for the visit.
function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemTheme() {
  return window.matchMedia && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore: the choice just will not survive a reload.
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }) {
  // Until the user picks a theme, the device setting decides (and is followed if it changes).
  const [chosen, setChosen] = useState(readStoredTheme);
  const [system, setSystem] = useState(systemTheme);
  const theme = chosen || system;

  useEffect(function () {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = function (event) {
      setSystem(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return function () {
      query.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(
    function () {
      applyTheme(theme);
    },
    [theme],
  );

  const setTheme = useCallback(function (next) {
    storeTheme(next);
    setChosen(next);
  }, []);

  const toggleTheme = useCallback(
    function () {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    },
    [theme, setTheme],
  );

  const value = useMemo(
    function () {
      return { theme, isSystem: !chosen, setTheme, toggleTheme };
    },
    [theme, chosen, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
