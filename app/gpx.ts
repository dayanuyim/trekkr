/****************************************************************
 * GPX Related Operations in Openlayers.
 * A GPX layer is a Vector Layer with Vector Source.
 * A Vector Source can be 
 *      1) url with GPX format or
 *      2) features (manually created or parsed by GPX Format)
 ***************************************************************/

import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Icon as IconStyle, Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { GPX } from 'ol/format';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { create as createXML } from 'xmlbuilder2';

import Opt from './opt';
import { def_symbol, getSymbol, matchRules } from './sym'
import { saveTextAsFile } from './lib/dom-utils';
import { getEpochOfCoords, getXYZMOfCoords } from './common';
import { epochseconds, binsearchIndex } from './lib/utils';

function toTextStyle(text){
  if(Opt.zoom < 13.5)
    return null;

  return new Text({
    text,
    textAlign: 'left',
    offsetX: 8,
    offsetY: -8,
    font: 'normal 16px "Noto Sans TC", "Open Sans", "Arial Unicode MS", "sans-serif"',
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
});

function toWptStyle(name, sym, bg?)
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
      text: toTextStyle(name),
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
    text: toTextStyle(name),
  });

  return bg? [white_circle_style, sym_style]: sym_style;
}

export const gpxStyle = (feature) => {
  switch (feature.getGeometry().getType()) {
    case 'Point': {
      const has_bg = !!feature.get('image_url');
      const name = feature.get('name');
      let sym = feature.get('sym');
      if(!sym){ // set default symbol name (although 'sym' is not a mandatory field for wpt, specifiy one helps wpt edit)
        sym = def_symbol.name;
        feature.set('sym', sym);
      }
      return toWptStyle(name, sym, has_bg);
    }
    case 'LineString': {
      return new Style({
        stroke: new Stroke({
          color: '#f00',
          width: 3
        })
      });
    }
    case 'MultiLineString': {
      return new Style({
        stroke: new Stroke({
          color: feature.get('color') || 'DarkMagenta',
          width: 3
        })
      });
    }
  }
};

// GPX format which reads extensions node
export class GPXFormat extends GPX {
  constructor(options?){
    super(Object.assign({
      readExtensions: (feat, node) => {
        //set color for track if any
        if(node && feat.getGeometry().getType() ==  'MultiLineString') {
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

// @source_props should contain 'features' or 'url' for local-drag-n-drop or remote gpx files.
// no @source_props results an empty gpx layer.
export function mkGpxLayer(source_props?, layer_props?){
    return new VectorLayer(Object.assign({
      source: new VectorSource(Object.assign({
        format: new GPXFormat(),
      }, source_props)),
      style: gpxStyle,
    }, layer_props));
}

//@coords is openlayer coords [x, y, ele, time], ele and tiem is optional.
export function mkWptFeature(coords, options?){
  coords = getXYZMOfCoords(coords);
  if(!coords[3]) coords[3] = epochseconds(new Date());
  return new Feature(Object.assign({
    geometry: new Point(coords),
    name: "WPT",
    sym: def_symbol.name,
  }, options));
}

export function findWptFeature(layer, time){
  const time_of = (coords) => coords[coords.length - 1];
  return layer.getSource().getFeatures()
          .filter(feature => feature.getGeometry().getType() == 'Point')              // is wpt
          .filter(feature => feature.getGeometry().getLayout().endsWith('M'))         // has time element
          .find(feature => time_of(feature.getGeometry().getCoordinates()) == time);  // exactly match
}

export function getGpxWpts(layers){
  return layers.flatMap(layer => layer.getSource().getFeatures())
        .filter(feature => feature.getGeometry().getType() == 'Point');
}

export function getGpxTrks(layers){
  return layers.flatMap(layer => layer.getSource().getFeatures())
        .filter(feature => feature.getGeometry().getType() == 'MultiLineString');
}

export function getGpxWptsTrks(layers){
  const wpts = [];
  const trks = [];
  layers.flatMap(layer => layer.getSource().getFeatures()).forEach(feature => {
      switch (feature.getGeometry().getType()) {
        case 'Point':           wpts.push(feature); break;
        case 'MultiLineString': trks.push(feature); break;
      }
  });
  return [wpts, trks];
}

export function genGpxText(layers){
  // get wpts and trks features
  const [wpts, trks ] = getGpxWptsTrks(layers);

  // create gpx by wpts and trks
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

  // convert the XML tree to string
  const xml = node.end({ prettyPrint: true, indent: '\t' });
  saveTextAsFile(xml, 'your.gpx', 'application/gpx+xml');
  //console.log(xml);
}

// decimal degrees 6 ~= 0.1 metres precision, ref https://en.wikipedia.org/wiki/Decimal_degrees
const fmt_coord = (n) => n.toFixed(6);
const fmt_ele = (n) => n.toFixed(1);
const fmt_time = (sec?) => (sec? new Date(sec*1000): new Date()).toISOString().split('.')[0]+'Z';
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

// @node is a gpx node
function addGpxMetadata(node, features){
  const bounds = getBounds(features);
  node = node.ele('metadata')
    .ele('link', { href: 'https://dayanuyim.github.io/maps/' })
      .ele('text').txt("Trekkr").up()
    .up()
    .ele('time').txt(fmt_time()).up();
    if(bounds) node.ele('bounds', bounds).up()
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
function addGpxWaypoints(node, wpts){
  wpts.sort(cmp_wpt_time).forEach(wpt => {
    const geom = wpt.getGeometry();
    const [x, y, ele, time ] = getXYZMOfCoords(geom.getCoordinates(), geom.getLayout());
    const [lon, lat] = toLonLat([x, y]).map(fmt_coord);
    const name = wpt.get('name');
    const sym = wpt.get('sym');
    const cmt = wpt.get('cmt');
    const desc = wpt.get('desc');

    node = node.ele('wpt', {lat, lon});
    if(ele)  node.ele('ele').txt(fmt_ele(ele)).up();
    if(time) node.ele('time').txt(fmt_time(time)).up();
    if(name) node.ele('name').txt(name).up();
    if(sym)  node.ele('sym').txt(sym).up();
    if(cmt)  node.ele('cmt').txt(cmt).up();
    if(desc) node.ele('desc').txt(desc).up();
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
function addGpxTracks(node, trks){
  trks.sort(cmp_trk_time).forEach(trk => {
    const name = trk.get('name');
    const color = trk.get('color');
    node = node.ele('trk');
    if(name) node.ele('name').txt(name).up();
    if(color)
      node.ele('extensions')
        .ele('gpxx:TrackExtension', { 'xmlns:gpxx': 'http://www.garmin.com/xmlschemas/GpxExtensions/v3' })
          .ele('gpxx:DisplayColor').txt(color).up()
        .up()
      .up();

    const layout = trk.getGeometry().getLayout();
    trk.getGeometry().getCoordinates().forEach(trkseg => {
      node = node.ele('trkseg');
      trkseg.forEach(coords => {
        const [x, y, ele, time ]= getXYZMOfCoords(coords, layout);
        const [lon, lat] = toLonLat([x, y]).map(fmt_coord);
        node = node.ele('trkpt', {lat, lon});
        if(ele)  node.ele('ele').txt(fmt_ele(ele)).up();
        if(time) node.ele('time').txt(fmt_time(time)).up();
        node = node.up();
      });
      node = node.up();
    });

    node = node.up(); //trk node
  });
  return node;
}

export function setSymByRules(wpt: Feature<Point>) {
  const symbol = matchRules(wpt.get('name'));
  if (symbol) wpt.set('sym', symbol.name);
}

export function estimateCoords(layer, time){
  const time_of = (coords) => coords[coords.length - 1];

  return layer.getSource().getFeatures()
          .map(feature => feature.getGeometry())                // get geom
          .filter(geom => geom.getType() == 'MultiLineString')  // is track
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
              return (time >= t)? (time - t):
                     (time > time_of(arr[i-1]))? 0: -1; // i should be larger than 0 here
            });
            // time == time(idx), or time(idx-1) < time < time(idx)
            const right = trkseg[idx];
            if(time_of(right) == time)
              return right;
            const left = trkseg[idx -1];
            return interpCoords(left, right, time);
          })
          .find(coords => !!coords);       //return the first, otherwise undefined
}

function interpCoords(c1, c2, time){
  const t1 = c1[c1.length - 1];
  const t2 = c2[c2.length - 1];
  const ratio = (time - t1) / (t2 - t1)
  const v = (v1, v2) => (v2 - v1) * ratio + v1;

  const x = v(c1[0], c2[0]);
  const y = v(c1[1], c2[1]);
  if(Math.min(c1.length, c2.length) == 3)
    return [x, y, null, time]

  const ele = v(c1[2], c2[2]);
  return [x, y, ele, time]
}
