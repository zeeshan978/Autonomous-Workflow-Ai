import { useEffect, useRef, useCallback } from 'react';

/**
 * Warns the user before leaving the page if there are unsaved changes.
 * Also provides a `confirmLeave()` for programmatic navigation.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Browser native "Are you sure you want to leave?" dialog
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /**
   * Call this before any programmatic navigation.
   * Returns true if safe to navigate, false if user cancelled.
   */
  const confirmLeave = useCallback((): boolean => {
    if (!isDirtyRef.current) return true;
    return window.confirm('You have unsaved changes. Leave anyway?');
  }, []);

  return { confirmLeave };
}
