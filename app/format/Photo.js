/**
 * @module ./format/PhotoFeature
 */
import FeatureFormat from 'ol/format/Feature.js';

import * as exif from 'exifreader'
import { transform } from 'ol/proj';
import { WGS84 } from '../coord';
import { mkWptFeature } from '../gpx';

/**
 * @classdesc
 * class for Photo feature formats.
 * read feature from geo location of EXIF
 *
 * @api
 */
class Photo extends FeatureFormat {
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
    const meta = exif.load(/** @type {ArrayBuffer} */ source)
    //console.log(meta);

    const lon = this._meta_longitude(meta);
    const lat = this._meta_latitude(meta);
    if(!lon || !lat)
      return null;

    let coords = transform([lon, lat], this.dataProjection, options.featureProjection);  //fromLonLat()
    coords.push(this._meta_altitude(meta));
    coords.push(this._meta_time(meta));

    const wpt = mkWptFeature(coords, {
      name: this._meta_name(meta) || 'WPT',
    });
    return [wpt];
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
    return new Date(y, m-1, d, hh, mm, ss);  // view as local time by Date
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
