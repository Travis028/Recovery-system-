import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  useEffect(
    function () {
      applyTheme(theme);
    },
    [theme],
  );

  const toggleTheme = useCallback(function () {
    setTheme(function (current) {
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(
    function () {
      return { theme, setTheme, toggleTheme };
    },
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
