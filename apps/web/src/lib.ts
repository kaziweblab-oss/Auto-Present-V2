import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ap2-theme') as Theme) || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ap2-theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
}

// Same-origin by default (single-service deploy). Dev override via VITE_API_BASE_URL.
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-demo-user-id': localStorage.getItem('ap2-demo-id') ?? 'demo-super-admin',
      'x-demo-user-email': localStorage.getItem('ap2-demo-email') ?? '',
      'x-demo-user-roles': localStorage.getItem('ap2-demo-roles') ?? 'SUPER_ADMIN',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as { success: boolean; data: T; error?: { code: string } };
  if (!body.success) throw new Error(body.error?.code ?? `API ${res.status} ${path}`);
  return body.data;
}
