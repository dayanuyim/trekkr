'use strict';

import '../node_modules/ol/ol.css';
import './css/index.css';
import {Map, View} from 'ol';
import {defaults as defaultControls, ScaleLine, OverviewMap} from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import {fromLonLat} from 'ol/proj';
import {fromTWD67, fromTWD97} from './coord';
import * as templates from './templates';

const createMap = () => {
  return new Map({
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap(),
    ]),
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