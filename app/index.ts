'use strict';

import '../node_modules/ol/ol.css';
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
  if(!symName)
    return symbols['waypoint'];

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

//TODO what is exactly @cooriante?
const toElevation = function(coordinate)
{
  const values = coordinate.toString().split(',');
  return (values.length >= 3)? values[2]: 0.0;
}

function setWptPopupContent(overlay, feature)
{
  const name = feature.get('name') || feature.get('desc');
  const license = getSymbol(feature.get('sym')).license;
  const coordinates = feature.getGeometry().getCoordinates()
  const elevation = toElevation(coordinates);
  const location = toStringXY(toTWD67(coordinates)); //TODO allow to choose EPSG

  const contentElem = overlay.getElement().querySelector('.ol-popup-content');
  contentElem.innerHTML = templates.wptPopup({ name, location, elevation, license });
}


const displayFeatureInfo = function (map, pixel) {
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
        //var hdms = toStringHDMS(toLonLat(coordinate));
        const overlay = map.getOverlayById('wpt-popup');
        setWptPopupContent(overlay, feature);
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

  dragAndDropInteraction.on('addfeatures', function(event) {
    const source = new VectorSource({
      features: event.features
    });
    map.addLayer(new VectorLayer({
      source: source,
      style: gpxStyle,
    }));
    map.getView().fit(source.getExtent());
    map.addInteraction(new Modify({source}))
  });

  return map;
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

  const map = createMap();
  map.setTarget(mapElem);
  map.addOverlay(createOverlay('wpt-popup'));

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