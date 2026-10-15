import { Map } from 'ol';

export function waitForMapRender(map: Map) {
  return new Promise<void>((resolve) => {
    map.once('rendercomplete', () => {      // once 只會監聽並執行一次，隨後自動解除綁定
      resolve();
    });
  });
}

export function waitForMapMoveEnd(map: Map): Promise<void> {
  return new Promise((resolve) => {
    map.once('moveend', () => resolve());
  });
}