'use strict';

export function partition(array, cond_fn) {
  const [pos, neg] = [[], []];
  array.forEach(elem => {
    cond_fn(elem)? pos.push(elem): neg.push(elem);
  });
  return [pos, neg];
}
