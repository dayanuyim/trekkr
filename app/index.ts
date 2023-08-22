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
import { AppMap } from './map';
import { Settings } from './settings';
import { Sidebar } from './sidebar';

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

function main(main_el: HTMLElement)
{
  main_el.innerHTML = templates.main();

  const map = new AppMap('map');
  map.setCtxMenu(document.getElementById('ctx-menu'));

  const sidebar = new Sidebar(main_el.querySelector('.settings-side'))
    .setListener('click', () => map.render());

  const settings = new Settings(main_el.querySelector('.settings'))
    .setListener('spychanged', (id) => map.setSpyLayer(id))
    .setListener('layerschanged', (layers_conf) => map.setLayers(layers_conf))
    .setListener('opacitychanged', (id, opacity) => map.setLayerOpacity(id, opacity))
    .setListener('wptchanged', () => map.redrawText())
    .apply();

  //set hotkey
  main_el.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 's')
          settings.toggle();
      else if (e.ctrlKey && e.key === 'x')
          sidebar.toggleSpy();
      else if (e.ctrlKey && e.key === 'f') {
          main_el.requestFullscreen();
      }
  });
}