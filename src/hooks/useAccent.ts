import { useEffect, useState } from 'react';

type AccentColor = 'purple' | 'blue' | 'emerald' | 'orange' | 'rose';

export function useAccent() {
  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem('lumora-accent') as AccentColor) || 'purple';
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all accent classes
    root.classList.remove('accent-blue', 'accent-emerald', 'accent-orange', 'accent-rose');
    
    // Add the new one if not default
    if (accent !== 'purple') {
      root.classList.add(`accent-${accent}`);
    }
  }, [accent]);

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    localStorage.setItem('lumora-accent', newAccent);
  };

  return { accent, setAccent };
}
