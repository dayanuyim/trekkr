import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control} from 'ol/control';
import {defaults as defaultInteractions, DragAndDrop, Modify, Select} from 'ol/interaction';
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

import {partition} from './lib/utils';
import {getSymbol, toSymPath, gpxStyle} from './common'
import PtPopupOverlay from './pt-popup';
import Cookie from './cookie';
import LayerGrp from './layer-grp';

export const createMap = (target) => {
  const map = new Map({
    target,
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap(),
      new ZoomSlider(),
      //new SaveCookieControl(),
    ]),
    interactions: defaultInteractions().extend([
      genDragGpxInteraction(),
      //new Select(),
    ]),
    //layers: [
      //layers.RUDY,
      //layers.NLSC_LG,
    //],
    view: new View({
      center: Cookie.xy,
      zoom: Cookie.zoom,
    }),
    overlays: [
        new PtPopupOverlay(document.getElementById('pt-popup')),
    ],
  });

  initEvents(map);
  return map;
};

function genDragGpxInteraction(){
  const drag = new DragAndDrop({
    formatConstructors: [
      GPX,
      GeoJSON,
      IGC,
      KML,
      TopoJSON,
    ]
  });

  drag.on('addfeatures', function(e) {
    addGPXLayer(e.target.map_, e.features);
  });
  return drag;
}

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
    map.addInteraction(new Modify({source})); //feature trkpt as 'Point', instead of 'MultiLineString'
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
    showHoverFeatures(e);
  });

  map.on('click', function(e) {
    const overlay = map.getOverlayById('pt-popup');
    overlay.setPosition(undefined);
  });

  map.on('singleclick', function(e) {
  });

  //map.getView().on('change', function(e){, 
  map.on('moveend', function(e){   //invoked only when view is locked down
    updateCookie(e.map.getView());
  });
}

function updateCookie(view)
{
  Cookie.update({
    xy: view.getCenter(),
    zoom: view.getZoom(),
  });
}

const showHoverFeatures = function (e) {
  const handleFeature = feature => {
    switch (feature.getGeometry().getType()) {
      case 'Point': {   // TODO: Waypoint or Track point
        const overlay = e.map.getOverlayById('pt-popup');
        overlay.popContent(feature);
        break;
      }
      case 'LineString': {
        const name = feature.get('name');
        console.log(name);
        break;
      }
      case 'MultiLineString': {
        //console.log(feature.getGeometry().getCoordinates());
        const name = feature.get('name');
        console.log(`track name: ${name}`);
        break;
      }
    }
    return true;
  };

  const isPt = f => f.getGeometry().getType() === 'Point';
  const isWpt = f => isPt(f) && (f.get('name') || f.get('desc') || f.get('sym'));
  const isTrkpt = f => isPt(f) && !isWpt(f);

  const filterOutTrkptIfWpt = (features) => {
    return features.find(isWpt)? features.filter(f => !isTrkpt(f)): features;
  }

  const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?

  // NOTE: not use forEach..., it is hard to point to Wpt if there are Trkpt in the same place. (Why?)
  //const hit = e.map.forEachFeatureAtPixel(pixel, handleFeature);
  //e.map.getTarget().style.cursor = hit? 'pointer': '';

  const features = filterOutTrkptIfWpt(e.map.getFeaturesAtPixel(pixel, {hitTolerance: 2}));
  features.forEach(handleFeature);
  e.map.getTarget().style.cursor = features.length? 'pointer': '';
};

//Note: OL and conf is anti-order.
//OL:
//  layers[0] is the most bottom layer; 
//  layers[n-1] is the most top layer
export function setLayers(map, conf)
{
  const in_right_pos = (arr, idx, elem) => arr.getLength() > idx && arr.item(idx) === elem;
  const layerOf = (cnf) => LayerGrp[cnf.id];

  conf = conf.slice().reverse();
  const [en, dis] = partition(conf, cnf => cnf.checked);

  const layers = map.getLayers();

  //rmeove all layers disabled in setting, buf reverse the most top layers, like gpx
  dis.forEach(cnf => layers.remove(layerOf(cnf)));

  en.forEach((cnf, idx) => {
    const layer = layerOf(cnf);
    if(!in_right_pos(layers, idx, layer)){
      layers.remove(layer); //in case the layer is added but not in right place
      layers.insertAt(idx, layer);
      layer.setOpacity(cnf.opacity);
    }
  });
}