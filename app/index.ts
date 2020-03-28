'use strict';

import '../node_modules/ol/ol.css';
import '../node_modules/@fortawesome/fontawesome-free/css/all.min.css';
import './css/index.css';
import './css/tab.css';

import * as templates from './templates';
import {createMap, } from './map';
import * as settings from './settings';

(async () => {
  document.body.innerHTML = templates.main();
  const map = createMap(document.getElementById('map'));  //init by elemnt (not id), retreive the elemnt later by 'getTarget()'
  settings.init(map);


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