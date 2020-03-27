import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {Vector as VectorSource, XYZ, OSM, TileJSON} from 'ol/source';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import {gpxStyle} from './common';

const layers = {
  OSM: new TileLayer({
    source: new OSM(),
  }),
  OSM_: new TileLayer({
    source: new XYZ({
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    })
  }),
  RUDY: new TileLayer({
    source: new XYZ({
      //url: 'http://rudy-daily.tile.basecamp.tw/{z}/{x}/{y}.png'
      url: 'http://rudy.tile.basecamp.tw/{z}/{x}/{y}.png'
      //url: 'https://rs.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png'
    })
  }),
  NLSC: new TileLayer({
    source: new XYZ({
      url: 'http://wmts.nlsc.gov.tw/wmts/EMAP5/default/EPSG:3857/{z}/{y}/{x}'
    })
  }),
  NLSC_LG: new TileLayer({
    source: new XYZ({
      url: 'http://wmts.nlsc.gov.tw/wmts/EMAP2/default/EPSG:3857/{z}/{y}/{x}',
      //crossOrigin: 'anonymous',
      transition: 0,  // this layer has transparency, so do not fade tiles
    })
  }),
  COUNTRIES: new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: './data/countries.json',
    })
  }),
  TW_COUNTIES: new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: './data/taiwan-counties.json',
    }),
    opacity: 0.3,
  }),
  GPX_SAMPLE: new VectorLayer({
    source: new VectorSource({
      url: './data/sample.gpx',
      format: new GPX(/*{
        readExtensions: (x) => {
          console.log(x);
        }
      }*/),
    }),
    style: gpxStyle,
  }),
  JP_GSI: new TileLayer({
    source: new XYZ({
      url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    })
  }),
};

export default layers;