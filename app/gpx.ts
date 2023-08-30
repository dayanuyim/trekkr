/****************************************************************
 * GPX Related Operations in Openlayers.
 * A GPX layer is a Vector Layer with Vector Source.
 * A Vector Source can be 
 *      1) url with GPX format or
 *      2) features (manually created or parsed by GPX Format)
 ***************************************************************/

import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Icon as IconStyle, Circle as CircleStyle, RegularShape, Fill, Stroke, Style, Text } from 'ol/style';
import { GPX } from 'ol/format';
import { Feature } from 'ol';
import { Geometry, MultiLineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { create as createXML } from 'xmlbuilder2';

import Opt from './opt';
import { def_symbol, getSymbol, matchRules } from './sym'
import { getEpochOfCoords, getXYZMOfCoords } from './common';
import { epochseconds, binsearchIndex } from './lib/utils';

export const def_trk_color = 'DarkMagenta';
//export const trk_colors = [
//  'White', 'Cyan', 'Magenta', 'Blue', 'Yellow', 'Green', 'Red',
//  'DarkGray', 'LightGray', 'DarkCyan', 'DarkMagenta', 'DarkBlue', 'DarkGreen', 'DarkRed', 'Black'
//];

// Waypoint Style ----------------------------------------------------------------

function wpt_name_style(text)
{
  let {fontsize, display, display_auto_zoom} = Opt.waypoint;
  fontsize = fontsize || 16;

  if(display == "none" ||
    (display == "auto" && Opt.zoom <= display_auto_zoom))
    return null;

  return new Text({
    text,
    textAlign: 'left',
    offsetX: 8,
    offsetY: -8,
    font: `normal ${fontsize}px "Noto Sans TC", "Open Sans", "Arial Unicode MS", "sans-serif"`,
    placement: 'point',
    fill: new Fill({color: '#fff'}),
    stroke: new Stroke({color: '#000', width: 2}),
  });
}

const white_circle_style = new Style({
  image: new CircleStyle({
    fill: new Fill({
      color: 'rgba(255,255,255,0.4)'
    }),
    radius: 20,
    stroke: new Stroke({
      color: '#f0f0f0',
      width: 1
    })
  }),
  zIndex: 8,
});


function _wpt_style(name, sym, bg?)
{
  if(!sym){
    return new Style({
      image: new CircleStyle({
        fill: new Fill({
          color: 'rgba(255,255,0,0.4)'
        }),
        radius: 5,
        stroke: new Stroke({
          color: '#ff0',
          width: 1
        })
      }),
      text: wpt_name_style(name),
      zIndex: 9,
    });
  }

  const sym_style = new Style({
    image: new IconStyle({
      src: getSymbol(sym).path(128),
      //rotateWithView: true,
      //size: toSize([32, 32]),
      //opacity: 0.8,
      //anchor: sym.anchor,
      scale: 0.25,
    }),
    text: wpt_name_style(name),
    zIndex: 9,
  });

  return bg? [white_circle_style, sym_style]: sym_style;
}

const wpt_style = feature => {
  const has_bg = !!feature.get('image');
  const name = feature.get('name');
  let sym = feature.get('sym');
  // set default symbol name if none. Although 'sym' is not a mandatory node for wpt, having one helps ui display for edit.
  if (!sym) {
    sym = def_symbol.name;
    feature.set('sym', sym);
  }
  return _wpt_style(name, sym, has_bg);
}

// Track Style ----------------------------------------------------------------
const outline_color = (color) => {
  switch(color){
    case 'lightgray': return '#ededed';
    default: return 'lightgray';
  }
}

// the math from: https://openlayers.org/en/latest/examples/line-arrows.html
const arrow_head_rad = (start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const rotation = Math.atan2(dy, dx);
  return Math.PI/2 - rotation;
}

const arrow_head_style = (start, end, color) => {
  const radius = Opt.track.arrow.radius;
  return new Style({
    geometry: new Point(end),
    image: new RegularShape({    // regular triangle, like ▲
      points: 3,
      radius,
      fill: new Fill({ color }),
      stroke: new Stroke({
        color: outline_color(color),
        width: 1,
        lineDash: [radius * 1.732],   // only for lateral sides, no buttom line, like /▲\
      }),
      rotateWithView: true,
      rotation: arrow_head_rad(start, end),
    }),
    zIndex: 4,
  });
}

const track_line_style = color => {
    return new Style({
      stroke: new Stroke({
        color,
        width: 3
      }),
      zIndex: 3,
    });
}

const track_styles = feature => {
    const color = (feature.get('color') || def_trk_color).toLowerCase();
    const styles = [track_line_style(color)];

    let { interval, max_num: arrow_num } = Opt.track.arrow;
    if(arrow_num > 0){
      feature.getGeometry().getLineStrings().forEach(linestr => {   //for each trkpt
        const seg_num = linestr.getCoordinates().length - 1;
        interval = Math.max(interval, Math.round(seg_num / arrow_num));
        let idx = 0;
        linestr.forEachSegment((start, end) => {
          if(idx % interval == 0 || idx == seg_num -1)
            styles.push(arrow_head_style(start, end, color));
          ++idx;
        });
      });
    }
    return styles;
}


// ----------------------------------------------------------------------------
// @not really use, just for in case
const route_style = (feature) => {
  return new Style({
    stroke: new Stroke({
      color: '#f00',
      width: 3
    }),
    zIndex: 5,
  });
}

// ----------------------------------------------------------------------------
const empty_style = new Style();

export const gpx_style = (feature) => {
  switch (feature.getGeometry().getType()) {
    case 'Point':           return wpt_style(feature);
    case 'MultiLineString': return track_styles(feature);
    case 'LineString':      return route_style(feature);
    default:                return empty_style;  //for fallback
  }
};

// ============================================================================

// GPX format which reads extensions node
export class GPXFormat extends GPX {
  constructor(options?){
    super(Object.assign({
      readExtensions: (feat, node) => {
        //set color for track if any
        if(node && isTrkFeature(feat)) {
          const color = this._getTrackColor(node);
          feat.set('color', color);
        }
      },
    }, options));
  }

  _getTrackColor(extensions) {
    let color = null;
    if (extensions) {
      extensions.childNodes.forEach((ext) => {
        if (ext.nodeName == "gpxx:TrackExtension") {
          ext.childNodes.forEach((attr) => {
            if (attr.nodeName == "gpxx:DisplayColor") {
              color = attr.textContent;
            }
          });
        }
      });
    }
    return color;
  }
}

//----------------------------------------------------------------

function companionColor(color){
  switch(color){
    case 'White':       return 'Black';
    case 'LightGray':   return 'DarkGray';
    case 'DarkGray':    return 'LightGray';
    case 'Black':       return 'White';
    case 'Yellow':      return 'Green';   //any others
    case 'Magenta':     return 'DarkMagenta';
    case 'DarkMagenta': return 'Magenta';
    case 'Cyan':        return 'DarkCyan';
    case 'DarkCyan':    return 'Cyan';
    case 'Blue':        return 'DarkBlue';
    case 'DarkBlue':    return 'Blue';
    case 'Green':       return 'DarkGreen';
    case 'DarkGreen':   return 'Green';
    case 'Red':         return 'DarkRed';
    case 'DarkRed':     return 'Red';
    default:            return companionColor(def_trk_color);
  }
}
//----------------------------------------------------------------
// The fuction works only when @coord is a trkpt in the @track.
export function splitTrack(track, coord)
{
  const time = getEpochOfCoords(coord);
  const layout = track.getGeometry().getLayout();
  const trksegs = track.getGeometry().getCoordinates();

  const point = (time && layout.endsWith('M'))?
      getSplitTrkptByTime(trksegs, time):
      getSplitTrkptByCoord(trksegs, coord);
  if(!point){
    console.error('cannot find the split point by coord', coord);
    return null;
  }
  const [i, j] = point;
  if(j == 0 || j == trksegs[i].length -1){
    console.error('cannot split at the first or the last of a trkseg');
    return null;
  }

  const [trksegs1, trksegs2] = splitTrksegs(trksegs, point);
  track.getGeometry().setCoordinates(trksegs1); // reset the current track
  return olTrackFeature({                      // create the split-out track
    coordinates: trksegs2,
    layout,
  },{
    name: (track.get('name') || '') + '-2',
    color: companionColor(track.get('color')),
  })
}

function getSplitTrkptByTime(trksegs, time)
{
  const time_of = (coords) => coords[coords.length - 1];

  for(let i = 0; i < trksegs.length; ++i){
    const trkseg = trksegs[i];
    if(!(time_of(trkseg[0]) <= time && time <= time_of(trkseg[trkseg.length-1])))
      continue;
    const idx = binsearchIndex(trkseg, (coords, i, arr) => {
      const t = time_of(coords);
      return (time >= t) ? (time - t) :
        (time > time_of(arr[i - 1])) ? 0 : -1; // i should be larger than 0 here
    });
    return [i, idx];
  }
  return null;
}

function getSplitTrkptByCoord(trksegs, coord)
{
  const [x0, y0] = coord;
  for(let i = 0; i < trksegs.length; ++i){
    const j = trksegs[i].findIndex(([x, y]) => (x0 === x && y0 === y));
    if(j >= 0) return [i, j];
  }
  return null;
}

function splitTrksegs(trksegs, point){
  const [i, j] = point;
  const trksegs1 = trksegs.slice(0, i);
  const trksegs2 = trksegs.slice(i+1);
  trksegs1.push(trksegs[i].slice(0, j+1));  //duplicate the coordinates at j
  trksegs2.unshift(trksegs[i].slice(j))
  return [trksegs1, trksegs2];
}
//----------------------------------------------------------------

// return: where: 0 means HEAD, - measn TAIL
export function findIndexIfIsEndPoint(trksegs, coord)
{
  let idx = trksegs.findIndex(trkseg => xy_equals(coord, trkseg.getFirstCoordinate()));
  if(idx >= 0) return {idx, where: 0}

  idx = trksegs.findIndex(trkseg => xy_equals(coord, trkseg.getLastCoordinate()));
  if(idx >= 0) return {idx, where: -1};

  return { idx: -1, where: null}
}

// join the trksegs [begin, end) of @trk
export function joinTrksegs(trk, begin, end){
  const trksegs = trk.getGeometry().getCoordinates();
  if(0 <= begin && begin < end && end <= trksegs.length) {
    //join [begin, end) to a new trkseg
    const seg = trksegs.slice(begin, end).reduce((result, s) => result.concat(s), []);

    //new trksegs
    let segs = trksegs.slice(0, begin);
    segs.push(seg);
    segs = segs.concat(trksegs.slice(end));

    //reset
    trk.getGeometry().setCoordinates(segs);
  }
}

function distance2(c1, c2){
  const [x1, y1] = c1;
  const [x2, y2] = c2;
  const d1 = x2 - x1;
  const d2 = y2 - y1;
  return d1*d1 + d2*d2;
}

const xy_equals = ([x1, y1], [x2, y2]) => (x1 === x2 && y1 === y2);
//----------------------------------------------------------------

// @source_props should contain 'features' or 'url' for local-drag-n-drop or remote gpx files.
// no @source_props results an empty gpx layer.
export function olGpxLayer(source_props?, layer_props?){
    return new VectorLayer(Object.assign({
      source: new VectorSource(Object.assign({
        format: new GPXFormat(),
      }, source_props)),
      style: gpx_style,
    }, layer_props));
}

//@coords is openlayer coords [x, y, ele, time], ele and tiem is optional.
export function olWptFeature(coords, options?){
  coords = getXYZMOfCoords(coords);
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

export function setSymByRules(wpt: Feature<Point>) {
  const symbol = matchRules(wpt.get('name'));
  if (symbol) wpt.set('sym', symbol.name);
}

function isCrosshairWpt(feature){
  return !feature.get('name') && feature.get('sym') == getSymbol('crosshair').name;
}

export function isWptFeature(feature){
  return feature.getGeometry().getType() == 'Point' &&
          !isCrosshairWpt(feature); //!! filter out the Crosshair wpt !!
}

export function isTrkFeature(feature){
  return feature.getGeometry().getType() == 'MultiLineString';
}

export class GpxLayer {
  static mkCrosshairWpt(coords, options?){
    return olWptFeature(coords, Object.assign({
      name: '',
      sym: getSymbol('crosshair').name,
    }, options));
  }

  _layer;
  _crosshair_wpt;
  get underlying() { return this._layer; }

  public constructor(layer: VectorLayer<VectorSource<Geometry>>){
    this._layer = layer;
  }

  //////////////////////////////////////
  public getSource() { return this._layer.getSource(); }
  //////////////////////////////////////

  public addWaypoint(wpt)    { this.getSource().addFeature(wpt);}
  public removeWaypoint(wpt) { this.getSource().removeFeature(wpt);}
  public addTrack(trk)       { this.getSource().addFeature(trk);}
  public removeTrack(trk)    { this.getSource().removeFeature(trk);}

  public createWaypoint(coord, options?){
    this.addWaypoint(olWptFeature(coord, options));
  }

  public getWaypoints() {
    return this._layer.getSource().getFeatures().filter(isWptFeature);
  }

  public getTracks() {
    return this._layer.getSource().getFeatures().filter(isTrkFeature);
  }

  private getWptsTrks(){
    return this._layer.getSource().getFeatures().reduce((result,feature) => {
      const idx = isWptFeature(feature)? 0:
                  isTrkFeature(feature)? 1: -1;
      if(idx >= 0)
        result[idx].push(feature);
      return result;
    }, [[],[]]);
  }

  public setCrosshairWpt(coord){
    //remove the old
    if(this._crosshair_wpt && isCrosshairWpt(this._crosshair_wpt))
      this.removeWaypoint(this._crosshair_wpt);
    //add the new
    this._crosshair_wpt = GpxLayer.mkCrosshairWpt(coord);
    this.addWaypoint(this._crosshair_wpt);
    return this._crosshair_wpt;
  }

  public findWaypoint(time){
    const time_of = (coords) => coords[coords.length - 1];
    return this.getWaypoints()
            .filter(feature => feature.getGeometry().getLayout().endsWith('M'))         // has time element
            .find(feature => time_of(feature.getGeometry().getCoordinates()) == time);  // exactly match
  }

  public estimateCoord(time) {
    //*/
    return this.getTracks()
      .map(trk => trk.getGeometry().getCoordinateAtM(time))
      .find(coords => !!coords);       //return the first, otherwise undefined
    /*/
    const time_of = (coords) => coords[coords.length - 1];
    return this.getTracks()
      .map(trk => trk.getGeometry())                        // get geom
      .filter(geom => geom.getLayout().endsWith('M'))       // has time element
      .flatMap(geom => geom.getCoordinates())               // cooordinates is the array of trekseg
      .filter(trkseg => {                                   // time in range
        const first = trkseg[0];
        const last = trkseg[trkseg.length - 1];
        return time_of(first) <= time && time <= time_of(last);
      })
      .map(trkseg => {                                      // interpolation
        //const idx = trkseg.findIndex((coords) => time_of(coords) >= time);
        const idx = binsearchIndex(trkseg, (coords, i, arr) => {
          const t = time_of(coords);
          return (time >= t) ? (time - t) :
            (time > time_of(arr[i - 1])) ? 0 : -1; // i should be larger than 0 here
        });
        // time == time(idx), or time(idx-1) < time < time(idx)
        const right = trkseg[idx];
        if (time_of(right) == time)
          return right;
        const left = trkseg[idx - 1];
        return interpCoords(left, right, time);
      })
      .find(coords => !!coords);       //return the first, otherwise undefined
      //*/
  }

  // return true if @trk is removed after joining, which happends only when @trk is joined to the 'previous' track.
  public joinTrackAt(trk, coord)
  {
    const trksegs = trk.getGeometry().getLineStrings();
    const {idx, where} = findIndexIfIsEndPoint(trksegs, coord);
    if(idx < 0) return false;

    // head end
    if(where == 0) {
      if(idx == 0){
        console.log('track join the previous');
        const prev = this.findPreviousTrack(coord);
        if(prev)
          return this.joinTracks(prev, trk);    // !! return to indicate whether @trk is removed !!
      }
      else{
        console.log(`track join trksegs [${idx-1}, ${idx}]`);
        joinTrksegs(trk, idx-1, idx+1)
      }
    }
    //tail end
    else {
      if(idx == trksegs.length - 1){
        console.log('track join the next');
        const next = this.findNextTrack(coord);
        if(next)
          this.joinTracks(trk, next);
      }
      else{
        console.log(`track join trksegs [${idx}, ${idx+1}]`);
        joinTrksegs(trk, idx, idx+2)
      }
    }
    return false;
  }

  //function inTrksegHead

  private findPreviousTrack(coord)
  {
    let prev = undefined;
    let prev_dist = Infinity;
    const time = getEpochOfCoords(coord);
    for (const trk of this.getTracks()) {
      const last = trk.getGeometry().getLastCoordinate();
      //check the timing
      const last_time = getEpochOfCoords(last);
      if(time && last_time && time < last_time)  //check time if avaialble
        continue;
      const dist = distance2(coord, last);
      if(prev_dist > dist){   //condicate
        prev_dist = dist;
        prev = trk;
      }
    }
    return prev;
  }

  private findNextTrack(coord)
  {
    let next = undefined;
    let next_dist = Infinity;
    const time = getEpochOfCoords(coord);
    for (const trk of this.getTracks()) {
      const first = trk.getGeometry().getFirstCoordinate();
      //check the timing
      const first_time = getEpochOfCoords(first);
      if(time && first_time && time > first_time)  //check time if avaialble
        continue;
      const dist = distance2(coord, first);
      if(next_dist > dist){   //condicate
        next_dist = dist;
        next = trk;
      }
    }
    return next;
  }

  joinTracks(trk1, trk2)
  {
    const first_of = arr => arr[0];
    const last_of = arr => arr[arr.length - 1];

    const trksegs1 = trk1.getGeometry().getCoordinates();
    const trksegs2 = trk2.getGeometry().getCoordinates();

    const seg1 = trksegs1.pop();
    const seg2 = trksegs2.shift();
    if(xy_equals(last_of(seg1), first_of(seg2))) seg1.pop();    //drop the duplicated coord
    trksegs1.push(seg1.concat(seg2));   //note: concat() is NOT in place

    trk1.getGeometry().setCoordinates(trksegs1);
    if(trksegs2.length > 0)
      trk2.getGeometry().setCoordinates(trksegs2);
    else{
      this.removeTrack(trk2);
      return true;   //to indicate trk2 is removed
    }
  }

  public genText(){
    const [wpts, trks ] = this.getWptsTrks();
    const node = createGpxNode(wpts, trks);
    return node.end({ prettyPrint: true, indent: '\t' });
  }

}//class end

function interpCoords(c1, c2, time){
  const t1 = c1[c1.length - 1];
  const t2 = c2[c2.length - 1];
  const ratio = (time - t1) / (t2 - t1)
  const v = (v1, v2) => (v2 - v1) * ratio + v1;

  const x = v(c1[0], c2[0]);
  const y = v(c1[1], c2[1]);
  if(Math.max(c1.length, c2.length) < 4)
    return [x, y, null, time]

  const ele = v(c1[2], c2[2]);
  return [x, y, ele, time]
}

//----------------------- utils for Generating Gpx Text-----------------------------------------//

// decimal degrees 6 ~= 0.1 metres precision, ref https://en.wikipedia.org/wiki/Decimal_degrees
const fmt_coord = (n) => n.toFixed(6);
const fmt_ele = (n) => n.toFixed(1);
const fmt_time = (sec?) => (sec? new Date(sec*1000): new Date()).toISOString().split('.')[0] + 'Z';
const cmp_wpt_time = (w1, w2) => {
  const time = wpt => {
    const coords = wpt.getGeometry().getCoordinates();
    const layout = wpt.getGeometry().getLayout();
    return getEpochOfCoords(coords, layout) || 0;
  };
  return time(w1) - time(w2);
}
const cmp_trk_time = (t1, t2) => {
  const time = trk => {
    const coords = trk.getGeometry().getCoordinates();
    const layout = trk.getGeometry().getLayout();
    if(coords.length > 0 && coords[0].length > 0)
      return getEpochOfCoords(coords[0][0], layout) || 0;  //first trkseg, first trkpt
    return 0;
  }
  return time(t1) - time(t2);
}

// create gpx by wpts and trks
function createGpxNode(wpts, trks){
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
  return node;
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
  wpts.sort(cmp_wpt_time).forEach(wpt => {
    const geom = wpt.getGeometry();
    const [x, y, ele, time] = getXYZMOfCoords(geom.getCoordinates(), geom.getLayout());
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
  trks.sort(cmp_trk_time).forEach(trk => {
    const name = trk.get('name');
    const color = trk.get('color');
    node = node.ele('trk');
    if (name) node.ele('name').txt(name).up();
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
        const [x, y, ele, time] = getXYZMOfCoords(coords, layout);
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