import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control} from 'ol/control';
import {defaults as defaultInteractions, DragAndDrop, Modify, Select} from 'ol/interaction';
import {toSize} from 'ol/size';
import {Map, View, Overlay, Collection} from 'ol';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import TileJSON from 'ol/source/TileJSON';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import {getRenderPixel} from 'ol/render';
import {platformModifierKeyOnly} from 'ol/events/condition';

import { Icon as IconStyle, Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import GeometryType from  'ol/geom/GeometryType';

import {getSymbol, toSymPath, gpxStyle} from './common'
import PtPopupOverlay from './pt-popup';
import Opt from './opt';
import * as LayerRepo from './layer-repo';

// GPX format which reads extensions node
class ExtGPX extends GPX {
  constructor(options?){
    super(Object.assign({
      readExtensions: (feat, node) => {
        //set color for track if any
        if(node && feat.getGeometry().getType() ==  'MultiLineString') {
          const color = this._getTrackColor(node) ;
          if(color) feat.set('color', color);
        }
      },
    }, options));
  }

  _getTrackColor(extensions) {
    let color = null;

    if (extensions) {
      extensions.childNodes.forEach((ext) => {
        if (ext.nodeName == "gpxx:TrackExtension") {
          ext.childNodes.forEach((attr) => {
            if (attr.nodeName == "gpxx:DisplayColor") {
              color = attr.textContent;
            }
          });
        }
      });
    }
    return color;
  }

}

export const createMap = (target) => {
  const drag_interaciton = new DragAndDrop({
    formatConstructors: [ ExtGPX, GeoJSON, IGC, KML, TopoJSON, ]
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
    /*
    layers: [
      createSpyLayer(Opt.spy.layer),
    ],
    */
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

  drag_interaciton.on('addfeatures', function(e) {
    addGPXLayer(map, e.features);
  });

  initEvents(map);
  return map;
};

function addGPXLayer(map, features)
{
    const source = new VectorSource({
      features,
    });

    map.addLayer(new VectorLayer({
      source,
      style: gpxStyle,
    }));
    map.getView().fit(source.getExtent(), {maxZoom: 16});

    //let trkpt feature as 'Point', instead of 'MultiLineString'
    map.addInteraction(new Modify({
      source,
      condition: platformModifierKeyOnly,
    }));
}

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
    //console.log(e.key);

    if (Opt.spy.enabled && e.key === 'ArrowUp')
      handleSpyRadiusChange(map, e, 5);
    else if (Opt.spy.enabled && e.key === 'ArrowDown')
      handleSpyRadiusChange(map, e, -5);
  });
}

function handleSpyRadiusChange(map, e, inc){
    const radius = Math.max(25, Math.min(Opt.spy.radius + inc, 250));
    if(radius != Opt.spy.radus){
      map.render();
      e.preventDefault();
      Opt.spy.radius = radius;
      Opt.update();
    }
}

function saveViewConf(view)
{
  Opt.update({
    xy: view.getCenter(),
    zoom: view.getZoom(),
  });
}

const _getFeatures = function (e) {
  const isPt = f => f.getGeometry().getType() === 'Point';
  const hasWptProp = f => f.get('name') || f.get('desc') || f.get('sym');
  const isWpt = f => isPt(f) && hasWptProp(f);
  const isTrkpt = f => isPt(f) && !hasWptProp(f);

  const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?

  // NOTE: not use forEach..., it is hard to point to Wpt if there are Trkpt in the same place. (Why?)
  //const hit = e.map.forEachFeatureAtPixel(pixel, handleFeature);
  //e.map.getTargetElement().style.cursor = hit? 'pointer': '';

  const features = e.map.getFeaturesAtPixel(pixel, {hitTolerance: 2});
  return features.find(isWpt)? features.filter(f => !isTrkpt(f)): features;  //filter out trkpts if wpt exists
};

const hoverFeatures = function (e) {
  const features = _getFeatures(e);
  e.map.getTargetElement().style.cursor = features.length? 'pointer': '';
};

const showFeatures = function (e) {
  let hasPopup = false;

  const features = _getFeatures(e);
  features.forEach(feature => {
    switch (feature.getGeometry().getType()) {
      case 'Point': {   // TODO: Waypoint or Track point
        hasPopup = true;
        const overlay = e.map.getOverlayById('pt-popup');
        overlay.popContent(feature);
        break;
      }
      case 'LineString': {  //grid line
        const name = feature.get('name');
        if(name) console.log(name);
        break;
      }
      case 'MultiLineString': {  //track
        //console.log(feature.getGeometry().getCoordinates());
        const name = feature.get('name');
        //console.log(`track name: ${name}`);
        break;
      }
    }
    return true;
  });

  //hide old popup, if any
  if(!hasPopup){
    const overlay = e.map.getOverlayById('pt-popup');
    overlay.setPosition(undefined);
  }
};

//Note:
// 1. OL is anti-order against @conf.
//   OL:
//     layers[0] is the most bottom layer; 
//     layers[n-1] is the most top layer
// 2. remove only the layers whith are set disabled in @conf
// 3. invoke getLayer only for those enalbed in @conf
// 4. as more as graceful to reorder the map's layers.
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

export function setLayerOpacity(id, opacity)
{
  const layer = LayerRepo.get(id);
  if (layer)
    layer.setOpacity(opacity);
  else
    console.error(`Set layer opacity error: layer ${id} not found`);
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

function createSpyLayer(id)
{
  const spy_conf = Object.assign({}, LayerRepo.getConf(id), { id: 'SPY' });
  const layer = LayerRepo.createByConf(spy_conf);
  return setSpyEvents(layer);
}

//TODO: are there beter ways than creating spy layer everytime?
//      Or creating spy layer everytime really hurt the performance?
export function setSpyLayer(map, id)
{
  function findIdx(ol_collection, cb) {
    for(let i = 0; i < ol_collection.getLength(); ++i){
      const layer = ol_collection.item(i);
      if(cb(layer))
        return i;
    }
    return -1;
  }

  const layers = map.getLayers();

  // get appropriate index to insert
  let has_old_spy = false;
  let idx = findIdx(layers, layer => {
    const id = LayerRepo.getId(layer);
    if(!id) return true;    //beyond normal layers, ig, gpx layer
    if(id === 'SPY'){
      has_old_spy = true;
      return true;
    }
    return false;
  });
  if(idx < 0) idx = layers.getLength();

  if(has_old_spy)
    layers.removeAt(idx);

  layers.insertAt(idx, createSpyLayer(id));
}

/********************* context menu ******************/
import { gmapUrl} from './common';
import { CtxMenu } from './ctx-menu';

export function setCtxMenu(map, menu: HTMLElement) {
  //const base = map.getTargetElement();
  const base = map.getViewport();

  // set menu listeners ========
  const item_gmap = menu.querySelector<HTMLAnchorElement>("a.item-gmap");
  item_gmap.addEventListener('click', () =>{
    item_gmap.href = gmapUrl(menu.dataset.coord.split(","));
  });

  const item_add_wpt = menu.querySelector<HTMLElement>("a.item-add-wpt");
  item_add_wpt.style.color = "gray";
  item_add_wpt.addEventListener('click', () =>{
    alert("not implemented yet!");
  });

  const item_save_gpx = menu.querySelector<HTMLElement>("a.item-save-gpx")
  item_save_gpx.style.color = "gray";
  item_save_gpx.addEventListener('click', () =>{
    alert("not implemented yet!");
  });

  // set base listeners ==========
  const ctx = new CtxMenu(base, menu);
  base.addEventListener('contextmenu', e => {
    menu.dataset.coord = map.getEventCoordinate(e);
    ctx.show(e);
  });

  base.addEventListener("click", e => {
    ctx.hide(e);
  });
}
