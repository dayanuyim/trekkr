'use strict';

import * as moment from 'moment-timezone';
import tzlookup from '@photostructure/tz-lookup';

import {Feature} from 'ol';
import {Point, LineString} from 'ol/geom';
import {getLength, getDistance } from 'ol/sphere';
import {fromLonLat, toLonLat} from 'ol/proj';
import {format as fmtCoordinate} from 'ol/coordinate';
import { getTrkptIndices, isTrkFeature, isWptFeature } from './ol/gpx-common';

//import elevationApi from 'google-elevation-api';
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import Opt from './opt';

const Param = {
  tz: undefined,
}

// The Functon is for:
//   1. the color name is not in CSS
//   2. convert the color name to the rgb hex string
export function colorCode(color)
{
    const codes = {
      "aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
      "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
      "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
      "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
      "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
      "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
      "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
      "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
      "honeydew":"#f0fff0","hotpink":"#ff69b4",
      "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
      "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
      "lightgray":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
      "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
      "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
      "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
      "navajowhite":"#ffdead","navy":"#000080",
      "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
      "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
      "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
      "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
      "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
      "violet":"#ee82ee",
      "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
      "yellow":"#ffff00","yellowgreen":"#9acd32", "darkyellow": "#ffcc00"
    };

    if(!color) return color;
    if(color.startsWith("#")) return color;
    return codes[color.toLowerCase()] || color;   // return original color if the code is not found
}

export function companionColor(color){
  switch(color?.toLowerCase()){
    case 'white':       return 'Black';
    case 'lightgray':   return 'DarkGray';
    case 'darkgray':    return 'LightGray';
    case 'black':       return 'White';
    case 'yellow':      return 'DarkYellow';
    case 'darkyellow':  return 'Yellow';
    case 'magenta':     return 'DarkMagenta';
    case 'darkmagenta': return 'Magenta';
    case 'cyan':        return 'DarkCyan';
    case 'darkcyan':    return 'Cyan';
    case 'blue':        return 'DarkBlue';
    case 'darkblue':    return 'Blue';
    case 'green':       return 'DarkGreen';
    case 'darkgreen':   return 'Green';
    case 'red':         return 'DarkRed';
    case 'darkred':     return 'Red';
    default:            return undefined;
  }
}

export function complementaryColor(color){
  const code = colorCode(color);
  if(!code || !code.startsWith('#')) return undefined;
  const r = parseInt(code.slice(1, 3), 16);
  const g = parseInt(code.slice(3, 5), 16);
  const b = parseInt(code.slice(5, 7), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#202020' : '#f0f0f0';
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

// Google Map ref:
//   https://developers.google.com/maps/documentation/javascript/reference/elevation

let elevation_instance = null;

async function getGoogleElevationService(){
  if (!elevation_instance) {
    setOptions({
      key: Opt.data.gmapkey,
      v: 'quarterly',
    });
    const { ElevationService } = await importLibrary("elevation");
    elevation_instance = new ElevationService();
  }
  return elevation_instance;
}

/**
 * 根據座標取得高度
 * @param {number} lat latitude
 * @param {number} lng longitude
 */
async function googleElevation(lat, lng) {
  try {
    const elevator = await getGoogleElevationService(); // 應該有快取，似乎沒必要做 singleton?
    const { results } = await elevator.getElevationForLocations({
      locations: [{ lat, lng }]
    });

    if(results?.length > 0)
      return results[0].elevation;
    return console.error(`Google Elevation API returned no result for location (${lat}, ${lng})`);
  }
  catch (error) {
    //const { ElevationStatus } = await importLibrary("elevation") as google.maps.ElevationLibrary;
    return console.error("query Elevation API error:", error);
  }
}

/* TODO: removing it in the next version. this is old implement using 'google-elevation-api'.
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
*/

export const getEstElevation = async (coord) => {
  const [lon, lat] = toLonLat(coord);
  try{
    return await googleElevation(lat, lon);
  }
  catch(err){
    console.error(`Google Elevation Error: ${err}`);
    return undefined;
  }
};

export function getLocalTimeByCoord(coord, layout?)
{
  const epoch = getEpochOfCoord(coord, layout);
  if(!epoch)
    return undefined;

  //cache tz to optimize since tzlookup is a slow operation
  // TODO: but what is the timeing to clear the cache?
  if(!Param.tz){
    const [lon, lat] = toLonLat(coord);
    Param.tz = tzlookup(lat, lon);
  }

  return moment.unix(epoch).tz(Param.tz);
}

export interface FilterRule {
  enabled: boolean;
  type: string;
  text: string;
}

export function matchRule({enabled, type, text}: FilterRule, str: string){
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
    if(Opt.update('rt.gpx_filename', filename))
      refreshDocTitle();
  }
}

export function setDocTitle(title){
  if(title && Opt.update('rt.title', title)){
    refreshDocTitle();
  }
}


//================================= Data collectd from a feature =======================

export function buildFeatureData(feature) {
  // restore the underlying wpt
  feature = _wpt_feature_of(feature) || feature;

  // trk data
  const track = _track_feature_of(feature);                // for trkpt
  const trk = track ? {
    name: track.get('name'),
    desc: track.get('desc'),
    color: track.get('color'),
  } : undefined;

  // pt data
  const pt = {
    name: feature.get('name'),                        //maybe undefined
    desc: feature.get('desc'),                        //maybe undefined
    sym: feature.get('sym'),                          //maybe undefined
    coord: feature.getGeometry().getCoordinates(),    //x, y, [ele, [time]]
    image: feature.get('image'),
    is_virtual: track && track.getGeometry().getLayout() != feature.getGeometry().getLayout(),
  };
  if (pt.is_virtual) // get data from other dimensions of its track, for example: XY -> XYZM
    pt.coord = track.getGeometry().getClosestPoint(pt.coord);

  //trkseg info
  const trkseg = getTrksegInfo(track, pt.coord);

  return {
    feature: track ? track : feature,  // trk(for rm/split/join) or wpt (for rm)
    data: {                            // for creating/updating
      trk,
      pt,
      trkseg,
    }
  };
}


function getTrksegInfo(trk_feat, webcoord: number[]) {
  if (!trk_feat)
    return null;

  const trksegs = trk_feat.getGeometry().getCoordinates();

  //TODO: This is duplicated with the GPX splitTrack(), are there better way to aovid the duplication?
  // get the Trkseg index and Trkpt index of the current pt
  const time = getEpochOfCoord(webcoord);
  const layout = trk_feat.getGeometry().getLayout();
  const has_time = time && layout.includes('M');    // the point and track both have time info
  const test_by = has_time ? { time } : { coord: webcoord };
  const [idx, pt_idx] = getTrkptIndices(trksegs, test_by);
  //console.log('trkpt indices', idx, pt_idx, trksegs[idx][pt_idx], new Date(time*1000));

  let points = null;
  let vt_dist = 0;
  if (idx >= 0) {
    const calc_speed = (dd, dt) => dt ? dd / dt * 3.6 : 0; // m/s -> km/h

    let dist = 0;
    let last_time = 0;

    const trkseg = trksegs[idx];
    const lonlats = trkseg.map(coord => toLonLat(coord));

    points = lonlats.map((lonlat, i) => {
      const diff = i ? getDistance(lonlat, lonlats[i - 1]) : 0;
      const time = getEpochOfCoord(lonlat, layout);
      const speed = (time && last_time) ? calc_speed(diff, time - last_time) : 0;
      last_time = time;
      dist += diff;
      return {
        // TODO: // lon lat 是必要的嗎？目前看來不會用到
        lon: lonlat[0],
        lat: lonlat[1],
        // TODO: coord/ele/time 有必要拆開嗎？
        coord: trkseg[i].slice(0, 2),          // web coord, for showing in the map
        ele: getEleOfCoord(lonlat, layout),
        time,
        dist,
        // TODO: 先不要計算速度，因為不一定會用到
        speed,
      };
    });

    if (pt_idx >= 0) {
      vt_dist = getDistance(lonlats[pt_idx], toLonLat(webcoord));  // distance between virtual trkpt and the real trkpt
    }
  }

  return {
    idx,
    pt_idx,
    vt_dist,
    points,
  };
}

function _track_feature_of(trkpt: Feature<Point>) {
  return trkpt.get('features')?.find(isTrkFeature);
}

function _wpt_feature_of(trkpt: Feature<Point>){
  return trkpt.get('features')?.find(isWptFeature);
}
