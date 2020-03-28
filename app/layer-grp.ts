import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {Vector as VectorSource, XYZ, OSM, TileJSON} from 'ol/source';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import {gpxStyle} from './common';
import { identityTransform } from 'ol/proj';
import layer_conf from './data/layer-conf';

function osmLayer(){
  return new TileLayer({
    source: new OSM(),
  });
}

function xyzLayer(url, options?){
  return new TileLayer(Object.assign({
    source: new XYZ({url}),
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
    default: throw `unrecognize layer conf type: ${type}`;
  }
}

const layers = {};
layer_conf.forEach(conf => layers[conf.id] = conf2layer(conf));

export default layers;