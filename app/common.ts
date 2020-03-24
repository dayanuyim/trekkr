'use strict';
import * as moment from 'moment-timezone';
import tzlookup from 'tz-lookup';
import {fromLonLat, toLonLat} from 'ol/proj';
import {googleElevation} from './utils';
import symbols from './data/symbols';

const Opt = {
  tz: undefined,
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