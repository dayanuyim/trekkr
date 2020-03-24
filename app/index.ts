'use strict';

import '../node_modules/ol/ol.css';
//import '../node_modules/font-awesome/css/font-awesome.css';
import './css/index.css';

import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control} from 'ol/control';
import {DragAndDrop, Modify} from 'ol/interaction';
import {toSize} from 'ol/size';
import {Map, View, Overlay} from 'ol';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import TileJSON from 'ol/source/TileJSON';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import { Icon as IconStyle, Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import GeometryType from  'ol/geom/GeometryType';

import * as templates from './templates';

import {createMap} from './map';


(async () => {
  document.body.innerHTML = templates.main();
  const target = document.getElementById('map');
  const map = createMap(target);

  /*
  const params = getQueryParameters();
  if(params['gpx']){
    console.log(params['gpx']);
    const resp = await fetch(params['gpx'], {
      mode: 'no-cors', // no-cors, cors, *same-origin
      headers: new Headers({
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/gpx+xml'
      }),
    });
    const txt = await resp.text();
    addGPXLayer(map, txt);
  }
  */

  /*
  navigator.geolocation.getCurrentPosition(function(pos) {
    const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
    map.getView().animate({center: coords, zoom: 16, duration: 3000});
  });
  */
})();