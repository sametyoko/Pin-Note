export type User = { id: number; username: string };
export type HistoryEntry = { id: number; action: string; title: string };
export type Photo = { id: number; url: string };
export type Point = {
  favorite: boolean;
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  municipality: string;
  memo: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
};
export type Position = { lat: number; lng: number };
export type PointInput = {
  requestId: string;
  title: string;
  latitude: number;
  longitude: number;
  municipality: string;
  memo: string;
  retainedPhotoIds: number[];
};
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'X-Pin-Note': '1', ...init?.headers } });
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/api/auth/'))
      window.dispatchEvent(new Event('pin-note-session-expired'));
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.message ||
        (response.status === 503
          ? 'DBに接続できません。少し待って再試行してください。'
          : '処理に失敗しました。再試行してください。')
    );
  }
  if (init?.method && init.method !== 'GET' && !url.startsWith('/api/auth/'))
    window.dispatchEvent(new Event('pin-note-data-changed'));
  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}
export const api = {
  me: () => request<User>('/api/auth/me'),
  authenticate: (mode: 'login' | 'signup', username: string, password: string) =>
    request<User>(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  history: () => request<HistoryEntry[]>('/api/history'),
  redoHistory: () => request<HistoryEntry[]>('/api/history/redo'),
  redo: (id: number) => request<void>(`/api/history/${id}/redo`, { method: 'POST' }),
  undo: (id: number) => request<void>(`/api/history/${id}/undo`, { method: 'POST' }),
  favorite: (id: number, favorite: boolean) =>
    request<Point>(`/api/points/${id}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    }),
  list: () => request<Point[]>('/api/points'),
  save: (input: PointInput, files: File[], id?: number) => {
    const data = new FormData();
    data.append('data', new Blob([JSON.stringify(input)], { type: 'application/json' }));
    files.forEach((file) => data.append('photos', file));
    return request<Point>(`/api/points${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      body: data,
    });
  },
  remove: (id: number) => request<void>(`/api/points/${id}`, { method: 'DELETE' }),
  city: async (position: Position, signal?: AbortSignal) => {
    const result = await request<{ municipality: string }>(
      `/api/municipality?latitude=${position.lat}&longitude=${position.lng}`,
      { signal }
    );
    return result.municipality;
  },
};
export function autoName(date: Date, city: string) {
  const z = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}/${z(date.getMonth() + 1)}/${z(date.getDate())} ${z(date.getHours())}:${z(date.getMinutes())}${city ? ` ${city}` : ' のポイント'}`;
}
