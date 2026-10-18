import { createContext, useContext } from 'react';
import type { Route } from '../hooks/useRoute';

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'success';
}

export interface UiContextValue {
  route: Route;
  navigate: (r: Route) => void;
  showToast: (t: ToastOptions) => void;
}

export const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiContext');
  return ctx;
}
