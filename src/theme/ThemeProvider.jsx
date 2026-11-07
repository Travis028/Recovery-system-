import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

export const THEME_STORAGE_KEY = 'ldrs.theme';

// Storage can be unavailable (private mode, blocked cookies); the theme still works for the visit.
function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (error) {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Ignore: the choice just will not survive a reload.
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(function () {
    return readStoredTheme() || 'light';
  });

  useEffect(
    function () {
      applyTheme(theme);
    },
    [theme],
  );

  const setTheme = useCallback(function (next) {
    storeTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(
    function () {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    },
    [theme, setTheme],
  );

  const value = useMemo(
    function () {
      return { theme, setTheme, toggleTheme };
    },
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
