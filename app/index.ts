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
import { Sidebar, Topbar } from './sidebar';

(async () => {
  main(document.body);

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

  // set ui utils
  const map = new AppMap('map');
  map.setCtxMenu(document.getElementById('ctx-menu'));

  const sidebar = new Sidebar(main_el.querySelector('.settings-bar.side'))
    .setListener('spyenabled', (spy) => map.setSpyLayer(spy));

  const topbar = new Topbar(main_el.querySelector('.settings-bar.top'))
    .setListener('getcenter', () => map.getView().getCenter())
    .setListener('goto', (coord) => map.setCrosshairWpt(coord));

  const settings = new Settings(main_el.querySelector('.settings'))
    .setListener('spychanged', (spy) => map.setSpyLayer(spy))
    .setListener('layerschanged', (layers_conf) => map.setLayers(layers_conf))
    .setListener('opacitychanged', (id, opacity) => map.setLayerOpacity(id, opacity))
    .setListener('wptchanged', () => map.redrawText())
    .setListener('trkchanged', () => map.redrawText())
    .apply();

  // set hotkey
  main_el.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 's')
          settings.toggle();
      else if (e.ctrlKey && e.key === 'x')
          sidebar.toggleSpy();
      else if (e.ctrlKey && e.key === 'f') {
          main_el.requestFullscreen();
      }
  });

  // default gpx
  loadQueryGpx(map);
}

async function loadQueryGpx(map){
  const params = new URLSearchParams(window.location.search);
  if(!params.has('gpx')) return;

  const gpx = params.get('gpx');
  if(!gpx) return;

  const resp = await fetch(gpx, {
    method: 'GET',
    mode: 'cors', // dont set no-cors,  which not mean 'no cors' or 'to disable cors'!
    headers: new Headers({
      'Content-Type': 'application/gpx+xml'
    }),
  });
  const txt = await resp.text();
  map.parseFeatures(txt);
}
