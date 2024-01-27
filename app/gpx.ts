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
import { getEpochOfCoord, getXYZMOfCoord, colorCode, matchRule } from './common';
import { epochseconds, binsearchIndex } from './lib/utils';
import ArrowHead from './style/ArrowHead';

export const def_trk_color = 'DarkMagenta';
//export const trk_colors = [
//  'White', 'Cyan', 'Magenta', 'Blue', 'Yellow', 'DarkYellow', 'Green', 'Red',
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

function filterOut(values)
{
  //not match if any rule not match
  const notmatch = ['name', 'desc', 'sym'].find((kind)=>{
    const rule = Opt.filter.wpt[kind];
    return rule.enabled && !matchRule(rule, values[kind]);
  });
  return notmatch;
}

const feat_prop = (feature, key, def_value?) => {
  const value = feature.get(key);
  if(!value && def_value){
    feature.set(def_value);
    return def_value;
  }
  return value;
}

const wpt_style = feature => {
  const has_bg = !!feat_prop(feature, 'image');
  const name = feat_prop(feature, 'name');
  const desc = feat_prop(feature, 'desc');
  const sym =  feat_prop(feature, 'sym', def_symbol.name); // set default symbol name if none. Although 'sym' is not a mandatory node for wpt, having one helps ui display for edit.

  if(filterOut({
    name: name.toLowerCase(),  //for caseignore
    desc: desc.toLowerCase(),
    sym:  sym.toLowerCase(),
  }))
    return null;

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

const arrow_head_style_gen = (color) => {
  const sqrt3 = 1.7320508075688772;
  const shaft_width = 3;                                 // this is the width of track line
  const radius = Math.max(1, Math.round(Opt.zoom/1.5));  // enlarge when zoom in

  const fill =  new Fill({
    color: colorCode(color),
  });

  const stroke = new Stroke({
    color: colorCode(outline_color(color)),
    width: 1,
    lineDash: [(sqrt3+1)*radius - (shaft_width/sqrt3), 2*sqrt3], // add outline, except the part to join the shaft
  });

  return (start, end) => new Style({
    geometry: new Point(end),
    image: new ArrowHead({    // like ➤ , head up
      points: 3,
      radius,
      fill,
      stroke,
      rotateWithView: true,
      rotation: arrow_head_rad(start, end),
    }),
    zIndex: 4,
  });
}

const track_line_style = color => {
  return new Style({
    stroke: new Stroke({
      color: colorCode(color),
      width: 3
    }),
    zIndex: 3,
  });
}

const track_styles = feature => {
  const color = (feature.get('color') || def_trk_color).toLowerCase();
  const styles = [track_line_style(color)];

  //let { interval, max_num: arrow_num } = Opt.track.arrow;
  const arrow_num = Opt.track.arrow.max_num;
  const begin = 15;   // show arrows in the very ends seems useless, so skip it.
  const min_step = 20;
  if(arrow_num > 0){
    const arrow_head_style = arrow_head_style_gen(color);
    feature.getGeometry().getLineStrings().forEach(trkseg => {
      const coords = trkseg.getCoordinates();
      for(let i of genSequence(begin, coords.length, arrow_num, min_step))
        styles.push(arrow_head_style(coords[i-1], coords[i]));
    });
  }
  return styles;
}

// generate integer sequence from [first, end)
// if possible, pick the ends at first.
// @first, @end, @num should be integer
function genSequence(first, end, num, min_step)
{
  const last = end - 1;
  if(num <= 0) return [];
  if(num == 1) return [last];
  if(last < first) return [last];   // !! special case

  const seq = [];
  const step = Math.max(1, Math.max(min_step, (last - first) / (num - 1)));  // step >= 1
  for(let i = first; i < end; i += step)   // !! may have float number round-off error, use '< end', not '<= last'
    seq.push(Math.min(Math.round(i), last));

  // correct the last, may be caused by float number round-off error
  const diff = last - seq[seq.length - 1];
  if(diff > 0){
    if(diff <= 1 || seq.length >= num)
      seq[seq.length - 1] = last;
    else
      seq.push(last);
  }
  return seq;
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
    case 'Yellow':      return 'DarkYellow';
    case 'DarkYellow':  return 'Yellow';
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
  const time = getEpochOfCoord(coord);
  const layout = track.getGeometry().getLayout();
  const trksegs = track.getGeometry().getCoordinates();

  const point = (time && layout.endsWith('M'))?
      getTrkptIndicesByTime(trksegs, time):
      getTrkptIndicesByCoord(trksegs, coord);
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

export function getTrkptIndicesByTime(trksegs, time)
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

export function getTrkptIndicesByCoord(trksegs, coord)
{
  for(let i = 0; i < trksegs.length; ++i){
    const j = trksegs[i].findIndex(c => xy_equals(c, coord));
    if(j >= 0)
      return [i, j];
  }
  return null;
}

// only check the ends of the trkseg
export function getTrkptIndicesAtEnds(trksegs, coord)
{
    for(let i = 0; i < trksegs.length; i++){
      const trkseg = trksegs[i];
      if(xy_equals(trkseg[0], coord)) return [i, 0];
      const j = trkseg.length -1;
      if(xy_equals(trkseg[j], coord)) return [i, j];
    }
    return null;
}

function splitTrksegs(trksegs, point){
  const [i, j] = point;
  const trksegs1 = trksegs.slice(0, i);
  const trksegs2 = trksegs.slice(i+1);
  trksegs1.push(trksegs[i].slice(0, j+1));
  trksegs2.unshift(trksegs[i].slice(j));   // duplicate the trkpt
  return [trksegs1, trksegs2];
}
//----------------------------------------------------------------

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
/*
export function olGpxLayer(source_props?, layer_props?){
    return new VectorLayer(Object.assign({
      source: new VectorSource(Object.assign({
        format: new GPXFormat(),
      }, source_props)),
      style: gpx_style,
    }, layer_props));
}
*/

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

export class GpxLayer extends VectorLayer<VectorSource>{
  static mkCrosshairWpt(coords, options?){
    return olWptFeature(coords, Object.assign({
      name: '',
      sym: getSymbol('crosshair').name,
    }, options));
  }

  _crosshair_wpt;

  public constructor(options?){
    options = options || {};
    options.style = options.style || gpx_style;
    options.source = options.source || new VectorSource();
    super(options);
  }

  public addWaypoint(wpt)    { this.getSource().addFeature(wpt);}
  public removeWaypoint(wpt) { this.getSource().removeFeature(wpt);}
  public addTrack(trk)       { this.getSource().addFeature(trk);}
  public removeTrack(trk)    { this.getSource().removeFeature(trk);}

  public createWaypoint(coord, options?){
    this.addWaypoint(olWptFeature(coord, options));
  }

  public getWaypoints() {
    return this.getSource().getFeatures().filter(isWptFeature).map(f => f as Feature<Point>);
  }

  public getTracks() {
    return this.getSource().getFeatures().filter(isTrkFeature).map(f => f as Feature<MultiLineString>);
  }

  /*
  private getWptsTrks(){
    return this.getSource().getFeatures().reduce((result,feature) => {
      const idx = isWptFeature(feature)? 0:
                  isTrkFeature(feature)? 1: -1;
      if(idx >= 0)
        result[idx].push(feature);
      return result;
    }, [[],[]]);
  }
  */

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
    const trksegs = trk.getGeometry().getCoordinates();
    const idx = getTrkptIndicesAtEnds(trksegs, coord);
    if(!idx) return false;

    let [i, j] = idx;
    // track head
    if(i == 0 && j == 0) {
        console.debug('track join the previous');
        const prev = this.findPreviousTrack(coord);
        if(prev)
          return this.joinTracks(prev, trk);    // !! return to indicate whether @trk is removed !!
    }
    // track tail
    else if(i == trksegs.length - 1 && j > 0){    // assert j == trksegs[i].length - 1
        console.debug('track join the next');
        const next = this.findNextTrack(coord);
        if(next)
          this.joinTracks(trk, next);
    }
    // in the middle
    else{
      if(j == 0) --i;  // this head is the last tail
      console.debug(`track join trksegs [${i}, ${i+2})`);
      joinTrksegs(trk, i, i+2)
    }
    return false;
  }

  private findPreviousTrack(coord)
  {
    let prev = undefined;
    let prev_dist = Infinity;
    const time = getEpochOfCoord(coord);
    for (const trk of this.getTracks()) {
      const last = trk.getGeometry().getLastCoordinate();
      //check the timing
      const last_time = getEpochOfCoord(last);
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
    const time = getEpochOfCoord(coord);
    for (const trk of this.getTracks()) {
      const first = trk.getGeometry().getFirstCoordinate();
      //check the timing
      const first_time = getEpochOfCoord(first);
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

  public promoteTrksegs(){
    this.getTracks()
      .filter(trk => trk.getGeometry().getCoordinates().length > 1)
      .flatMap(trk => {
        const trksegs = trk.getGeometry().getCoordinates();
        const layout = trk.getGeometry().getLayout();
        const name = trk.get('name') || '';
        let color = trk.get('color') || def_trk_color;

        // reset the orginal track
        trk.getGeometry().setCoordinates([trksegs.shift()]);
        trk.set('name', `${name}-1`);
        trk.set('color', color);

        //split out other tracks
        return trksegs.map((seg, i) => {
          color = companionColor(color);
          return olTrackFeature({
            coordinates: [seg],
            layout,
          }, {
            name: `${name}-${i+2}`,
            color,
          });
        });
      })
      .forEach(trk => this.addTrack(trk));
  }

  public genXml(){
    const node = createGpxNode(
      this.getWaypoints(),
      this.getTracks()
    );
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