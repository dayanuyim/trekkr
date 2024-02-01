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
import Opt from './opt';

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
    .setListener('filterchanged', (filterable) => map.setLayerFilterable(null, filterable))
    .setListener('filterrulechanged', () => map.redrawText())
    .setListener('getcenter', () => map.getView().getCenter())
    .setListener('goto', (coord) => map.setCrosshairWpt(coord));

  const settings = new Settings(main_el.querySelector('.settings'))
    .setListener('layers_reorder',   (ids) => map.setLayers(Opt.layers))
    .setListener('layer_checked',    (id, checked) => map.setLayers(Opt.layers))
    .setListener('layer_opacity',    (id, opacity) => map.setLayerOpacity(id, opacity))
    .setListener('layer_filterable', (id, filterable) => map.setLayerFilterable(id, filterable))
    .setListener('layer_invisible',  (id, invisible) => map.setLayerInvisible(id, invisible))
    .setListener('spy',              (id) => map.setSpyLayer(Opt.spy))
    .setListener('wptchanged', () => map.redrawText())
    .setListener('trkchanged', () => map.redrawText());

  //initialize
  map.setLayers(Opt.layers);
  map.setSpyLayer(Opt.spy);  // !! init spy after configuring layers

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
