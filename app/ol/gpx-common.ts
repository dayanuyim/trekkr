import { Feature } from 'ol';
import { MultiLineString, Point } from 'ol/geom';

import { def_symbol } from '../sym'
import { getXYZMOfCoord } from '../common';
import { epochseconds, binsearchIndex } from '../lib/utils';

export const def_trk_color = 'DarkMagenta';
//export const trk_colors = [
//  'White', 'Cyan', 'Magenta', 'Blue', 'Yellow', 'DarkYellow', 'Green', 'Red',
//  'DarkGray', 'LightGray', 'DarkCyan', 'DarkMagenta', 'DarkBlue', 'DarkGreen', 'DarkRed', 'Black'
//];

export function isWptFeature(feature){
  return feature.getGeometry().getType() == 'Point';
}

export function isTrkFeature(feature){
  return feature.getGeometry().getType() == 'MultiLineString';
}

//----------------------------------------------------------------

//@coords is openlayer coords [x, y, ele, time], ele and tiem is optional.
export function olWptFeature(coords, options?){
  coords = getXYZMOfCoord(coords);
  if(!coords[3]) coords[3] = epochseconds(new Date());
  return new Feature(Object.assign({
    geometry: new Point(coords),
    name: "WPT",
    sym: def_symbol.name,
  }, options));
}

export function olTrackFeature({coordinates, layout}, {name, color}, options?){
  return new Feature(Object.assign({
    geometry: new MultiLineString(coordinates, layout),
    name,
    color,
  }, options));
}

//----------------------------------------------------------------

const time_of = (coord) => coord[coord.length - 1];
const time_eq = (coord, time) => coord[coord.length -1] === time;
const xy_eq = (coord, xy) => coord[0] === xy[0] && coord[1] === xy[1];

// track: array of trksegs
// trkseg: array of trkseg
// trkseg: array of coords
// coords: [x, y, (z), (m)]
export function getTrkptIndices(trksegs, options){
  const {coord, time, atends} = options;
  if(atends){
    return coord?
      getTrkptIndicesAtEnds(trksegs, coord, xy_eq):
      getTrkptIndicesAtEnds(trksegs, time, time_eq);
  }
  else{
    return coord?
      getTrkptIndicesByCoord(trksegs, coord):
      getTrkptIndicesByTime(trksegs, time);
  }
}

// only check the ends of the trkseg
function getTrkptIndicesAtEnds(trksegs, value, eq)
{
    for(let i = 0; i < trksegs.length; i++){
      const trkseg = trksegs[i];
      for(let j = 0; j < trkseg.length; j += trkseg.length-1)   // the fist and the last
        if(eq(trkseg[j], value)) return [i, j];
    }
    return [-1, -1];
}

// TODO: seems no efficient way...should get the info from ol...
// cannot use binary search here, because the track may go to and back...
function getTrkptIndicesByCoord(trksegs, coord)
{
  for (let i = 0; i < trksegs.length; ++i) {
    const trkseg = trksegs[i];
    const j = trkseg.findIndex(c => xy_eq(c, coord));
    if (j >= 0)
      return [i, j];
  }
  return [-1, -1];
}

// optimize by binary search
function getTrkptIndicesByTime(trksegs, time)
{
  for(let i = 0; i < trksegs.length; ++i){
    const trkseg = trksegs[i];
    if(!(time_of(trkseg[0]) <= time && time <= time_of(trkseg[trkseg.length-1])))
      continue;

    const j = binsearchIndex(trkseg, (coord, idx, arr) => {
      const t = time_of(coord);
      return (time >= t) ? (time - t) :             // return 0 if time == time_of(coord)
             (time > time_of(arr[idx - 1])) ? 0 : -1; // return 0 if time < time_of(coord) and time > time_of(the-last-coord)
    });
    return [i, j];
  }
  return [-1, -1];
}