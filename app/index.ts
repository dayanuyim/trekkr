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
import { Sidebar, Topbar } from './toolbar';

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

  const sidebar = new Sidebar(main_el.querySelector('.toolbar-side'))
    .setListener('spyenabled', (spy) => map.setSpyLayer(spy));

  const topbar = new Topbar(main_el.querySelector('.toolbar-top'))
    .setListener('filterchanged', () => map.redrawText())
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

  // default data
  loadQueryData(map);
}

async function loadQueryData(map){
  const params = new URLSearchParams(window.location.search);
  if(!params.has('data')) return;
  if(!params.get('data')) return;
  try{
    const url = params.get('data');
    const data = await fetchData(url);
    if(data) map.parseFeatures(data);
  }
  catch(e){
    alert(`parse data error: ${e.message}`);
  }
}

async function fetchData(url){
  try{
    const resp = await fetch(url, {
      method: 'GET',
      mode: 'cors', // dont set no-cors,  which not mean 'no cors' or 'to disable cors'!
      //headers: new Headers({ 'Content-Type': mime, }),
    });

    if(!resp.ok)
      throw new Error(`${resp.status} ${resp.statusText}`)

    return await resp.arrayBuffer();
  }
  catch(e){
    alert(`fetch data error: ${e.message}`);
    return null;
  }
}
