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

import { toSymPath, getSymbol } from './common'
import Opt from './opt';

function _toStyleText(text){
  if(Opt.zoom < 13.5)
    return null;

  return new Text({
    text,
    textAlign: 'left',
    offsetX: 8,
    offsetY: -8,
    font: 'normal 14px "cwTeXYen", "Open Sans", "Arial Unicode MS", "sans-serif"',
    placement: 'point',
    fill: new Fill({color: '#fff'}),
    stroke: new Stroke({color: '#000', width: 2}),
  });
}
export const gpxStyle = (feature) => {
  switch (feature.getGeometry().getType()) {
    case 'Point': {
      const sym = getSymbol(feature.get('sym'));
      const name = feature.get('name');
      if(sym){
        return new Style({
          image: new IconStyle({
            src: toSymPath(sym, 128),
            //rotateWithView: true,
            //size: toSize([32, 32]),
            //opacity: 0.8,
            //anchor: sym.anchor,
            scale: 0.25,
          }),
          text: _toStyleText(name),
        });
      }
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
          const color = this._getTrackColor(node) ;
          if(color) feat.set('color', color);
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
