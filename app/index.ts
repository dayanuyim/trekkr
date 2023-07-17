'use strict';

import 'ol/ol.css';
import './css/index.css';
import './css/tab.css';
import './css/ctx-menu.css';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';
import '@fortawesome/fontawesome-free/js/regular';
import '@fortawesome/fontawesome-free/js/brands';

import './coord';
import * as templates from './templates';
import {createMap, setCtxMenu} from './map';
import { initSettings, initSidebar } from './settings';

(async () => {
  main(document.body);


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

function main(root_el: HTMLElement)
{
  root_el.innerHTML = templates.main();

  const map = createMap('map');
  const settings = initSettings(map, root_el.querySelector('.settings'))
  const sidebar = initSidebar(map, root_el.querySelector('.settings-side'))
  setCtxMenu(map, document.getElementById('ctx-menu'));

  //set hotkey
  root_el.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 's')
          settings.toggle();
      else if (e.ctrlKey && e.key === 'x')
          sidebar.toggleSpy();
      else if (e.ctrlKey && e.key === 'f') {
          root_el.requestFullscreen();
      }
  });
}