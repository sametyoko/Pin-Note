import type { Point } from './api';
export function searchPoints(points: Point[], query: string) {
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('ja-JP');
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return points.filter((point) => {
    const text = normalize(`${point.title} ${point.memo} ${point.municipality}`);
    return terms.every((term) => text.includes(term));
  });
}
