import { Feature } from 'ol';
import { MultiLineString, Point } from 'ol/geom';

import { create as createXML } from 'xmlbuilder2';
import { toLonLat } from 'ol/proj';

import { def_symbol } from '../sym'
import { getXYZMOfCoord, getEpochOfCoord } from '../common';
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

//----------------------- utils for Generating Gpx Text-----------------------------------------//

// decimal degrees 6 ~= 0.1 metres precision, ref https://en.wikipedia.org/wiki/Decimal_degrees
const fmt_coord = (n) => n.toFixed(6);
const fmt_ele = (n) => n.toFixed(1);
const fmt_time = (sec?) => (sec? new Date(sec*1000): new Date()).toISOString().split('.')[0] + 'Z';
const cmp_time = (f1, f2) => {  //for wpt/trk feature
  const time = f => {
    const coord = f.getGeometry().getFirstCoordinate();
    const layout = f.getGeometry().getLayout();
    return getEpochOfCoord(coord, layout) || 0;
  }
  return time(f1) - time(f2);
}
const cmp_name = (f1, f2) => {
  const name = f => f.get('name') || '';
  return name(f1).localeCompare(name(f2));
}
const cmp_feature = (f1, f2) => {
  let cmp = cmp_time(f1, f2);
  if(cmp == 0) cmp = cmp_name(f1, f2);
  return cmp;
}

// create gpx by wpts and trks
export function createGpxText(wpts, trks){
  let node = createXML({ version: '1.0', encoding: "UTF-8" })
    .ele('gpx', {
      creator: "trekkr",
      version: "1.1",
      xmlns: "http://www.topografix.com/GPX/1/1",
      'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
      'xsi:schemaLocation': "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
    });
    addGpxMetadata(node, wpts.concat(trks));
    addGpxWaypoints(node, wpts);
    addGpxTracks(node, trks)
  .up();
  return node.end({ prettyPrint: true, indent: '\t' });
}

// @node is a gpx node
function addGpxMetadata(node, features){
  const bounds = getBounds(features);
  node = node.ele('metadata')
    .ele('link', { href: 'https://dayanuyim.github.io/maps/' })
      .ele('text').txt("Trekkr").up()
    .up()
    .ele('time').txt(fmt_time()).up();
    if (bounds) node.ele('bounds', bounds).up()
  return node.up();
}

function getBounds(features){
  if(features.length == 0)
    return undefined;

  const [minx, miny, maxx, maxy] = features
    .map(f => f.getGeometry().getExtent())
    .reduce(([minx1, miny1, maxx1, maxy1], [minx2, miny2, maxx2, maxy2]) => [
      Math.min(minx1, minx2),
      Math.min(miny1, miny2),
      Math.max(maxx1, maxx2),
      Math.max(maxy1, maxy2),
    ], [Infinity, Infinity, -Infinity, -Infinity]);
  const [minlon, minlat] = toLonLat([minx, miny]).map(fmt_coord);
  const [maxlon, maxlat] = toLonLat([maxx, maxy]).map(fmt_coord);
  return { maxlat, maxlon, minlat, minlon };
}

// @node is a gpx node
function addGpxWaypoints(node, wpts) {
  wpts.sort(cmp_feature).forEach(wpt => {
    const geom = wpt.getGeometry();
    const [x, y, ele, time] = getXYZMOfCoord(geom.getCoordinates(), geom.getLayout());
    const [lon, lat] = toLonLat([x, y]).map(fmt_coord);
    const name = wpt.get('name');
    const sym = wpt.get('sym');
    const cmt = wpt.get('cmt');
    const desc = wpt.get('desc');

    node = node.ele('wpt', { lat, lon });
    if (ele)  node.ele('ele').txt(fmt_ele(ele)).up();
    if (time) node.ele('time').txt(fmt_time(time)).up();
    if (name) node.ele('name').txt(name).up();
    if (sym)  node.ele('sym').txt(sym).up();
    if (cmt)  node.ele('cmt').txt(cmt).up();
    if (desc) node.ele('desc').txt(desc).up();
    /*
    //@@! the extensions has any practical use?
    doc.ele('extensions')
      .ele('gpxx:WaypointExtension', {'xmlns:gpxx': 'http://www.garmin.com/xmlschemas/GpxExtensions/v3'})
        .ele('gpxx:DisplayMode').txt('SymbolAndName').up()
      .up()
    .up();
    */
    node = node.up();
  });
  return node;
}

// @node is a gpx node
function addGpxTracks(node, trks) {
  trks.sort(cmp_feature).forEach(trk => {
    const name = trk.get('name');
    const desc = trk.get('desc');
    const cmt  = trk.get('cmt');
    const color = trk.get('color');

    node = node.ele('trk');
    if (name) node.ele('name').txt(name).up();
    if (desc) node.ele('desc').txt(desc).up();
    if (cmt)  node.ele('cmt').txt(cmt).up();
    if (color)
      node.ele('extensions')
        .ele('gpxx:TrackExtension', { 'xmlns:gpxx': 'http://www.garmin.com/xmlschemas/GpxExtensions/v3' })
          .ele('gpxx:DisplayColor').txt(color).up()
        .up()
      .up();

    const layout = trk.getGeometry().getLayout();
    trk.getGeometry().getCoordinates().forEach(trkseg => {
      node = node.ele('trkseg');
      trkseg.forEach(coords => {
        const [x, y, ele, time] = getXYZMOfCoord(coords, layout);
        const [lon, lat] = toLonLat([x, y]).map(fmt_coord);
        node = node.ele('trkpt', { lat, lon });
        if (ele)  node.ele('ele').txt(fmt_ele(ele)).up();
        if (time) node.ele('time').txt(fmt_time(time)).up();
        node = node.up();
      });
      node = node.up();
    });

    node = node.up(); //trk node
  });
  return node;
}
