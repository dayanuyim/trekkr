'use strict';

import 'ol/ol.css';
import './css/index.css';
import './css/tab.css';
import './css/ctx-menu.css';
import './css/popup.css';

import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';
import '@fortawesome/fontawesome-free/js/regular';
import '@fortawesome/fontawesome-free/js/brands';

import './coord';
import * as templates from './templates';
import { AppMap } from './map';
import { Settings } from './settings';
import { Sidebar, Topbar } from './toolbar';
import { setGpxFilename, setDocTitle } from './common';
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
  map.initLayers(Opt.layers, Opt.spy);

  // set hotkey
  main_el.addEventListener('keydown', function (e) {
    Opt.rt.shiftdown = e.shiftKey;
    if (e.ctrlKey && e.key === 's')
      settings.toggle();
    else if (e.ctrlKey && e.key === 'x')
      sidebar.toggleSpy();
    else if (e.ctrlKey && e.key === 'f') {
      main_el.requestFullscreen();
    }
  });
  main_el.addEventListener('keyup', function (e) {
    Opt.rt.shiftdown = e.shiftKey;
  });

  // load initial data
  const params = new URLSearchParams(window.location.search);
  const title = params.get('title');
  const filename = params.get('filename');
  const data = params.get('data');          // data url

  if(title) setDocTitle(title);
  if(filename) setGpxFilename(filename, true);
  if(data) loadQueryData(map, data);
}


async function loadQueryData(map, url){
  // fetch and parse
  try{
    const resp = await fetchData(url);
    map.readFileFeatures(resp.url, resp);
  }
  catch(e){
    alert(`fetch data error: ${e.message}`);
  }
}

async function fetchData(url){
  const resp = await fetch(url, {
    method: 'GET',
    mode: 'cors', // dont set no-cors,  which not mean 'no cors' or 'to disable cors'!
    //headers: new Headers({ 'Content-Type': mime, }),
  });

  if(!resp.ok)
    throw new Error(`${resp.status} ${resp.statusText}`)
  return resp;
}
