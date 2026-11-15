import { useEffect, useState } from 'react';

let toasts = [];
const listeners = new Set();
let counter = 0;

function emit() {
  listeners.forEach(function (listener) {
    listener(toasts);
  });
}

/**
 * Shows a short notice. tone is 'success', 'danger' or 'info' (default).
 * The older variant: 'destructive' is still read as the danger tone.
 */
export function toast({ title, description, tone, variant, duration }) {
  counter += 1;
  const id = counter;
  const resolvedTone = tone || (variant === 'destructive' ? 'danger' : 'info');
  toasts = toasts.concat([{ id, title, description, tone: resolvedTone }]).slice(-4);
  emit();
  setTimeout(function () {
    dismiss(id);
  }, duration || 4500);
  return id;
}

export function dismiss(id) {
  toasts = toasts.filter(function (item) {
    return item.id !== id;
  });
  emit();
}

export function useToast() {
  const [items, setItems] = useState(toasts);
  useEffect(function () {
    listeners.add(setItems);
    return function () {
      listeners.delete(setItems);
    };
  }, []);
  return { toasts: items, toast, dismiss };
}
