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
