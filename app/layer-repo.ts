import {Tile as TileLayer, Vector as VectorLayer, Layer} from 'ol/layer';
import {Vector as VectorSource, VectorTile, XYZ, OSM, TileJSON} from 'ol/source';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import {Stroke, Text, Fill} from 'ol/style';

import {gpxStyle} from './common';
import Confs from './data/layer-conf';
import ProjGraticule from './proj-graticule';
import {TWD67, TWD97} from './coord';

const def_label_style = {
  font: '15px Calibri,sans-serif',
  fill: new Fill({
    color: 'rgba(0,0,0,1)'
  }),
  stroke: new Stroke({
    color: 'rgba(255,255,255,0.6)',
    width: 1
  }),
  backgroundFill: new Fill({
    color: 'rgba(255,255,255,0.6)'
  }),
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
    textAlign: 'end',
    offsetX: 10,
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
    case 'wgs84': return new ProjGraticule(Object.assign(def_opt, {
      latLabelStyle: latLabelStyle({ textBaseline: 'top' }),
    }));
    case 'wgs84-num': return new ProjGraticule(Object.assign(def_opt, {
      lonLabelFormatter: lon => lon.toFixed(3),
      latLabelFormatter: lat => lat.toFixed(3),
      latLabelStyle: latLabelStyle({ textBaseline: 'bottom' }),
      lonLabelStyle: lonLabelStyle({ offsetY: -16 }),
    }));
    case 'twd67': return new ProjGraticule(Object.assign(def_opt, def_tm2_opt, {
      projection: TWD67,
    }));
    case 'twd97': return new ProjGraticule(Object.assign(def_opt, def_tm2_opt, {
      projection: TWD97,
    }));
    default: throw `create graticule layer error: unknown coordsys ${coordsys}`;
  }

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

//////////////////////////////////////////////////////////////////////
const _layers = new Map();
const _ids = new Map();

function createInRepo(conf) {
  const layer = conf2layer(conf);
  _layers.set(conf.id, layer);
  _ids.set(layer, conf.id);
  return layer;
}

//lazy initialization for _layers/_ids
export function get(id){
  let layer = _layers.get(id);

  //try to get layer from conf
  if(!layer){
    const conf = Confs.find(conf => conf.id === id);
    if(!conf){
      console.error(`get layer error: layer ${id} unconfiguration.`)
      return undefined;
    }
    layer = createInRepo(conf);
  }

  return layer;
}

export function getId(layer){
  return _ids.get(layer);
}

//TODO: integrate to settings board
const spy_conf = Object.assign({}, Confs.find(conf => conf.id == 'NLSC_PHOTO_MIX'), {id: 'SPY'});
createInRepo(spy_conf);
