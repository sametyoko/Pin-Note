import { useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import type { Point, Position } from './api';
import 'leaflet/dist/leaflet.css';
const icon = (draft: boolean) =>
  L.divIcon({
    className: `map-pin ${draft ? 'draft-pin' : ''}`,
    html: renderToStaticMarkup(<PlaceRounded />),
    iconSize: [42, 48],
    iconAnchor: [21, 43],
  });
const savedIcon = icon(false),
  draftIcon = icon(true);
const selectedIcon = L.divIcon({
  className: 'map-pin selected-pin',
  html: renderToStaticMarkup(
    <>
      <span className="pin-halo" />
      <PlaceRounded />
    </>
  ),
  iconSize: [50, 58],
  iconAnchor: [25, 52],
});
function Events({
  target,
  visible,
  raised,
  onPick,
}: {
  target: Position;
  visible: boolean;
  raised: boolean;
  onPick: (p: Position) => void;
}) {
  const map = useMapEvents({ click: (e) => onPick(e.latlng) });
  useEffect(() => {
    map.stop();
    if (!visible) return;
    const container = map.getContainer();
    if (!container.clientWidth || !container.clientHeight) return;
    // display:none can leave Leaflet's cached size at zero until ResizeObserver runs.
    // Refresh it before flyTo, which otherwise calculates invalid coordinates.
    map.invalidateSize({ animate: false, pan: false });
    const zoom = Math.max(map.getZoom(), 15);
    const center = raised
      ? map.unproject(map.project(target, zoom).add([0, container.clientHeight * 0.2]), zoom)
      : target;
    map.flyTo(center, zoom, {
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: 0.5,
    });
  }, [target.lat, target.lng, visible, raised, map]);
  useEffect(() => {
    if (!visible) return;
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      if (container.clientWidth && container.clientHeight) map.invalidateSize({ animate: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [visible, map]);
  return null;
}
export default function MapCanvas({
  points,
  target,
  visible,
  selectedId,
  raised = false,
  draft,
  location,
  onPick,
  onSelect,
}: {
  points: Point[];
  target: Position;
  visible: boolean;
  selectedId?: number;
  raised?: boolean;
  draft?: Position;
  location?: Position & { accuracy: number };
  onPick: (p: Position) => void;
  onSelect: (p: Point) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <MapContainer
        center={target}
        zoom={15}
        zoomControl={false}
        className="map"
        aria-label="保存した場所の地図"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setFailed(true), tileload: () => setFailed(false) }}
        />
        <Events target={target} visible={visible} raised={raised} onPick={onPick} />
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={p.id === selectedId ? selectedIcon : savedIcon}
            zIndexOffset={p.id === selectedId ? 1000 : 0}
            title={p.title}
            alt={p.title}
            eventHandlers={{ click: () => onSelect(p) }}
          />
        ))}
        {draft && (
          <Marker position={draft} icon={draftIcon} title="選択した場所" alt="選択した場所" />
        )}
        {location && (
          <>
            <Circle
              center={location}
              radius={location.accuracy}
              pathOptions={{ color: '#b65a22', weight: 1, fillOpacity: 0.08 }}
            />
            <CircleMarker
              center={location}
              radius={7}
              pathOptions={{ color: 'white', weight: 3, fillColor: '#bd581c', fillOpacity: 1 }}
            />
          </>
        )}
      </MapContainer>
      {failed && (
        <div className="tile-error" role="status">
          地図を読み込めません。ネット接続を確認してください。一覧は引き続き利用できます。
        </div>
      )}
    </>
  );
}
