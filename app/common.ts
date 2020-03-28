'use strict';

import * as moment from 'moment-timezone';
import tzlookup from 'tz-lookup';
import {fromLonLat, toLonLat} from 'ol/proj';
import elevationApi from 'google-elevation-api';
import conf from './data/conf';
import symbols from './data/symbols.json';
import { Icon as IconStyle, Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';

const Opt = {
  tz: undefined,
}

// Promisify and Accept only a location
export function googleElevation(lat, lon)
{
  return new Promise((resolve, reject)=>{
    elevationApi({
      key: conf.googleMapKey,
      locations: [
        [lat, lon],
      ]
    }, (err, locations) => {
      if(err) reject(err);
      else resolve(locations[0].elevation);
    });
  });
}
function getElevationOfCoords (coordinates) {
  if(coordinates.length > 2 && coordinates[2] < 10000.0){
    return coordinates[2];
  }
  return undefined;
};

function getEpochOfCoords(coordinates){
  const last = coordinates.length -1;
  if(coordinates.length > 2 && coordinates[last] > 10000.0){
    return coordinates[last];
  }
  return undefined;
};

export const getElevationByCoords = async (coordinates) => {
  const ele = getElevationOfCoords(coordinates);
  if(ele)
    return {value: ele, est: false};

  //get est. elevation from google
  const [lon, lat] = toLonLat(coordinates);
  try{
    const ele = await googleElevation(lat, lon);
    return {value: ele, est: true}
  }catch(err){
    console.log(`Google Elevation Error: ${err}`);
    return undefined;
  }
};

export function getLocalTimeByCoords(coordinates)
{
  const epoch = getEpochOfCoords(coordinates);
  if(!epoch)
    return undefined;

  //TODO the optimization is really needed?
  if(!Opt.tz){
    const [lon, lat] = toLonLat(coordinates);
    Opt.tz = tzlookup(lat, lon);
  }

  return moment.unix(epoch).tz(Opt.tz);
}

const symDir = './images/sym';
export function toSymPath(sym, size=32)
{
  return `${symDir}/${size}/${sym.filename}`;
}

export function getSymbol(symName){
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

export const gpxStyle = (feature) => {
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

