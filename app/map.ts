import { defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control } from 'ol/control';
import { defaults as defaultInteractions, DragAndDrop, Modify, Select } from 'ol/interaction';
import { toSize } from 'ol/size';
import { Map, View, Overlay, Collection } from 'ol';
import { Tile as TileLayer } from 'ol/layer';
import { Vector as VectorSource, TileJSON, XYZ, OSM } from 'ol/source';
import { getRenderPixel } from 'ol/render';
import { platformModifierKeyOnly } from 'ol/events/condition';

import { GeoJSON, IGC, KML, TopoJSON } from 'ol/format';
import PhotoFormat from './format/Photo';

import { GPXFormat, mkGpxLayer, genGpxText, mkWptFeature, findWptFeature, getGpxWpts, setSymByRules, estimateCoords } from './gpx';
import PtPopupOverlay from './pt-popup';
import Opt from './opt';
import * as LayerRepo from './layer-repo';

/*
//TODO: better way to do this?
// NOTE: the function is called only with 'wpt' feature feed,
// so the index range should be in [ indexOfPseudoGpxLayer(), layers.getLength() ),
// so do the search by rever order.
function findLayerByFeature(map, feature){
  const layers = map.getLayers();
  for(let i = layers.getLength() -1; i >= 0; --i){
    const layer = layers.item(i);
    if(layer.getSource().getFeatures().includes(feature))
      return layer;
  }
  return undefined;
}
*/

////////////////////////////////////////////////////////////////

export const createMap = (target) => {
  const photo_format = new PhotoFormat();
  const drag_interaciton = new DragAndDrop({
    formatConstructors: [ GPXFormat, photo_format, GeoJSON, IGC, KML, TopoJSON]
  });

  const map = new Map({
    target,
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap({
        layers: [ new TileLayer({ source : new OSM() }) ]
      }),
      new ZoomSlider(),
      //new SaveCookieControl(),
    ]),
    interactions: defaultInteractions().extend([
      drag_interaciton,
      //new Select(),
    ]),
    //layers: [
    //],
    view: new View({
      center: Opt.xy,
      zoom: Opt.zoom,
      minZoom: 1,
      maxZoom: 23,
    }),
    overlays: [
      new PtPopupOverlay(document.getElementById('pt-popup')),
    ],
  });

  photo_format.onlookupcoords = (time) => estimateCoords(getGpxLayer(map), time);
  photo_format.onfeatureexists = (time) => findWptFeature(getGpxLayer(map), time);

  // pseudo gpx layer
  addLayerWithInteraction(map, mkGpxLayer())

  //create layer from features, and add it to the map
  drag_interaciton.on('addfeatures', function(e) {
    const src = getGpxLayer(map).getSource();
    src.addFeatures(e.features);
    map.getView().fit(src.getExtent(), { maxZoom: 16 });
    //const layer = mkGpxLayer({features: e.features});
    //addLayerWithInteraction(map, layer);
    //map.getView().fit(layer.getSource().getExtent(), { maxZoom: 16 });
  });

  initEvents(map);
  return map;
};

/*
function getQueryParameters()
{
  const query = window.location.search.substring(1);
  return query.split('&')
    .reduce((all, param) => {
      const [key, value] = param.split('=');
      all[key] = value;
      return all;
    }, {});
}
*/
function initEvents(map)
{
  map.on('pointermove', function(e) {
    if (e.dragging) 
      return;
    hoverFeatures(e);
  });

  map.on('click', function(e) {
    showFeatures(e);
  });

  map.on('singleclick', function(e) {
  });

  //map.on('moveend', function(e){   //invoked only when view is locked down
  map.on('postrender', function(e){
    saveViewConf(e.map.getView());
  });

  // when pt-popup overlay make or remove a wpt feature
  const pt_popup = map.getOverlayById('pt-popup');
  pt_popup.onmkwpt = (wpt) => getGpxLayer(map).getSource().addFeature(wpt);
  pt_popup.onrmwpt = (wpt) => {
    getGpxLayer(map).getSource().removeFeature(wpt);
    map.getOverlayById('pt-popup').hide(); //close popup
  }

  // record the pixel position with every move
  document.addEventListener('mousemove', function (e) {
    Opt.mousepos = map.getEventPixel(e);
    map.render();
  });

  document.addEventListener('mouseout', function () {
    Opt.mousepos = null;
    map.render();
  });
  
  //document events
  document.addEventListener('keydown', function(e) {
    if (Opt.spy.enabled && e.key === 'ArrowUp')
      handleSpyRadiusChange(map, e, 5);
    else if (Opt.spy.enabled && e.key === 'ArrowDown')
      handleSpyRadiusChange(map, e, -5);
  });
}

function handleSpyRadiusChange(map, e, inc){
    const radius = Math.max(25, Math.min(Opt.spy.radius + inc, 250));
    if(radius != Opt.spy.radus){
      Opt.update({radius}, 'spy');
      map.render();  //trigger prerender
      e.preventDefault();
    }
}

function saveViewConf(view)
{
  Opt.update({
    xy: view.getCenter(),
    zoom: view.getZoom(),
  });
}

const hoverFeatures = function (e) {
  const features = _getFeatures(e);
  e.map.getTargetElement().style.cursor = features.length? 'pointer': '';
};

const showFeatures = function (e) {
  let has_popup_shown = false;
  const popup_overlay = () => e.map.getOverlayById('pt-popup');

  const features = _getFeatures(e);
  features.forEach(feature => {
    switch (feature.getGeometry().getType()) {
      case 'Point': {   // Waypoint or Track point
        has_popup_shown = true;
        popup_overlay().popContent(feature);
        break;
      }
      case 'LineString': {  //grid line
        const name = feature.get('name');
        if(name) console.log(name);
        break;
      }
      case 'MultiLineString': {  //track
        const name = feature.get('name');
        console.log(`track name: ${name}`);
        break;
      }
    }
    return true;
  });

  //no popup in this run, but hide the old popup if any
  if(!has_popup_shown) popup_overlay().hide();
};

function _getFeatures(e) {
  const isTrk      = f => f.getGeometry().getType() == 'MultiLineString';
  const isPt       = f => f.getGeometry().getType() === 'Point';
  const hasWptProp = f => f.get('name') || f.get('desc') || f.get('sym');
  const isWpt      = f => isPt(f) && hasWptProp(f);
  const isTrkpt    = f => isPt(f) && !hasWptProp(f);

  const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?

  // NOTE: not use forEach..., it is hard to point to Wpt if there are Trkpt in the same place. (Why?)
  //const hit = e.map.forEachFeatureAtPixel(pixel, handleFeature);
  //e.map.getTargetElement().style.cursor = hit? 'pointer': '';

  const features = e.map.getFeaturesAtPixel(pixel, {hitTolerance: 2});
  //return features.some(isWpt)? features.filter(f => !isTrkpt(f)): features;  //filter out trkpts if wpt exists
  return features.some(isWpt)? features.filter(isWpt): features.filter(isTrkpt);  //either wpt or trk/trkpt
};

////////////////////////////////////////////////////////////////

function indexOfSpyLayer(){
  return Opt.layers.filter(ly => ly.checked).length;   // after all enabled layers
}

function indexOfPseudoGpxLayer(){
  return indexOfSpyLayer() + 1;  //after spy layer
}

/*
function getGpxLayers(map){
    return map.getLayers().getArray().slice(indexOfPseudoGpxLayer());
}
*/

function getGpxLayer(map){
    return map.getLayers().item(indexOfPseudoGpxLayer());
}

function addLayerWithInteraction(map, layer){
    map.addLayer(layer);
    map.addInteraction(new Modify({    //let trkpt feature as 'Point', instead of 'MultiLineString'
      source: layer.getSource(),
      condition: platformModifierKeyOnly,
    }));
}


//Note:
// 1. OL is anti-order against @conf.
//    OL:
//     layers[0]     is the most bottom layer from conf;
//     layers[n-1]   is the most top layer from conf
//     layers[n]     is the spy layer
//     layers[n+1]   is the pseudo gpx layer
//     layers[n+1+m] is the mth user-provided gpx laeyr
// 2. remove only the layers whith are set disabled in @conf
// 3. invoke getLayer only for those enalbed in @conf
// 4. as mush as graceful to reorder the map's layers.
export function setLayers(map, conf)
{
  const in_right_pos = (arr, idx, elem) => arr.getLength() > idx && arr.item(idx) === elem;

  const id_conf = {};
  conf.forEach(cnf => id_conf[cnf.id] = cnf)

  const map_layers = map.getLayers();

  // remove map layers, which disable in conf
  const rm_idx = [];
  map_layers.forEach((layer, idx) => {
    const id = LayerRepo.getId(layer);
    const cnf = id? id_conf[id]: undefined;
    if(cnf && !cnf.checked)
      rm_idx.unshift(idx);  //insert to first
  });
  rm_idx.forEach(idx => map_layers.removeAt(idx));

  // add enabled layers in the same order of cnf
  conf.filter(cnf => cnf.checked)
      .reverse()
      .forEach((cnf, idx) => {
        const layer = LayerRepo.get(cnf.id);
        if (!in_right_pos(map_layers, idx, layer)) {
          map_layers.remove(layer); //in case the layer is added but in the wrong place
          map_layers.insertAt(idx, layer);
          layer.setOpacity(cnf.opacity);
        }
      });
}

////////////////////////////////////////////////////////////////

export function setLayerOpacity(id, opacity)
{
  const layer = LayerRepo.get(id);
  if (layer)
    layer.setOpacity(opacity);
  else
    console.error(`Set layer opacity error: layer ${id} not found`);
}

////////////////////////////////////////////////////////////////

//TODO: are there beter ways than creating spy layer everytime?
//      Or creating spy layer everytime really hurt the performance?
export function setSpyLayer(map, id)
{
  const layers = map.getLayers();
  const idx = indexOfSpyLayer();  // !! the index is correct only if the configurated layers are set; otherwise do the following search to find out the proper index.
/*
  let has_old_spy = false;
  let idx = 0;
  for(; idx < layers.getLength(); ++idx){
    const layer = layers.item(idx);
    const id = LayerRepo.getId(layer);
    if(!id) break;    //beyond normal layers, e.g., gpx layer
    if(id === 'SPY'){
      has_old_spy = true;
      break;
    }
  }
  if(has_old_spy)*/
  if(LayerRepo.getId(layers.item(idx)) == 'SPY')  //remove the original if any
    layers.removeAt(idx);
  layers.insertAt(idx, createSpyLayer(id));
}

function createSpyLayer(id)
{
  const spy_conf = Object.assign({}, LayerRepo.getConf(id), { id: 'SPY' });
  const layer = LayerRepo.createByConf(spy_conf);
  return setSpyEvents(layer);
}

function setSpyEvents(layer)
{
  // before rendering the layer, do some clipping
  layer.on('prerender', function (event) {
    const ctx = event.context;
    ctx.save();
    ctx.beginPath();
    
    const spy = Opt.spy;
    const mousepos = Opt.mousepos;
    if (spy.enabled && mousepos) {
      // only show a circle around the mouse
      var pixel = getRenderPixel(event, mousepos);

      //@why the sample code so complexed ??
      //var offset = getRenderPixel(event, [mousepos[0] + spy.radius, mousepos[1]]);
      //var canvasRadius = Math.sqrt(Math.pow(offset[0] - pixel[0], 2) + Math.pow(offset[1] - pixel[1], 2));
      //ctx.arc(pixel[0], pixel[1], canvasRadius, 0, 2 * Math.PI);
      //ctx.lineWidth = 5 * canvasRadius / spy.radius;
      ctx.arc(pixel[0], pixel[1], spy.radius, 0, 2 * Math.PI);
      ctx.lineWidth = 1;

      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
    }
    ctx.clip();
  });

  // after rendering the layer, restore the canvas context
  layer.on('postrender', function (event) {
    const ctx = event.context;
    ctx.restore();
  });
  return layer;
}

/////////////////////// Context Menu ///////////////////////////

import { gmapUrl} from './common';
import { CtxMenu } from './ctx-menu';

let __ctxmenu_coord;

export function setCtxMenu(map, menu: HTMLElement) {
  // set map listeners ==========
  //const map_el = map.getTargetElement();
  const map_el = map.getViewport();

  const ctx = new CtxMenu(map_el, menu);
  map_el.addEventListener('contextmenu', e => {
    __ctxmenu_coord = map.getEventCoordinate(e);
    ctx.show(e);
  });

  map_el.addEventListener("click", e => {
    ctx.hide(e);
  });

  // set menu listeners ========

  ctx.setItem(".item-gmap", (el) => {
    el.href = gmapUrl(__ctxmenu_coord);
  });

  ctx.setItem(".item-add-wpt", (el) => {
    getGpxLayer(map).getSource().addFeature(mkWptFeature(__ctxmenu_coord));
  });

  ctx.setItem(".item-save-gpx", (el) => {
    genGpxText([getGpxLayer(map)]);
  });
  ctx.setItem(".item-apply-sym", (el) => {
    getGpxWpts([getGpxLayer(map)]).forEach(setSymByRules);
  });
}
