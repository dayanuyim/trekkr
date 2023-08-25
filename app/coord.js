import {get as getProjection, addProjection, getTransform, Projection, transform} from 'ol/proj';
import {register} from 'ol/proj/proj4';
import proj4 from 'proj4';

// ref: https://epsg.io/<NUMBER>.js
// ref: http://mutolisp.logdown.com/posts/207563-taiwan-geodetic-coordinate-system-conversion
 proj4.defs([
   ["EPSG:3825", "+title=二度分帶：TWD97 TM2 澎湖 +proj=tmerc +lat_0=0 +lon_0=119 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs"],
   ["EPSG:3826", "+title=二度分帶：TWD97 TM2 台灣 +proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs"],
   ["EPSG:3827", "+title=二度分帶：TWD67 TM2 澎湖 +proj=tmerc +lat_0=0 +lon_0=119 +k=0.9999 +x_0=250000 +y_0=0 +ellps=aust_SA +towgs84=-752,-358,-179,-0.0000011698,0.0000018398,0.0000009822,0.00002329 +units=m"],
   ["EPSG:3828", "+title=二度分帶：TWD67 TM2 台灣 +proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=aust_SA +towgs84=-752,-358,-179,-0.0000011698,0.0000018398,0.0000009822,0.00002329 +units=m +no_defs"],
   //["EPSG:3857", "+title=Web Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs"],
   //["EPSG:4326", '+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees'],
   //["EPSG:900913", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +towgs84=0,0,0,0,0,0,0 +units=m +nadgrids=@null +wktext  +no_defs"],
 ]);

 /*
export const WGS84 = proj4.WGS84;  //proj4.Proj('EPSG:4326');
export const WGS84Web = new proj4.Proj('EPSG:3857');
export const TWD97 = new proj4.Proj('EPSG:3826');
export const TWD67 = new proj4.Proj('EPSG:3828');
export const fromTWD67 = (coords) => proj4(TWD67, WGS84Web, coords);
export const fromTWD97 = (coords) => proj4(TWD97, WGS84Web, coords);
*/

// reigster for openlayers
register(proj4);

export const TWD67 = new Projection({
  code: 'EPSG:3828',
  //center: 252551.25 2611288.37
  extent: [ 145616.57, 2419514.81, 356704.34, 2803869.61 ],
  worldExtent: [119.99, 21.87, 122.06, 25.34 ],
  units: 'm',
});
addProjection(TWD67);

export const TWD97 = new Projection({
  code: 'EPSG:3826',
  //center: 40087.26 2452678.85
  extent: [-461216.18, 1932367.55, 509174.11, 2985577.33],
  worldExtent: [114.32, 17.36, 123.61, 26.96],
  units: 'm',
});
addProjection(TWD97);


//TODO:
// consider addCoordinateTransforms()
// ref: https://openlayers.org/en/latest/examples/wms-custom-proj.html

export const WGS84 = getProjection('EPSG:4326');
export const WEB_MERCATOR = getProjection('EPSG:3857');

export const fromTWD67 = getTransform(TWD67, 'EPSG:3857');
export const fromTWD97 = getTransform(TWD97, 'EPSG:3857');

// @coordinate: [X, Y, Height, Time]
export const toTWD67 = (coordinate) => {
    return (coordinate.length <= 2)?
      transform(coordinate, WEB_MERCATOR, TWD67):
      transform(coordinate.slice(0, 2), WEB_MERCATOR, TWD67).concat(coordinate.slice(2));
}

export const toTWD97 = (coordinate) => {
    return (coordinate.length <= 2)?
      transform(coordinate, WEB_MERCATOR, TWD97):
      transform(coordinate.slice(0, 2), WEB_MERCATOR, TWD97).concat(coordinate.slice(2));
}

const fromTM2Sixcodes = (reftm2, sixcodes, from_fun) => {
  if(!sixcodes && sixcodes.length != 6)
    return undefined;
  const to_tm2 = (ref, code) => (Math.floor(ref / 100000) * 1000 + Number(code)) * 100;

  const [xref, yref] = reftm2;
  const xcode = sixcodes.slice(0, 3);
  const ycode = sixcodes.slice(3, 6);
  const tm2 = [ to_tm2(xref, xcode), to_tm2(yref, ycode) ];
  return from_fun(tm2);
}

export const fromTWD67Sixcodes = (twd67, sixcodes) => fromTM2Sixcodes(twd67, sixcodes, fromTWD67);
export const fromTWD97Sixcodes = (twd97, sixcodes) => fromTM2Sixcodes(twd97, sixcodes, fromTWD97);



// /^[A-HJ-Z]\d{4}[A-H][A-E]\d{2}(\d{2})?$/
function taipowerCoordToTWD67(coord)
{
  // the base of each area of electic coord
  const [EW, EH] = [80 * 1000, 50 * 1000];
  const [X0, Y0] = [250 * 1000, 2500 * 1000];
  const EBASE = {
                             'A': [X0-EW, Y0+5*EH], 'B': [X0, Y0+5*EH], 'C': [X0+EW, Y0+5*EH],
                             'D': [X0-EW, Y0+4*EH], 'E': [X0, Y0+4*EH], 'F': [X0+EW, Y0+4*EH],
                             'G': [X0-EW, Y0+3*EH], 'H': [X0, Y0+3*EH],
    'J': [X0-2*EW, Y0+2*EH], 'K': [X0-EW, Y0+2*EH], 'L': [X0, Y0+2*EH],
    'M': [X0-2*EW, Y0+1*EH], 'N': [X0-EW, Y0+1*EH], 'O': [X0, Y0+1*EH],
    'P': [X0-2*EW, Y0+0*EH], 'Q': [X0-EW, Y0+0*EH], 'R': [X0, Y0+0*EH],
                             'T': [X0-EW, Y0-1*EH], 'U': [X0, Y0-1*EH],
                             'V': [X0-EW, Y0-2*EH], 'W': [X0, Y0-2*EH],
  };

  // preprocess, coord should be a string or a one-dimensional array
  if(Array.isArray(coord) && coord.length >= 1)
    coord = coord[0];

  if(coord.length != 9 && coord.length != 11){
      console.error('invalide taipower coord: ' + coord)
      return undefined;
  }
  if(coord.length == 9)
      coord += '00';  // 10x10 -> 1x1
  coord = coord.toUpperCase();

  const diffA = idx => coord[idx].charCodeAt(0) - 'A'.charCodeAt(0);
  const toint = (begin, end=undefined) => Number(end? coord.slice(begin, end): coord[begin]);

  // sum xy at each level
  let [x, y] = EBASE[coord[0]];
  x += 800*toint(1,3) + 100*diffA(5) + 10*toint(7) + toint(9);
  y += 500*toint(3,5) + 100*diffA(6) + 10*toint(8) + toint(10);
  return [x, y];
}

function getTaipowerCoordBase(xcoeff, ycoeff)
{
    switch (ycoeff) {
        case 5: switch (xcoeff) {
            case -1: return 'A'
            case  0: return 'B'
            case  1: return 'C'
        };
        case 4: switch (xcoeff) {
            case -1: return 'D'
            case  0: return 'E'
            case  1: return 'F'
        };
        case 3: switch (xcoeff) {
            case -1: return 'G'
            case  0: return 'H'
        };
        case 2: switch (xcoeff) {
            case -2: return 'J'
            case -1: return 'K'
            case  0: return 'L'
        };
        case 1: switch (xcoeff) {
            case -2: return 'M'
            case -1: return 'N'
            case  0: return 'O'
        };
        case 0: switch (xcoeff) {
            case -2: return 'P'
            case -1: return 'Q'
            case  0: return 'R'
        };
        case -1: switch (xcoeff) {
            case -1: return 'T'
            case  0: return 'U'
        };
        case -2: switch (xcoeff) {
            case -1: return 'V'
            case  0: return 'W'
        };
    }
    return undefined;
}

function TWD67ToTaipowerCoord(coord)
{
  if(!coord || coord.length < 2) return undefined;
  if(!coord[0] || !coord[1]) return undefined;
  const [x, y] = coord;
  coord = [Math.round(x), Math.round(y)];   //align to the closest 1m x 1m point

  const extract_base = () => {
    const [x, y] = coord;
    const xcoeff = Math.floor((x -  250000) / 80000);
    const ycoeff = Math.floor((y - 2500000) / 50000);
    const base = getTaipowerCoordBase(xcoeff, ycoeff);
    if(!base) return undefined;
    coord = [
        x -  (250000 + (xcoeff * 80000)),
        y - (2500000 + (ycoeff * 50000)),
    ];
    return base;
  }

  const extract_num1 = () => {
    const [x, y] = coord;
    const xcoeff = Math.floor(x / 800);  //0~99
    const ycoeff = Math.floor(y / 500);  //0~99
    coord = [
        x - (xcoeff * 800),
        y - (ycoeff * 500),
    ];
    return [
        xcoeff.toString().padStart(2, '0'),
        ycoeff.toString().padStart(2, '0'),
    ];
  }

  const extract_lttr = () => {
    const [x, y] = coord;
    const xcoeff = Math.floor(x / 100);  //0~7
    const ycoeff = Math.floor(y / 100);  //0~4
    coord = [
        x - (xcoeff * 100),
        y - (ycoeff * 100),
    ];
    return [
        String.fromCharCode(65 + xcoeff),  // 'A'.charCodeAt(0) == 65
        String.fromCharCode(65 + ycoeff),
    ];
  }

  const extract_num2 = () => {
    const [x, y] = coord;
    const xcoeff = Math.floor(x / 10);  //0~9
    const ycoeff = Math.floor(y / 10);  //0~9
    coord = [
        x - (xcoeff * 10),
        y - (ycoeff * 10),
    ];
    return [
        xcoeff.toString(),
        ycoeff.toString(),
    ];
  }

  const extract_num3 = () => {
    const [x, y] = coord;  // [0~9, 0~9]
    return [
        x.toString(),
        y.toString(),
    ];
  }

  const base = extract_base();  if(!base) return undefined;
  const num1 = extract_num1();
  const lttr = extract_lttr();
  const num2 = extract_num2();
  const num3 = extract_num3();

  const print = ([x,y]) => x + y;
  return base + print(num1) + print(lttr) + print(num2) + print(num3);
}

export function fromTaipowerCoord(coord){
  return fromTWD67(taipowerCoordToTWD67(coord));   //taipower -> twd67 -> webmercator
}

export function toTaipowerCoord(coord){
  return TWD67ToTaipowerCoord(toTWD67(coord));
}