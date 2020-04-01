import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {Vector as VectorSource, VectorTile, XYZ, OSM, TileJSON} from 'ol/source';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import Graticule from 'ol/layer/Graticule';
import {Stroke, Text, Fill} from 'ol/style';
import {gpxStyle} from './common';
import { identityTransform } from 'ol/proj';
import layer_conf from './data/layer-conf';
import TileSource from 'ol/source/Tile';

const def_label_style = {
  font: '14px Calibri,sans-serif',
  fill: new Fill({
    color: 'rgba(0,0,0,1)'
  }),
  stroke: new Stroke({
    color: 'rgba(255,255,255,0.5)',
    width: 1
  }),
  backgroundFill: new Fill({
    color: 'rgba(255,255,255,0.5)'
  }),
}

function lonLabelStyle(opt?)
{
  return new Text(Object.assign({
    textBaseline: 'bottom',
  }, def_label_style, opt));
}

function latLabelStyle(opt?)
{
  return new Text(Object.assign({
    textAlign: 'end',
    offsetX: 10,
    offsetY: 0,
  }, def_label_style, opt));
}

function graticule(coordsys){
  const opt = () => {
    switch(coordsys){
      case 'wgs84': return {
          latLabelStyle: latLabelStyle({textBaseline: 'bottom'}),
      };
      case 'wgs84-num': return {
          lonLabelFormatter: lon => lon.toFixed(3),
          latLabelFormatter: lat => lat.toFixed(3),
          latLabelStyle: latLabelStyle({textBaseline: 'top'}),
        };
      case 'twd97': return undefined;
      case 'twd67': return undefined;
      default: `create graticule layer error: unknown coordsys ${coordsys}`;
    }
  }

  return new Graticule(Object.assign({
    // the style to use for the lines, optional.
    strokeStyle: new Stroke({
      color: 'rgba(255,120,0,1)',
      //color: 'rgba(64,64,64,1)',
      width: 2,
      lineDash: [0.5, 4]
    }),
    lonLabelPosition: 0,
    latLabelPosition: 0,
    lonLabelStyle: lonLabelStyle(),
    latLabelStyle: latLabelStyle(),
    showLabels: true,
    wrapX: true,
  }, opt()));
}

function osmLayer(){
  return new TileLayer({
    source: new OSM(),
  });
}

function xyzLayer(url, options?){
  return new TileLayer(Object.assign({
    source: new XYZ({
      url,
    }),
  }, options));
}

function jsonLayer(url, options?){
  return new VectorLayer(Object.assign({
    source: new VectorSource({
      format: new GeoJSON(),
      url
    }),
  }, options));
}

function gpxLayer(url, options?){
  return new VectorLayer(Object.assign({
    source: new VectorSource({
      format: new GPX(/*{
        readExtensions: (x) => { console.log(x); }
      }*/),
      url
    }),
    style: gpxStyle,
  }, options));
}

function conf2layer({legend, type, url})
{
  const opt = legend? {transition: 0}: undefined;
  switch(type){
    case 'osm': return osmLayer();
    case 'xyz': return xyzLayer(url, opt);
    case 'json': return jsonLayer(url);
    case 'gpx': return gpxLayer(url);
    case 'grid': return graticule(url);
    default: throw `unrecognize layer conf type: ${type}`;
  }
}

const layers = {};
layer_conf.forEach(conf => layers[conf.id] = conf2layer(conf));

export default layers;