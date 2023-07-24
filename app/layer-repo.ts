import {Tile as TileLayer, Vector as VectorLayer, Layer} from 'ol/layer';
import {Vector as VectorSource, VectorTile, XYZ, OSM, TileJSON} from 'ol/source';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import {Stroke, Text, Fill} from 'ol/style';
import Graticule from 'ol/layer/Graticule';

import BiMap from 'bidirectional-map';

import { mkGpxLayer } from './gpx';
import Confs from './data/layer-conf';

const def_label_style = {
  font: '15px Calibri,sans-serif',
  fill: new Fill({
    color: 'rgba(0,0,0,1)'
  }),
  stroke: new Stroke({
    color: 'rgba(255,255,255,0.7)',
    width: 5,
  }),
  /* //seem not work?
  backgroundFill: new Fill({
    color: 'rgba(255,255,255,0.7)',
  }),
  */
  padding: [-1, 0, -2, 0],
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
    textAlign: 'left',
    offsetX: 5,
    offsetY: 0,
  }, def_label_style, opt));
}

function graticule(coordsys) {
  const def_opt = {
    strokeStyle: new Stroke({
      //color: 'rgba(255,120,0,1)',
      color: 'rgba(64,64,64,1)',
      width: 2,
      lineDash: [0.5, 4]
    }),
    lonLabelPosition: 0,
    latLabelPosition: 0,
    lonLabelStyle: lonLabelStyle(),
    latLabelStyle: latLabelStyle(),
    showLabels: true,
    maxLines: 20,
    wrapX: true,
  };

  const tm2_label_formatter = n => {
    const s = Math.floor(n).toString();
    return s.slice(0, -3) + ' ' + s.slice(-3);
  }

  const def_tm2_opt = {
      intervals: [100000, 10000, 1000, 100, 10, 1],
      lonLabelFormatter: tm2_label_formatter,
      latLabelFormatter: tm2_label_formatter,
      targetSize: 80,
  };

  switch (coordsys) {
    case 'wgs84': return new Graticule(Object.assign(def_opt, {
      latLabelStyle: latLabelStyle({ textBaseline: 'top' }),
    }));
    case 'wgs84-num': return new Graticule(Object.assign(def_opt, {
      lonLabelFormatter: lon => lon.toFixed(3),
      latLabelFormatter: lat => lat.toFixed(3),
      latLabelStyle: latLabelStyle({ textBaseline: 'bottom' }),
      lonLabelStyle: lonLabelStyle({ offsetY: -16 }),
    }));
    case 'twd67': return new Graticule(Object.assign(def_opt, def_tm2_opt, {
      gridProjection: 'EPSG:3828',  //TWD67
    }));
    case 'twd97': return new Graticule(Object.assign(def_opt, def_tm2_opt, {
      gridProjection: 'EPSG:3826',  //TWD97
    }));
    default: throw `create graticule layer error: unknown coordsys ${coordsys}`;
  }

}

function osmLayer(){
  return new TileLayer({
    source: new OSM(),
  });
}

function xyzLayer(url, urls, options?){
  return new TileLayer(Object.assign({
    source: new XYZ({
      url,
      urls,
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
  return mkGpxLayer({url}, options)
  /*
  return new VectorLayer(Object.assign({
    source: new VectorSource({
      format: new GPXFormat(),
      url
    }),
    style: gpxStyle,
  }, options));
  */
}

function mkLayer({legend, type, url, urls})
{
  const opt = legend? {transition: 0}: undefined;
  switch(type){
    case 'osm': return osmLayer();
    case 'xyz': return xyzLayer(url, urls, opt);
    case 'json': return jsonLayer(url);
    case 'gpx': return gpxLayer(url);
    case 'grid': return graticule(url);
    default: throw `unrecognize layer conf type: ${type}`;
  }
}

//////////////////////////////////////////////////////////////////////

const _layers = new BiMap();   // id <-> layer

export function createByConf(conf) {
  const layer = mkLayer(conf);
  _layers.delete(conf.id);
  _layers.set(conf.id, layer);
  return layer;
}

//lazy initialization for _layers
export function get(id){
  let layer = _layers.get(id);
  if(layer) return layer;

  //try to get layer from conf
  const conf = getConf(id);
  if(conf) return createByConf(conf);

  console.error(`get layer error: layer ${id} unconfiguration.`)
  return undefined;
}

export function getId(layer){
  return _layers.getKey(layer);
}

export function getConf(id){
  return Confs.find(conf => conf.id == id);
}

