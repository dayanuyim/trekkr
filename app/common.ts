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

export function colorCode(color){
  switch(color.toLowerCase()) {
    case 'darkyellow': return '#ffcc00';
    default:           return color;
  }
}

export function gmapUrl(coord){
    return fmtCoordinate(toLonLat(coord), `https://www.google.com.tw/maps/place/{y}+{x}/@{y},{x},${Opt.zoom}z?hl=zh-TW`, 7);
}

export function getLayoutOfCoord(coord){
  switch(coord.length){
    case 2: return 'XY';
    case 3: return (coord[2] < 10000.0)? 'XYZ': 'XYM';
    case 4: return 'XYZM';
    default:
      console.error('cannot determine the layout of coord', coord);
      return undefined;
  }
}

export function getXYZMOfCoord(coord, layout?){
  layout = layout || getLayoutOfCoord(coord);
  switch(layout){
    case 'XY':   return coord.concat([undefined, undefined]);
    case 'XYZ':  return coord.concat([undefined]);
    case 'XYM':  return [coord[0], coord[1], undefined, coord[2]];
    case 'XYZM': return coord;
    default:
      console.error(`unknown layout '${layout}' to get xyzm of coord`);
      return undefined;
  }
}

export function getEleOfCoord(coord, layout?) {
  layout = layout || getLayoutOfCoord(coord);
  switch(layout){
    case 'XY':   return undefined;
    case 'XYZ':  return coord[2];
    case 'XYM':  return undefined;
    case 'XYZM': return coord[2];
    default:
      console.error(`unknown layout '${layout}' to get ele of coord`);
      return undefined;
  }
};

export function setEleOfCoord(coord, ele, layout?) {
  layout = layout || getLayoutOfCoord(coord);
  switch(layout){
    case 'XY':   coord.push(ele); break;
    case 'XYM':  coord.splice(2, 0, ele);  break;
    case 'XYZ':  coord[2] = ele;  break;
    case 'XYZM': coord[2] = ele;  break;
    default:
      console.error(`unknown layout '${layout}' to set ele of coord`);
  }
}

export function getEpochOfCoord(coord, layout?){
  layout = layout || getLayoutOfCoord(coord);
  switch(layout){
    case 'XY':   return undefined;
    case 'XYZ':  return undefined;
    case 'XYM':  return coord[2];
    case 'XYZM': return coord[3];
    default:
      console.error(`unknown layout '${layout}' to get epoch of coord`);
      return undefined;
  }
};

// Promisify and Accept only a location
function googleElevation(lat, lon)
{
  return new Promise((resolve, reject)=>{
    elevationApi({
      key: Opt.data.gmapkey,
      locations: [
        [lat, lon],
      ]
    }, (err, locations) => {
      if(err) reject(err);
      else resolve(locations[0].elevation);
    });
  });
}

export const getEstElevation = async (coord) => {
  const [lon, lat] = toLonLat(coord);
  try{
    return await googleElevation(lat, lon);
  }
  catch(err){
    console.log(`Google Elevation Error: ${err}`);
    return undefined;
  }
};

export function getLocalTimeByCoord(coord)
{
  const epoch = getEpochOfCoord(coord);
  if(!epoch)
    return undefined;

  //cache tz to optimize since tzlookup is a slow operation
  if(!Param.tz){
    const [lon, lat] = toLonLat(coord);
    Param.tz = tzlookup(lat, lon);
  }

  return moment.unix(epoch).tz(Param.tz);
}

export function matchRule({enabled, type, text}, str: string){
  if(!str) return false;
  if(!enabled) return false;
  switch(type){
      case "contains":   return str.includes(text);
      case "startswith": return str.startsWith(text);
      case "endswith":   return str.endsWith(text);
      case "equals":     return str == text;
      case "regex":      return str.match(text);
      default:           return false;
  };
}

function refreshDocTitle(){

  const {title, gpx_filename: filename} = Opt.rt;

  const titlestr = [
    title,
    filename,
  ].filter(Boolean).join(":");

  if(titlestr)
    document.title = `Trekkr [${titlestr}]`;
}

export function setGpxFilename(path: string, overwrite: boolean = false){
  const filename = path?.split(/[\\/]/).pop();
  if(filename && filename.toLowerCase().endsWith(".gpx") && (overwrite || !Opt.rt.gpx_filename)){
    Opt.rt.gpx_filename = filename;
    refreshDocTitle();
  }
}

export function setDocTitle(title){
  if(title){
    Opt.rt.title = title;
    refreshDocTitle();
  }

}