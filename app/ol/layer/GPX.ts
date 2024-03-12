import { Feature } from 'ol';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { MultiLineString, Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { create as createXML } from 'xmlbuilder2';

import GPXStyle from '../style/GPX';
import { def_trk_color, isTrkFeature, isWptFeature, olWptFeature, olTrackFeature, getTrkptIndices } from '../gpx-common';

import { getSymbol } from '../../sym'
import { getEpochOfCoord, getXYZMOfCoord, companionColor } from '../../common';


const xy_equals = ([x1, y1], [x2, y2]) => (x1 === x2 && y1 === y2);

function distance2(c1, c2){
  const [x1, y1] = c1;
  const [x2, y2] = c2;
  const d1 = x2 - x1;
  const d2 = y2 - y1;
  return d1*d1 + d2*d2;
}

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

//----------------------------------------------------------------

function mkCrosshairWpt(coords, options?){
  return olWptFeature(coords, Object.assign({
    name: '',
    sym: getSymbol('crosshair').name,
    pseudo: true,
  }, options));
}

function isCrosshairWpt(feature){
  return !!feature.get('pseudo');
}

//----------------------------------------------------------------

//@coord may be a virtual trkpt, not in the trksegs[i]
function splitTrksegs(trksegs, [i, j], coord){
  const trksegs1 = trksegs.slice(0, i);   // for track1
  const trksegs2 = trksegs.slice(i+1);    // for track2

  const seg1 = trksegs[i].slice(0, j);
  if(!xy_equals(seg1[seg1.length-1], coord))
    seg1.push(coord);

  const seg2 = trksegs[i].slice(j);
  if(!xy_equals(seg2[0], coord))
    seg2.unshift(coord);

  trksegs1.push(seg1);
  trksegs2.unshift(seg2);
  return [trksegs1, trksegs2];
}

// join the trksegs [begin, end) of @trk
function joinTrksegs(trk, begin, end){
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


/****************************************************************
 * GPX Related Operations in Openlayers.
 * A GPX layer is a Vector Layer with Vector Source.
 * A Vector Source can be 
 *      1) url with GPX format or
 *      2) features (manually created or parsed by GPX Format)
 ***************************************************************/

class GPX extends VectorLayer<VectorSource>{
  _crosshair_wpt;
  _interactable;

  set interactable(v){ this._interactable = v; }
  get interactable(){ return this._interactable; }

  public constructor(options?){
    options = options || {};
    options.style = options.style || new GPXStyle();
    options.source = options.source || new VectorSource();

    //subclass options
    const interactable = options.interactable || false;
    delete options.interactable;

    super(options);

    this.interactable = interactable;
  }

  public addWaypoint(wpt)    { this.getSource().addFeature(wpt);}
  public removeWaypoint(wpt) { this.getSource().removeFeature(wpt);}
  public addTrack(trk)       { this.getSource().addFeature(trk);}
  public removeTrack(trk)    { this.getSource().removeFeature(trk);}

  public createWaypoint(coord, options?){
    this.addWaypoint(olWptFeature(coord, options));
  }

  public getWaypoints() {
    return this.getSource().getFeatures()
            .filter(isWptFeature)
            .filter(f => !isCrosshairWpt(f))
            .map(f => f as Feature<Point>);
  }

  public getTracks() {
    return this.getSource().getFeatures()
            .filter(isTrkFeature)
            .map(f => f as Feature<MultiLineString>);
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
    this._crosshair_wpt = mkCrosshairWpt(coord);
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
      .reduce((coord, trk) => coord || trk.getGeometry().getCoordinateAtM(time), undefined);   // return the first if found
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
    const idx = getTrkptIndices(trksegs, {coord, atends: true});
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

  // The fuction works only when @coord is a trkpt in the @track.
  public splitTrack(trk, coord){
    GPX.spawnTracks(trk, (trksegs) => {
      const time = getEpochOfCoord(coord);
      const layout = trk.getGeometry().getLayout();
      const split_by = (time && layout.endsWith('M'))? {time}: {coord};

      const [i, j] = getTrkptIndices(trksegs, split_by);
      if(i < 0 || j < 0)
        return console.error('cannot find the split point by coord', coord);
      if(j == 0 || j == trksegs[i].length -1)
        return console.error('cannot split at the first or the last of a trkseg');

      return splitTrksegs(trksegs, [i, j], coord);
    })
    .forEach(trk => this.addTrack(trk));
  }

  public promoteTrksegs(){
    this.getTracks()
      .filter(trk => trk.getGeometry().getCoordinates().length > 1)
      .flatMap(trk => GPX.spawnTracks(trk, (trksegs) => {
        return trksegs.map(trkseg => [trkseg]);
      }))
      .forEach(trk => this.addTrack(trk));
  }

  // @spawner get trksegs from @trk, then return a array of trksegs, i.g., trksegs_set
  // trksegs_set[0] is used to reset the origianl @trk,
  // trksegs_set[1..n-1] is used to spawn new tracks.
  private static spawnTracks(trk, spawner){
    const trksegs = trk.getGeometry().getCoordinates();
    const trksegs_set = spawner(trksegs);
    if(!Array.isArray(trksegs_set) || trksegs_set.length <= 0){
      console.error("spawnTracks error: bad spawner having no array of trksegs");
      return [];
    }

    const layout = trk.getGeometry().getLayout();
    const name = trk.get('name') || '';
    let color = trk.get('color');
    if(!companionColor(color)) color = def_trk_color;  // if not legal color...

    // reset the orginal track
    trk.getGeometry().setCoordinates(trksegs_set.shift());
    trk.set('name', `${name}-1`);
    trk.set('color', color);

    //spawn other tracks
    return trksegs_set.map((trksegs, i) => {
      color = companionColor(color);
      return olTrackFeature({
        coordinates: trksegs,
        layout,
      }, {
        name: `${name}-${i+2}`,
        color,
      });
    });
  }

  public genXml(){
    const node = createGpxNode(
      this.getWaypoints(),
      this.getTracks()
    );
    return node.end({ prettyPrint: true, indent: '\t' });
  }

}//class end

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

export default GPX;