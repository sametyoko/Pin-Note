import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import UndoRounded from '@mui/icons-material/UndoRounded';
import RedoRounded from '@mui/icons-material/RedoRounded';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { api, type User, type HistoryEntry } from './api';
const AccountContext = createContext<{ user: User; logout: () => Promise<void> } | null>(null);
export function useAccount() {
  return useContext(AccountContext)!;
}
export function AccountGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
    const expired = () => {
      setUser(null);
      setError('セッションが切れました。ログインし直してください。');
    };
    window.addEventListener('pin-note-session-expired', expired);
    return () => window.removeEventListener('pin-note-session-expired', expired);
  }, []);
  if (!ready)
    return (
      <main className="auth-page" role="status">
        ログイン状態を確認しています…
      </main>
    );
  if (!user)
    return (
      <AuthScreen
        notice={error}
        onLogin={(u) => {
          setUser(u);
          setError('');
        }}
      />
    );
  return (
    <AccountContext.Provider
      value={{
        user,
        logout: async () => {
          await api.logout();
          setUser(null);
        },
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
function AuthScreen({ onLogin, notice }: { onLogin: (u: User) => void; notice: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login'),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onLogin(await api.authenticate(mode, username, password));
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '接続できませんでした。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card glass">
        <div className="brand">
          <span className="brand-mark">
            <PlaceRounded />
          </span>
          pin note
        </div>
        <span className="eyebrow">YOUR OWN LITTLE MAP</span>
        <h1>{mode === 'login' ? 'おかえりなさい。' : '自分だけの地図を。'}</h1>
        <p>
          気になった場所も、小さな発見も。
          <br />
          あなたの記録を、ここに。
        </p>
        {notice && <p role="status">{notice}</p>}
        <form onSubmit={submit}>
          <label htmlFor="username">ユーザー名</label>
          <input
            id="username"
            autoComplete="username"
            pattern="[a-zA-Z0-9_]{3,40}"
            minLength={3}
            maxLength={40}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
          <p className="field-hint">
            英数字・アンダースコア、3〜40文字。大文字・小文字は区別しません。
          </p>
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            maxLength={72}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <p className="field-hint">
            8文字以上、UTF-8で72バイト以内。パスワード再設定は未対応です。
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? '確認中…' : mode === 'login' ? 'ログイン' : '登録してはじめる'}
          </button>
        </form>
        <button
          className="skip"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
            setPassword('');
          }}
        >
          {mode === 'login' ? 'はじめての方：サインアップ' : 'アカウントをお持ちの方：ログイン'}
        </button>
      </section>
    </main>
  );
}
export function UndoControl({ disabled }: { disabled: boolean }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]),
    [redoHistory, setRedoHistory] = useState<HistoryEntry[]>([]);
  const [mode, setMode] = useState<'undo' | 'redo' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const refresh = () => {
    void Promise.all([api.history(), api.redoHistory()])
      .then(([undo, redo]) => {
        setHistory(undo);
        setRedoHistory(redo);
      })
      .catch(() => {
        setHistory([]);
        setRedoHistory([]);
      });
  };
  useEffect(() => {
    refresh();
    window.addEventListener('pin-note-data-changed', refresh);
    return () => window.removeEventListener('pin-note-data-changed', refresh);
  }, []);
  const entry = (mode === 'redo' ? redoHistory : history)[0];
  async function apply() {
    if (!entry || !mode || busy) return;
    setBusy(true);
    setError('');
    try {
      await api[mode](entry.id);
      window.dispatchEvent(
        new CustomEvent('pin-note-undone', { detail: { redo: mode === 'redo' } })
      );
      setMode(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '復元できませんでした。');
      refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="history-controls">
        <button
          className="history-control glass"
          disabled={disabled || busy || !history.length}
          onClick={() => {
            setError('');
            setMode('undo');
          }}
          aria-label={`元に戻す・残り${history.length}操作`}
          title={`元に戻す（${history.length}操作）`}
        >
          <UndoRounded />
          <span>{history.length}</span>
        </button>
        <button
          className="history-control glass"
          disabled={disabled || busy || !redoHistory.length}
          onClick={() => {
            setError('');
            setMode('redo');
          }}
          aria-label={`やり直す・残り${redoHistory.length}操作`}
          title={`やり直す（${redoHistory.length}操作）`}
        >
          <RedoRounded />
          <span>{redoHistory.length}</span>
        </button>
      </div>
      <Dialog
        open={mode !== null}
        onClose={() => {
          if (!busy) setMode(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {mode === 'redo' ? '取り消した操作をやり直しますか？' : 'ひとつ前の状態に戻しますか？'}
        </DialogTitle>
        <DialogContent>
          「{entry?.title}」の
          {entry?.action === 'CREATE'
            ? '登録'
            : entry?.action === 'EDIT'
              ? '編集'
              : entry?.action === 'FAVORITE'
                ? 'お気に入りの変更'
                : '削除'}
          を{mode === 'redo' ? 'やり直します。' : '取り消します。'}写真も復元対象です。
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </DialogContent>
        <DialogActions>
          <button disabled={busy} onClick={() => setMode(null)}>
            キャンセル
          </button>
          <button className="primary" disabled={busy || !entry} onClick={() => void apply()}>
            {busy ? '復元中…' : mode === 'redo' ? 'やり直す' : '元に戻す'}
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
}
