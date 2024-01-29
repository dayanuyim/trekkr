/**
 * @module ./ol-ext/format/Photo
 */
import FeatureFormat from 'ol/format/Feature.js';
import RenderFeature from 'ol/render/Feature';

import * as exif from 'exifreader'
import { transform } from 'ol/proj';
import { WGS84 } from '../../coord';
import { olWptFeature } from '../gpx-common';
import { epochseconds } from '../../lib/utils';

function toRenderFeature(feature){
  return new RenderFeature(
    feature.getGeometry().getType(),
    feature.getGeometry().getCoordinates(),
    [],   // what is the parameter 'ends'??
    feature.getProperties(),
    feature.getId()
  );
}

/**
 * @classdesc
 * class for Photo feature formats.
 * read feature from geo location of EXIF
 *
 * @api
 */
class Photo extends FeatureFormat {

  _listeners = {};

  /**
   * @param {Options} [options] Options.
   */
  constructor(options) {
    super();

    options = options ? options : {};

    /**
     * @type {import("../proj/Projection.js").default}
     */
    this.dataProjection = WGS84;
  }

  setListener(event, listener){
      this._listeners[event] = listener;
      return this;
  }

  /**
   * @return {import("ol/format/Feature.js").Type} Format.
   */
  getType() {
    return 'arraybuffer';
  }

  /**
   * Read a single feature.
   *
   * @param {Document|Element|Object|string} source Source.
   * @param {import("ol/format/Feature.js").ReadOptions} [options] Read options.
   * @return {import("ol/Feature.js").default} Feature.
   * @api
   */
  readFeature(source, options) {
    const features = this.readFeatures(source, options);
    if (features.length > 0) {
      return features[0];
    }
    return null;
  }

  /**
   * Read all features from a feature collection.
   *
   * @param {Document|Element|Object|string} source Source.
   * @param {import("ol/format/Feature.js").ReadOptions} [options] Options.
   * @return {Array<import("ol/Feature.js").default>} Features.
   * @api
   */
  readFeatures(source, options) {
    if (!source) {
      return [];
    }

    const url = window.URL || window.webkitURL;

    // read geo location
    const meta = exif.load(/** @type {ArrayBuffer} */ source)
    //console.log(meta);
    const lon = this._meta_longitude(meta);
    const lat = this._meta_latitude(meta);
    const time = this._meta_time(meta);

    const image_obj = () => ({
      url: url.createObjectURL(new Blob([source], { type: "image/jpeg" })),
      size: this._meta_size(meta),
    });

    // check if the feature exits
    if(time){
      const feature = this._listeners['featureexists']?.(time);
      if(feature){
        if(!feature.get('image')){
          feature.set('image', image_obj());
        }
        return [ toRenderFeature(feature) ]; //return for map view to fit it.
      }
    }

    let coords;
    // check if having geo location
    if(lon && lat){
      coords = transform([lon, lat], this.dataProjection, options.featureProjection);  //fromLonLat()
      coords.push(this._meta_altitude(meta));
      coords.push(time);
    }
    // check if the coords can be estimated
    else if(time){
      coords = this._listeners['lookupcoords']?.(time);
      if(!coords) console.log(`The photo time '${meta.DateTimeOriginal.description}' is not in the range.`);
    }

    //make feature from coords
    if(coords){
      const feature = olWptFeature(coords, {
        name: this._meta_name(meta) || 'WPT',
        image: image_obj(),
      });
      return [feature];
    }

    return null;
  }

  _meta_altitude(meta){
    if(!meta.GPSAltitude) return null;
    const [m, n] = meta.GPSAltitude.value;
    const ref = (meta.GPSAltitudeRef)? meta.GPSAltitudeRef.value: 0;
    return ref + m / n;
  }

  _meta_longitude(meta){
    if(!meta.GPSLongitude) return null;
    const ref = (meta.GPSLongitudeRef && meta.GPSLongitudeRef.value[0] == 'W')? -1: 1;
    return ref * meta.GPSLongitude.description;
  }

  _meta_latitude(meta){
    if(!meta.GPSLatitude) return null;
    const ref = (meta.GPSLatitudeRef && meta.GPSLatitudeRef.value[0] == 'S')? -1: 1;
    return ref * meta.GPSLatitude.description;
  }

  _meta_name(meta){
    if(!meta.ImageDescription) return null;
    return meta.ImageDescription.description;
  }

  _meta_time(meta){
    if(!meta.DateTimeOriginal) return null;
    const [y, m , d, hh, mm, ss] = meta.DateTimeOriginal.description.split(/[: ]/);  // local time
    //TODO: for accuracy, we should use geo lacation to get tz, then get UTC time, not use the system's tz of Date()
    const datetime = new Date(y, m-1, d, hh, mm, ss);  // view as local time by Date
    return epochseconds(datetime);
  }

  _meta_size(meta){
    if(meta['Image Width'] && meta['Image Height']){
      const width = meta['Image Width'].value;
      const height = meta['Image Height'].value;
      //TODO: maybe it is better to let caller to check the orientation
      if(meta.Orientation && meta.Orientation.value >= 5) // rotate 90deg or 270deg
        return {width: height, height: width};
      else
        return {width, height};
    }
    return null;
  }

  /**
   * Read the projection from the source.
   *
   * @param {Document|Element|Object|string} source Source.
   * @return {import("ol/proj/Projection.js").default} Projection.
   * @api
   */
  readProjection(source) {
    return this.dataProjection;
  }
}

export default Photo;
