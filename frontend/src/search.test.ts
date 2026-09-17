import { expect, test } from 'vitest';
import { searchPoints } from './search';
import type { Point } from './api';
const points: Point[] = [
  {
    id: 2,
    title: '川沿いのCafe',
    memo: '夕方の散歩',
    municipality: '横浜市',
    favorite: false,
    latitude: 35,
    longitude: 139,
    photos: [],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 1,
    title: '公園',
    memo: 'ＣＡＦＥの近く',
    municipality: '東京都千代田区',
    favorite: true,
    latitude: 35,
    longitude: 139,
    photos: [],
    createdAt: '',
    updatedAt: '',
  },
];
test('matches names, notes and municipalities, ignoring width and Latin letter case', () => {
  expect(searchPoints(points, 'ｃａｆｅ').map((p) => p.id)).toEqual([2, 1]);
  expect(searchPoints(points, '横浜　散歩').map((p) => p.id)).toEqual([2]);
  expect(searchPoints(points, '千代田').map((p) => p.id)).toEqual([1]);
});
test('keeps original order, handles empty query and no matches', () => {
  expect(searchPoints(points, '　 ')).toEqual(points);
  expect(searchPoints(points, '大阪')).toEqual([]);
  expect(searchPoints(points, '公園 散歩')).toEqual([]);
});
