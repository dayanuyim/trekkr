'use strict';

import '../node_modules/ol/ol.css';
import '../node_modules/font-awesome/css/font-awesome.min.css';
import './css/index.css';

import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider} from 'ol/control';
import {DragAndDrop, Modify} from 'ol/interaction';
import {toSize} from 'ol/size';
import {Map, View, Overlay} from 'ol';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import TileJSON from 'ol/source/TileJSON';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import {GPX, GeoJSON, IGC, KML, TopoJSON} from 'ol/format';
import {fromLonLat} from 'ol/proj';
import { Icon as IconStyle, Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import GeometryType from  'ol/geom/GeometryType';
import {toStringXY} from 'ol/coordinate';


import {fromTWD67, toTWD67} from './coord';
import symbols from './data/symbols';
import * as templates from './templates';


function toSymPath(sym, size=32)
{
  const symDir = './images/sym';
  return `${symDir}/${size}/${sym.filename}`;
}

function getSymbol(symName){
  if(!symName)   // may be a track point
    return undefined;

  const id = symName.toLowerCase();
  const sym = symbols[id];
  if(!sym){
    console.log(`The symbol '${symName}' is not found`)
    return symbols['waypoint'];
  }
  return sym;
}

const gpxStyle = (feature) => {
  switch (feature.getGeometry().getType()) {
    case 'Point': {
      const sym = getSymbol(feature.get('sym'));
      if(sym){
        return new Style({
          image: new IconStyle({
            src: toSymPath(sym, 128),
            //rotateWithView: true,
            //size: toSize([32, 32]),
            //opacity: 0.8,
            //anchor: sym.anchor,
            scale: 0.25,
          }),
        });
      }
      else {
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
      }
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

function setPtPopupContent(overlay, feature)
{
  const name = feature.get('name') || feature.get('desc');   //may undefined
  const symbol = getSymbol(feature.get('sym'));              //may undefined
  const coordinate = feature.getGeometry().getCoordinates(); //TODO why getCoordinate's' ???

  const contentElem = overlay.getElement().querySelector('.ol-popup-content');
  contentElem.innerHTML = templates.ptPopup({ name, coordinate, symbol });
}


const displayFeatureInfo = function (map, pixel) {
  let features = map.getFeaturesAtPixel(pixel);
  if (features == null || features.length <= 0) {
    map.getTarget().style.cursor = '';
    return;
  }

  map.getTarget().style.cursor = 'pointer';

  /*
  // prefer to show point solely
  const points = features.filter(feature => feature.getGeometry().getType() === 'Point');
  if (points.length >  0) 
    features = points;
    */
  features.forEach(feature => {
    switch (feature.getGeometry().getType()) {
      case 'Point': {   // Waypoint or Track point
        const overlay = map.getOverlayById('pt-popup');
        setPtPopupContent(overlay, feature);
        overlay.setPosition(feature.getGeometry().getCoordinates());
        break;
      }
      case 'LineString': {
        const name = feature.get('name');
        console.log(name);
        break;
      }
      case 'MultiLineString': {
        //const name = feature.get('name');
        //console.log(`track name: ${name}`);
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
  const dragAndDropInteraction = new DragAndDrop({
    formatConstructors: [
      GPX,
      GeoJSON,
      IGC,
      KML,
      TopoJSON
    ]
  });

  const map = new Map({
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap(),
      new ZoomSlider(),
      dragAndDropInteraction,
    ]),
    layers: [
      //layers.OSM,
      //layers.TAIWAN_COUNTIES,
      layers.RUDY,
      layers.EMAP_TRANS,
      //layers.EMAP,
      //layers.GPX_SAMPLE,
    ],
    view: new View({
      //center: fromLonLat([120.929272, 23.555519]),
      //center: fromTWD97([242780, 2605801]),
      center: fromTWD67([241951, 2606008]),
      zoom: 15,
    })
  });

  dragAndDropInteraction.on('addfeatures', function(event) {
    addGPXLayer(map, event.features);
  });

  return map;
};

function addGPXLayer(map, features)
{
    const source = new VectorSource({
      features,
    });
    map.addLayer(new VectorLayer({
      source: source,
      style: gpxStyle,
    }));
    map.getView().fit(source.getExtent());
    map.addInteraction(new Modify({source}))
}

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

(async () => {
  document.body.innerHTML = templates.main();
  const mapElem = document.getElementById('map');

  const map = createMap();
  map.setTarget(mapElem);
  map.addOverlay(createOverlay('pt-popup'));

  map.on('pointermove', function(evt) {
    if (evt.dragging) {
      return;
    }
    // TODO what is the diff between 'originalevent' and 'event'?
    const pixel = map.getEventPixel(evt.originalEvent);
    displayFeatureInfo(map, pixel);
  });


  map.on('click', function(evt) {
    //displayFeatureInfo(map, evt.pixel);
    const overlay = map.getOverlayById('pt-popup')
    overlay.setPosition(undefined);
  });

  map.on('singleclick', function(evt) {
  });

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