// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import L from 'leaflet';
import MapCanvas from './MapCanvas';
import type { Point, Position } from './api';

let host: HTMLDivElement;
let root: Root;
let resize: () => void;
const originalAny3d = L.Browser.any3d;
const initial = { lat: 35.681236, lng: 139.767125 };
const saved: Point = {
  favorite: false,
  id: 1,
  title: '保存テスト',
  latitude: 35.69,
  longitude: 139.77,
  municipality: '',
  memo: '',
  photos: [],
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // JSDOM has no layout. Model the real 390px map and display:none form transition.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.closest('[hidden]') ? 0 : 390;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.closest('[hidden]') ? 0 : 844;
  });
  Object.defineProperty(L.Browser, 'any3d', { value: true, configurable: true });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  Object.defineProperty(L.Browser, 'any3d', { value: originalAny3d, configurable: true });
  host?.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(
  visible: boolean,
  target: Position,
  points: Point[] = [],
  selectedId?: number
) {
  await act(async () =>
    root.render(
      <div hidden={!visible}>
        <MapCanvas
          visible={visible}
          points={points}
          target={target}
          selectedId={selectedId}
          raised={selectedId !== undefined}
          onPick={() => {}}
          onSelect={() => {}}
        />
      </div>
    )
  );
}

test('saving from a hidden form restores the map and saved pin without a reload', async () => {
  await render(true, initial);
  await act(async () => vi.advanceTimersByTime(600));
  await render(false, initial);
  await act(async () => resize());
  // Save response updates both target and points before ResizeObserver runs again.
  await render(true, { lat: saved.latitude, lng: saved.longitude }, [saved]);
  await act(async () => vi.advanceTimersByTime(600));
  expect(host.querySelector('.leaflet-marker-icon')?.getAttribute('title')).toBe(saved.title);
  expect(host.querySelector('.leaflet-container')).not.toBeNull();
});

test('changing a target while the form is hidden does not animate a zero-size map', async () => {
  await render(true, initial);
  await act(async () => vi.advanceTimersByTime(600));
  await render(false, initial);
  await act(async () => resize());
  const fly = vi.spyOn(L.Map.prototype, 'flyTo');
  const target = { lat: saved.latitude, lng: saved.longitude };
  await render(false, target);
  expect(fly).not.toHaveBeenCalled();
  await render(true, target, [saved]);
  await act(async () => vi.advanceTimersByTime(600));
  expect(host.querySelector('.leaflet-marker-icon')).not.toBeNull();
});

test('highlights only the selected marker and removes the highlight when cleared', async () => {
  const second = { ...saved, id: 2, title: '別の場所' };
  await render(true, initial, [saved, second], saved.id);
  await act(async () => vi.advanceTimersByTime(600));
  expect(host.querySelectorAll('.selected-pin')).toHaveLength(1);
  expect(host.querySelector('.selected-pin')?.getAttribute('title')).toBe(saved.title);
  expect(host.querySelector('.pin-halo')).not.toBeNull();
  await render(true, initial, [saved, second]);
  await act(async () => vi.advanceTimersByTime(600));
  expect(host.querySelector('.selected-pin')).toBeNull();
});
