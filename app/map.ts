import {defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control} from 'ol/control';
import {DragAndDrop, Modify} from 'ol/interaction';
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

import {getSymbol, toSymPath} from './common'
import PtPopupOverlay from './pt-popup';
import Cookie from './cookie';

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


const layers = {
  OSM: new TileLayer({
    source: new OSM(),
  }),
  OSM_: new TileLayer({
    source: new XYZ({
      url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    })
  }),
  RUDY: new TileLayer({
    source: new XYZ({
      //url: 'http://rudy-daily.tile.basecamp.tw/{z}/{x}/{y}.png'
      url: 'http://rudy.tile.basecamp.tw/{z}/{x}/{y}.png'
      //url: 'https://rs.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png'
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

export const createMap = (target) => {
  const map = new Map({
    target,
    controls: defaultControls().extend([
      new ScaleLine(),
      new OverviewMap(),
      new ZoomSlider(),
      //new SaveCookieControl(),
      genDragGpxInteraction(),
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
      center: [Cookie.get().x, Cookie.get().y],
      zoom: Cookie.get().zoom,
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
      TopoJSON
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
      source: source,
      style: gpxStyle,
    }));
    map.getView().fit(source.getExtent(), {maxZoom: 16});
    map.addInteraction(new Modify({source}))
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
function saveCookie(map)
{
    const cookie = Cookie.get();
    [cookie.x, cookie.y] = map.getView().getCenter();
    cookie.zoom = map.getView().getZoom();
    cookie.save();
}

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

  map.on('moveend', function(e){
    saveCookie(e.map);
  });
}

const showHoverFeatures = function (e) {
  const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?
  const features = e.map.getFeaturesAtPixel(pixel);

  e.map.getTarget().style.cursor = (features.length > 0)? 'pointer': '';

  /*
  // prefer to show point solely
  const points = features.filter(feature => feature.getGeometry().getType() === 'Point');
  if (points.length >  0) 
    features = points;
    */
  features.forEach(feature => {
    switch (feature.getGeometry().getType()) {
      case 'Point': {   // Waypoint or Track point
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
        //const name = feature.get('name');
        //console.log(`track name: ${name}`);
        break;
      }
    }
  });
};