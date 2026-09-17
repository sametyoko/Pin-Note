import { Drawer, useMediaQuery } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import MapOutlined from '@mui/icons-material/MapOutlined';
import type { Point } from './api';

export function FavoriteButton({
  point,
  disabled,
  onClick,
}: {
  point: Point;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`favorite-button ${point.favorite ? 'is-favorite' : ''}`}
      disabled={disabled}
      aria-pressed={point.favorite}
      aria-label={`${point.title}をお気に入り${point.favorite ? 'から外す' : 'に追加'}`}
      onClick={onClick}
    >
      {point.favorite ? <StarRounded /> : <StarBorderRounded />}
    </button>
  );
}
export default function PointDetails({
  point,
  open,
  busy,
  onClose,
  onFavorite,
  onEdit,
  onDelete,
  onMap,
}: {
  point?: Point;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMap: () => void;
}) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      transitionDuration={reducedMotion ? 0 : 200}
      slotProps={{
        paper: {
          className: 'point-sheet',
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'point-detail-title',
        },
        backdrop: { className: 'sheet-backdrop' },
      }}
    >
      {point && (
        <>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-heading">
            <div>
              <span className="eyebrow">SAVED PLACE</span>
              <h2 id="point-detail-title">{point.title}</h2>
              <span className="city">
                <PlaceRounded />
                {point.municipality || '保存した場所'}
              </span>
            </div>
            <FavoriteButton point={point} disabled={busy} onClick={onFavorite} />
            <button
              className="icon-button"
              disabled={busy}
              aria-label="詳細を閉じる"
              onClick={onClose}
            >
              <CloseRounded />
            </button>
          </div>
          {point.photos.length ? (
            <div className="detail-photos">
              {point.photos.map((photo) => (
                <img key={photo.id} src={photo.url} alt={point.title} />
              ))}
            </div>
          ) : (
            <div className="detail-no-photo">
              <PlaceRounded />
              <span>写真はあとから、ゆっくり。</span>
            </div>
          )}
          <div className="sheet-body">
            <h3>メモ</h3>
            <p className="memo">{point.memo || 'メモはまだありません。あとから追加できます。'}</p>
            <dl>
              <dt>位置</dt>
              <dd>
                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
              </dd>
              <dt>登録日</dt>
              <dd>{new Date(point.createdAt).toLocaleString('ja-JP')}</dd>
            </dl>
          </div>
          <div className="sheet-actions">
            <button className="primary" disabled={busy} onClick={onEdit}>
              <EditOutlined />
              写真・メモを編集
            </button>
            <button disabled={busy} onClick={onMap}>
              <MapOutlined />
              地図で見る
            </button>
            <button className="danger" disabled={busy} onClick={onDelete}>
              <DeleteOutlineRounded />
              削除
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}
