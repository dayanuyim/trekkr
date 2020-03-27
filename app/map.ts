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

import {partition} from './utils';
import {getSymbol, toSymPath, gpxStyle} from './common'
import PtPopupOverlay from './pt-popup';
import Cookie from './cookie';
import Layers from './layer-grp';

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
  const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?

  const hit = e.map.forEachFeatureAtPixel(pixel, feature => {
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
  });

  e.map.getTarget().style.cursor = hit? 'pointer': '';
};

//layers[0] is the most bottom layer; 
//layers[n-1] is the most top layer
export function setLayers(map, layers_setting)
{
  const in_right_pos = (arr, idx, elem) => arr.getLength() > idx && arr.item(idx) === elem;

  layers_setting = layers_setting.map(ly => Object.assign({
    obj: Layers[ly.id]
  }, ly));
  const [en, dis] = partition(layers_setting, ly => ly.enabled);

  const layers = map.getLayers();

  //rmeove all layers disabled in setting, buf reverse the most top layers, like gpx
  dis.forEach(ly => layers.remove(ly.obj));

  en.forEach((ly, idx) => {
    if(!in_right_pos(layers, idx, ly.obj)){
      layers.remove(ly.obj); //in case the layer is added but not in right place
      layers.insertAt(idx, ly.obj);
    }
  });
}