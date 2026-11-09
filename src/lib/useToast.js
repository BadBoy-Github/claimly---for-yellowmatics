'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useToast() {
  const [toast, setToast] = useState(null);
  const nextId = useRef(0);
  const showToast = useCallback((message, type = 'success') => {
    nextId.current += 1;
    setToast({ id: nextId.current, message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return { toast, showToast, dismissToast: () => setToast(null) };
}
