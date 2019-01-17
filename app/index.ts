'use strict';

import '../node_modules/ol/ol.css';
import './css/index.css';
import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider} from 'ol/control';
import {Map, View} from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import VectorSource from 'ol/source/Vector';
import TileJSON from 'ol/source/TileJSON.js';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import {fromLonLat} from 'ol/proj';
import {fromTWD67, fromTWD97} from './coord';
import * as templates from './templates';

const layers = {
      OSM: new TileLayer({
        source: new OSM(),
      }),
      RUDY: new TileLayer({
        source: new XYZ({
          url: 'http://rudy-daily.tile.basecamp.tw/{z}/{x}/{y}.png'
          //url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        })
      }),
      EMAP_TRANS: new TileLayer({
        source: new XYZ({
          url: 'http://wmts.nlsc.gov.tw/wmts/EMAP2/default/EPSG:3857/{z}/{y}/{x}'
        })
      }),
      COUNTRIES: new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: './data/countries.json'
        })
      }),
      TAIWAN_COUNTIES: new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: './data/taiwan-counties.json',
        }),
        opacity: 0.3,
      }),
}

const createMap = () => {
  return new Map({
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap(),
      new ZoomSlider(),
    ]),
    layers: [
      //layers.OSM,
      //layers.TAIWAN_COUNTIES,
      layers.RUDY,
      layers.EMAP_TRANS,
    ],
    view: new View({
      //center: fromLonLat([120.929272, 23.555519]),
      //center: fromTWD97([242780, 2605801]),
      center: fromTWD67([241951, 2606008]),
      zoom: 15,
    })
  });
};

(async () => {
  const mapId = 'map';
  document.body.innerHTML = templates.main({mapId});

  const map = createMap();
  map.setTarget(mapId);

  /*
  navigator.geolocation.getCurrentPosition(function(pos) {
    const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
    map.getView().animate({center: coords, zoom: 16, duration: 3000});
  });
  */
})();