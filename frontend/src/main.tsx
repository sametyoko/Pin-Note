import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import MapOutlined from '@mui/icons-material/MapOutlined';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import ViewListRounded from '@mui/icons-material/ViewListRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CameraAltOutlined from '@mui/icons-material/CameraAltOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SearchRounded from '@mui/icons-material/SearchRounded';
import PointDetails, { FavoriteButton } from './PointDetails';
import { searchPoints } from './search';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import MapCanvas from './MapCanvas';
import { api, autoName, type Point, type Position, type Photo } from './api';
import './style.css';
import { AccountGate, useAccount, UndoControl } from './Account';
import { registerPointReader } from './webmcp';
const theme = createTheme({
  palette: { primary: { main: '#c65a17', dark: '#a6420e' } },
  typography: { fontFamily: '"Noto Sans JP",system-ui,sans-serif' },
  shape: { borderRadius: 20 },
});
const initialPosition = { lat: 35.681236, lng: 139.767125 };
type View = 'map' | 'list' | 'form' | 'detail' | 'settings';
type Draft = {
  requestId: string;
  position: Position;
  title: string;
  city: string;
  memo: string;
  files: File[];
  kept: Photo[];
  date: Date;
  editedName: boolean;
  id?: number;
};
function App() {
  const { user, logout } = useAccount();
  const [query, setQuery] = useState('');
  const detailReturn = useRef<'map' | 'list'>('map');
  const [introVisible, setIntroVisible] = useState(() => {
    try {
      return localStorage.getItem('pin-note-hide-intro') !== 'true';
    } catch {
      return true;
    }
  });
  function toggleIntro(show: boolean) {
    setIntroVisible(show);
    try {
      localStorage.setItem('pin-note-hide-intro', String(!show));
    } catch {}
  }
  const [points, setPoints] = useState<Point[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('map'),
    [target, setTarget] = useState<Position>(initialPosition),
    [picked, setPicked] = useState<Position>();
  const [location, setLocation] = useState<Position & { accuracy: number }>(),
    [locating, setLocating] = useState(false),
    [selected, setSelected] = useState<Point>();
  const [draft, setDraft] = useState<Draft>(),
    [choosing, setChoosing] = useState(false),
    [saving, setSaving] = useState(false),
    [cityLoading, setCityLoading] = useState(false),
    [formError, setFormError] = useState('');
  const [toast, setToast] = useState(''),
    [grid, setGrid] = useState(() => {
      try {
        return localStorage.getItem('pin-note-layout') !== 'list';
      } catch {
        return true;
      }
    });
  const [menu, setMenu] = useState<HTMLElement | null>(null),
    [accountInfo, setAccountInfo] = useState(false),
    [confirm, setConfirm] = useState<'skip' | 'delete' | 'leave' | null>(null);
  const nextView = useRef<View>('map'),
    busy = useRef(false),
    titleRef = useRef<HTMLInputElement>(null),
    initialized = useRef(false);
  async function reload() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.list();
      setPoints(data);
      if (!initialized.current && data.length) {
        setTarget({ lat: data[0].latitude, lng: data[0].longitude });
      }
      initialized.current = true;
    } catch (e) {
      setLoadError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    const undone = (event: Event) => {
      setDraft(undefined);
      setChoosing(false);
      setSelected(undefined);
      setPicked(undefined);
      setView('list');
      void reload();
      setToast(
        (event as CustomEvent<{ redo: boolean }>).detail?.redo
          ? '取り消した操作をやり直しました。'
          : 'ひとつ前の状態に戻しました。'
      );
    };
    window.addEventListener('pin-note-undone', undone);
    return () => window.removeEventListener('pin-note-undone', undone);
  }, []);
  useEffect(registerPointReader, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view, choosing]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem('pin-note-layout', grid ? 'grid' : 'list');
    } catch {
      /* プライベートモードでは表示中のみ保持 */
    }
  }, [grid]);
  useEffect(() => {
    if (!draft) return;
    const controller = new AbortController();
    setCityLoading(true);
    api
      .city(draft.position, controller.signal)
      .then((city) => {
        setDraft((previous) =>
          previous
            ? {
                ...previous,
                city,
                title: previous.editedName ? previous.title : autoName(previous.date, city),
              }
            : previous
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setCityLoading(false);
      });
    return () => controller.abort();
  }, [draft?.requestId, draft?.position.lat, draft?.position.lng]);
  useEffect(() => {
    if (!draft) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draft]);
  function message(e: unknown) {
    return e instanceof Error ? e.message : '通信に失敗しました。もう一度お試しください。';
  }
  function go(v: View) {
    if (saving) return;
    if (draft) {
      nextView.current = v;
      setConfirm('leave');
      return;
    }
    setView(v);
    setMenu(null);
  }
  function showPoint(point: Point) {
    detailReturn.current = view === 'list' ? 'list' : 'map';
    setSelected(point);
    setTarget({ lat: point.latitude, lng: point.longitude });
    setView('detail');
    setPicked(undefined);
  }
  async function toggleFavorite(point: Point) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const updated = await api.favorite(point.id, !point.favorite);
      setPoints((items) => items.map((p) => (p.id === updated.id ? updated : p)));
      setSelected((p) => (p?.id === updated.id ? updated : p));
      setToast(updated.favorite ? 'お気に入りに追加しました。' : 'お気に入りを外しました。');
    } catch (e) {
      setToast(message(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  function openForm(position: Position, point?: Point) {
    const date = new Date();
    setDraft({
      requestId: crypto.randomUUID(),
      position,
      title: point?.title || autoName(date, ''),
      city: point?.municipality || '',
      memo: point?.memo || '',
      files: [],
      kept: point?.photos || [],
      date,
      editedName: !!point,
      id: point?.id,
    });
    setPicked(position);
    setTarget(position);
    setFormError('');
    setView('form');
    setChoosing(false);
  }
  function locate(register = false) {
    if (locating) return;
    if (!navigator.geolocation) {
      setToast('この端末では現在地を取得できません。地図で場所を選んでください。');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setLocation({ ...pos, accuracy: p.coords.accuracy });
        setPicked(pos);
        setTarget(pos);
        setLocating(false);
        if (register) openForm(pos);
        else setToast(`現在地を表示しました（精度 約${Math.round(p.coords.accuracy)}m）。`);
      },
      (e) => {
        setLocating(false);
        setToast(
          e.code === 1
            ? '位置情報が許可されていません。地図をタップして場所を選べます。'
            : '現在地を取得できませんでした。再試行するか、地図で場所を選んでください。'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }
  function pick(p: Position) {
    if (saving) return;
    if (!draft) setSelected(undefined);
    setPicked(p);
    if (choosing && draft) {
      setDraft({ ...draft, position: p, city: '' });
      setChoosing(false);
      setView('form');
    } else setToast('場所を選択しました。「この場所を追加」で保存できます。');
  }
  function addFiles(files: FileList | null) {
    if (!draft || !files) return;
    const items = [...files];
    if (draft.files.length + draft.kept.length + items.length > 3) {
      setFormError('写真は3枚までです。');
      return;
    }
    if (
      items.some((f) => !['image/jpeg', 'image/png'].includes(f.type) || f.size > 5 * 1024 * 1024)
    ) {
      setFormError('JPEGまたはPNG、1枚5MB以下の写真を選んでください。');
      return;
    }
    setDraft({ ...draft, files: [...draft.files, ...items] });
    setFormError('');
  }
  async function save(skip = false) {
    if (!draft || busy.current) return;
    if (
      skip &&
      (draft.editedName || draft.memo || draft.files.length || draft.kept.length) &&
      confirm !== 'skip'
    ) {
      setConfirm('skip');
      return;
    }
    busy.current = true;
    setSaving(true);
    setConfirm(null);
    setFormError('');
    try {
      const point = await api.save(
        {
          requestId: draft.requestId,
          title: skip ? autoName(draft.date, draft.city) : draft.title,
          latitude: draft.position.lat,
          longitude: draft.position.lng,
          municipality: draft.city,
          memo: skip ? '' : draft.memo,
          retainedPhotoIds: skip ? [] : draft.kept.map((p) => p.id),
        },
        skip ? [] : draft.files,
        draft.id
      );
      setPoints((previous) => [point, ...previous.filter((p) => p.id !== point.id)]);
      setSelected(point);
      setTarget({ lat: point.latitude, lng: point.longitude });
      setDraft(undefined);
      setPicked(undefined);
      setView('map');
      setToast('場所を保存しました。');
    } catch (e) {
      setFormError(message(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function remove() {
    if (!selected || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await api.remove(selected.id);
      setPoints((p) => p.filter((item) => item.id !== selected.id));
      setSelected(undefined);
      setView('list');
      setConfirm(null);
      setToast('ポイントを削除しました。');
    } catch (e) {
      setToast(message(e));
      setConfirm(null);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const mapVisible =
    view === 'map' ||
    (view === 'detail' && detailReturn.current === 'map') ||
    (view === 'form' && choosing);
  const listVisible = view === 'list' || (view === 'detail' && detailReturn.current === 'list');
  const filteredPoints = searchPoints(points, query);
  return (
    <>
      <div className="app">
        <header className="app-header glass">
          <button className="brand" onClick={() => go('map')} aria-label="Pin Note 地図ホーム">
            <span className="brand-mark">
              <PlaceRounded />
            </span>
            pin note<span className="brand-caption">小さな発見を、ここに。</span>
          </button>
          <button
            className="icon-button account-button"
            onClick={(e) => setMenu(e.currentTarget)}
            aria-label="アカウントメニュー"
            aria-haspopup="menu"
            aria-expanded={!!menu}
          >
            <PersonOutlineRounded />
          </button>
        </header>
        <UndoControl disabled={!!draft || saving || view === 'detail'} />
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} disableScrollLock>
          <MenuItem disabled>
            <PersonOutlineRounded />
            {user.username}
          </MenuItem>
          <MenuItem onClick={() => go('settings')}>
            <SettingsOutlined />
            設定
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenu(null);
              setAccountInfo(true);
            }}
          >
            <PersonOutlineRounded />
            プロフィール
          </MenuItem>
          <MenuItem
            disabled={saving || !!draft}
            onClick={() => {
              void logout().catch((e) => setToast(message(e)));
            }}
          >
            <LogoutRounded />
            ログアウト
          </MenuItem>
          {draft && <MenuItem disabled>登録画面を閉じてからログアウトできます</MenuItem>}
        </Menu>
        <main>
          <section
            className={`map-view ${mapVisible ? '' : 'map-hidden'}`}
            aria-hidden={!mapVisible}
          >
            <MapCanvas
              selectedId={selected?.id}
              raised={view === 'detail'}
              visible={mapVisible}
              points={points}
              target={target}
              draft={picked}
              location={location}
              onPick={pick}
              onSelect={(point) =>
                choosing ? pick({ lat: point.latitude, lng: point.longitude }) : showPoint(point)
              }
            />
            {introVisible && view !== 'detail' && (
              <div className="map-label glass">
                <button
                  className="map-label-close"
                  aria-label="地図の紹介文を閉じる"
                  onClick={() => toggleIntro(false)}
                >
                  <CloseRounded />
                </button>
                <span className="eyebrow">MY PLACES</span>
                <h1>
                  いつもの街に、
                  <br />
                  自分だけのしるし。
                </h1>
                <span className="sub">
                  {loading ? 'ポイントを読み込み中…' : `${points.length} 件のポイント`}
                </span>
              </div>
            )}
            <div className="map-controls">
              <button
                className="icon-button glass"
                disabled={locating}
                onClick={() => locate()}
                aria-label="現在地へ移動"
              >
                <MyLocationRounded className={locating ? 'spinning' : ''} />
              </button>
            </div>
            {view !== 'detail' && (
              <section className="map-card glass">
                <div>
                  <span className="eyebrow">{choosing ? 'CHOOSE A PLACE' : 'PIN YOUR MOMENT'}</span>
                  <h2>
                    {choosing
                      ? '地図で新しい位置をタップ'
                      : picked
                        ? 'この場所を残そう'
                        : '気になる場所を見つけたら'}
                  </h2>
                  <p>
                    {choosing
                      ? 'タップすると登録画面に戻ります。'
                      : picked
                        ? '名前や写真は、あとからでも。'
                        : '地図をタップするか、現在地から追加。'}
                  </p>
                </div>
                {choosing ? (
                  <button
                    onClick={() => {
                      setChoosing(false);
                      setView('form');
                    }}
                  >
                    位置を変えずに戻る
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={locating}
                    onClick={() => (picked ? openForm(picked) : locate(true))}
                  >
                    <AddRounded />
                    {locating ? '現在地を取得中…' : picked ? 'この場所を追加' : '現在地から追加'}
                  </button>
                )}
              </section>
            )}
          </section>
          {(view === 'map' || view === 'list') && loadError && (
            <div className="load-error" role="alert">
              <span>{loadError}</span>
              <button onClick={() => void reload()}>再試行</button>
            </div>
          )}
          {listVisible && (
            <section className="content-page">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR COLLECTION</span>
                  <h1>マイポイント</h1>
                  <p>{points.length} 件の小さな発見</p>
                </div>
                <div className="view-switch" aria-label="一覧の表示方法">
                  <button
                    aria-label="縦リスト表示"
                    aria-pressed={!grid}
                    onClick={() => setGrid(false)}
                  >
                    <ViewListRounded />
                  </button>
                  <button aria-label="格子表示" aria-pressed={grid} onClick={() => setGrid(true)}>
                    <GridViewRounded />
                  </button>
                </div>
              </div>
              <div className="search-field">
                <SearchRounded />
                <input
                  type="search"
                  aria-label="ポイントを検索"
                  placeholder="名前・メモ・市区町村で検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button aria-label="検索をクリア" onClick={() => setQuery('')}>
                    <CloseRounded />
                  </button>
                )}
              </div>
              {query && (
                <p className="search-count" role="status">
                  {filteredPoints.length} 件見つかりました
                </p>
              )}
              {loading ? (
                <p role="status">ポイントを読み込んでいます…</p>
              ) : points.length === 0 && !loadError ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <PlaceRounded />
                  </span>
                  <h2>まだ、まっさらな地図。</h2>
                  <p>
                    散歩の途中で気になった場所を、
                    <br />
                    ひとつ残してみませんか。
                  </p>
                  <button className="primary" onClick={() => go('map')}>
                    <AddRounded />
                    地図から追加
                  </button>
                </div>
              ) : filteredPoints.length === 0 && !loadError ? (
                <div className="empty-state">
                  <SearchRounded />
                  <h2>見つかりませんでした</h2>
                  <p>別の言葉で検索してみてください。</p>
                  <button onClick={() => setQuery('')}>すべて表示する</button>
                </div>
              ) : (
                <div className={`point-list ${grid ? 'grid-layout' : ''}`}>
                  {filteredPoints.map((point) => (
                    <article className="point-card" key={point.id}>
                      <button
                        className="point-card-open"
                        onClick={() => showPoint(point)}
                        aria-label={`${point.title}の詳細を開く`}
                      >
                        <div className="thumbnail">
                          {point.photos[0] ? (
                            <img src={point.photos[0].url} alt="" loading="lazy" />
                          ) : (
                            <>
                              <PlaceRounded />
                              <span>場所の記録</span>
                            </>
                          )}
                        </div>
                        <div className="point-card-copy">
                          <span className="city">
                            <PlaceRounded />
                            {point.municipality || 'マイポイント'}
                          </span>
                          <h2>{point.title}</h2>
                          <p>{point.memo || '詳細はあとから、ゆっくり。'}</p>
                          <time>{new Date(point.createdAt).toLocaleDateString('ja-JP')}</time>
                        </div>
                      </button>
                      <FavoriteButton
                        point={point}
                        disabled={saving}
                        onClick={() => void toggleFavorite(point)}
                      />
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {view === 'form' && draft && !choosing && (
            <section className="content-page form-page">
              <button className="back" onClick={() => go(draft.id ? 'detail' : 'map')}>
                <ArrowBackRounded />
                戻る
              </button>
              <span className="eyebrow">{draft.id ? 'EDIT YOUR PLACE' : 'A LITTLE DISCOVERY'}</span>
              <h1>{draft.id ? '記録を育てよう。' : 'この場所を、残そう。'}</h1>
              <p className="intro">場所だけでも大丈夫。思い出は、あとから。</p>
              <div className="location-strip">
                <PlaceRounded />
                <div>
                  <strong>
                    {cityLoading ? '市区町村を確認中…' : draft.city || '選択した場所'}
                  </strong>
                  <span>
                    {draft.position.lat.toFixed(5)}, {draft.position.lng.toFixed(5)}
                  </span>
                </div>
                <button
                  disabled={saving}
                  onClick={() => {
                    setChoosing(true);
                    setTarget(draft.position);
                  }}
                >
                  変更
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                {!draft.id && (
                  <button
                    type="button"
                    className="quick-save"
                    disabled={saving}
                    onClick={() => void save(true)}
                  >
                    <CheckRounded />
                    詳細をスキップして保存
                  </button>
                )}
                <fieldset disabled={saving}>
                  <label htmlFor="point-title">
                    名前 <span className="optional">自動入力・変更OK</span>
                  </label>
                  <input
                    ref={titleRef}
                    id="point-title"
                    value={draft.title}
                    maxLength={100}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value, editedName: true })
                    }
                  />
                  <label htmlFor="point-memo">
                    メモ <span className="optional">任意</span>
                  </label>
                  <textarea
                    id="point-memo"
                    value={draft.memo}
                    maxLength={1000}
                    rows={3}
                    placeholder="何が気になった？ 書かなくても大丈夫。"
                    onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
                  />
                  <div className="field-heading">
                    <label htmlFor="point-photos">
                      写真 <span className="optional">任意</span>
                    </label>
                    <span>{draft.files.length + draft.kept.length} / 3</span>
                  </div>
                  <div className="photo-previews">
                    {draft.kept.map((photo) => (
                      <div className="photo-preview" key={photo.id}>
                        <img src={photo.url} alt="保存済みの写真" />
                        <button
                          type="button"
                          className="photo-remove"
                          aria-label="保存済み写真を外す"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              kept: draft.kept.filter((p) => p.id !== photo.id),
                            })
                          }
                        >
                          <CloseRounded />
                        </button>
                      </div>
                    ))}
                    {draft.files.map((file, index) => (
                      <PhotoPreview
                        key={`${file.name}-${index}`}
                        file={file}
                        remove={() =>
                          setDraft({ ...draft, files: draft.files.filter((_, i) => i !== index) })
                        }
                      />
                    ))}
                  </div>
                  <label className="upload-button" htmlFor="point-photos">
                    <CameraAltOutlined />
                    <span>写真を追加する</span>
                    <input
                      id="point-photos"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <p className="field-hint">JPEG・PNG / 1枚5MBまで。写真なしでも保存できます。</p>
                </fieldset>
                {formError && (
                  <p className="form-error" role="alert">
                    {formError}
                  </p>
                )}
                <div className="form-actions">
                  <button className="primary" type="submit" disabled={saving}>
                    <CheckRounded />
                    {saving ? '保存中…' : '保存する'}
                  </button>
                </div>
                <p className="privacy-note">
                  市区町村の補完に選択地点をOpenStreetMapへ送信します。取得できなくても日時だけで保存できます。
                </p>
              </form>
            </section>
          )}
          {view === 'settings' && (
            <section className="content-page">
              <button className="back" onClick={() => go('map')}>
                <ArrowBackRounded />
                地図へ
              </button>
              <span className="eyebrow">MAKE IT YOURS</span>
              <h1>設定</h1>
              <div className="settings-card">
                <h2>地図の紹介文</h2>
                <button aria-pressed={introVisible} onClick={() => toggleIntro(!introVisible)}>
                  {introVisible ? '紹介文を非表示にする' : '紹介文を再表示する'}
                </button>
              </div>
              <div className="settings-card">
                <h2>ポイントの表示</h2>
                <p>このブラウザーで使う表示方法を選べます。</p>
                <div className="setting-buttons">
                  <button aria-pressed={!grid} onClick={() => setGrid(false)}>
                    <ViewListRounded />
                    リスト
                  </button>
                  <button aria-pressed={grid} onClick={() => setGrid(true)}>
                    <GridViewRounded />
                    格子
                  </button>
                </div>
              </div>
              <div className="settings-card">
                <h2>位置情報</h2>
                <p>
                  現在地ボタンを押したときだけ取得します。移動履歴は記録しません。許可の変更はブラウザーのサイト設定から行えます。
                </p>
              </div>
              <div className="settings-card">
                <h2>Pin Note</h2>
                <p>
                  自分のポイントと写真だけを表示します。直近10操作まで登録・編集・削除・お気に入りの変更を逆順に取り消せます。履歴は再起動後も残ります。取り消した操作は右向きの矢印からやり直せます。新しく登録・編集・削除・お気に入りの変更をすると、やり直し履歴はリセットされます。
                </p>
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                  地図データ © OpenStreetMap contributors
                </a>
              </div>
            </section>
          )}
        </main>
        <nav className="bottom-nav glass" aria-label="メインナビ">
          <button
            aria-current={view === 'map' ? 'page' : undefined}
            className={view === 'map' ? 'active' : ''}
            onClick={() => go('map')}
          >
            <MapOutlined />
            地図
          </button>
          <button
            aria-current={view === 'list' ? 'page' : undefined}
            className={view === 'list' ? 'active' : ''}
            onClick={() => go('list')}
          >
            <GridViewRounded />
            ポイント
          </button>
        </nav>
        {toast && (
          <div className="notice" role="status">
            {toast}
          </div>
        )}
      </div>
      <PointDetails
        point={selected}
        open={view === 'detail' && !!selected}
        busy={saving}
        onClose={() => setView(detailReturn.current)}
        onFavorite={() => {
          if (selected) void toggleFavorite(selected);
        }}
        onEdit={() => {
          if (selected) openForm({ lat: selected.latitude, lng: selected.longitude }, selected);
        }}
        onDelete={() => setConfirm('delete')}
        onMap={() => {
          if (selected) {
            setTarget({ lat: selected.latitude, lng: selected.longitude });
            setView('map');
          }
        }}
      />
      <Dialog
        open={!!confirm}
        onClose={() => {
          if (!saving) setConfirm(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {confirm === 'delete'
            ? 'このポイントを削除しますか？'
            : confirm === 'skip'
              ? '詳細を省いて保存しますか？'
              : '登録画面を閉じますか？'}
        </DialogTitle>
        <DialogContent>
          {confirm === 'delete'
            ? `「${selected?.title}」と写真を削除します。直近10操作までは「元に戻す」で復元できます。`
            : confirm === 'skip'
              ? '入力した名前・メモ・写真は保存せず、位置と自動名だけを保存します。'
              : '入力中の内容は保存されません。'}
        </DialogContent>
        <DialogActions>
          <button disabled={saving} onClick={() => setConfirm(null)}>
            戻る
          </button>
          <button
            className={confirm === 'delete' ? 'danger' : 'primary'}
            disabled={saving}
            onClick={() => {
              if (confirm === 'delete') void remove();
              else if (confirm === 'skip') void save(true);
              else {
                setDraft(undefined);
                setChoosing(false);
                setView(nextView.current);
                setConfirm(null);
              }
            }}
          >
            {saving
              ? '処理中…'
              : confirm === 'delete'
                ? '削除する'
                : confirm === 'skip'
                  ? '場所だけ保存'
                  : '保存せず閉じる'}
          </button>
        </DialogActions>
      </Dialog>
      <Dialog open={accountInfo} onClose={() => setAccountInfo(false)} fullWidth maxWidth="xs">
        <DialogTitle>プロフィール</DialogTitle>
        <DialogContent>
          ログイン中のユーザー：{user.username}。記録はこのアカウントに保存されます。
        </DialogContent>
        <DialogActions>
          <button onClick={() => setAccountInfo(false)}>閉じる</button>
        </DialogActions>
      </Dialog>
    </>
  );
}
function PhotoPreview({ file, remove }: { file: File; remove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="photo-preview">
      <img src={url} alt={file.name} />
      <button
        type="button"
        className="photo-remove"
        aria-label={`${file.name}を外す`}
        onClick={remove}
      >
        <CloseRounded />
      </button>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <AccountGate>
      <App />
    </AccountGate>
  </ThemeProvider>
);
