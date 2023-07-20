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

import { getSymbol } from './sym'
import Opt from './opt';
import { saveTextAsFile } from './lib/dom-utils';

function _toStyleText(text){
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
export const gpxStyle = (feature) => {
  switch (feature.getGeometry().getType()) {
    case 'Point': {
      const name = feature.get('name');
      let sym = feature.get('sym');
      // set default symbol name, although 'sym' (symbol name) is not a mandatory filed for wpt, specifiy one helps wpt edit
      if(!sym){
        sym = 'waypoint';
        feature.set('sym', sym);
      }

      if(sym){
        return new Style({
          image: new IconStyle({
            src: getSymbol(sym).path(128),
            //rotateWithView: true,
            //size: toSize([32, 32]),
            //opacity: 0.8,
            //anchor: sym.anchor,
            scale: 0.25,
          }),
          text: _toStyleText(name),
        });
      }
      // for a wpt without sym specified (but the block of code shoulde be useless now, since a default sym is used always)
      else {
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
          text: _toStyleText(name),
        });
      }
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
  if(coords.length < 3) coords.push(null);  // ele // getElevationByCoords(coords)
  if(coords.length < 4) coords.push(Math.round(new Date().getTime() / 1000));   //time
  return new Feature(Object.assign({
    geometry: new Point(coords),
    name: "WPT",
    sym: "waypoint",
  }, options));
}

export function genGpxText(layers){
  // get wpts and trks features
  const wpts = [];
  const trks = [];
  layers.forEach(layer => {
    layer.getSource().getFeatures().forEach(feature => {
      switch (feature.getGeometry().getType()) {
        case 'Point':
          wpts.push(feature); break;
        case 'MultiLineString':
          trks.push(feature); break;
      }
    });
  });

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
  const xml = node.end({ prettyPrint: true });
  saveTextAsFile(xml, 'your.gpx', 'application/gpx+xml');
  //console.log(xml);
}

// @node is a gpx node
function addGpxMetadata(node, features){
  const [minx, miny, maxx, maxy] = features
    .map(f => f.getGeometry().getExtent())
    .reduce(([minx1, miny1, maxx1, maxy1], [minx2, miny2, maxx2, maxy2]) => {
      return [
        Math.min(minx1, minx2),
        Math.min(miny1, miny2),
        Math.max(maxx1, maxx2),
        Math.max(maxy1, maxy2),
      ];
    }, [Infinity, Infinity, -Infinity, -Infinity]);
  const [minlon, minlat] = toLonLat([minx, miny]);
  const [maxlon, maxlat] = toLonLat([maxx, maxy]);

  return node.ele('metadata')
    .ele('link', { href: 'http://garmin.com' })
      .ele('text').txt("Garmin International").up()
    .up()
    .ele('time').txt(new Date().toISOString()).up()
    .ele('bounds', { maxlat, maxlon, minlat, minlon }).up()
  .up();
}

// @node is a gpx node
function addGpxWaypoints(node, wpts){
  const first_char = /(^\w{1})|(\s+\w{1})/g;
  wpts.forEach(wpt => {
    const [x, y, ele, time ]= wpt.getGeometry().getCoordinates();
    const [lon, lat] = toLonLat([x, y]);
    const name = wpt.get('name');
    const sym = wpt.get('sym');
    const cmt = wpt.get('cmt');
    const desc = wpt.get('desc');

    node = node.ele('wpt', {lat, lon});
    if(ele)  node.ele('ele').txt(ele).up();
    if(time) node.ele('time').txt(new Date(time*1000).toISOString()).up();
    if(name) node.ele('name').txt(name).up();
    if(sym)  node.ele('sym').txt(sym.replace(first_char, c => c.toUpperCase())).up();
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
  trks.forEach(trk => {
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

    trk.getGeometry().getCoordinates().forEach(trkseg => {
      node = node.ele('trkseg');
      trkseg.forEach(trkpt => {
        const [x, y, ele, time ]= trkpt;
        const [lon, lat] = toLonLat([x, y]);
        node = node.ele('trkpt', {lat, lon});
        if(ele)  node.ele('ele').txt(ele).up();
        if(time) node.ele('time').txt(new Date(time*1000).toISOString()).up();
        node = node.up();
      });
      node = node.up();
    });

    node = node.up(); //trk node
  });
  return node;
}