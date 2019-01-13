import '../node_modules/ol/ol.css';
import './css/index.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import {fromLonLat} from 'ol/proj';
import * as templates from './templates';

const initMap = (targetId) => {
  new Map({
    target: targetId,
    layers: [
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
      center: fromLonLat([120.929089, 23.556611]),
      zoom: 16
    })
  });
};

(async () => {
  const mapId = 'map';
  document.body.innerHTML = templates.main({mapId});
  initMap(mapId);
})();