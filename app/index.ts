'use strict';

import '../node_modules/ol/ol.css';
import './css/index.css';

import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider} from 'ol/control';
import {toSize} from 'ol/size';
import {Map, View, Overlay} from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
import VectorSource from 'ol/source/Vector';
import TileJSON from 'ol/source/TileJSON.js';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import GPX from 'ol/format/GPX';
import {fromLonLat} from 'ol/proj';
import { Icon as IconStyle, Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';
import GeometryType from  'ol/geom/GeometryType';

import {fromTWD67, fromTWD97} from './coord';
import * as templates from './templates';

function getSymPath(sym)
{
  const symDir = './images/sym';
  return `${symDir}/${sym}@Freepik.png`;
}

const gpxStyle = (feature) => {
  switch (feature.getGeometry().getType()) {
    case 'Point': {
      return new Style({
        image: new IconStyle({
          src: getSymPath(feature.get('sym')),
          //rotateWithView: true,
          //size: toSize([32, 32]),
          scale: 0.25,
          opacity: 0.8,
        }),
      });
      /*
      return new Style({
        image: new CircleStyle({
          fill: new Fill({
            color: 'rgba(255,255,0,0.4)'
          }),
          radius: 5,
          stroke: new Stroke({
            color: '#ff0',
            width: 1
          })
        })
      });
      */
    }
    case 'LineString': {
      return new Style({
        stroke: new Stroke({
          color: '#f00',
          width: 3
        })
      });
    }
    case 'MultiLineString': {
      return new Style({
        stroke: new Stroke({
          color: '#8B008B',
          width: 3
        })
      });
    }
  }
};



const _gpxDisplay = {
};

const gpxDisplay = feature => {
  _gpxDisplay[feature.getGeometry().getType()](feature);
};

const displayFeatureInfo = function (map, pixel, coordinate) {
  let features = map.getFeaturesAtPixel(pixel);
  if (features == null || features.length <= 0) {
    map.getTarget().style.cursor = '';
    return;
  }

  map.getTarget().style.cursor = 'pointer';

  /*
  // prefer to show wpt solely
  const points = features.filter(feature => feature.getGeometry().getType() === 'Point');
  if (points.length >  0) 
    features = points;
    */
  features.forEach(feature => {
    switch (feature.getGeometry().getType()) {
      case 'Point': {
        //const name = feature.get('name');
        //const sym = feature.get('sym');
        //console.log(coordinate);
        //var hdms = toStringHDMS(toLonLat(coordinate));
        const overlay = map.getOverlayById('wpt-popup');
        const contentElem = overlay.getElement().querySelector('.ol-popup-content');
        contentElem.innerHTML = feature.get('desc') || feature.get('name');
        overlay.setPosition(feature.getGeometry().getCoordinates());
        break;
      }
      case 'LineString': {
        const name = feature.get('name');
        console.log(name);
        break;
      }
      case 'MultiLineString': {
        const name = feature.get('name');
        console.log(name);
        break;
      }
    }
  });
};

const layers = {
  OSM: new TileLayer({
    source: new OSM(),
  }),
  RUDY: new TileLayer({
    source: new XYZ({
      url: 'http://rudy-daily.tile.basecamp.tw/{z}/{x}/{y}.png'
      //url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    })
  }),
  EMAP: new TileLayer({
    source: new XYZ({
      url: 'http://wmts.nlsc.gov.tw/wmts/EMAP5/default/EPSG:3857/{z}/{y}/{x}'
    })
  }),
  EMAP_TRANS: new TileLayer({
    source: new XYZ({
      url: 'http://wmts.nlsc.gov.tw/wmts/EMAP2/default/EPSG:3857/{z}/{y}/{x}'
    })
  }),
  COUNTRIES: new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: './data/countries.json'
    })
  }),
  TAIWAN_COUNTIES: new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: './data/taiwan-counties.json',
    }),
    opacity: 0.3,
  }),
  GPX_SAMPLE: new VectorLayer({
    source: new VectorSource({
      url: './data/sample.gpx',
      format: new GPX(/*{
        readExtensions: (x) => {
          console.log(x);
        }
      }*/),
    }),
    style: gpxStyle,
  }),
};

const createMap = () => {
  return new Map({
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap(),
      new ZoomSlider(),
    ]),
    layers: [
      //layers.OSM,
      //layers.TAIWAN_COUNTIES,
      //layers.RUDY,
      //layers.EMAP_TRANS,
      layers.EMAP,
      layers.GPX_SAMPLE,
    ],
    view: new View({
      //center: fromLonLat([120.929272, 23.555519]),
      //center: fromTWD97([242780, 2605801]),
      center: fromTWD67([241951, 2606008]),
      zoom: 15,
    })
  });
};

function createOverlay(id)
{
  const popupElem = document.getElementById(id);
  const closerElem = popupElem.querySelector('.ol-popup-closer') as HTMLElement;

  const overlay = new Overlay({
    element: popupElem,
    id,
    autoPan: true,
    autoPanAnimation: {
      duration: 250
    }
  });

  closerElem.onclick = function () {
    overlay.setPosition(undefined);
    closerElem.blur();
    return false;
  };

  return overlay;
}

(async () => {
  document.body.innerHTML = templates.main();
  const mapElem = document.getElementById('map');

  const wptOverlay = createOverlay('wpt-popup');

  const map = createMap();
  map.setTarget(mapElem);
  map.addOverlay(wptOverlay)
  map.on('pointermove', function(evt) {
    if (evt.dragging) {
      return;
    }
    // TODO what is the diff between 'originalevent' and 'event'?
    const pixel = map.getEventPixel(evt.originalEvent);
    displayFeatureInfo(map, pixel, evt.coordinate);
  });


  map.on('click', function(evt) {
    //displayFeatureInfo(map, evt.pixel, evt.coordinate);
    const overlay = map.getOverlayById('wpt-popup')
    overlay.setPosition(undefined);
  });


  map.on('singleclick', function(evt) {
  });

  /*
  navigator.geolocation.getCurrentPosition(function(pos) {
    const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
    map.getView().animate({center: coords, zoom: 16, duration: 3000});
  });
  */
})();