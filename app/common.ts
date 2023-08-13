'use strict';

import * as moment from 'moment-timezone';
import tzlookup from 'tz-lookup';
import {fromLonLat, toLonLat} from 'ol/proj';
import {format as fmtCoordinate} from 'ol/coordinate';
import elevationApi from 'google-elevation-api';
import Opt from './opt';

const Param = {
  tz: undefined,
}

export function gmapUrl(coord){
    return fmtCoordinate(toLonLat(coord), `https://www.google.com.tw/maps/@{y},{x},${Opt.zoom}z?hl=zh-TW`, 7);
}

export function getXYZMOfCoords(coords, layout?){
  switch(layout){
    case 'XY':   return coords.concat([undefined, undefined]);
    case 'XYZ':  return coords.concat([undefined]);
    case 'XYM':  return [coords[0], coords[1], undefined, coords[2]];
    case 'XYZM': return coords;
    default:
      return (coords.length == 4)? coords: [
        coords[0],
        coords[1],
        getEleOfCoords(coords),
        getEpochOfCoords(coords)
      ];
  }
}

function getEleOfCoords(coords, layout?) {
  if(layout){
    return (layout == 'XYZ' || layout == 'XYZM')? coords[2]: undefined;
  }
  if(coords.length > 2 && coords[2] < 10000.0){   //geometry.getLayout() == 'XYZ' or 'XYZM'
    return coords[2];
  }
  return undefined;
};

export function getEpochOfCoords(coords, layout?){
  if(layout){
    return (layout == 'XYM' || layout == 'XYZM')?  coords[coords.length-1]: undefined;
  }
  const last = coords.length -1;
  if(coords.length > 2 && coords[last] > 10000.0){   //geometry.getLayout() == 'XYM' or 'XYZM
    return coords[last];
  }
  return undefined;
};

// Promisify and Accept only a location
function googleElevation(lat, lon)
{
  return new Promise((resolve, reject)=>{
    elevationApi({
      key: Opt.googleMapKey,
      locations: [
        [lat, lon],
      ]
    }, (err, locations) => {
      if(err) reject(err);
      else resolve(locations[0].elevation);
    });
  });
}
export const getEleByCoords = async (coordinates) => {
  const ele = getEleOfCoords(coordinates);
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

  //cache tz to optimize since tzlookup is a slow operation
  if(!Param.tz){
    const [lon, lat] = toLonLat(coordinates);
    Param.tz = tzlookup(lat, lon);
  }

  return moment.unix(epoch).tz(Param.tz);
}
