import '../node_modules/ol/ol.css';
import './css/index.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import {fromLonLat} from 'ol/proj';
import proj4 from 'proj4';
import * as templates from './templates';

// ref: https://epsg.io
// ref: http://mutolisp.logdown.com/posts/207563-taiwan-geodetic-coordinate-system-conversion
 proj4.defs([
   ["EPSG:3825", "+title=二度分帶：TWD97 TM2 澎湖 +proj=tmerc +lat_0=0 +lon_0=119 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=公尺 +no_defs"],
   ["EPSG:3826", "+title=二度分帶：TWD97 TM2 台灣 +proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=公尺 +no_defs"],
   ["EPSG:3827", "+title=二度分帶：TWD67 TM2 澎湖 +proj=tmerc +lat_0=0 +lon_0=119 +k=0.9999 +x_0=250000 +y_0=0 +ellps=aust_SA +towgs84=-752,-358,-179,-0.0000011698,0.0000018398,0.0000009822,0.00002329 +units=公尺"],
   ["EPSG:3828", "+title=二度分帶：TWD67 TM2 台灣 +proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=aust_SA +towgs84=-752,-358,-179,-0.0000011698,0.0000018398,0.0000009822,0.00002329 +units=公尺 +no_defs"],
   ["EPSG:3857", "+title=Web Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs"],
   ["EPSG:4326", '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'],
   ["EPSG:900913", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +towgs84=0,0,0,0,0,0,0 +units=m +nadgrids=@null +wktext  +no_defs"],
 ]);

//const WGS84 = proj4.WGS84;  //proj4.Proj('EPSG:4326');
const WGS84Web = new proj4.Proj('EPSG:3857');
const TWD97 = new proj4.Proj('EPSG:3826');
const TWD67 = new proj4.Proj('EPSG:3828');

const fromTWD67 = (xy) => proj4(TWD67, WGS84Web, xy);
const fromTWD97 = (xy) => proj4(TWD97, WGS84Web, xy);

const createMap = () => {
  return new Map({
    //target: targetId,
    layers: [
      /*
      new TileLayer({
        source: new OSM(),
      }),
      */
      new TileLayer({
        source: new XYZ({
          url: 'http://rudy-daily.tile.basecamp.tw/{z}/{x}/{y}.png'
          //url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        })
      }),
      new TileLayer({
        source: new XYZ({
          url: 'http://wmts.nlsc.gov.tw/wmts/EMAP2/default/EPSG:3857/{z}/{y}/{x}'
        })
      }),
    ],
    view: new View({
      //center: fromLonLat([121.009702, 23.490124]),
      //center: fromTWD97([250991, 2598558]),
      center: fromTWD67([250162, 2598764]),
      zoom: 16
    })
  });
};

(async () => {
  const mapId = 'map';
  document.body.innerHTML = templates.main({mapId});
  createMap().setTarget(mapId);
})();