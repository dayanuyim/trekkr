
import Graticule from 'ol/layer/Graticule';
import { equivalent as equivalentProjection, get as getProjection, getTransform, transformExtent } from 'ol/proj';
import { getCenter, intersects, equals, getIntersection, isEmpty } from 'ol/extent.js';
import { clamp } from 'ol/math.js';
import LineString from 'ol/geom/LineString.js';
import GeometryLayout from 'ol/geom/GeometryLayout.js';
import {line as geomLine} from 'ol/geom/flat/geodesic';  //@@ hack lib to export 'line' function


class ProjGraticule extends Graticule {

    constructor(opt) {
        const proj = (opt && opt.projection) ? (typeof p === "string") ?
            getProjection(opt.projection) :
            opt.projection :
            getProjection('EPSG:4326');   //default WGS84;

        super(Object.assign({
            showLabels: true,
            maxLines: 10,
            extent: transformExtent(proj.getExtent(), proj, 'EPSG:3857'),  //to Web Mercator
        }, opt));

        this.gridProjection = proj;
    }

    /**
     * Define the valid extent of gridProjection (ex TWD67), and also the projection (WEBMercator)
     * NOTE: OL use the WEBMercator's worldExtent as the valid extent,
     *       because WEBMercator's worldExtent === WGS84's extent. 
     *       But I think this is a senmantic misleading.
     *       OL should just use WGS84's extent, i.g., gridProjection's extent directly, 
     *       and nothing about 'worldExtent'.
     */
    updateProjectionInfo_(projection) {
        //@@ epsg4326Projection  => this.gridProjection
        //@@ projection.getWorldExtent()  => this.gridProjection.getExtent()
        //var epsg4326Projection = getProjection('EPSG:4326');
        //var worldExtent = projection.getWorldExtent();
        var validExtent = this.gridProjection.getExtent();
        var validExtentP = transformExtent(validExtent, this.gridProjection, projection);
        this.maxLat_ = validExtent[3];
        this.maxLon_ = validExtent[2];
        this.minLat_ = validExtent[1];
        this.minLon_ = validExtent[0];
        this.maxLatP_ = validExtentP[3];
        this.maxLonP_ = validExtentP[2];
        this.minLatP_ = validExtentP[1];
        this.minLonP_ = validExtentP[0];
        this.fromLonLatTransform_ = getTransform(this.gridProjection, projection);
        this.toLonLatTransform_ = getTransform(projection, this.gridProjection);
        //@@
        //this.projectionCenterLonLat_ = this.toLonLatTransform_(getCenter(projection.getExtent()));
        this.projectionCenterLonLat_ = this.gridProjection.getExtent() ?
            getCenter(this.gridProjection.getExtent()) :
            this.toLonLatTransform_(getCenter(projection.getExtent()));
        this.projection_ = projection;
    };

    /**
     * @param {import("../extent.js").Extent} extent Extent.
     * @param {import("../coordinate.js").Coordinate} center Center.
     * @param {number} resolution Resolution.
     * @param {number} squaredTolerance Squared tolerance.
     * @private
     */
    createGraticule_(extent, center, resolution, squaredTolerance) {
        var interval = this.getInterval_(resolution);
        if (interval == -1) {
            this.meridians_.length = 0;
            this.parallels_.length = 0;
            if (this.meridiansLabels_) {
                this.meridiansLabels_.length = 0;
            }
            if (this.parallelsLabels_) {
                this.parallelsLabels_.length = 0;
            }
            return;
        }
        var centerLonLat = this.toLonLatTransform_(center);
        var centerLon = centerLonLat[0];
        var centerLat = centerLonLat[1];
        var maxLines = this.maxLines_;
        var cnt, idx, lat, lon;

        var validExtent = [
            Math.max(extent[0], this.minLonP_),
            Math.max(extent[1], this.minLatP_),
            Math.min(extent[2], this.maxLonP_),
            Math.min(extent[3], this.maxLatP_)
        ];
        //@@ use gridProjection
        //validExtent = transformExtent(validExtent, this.projection_, 'EPSG:4326');
        validExtent = transformExtent(validExtent, this.projection_, this.gridProjection);
        var maxLat = validExtent[3];
        var maxLon = validExtent[2];
        var minLat = validExtent[1];
        var minLon = validExtent[0];
        // Create meridians
        centerLon = Math.floor(centerLon / interval) * interval;
        lon = clamp(centerLon, this.minLon_, this.maxLon_);
        idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, 0);
        cnt = 0;
        while (lon != this.minLon_ && cnt++ < maxLines) {
            lon = Math.max(lon - interval, this.minLon_);
            idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
        }
        lon = clamp(centerLon, this.minLon_, this.maxLon_);
        cnt = 0;
        while (lon != this.maxLon_ && cnt++ < maxLines) {
            lon = Math.min(lon + interval, this.maxLon_);
            idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
        }
        this.meridians_.length = idx;
        if (this.meridiansLabels_) {
            this.meridiansLabels_.length = idx;
        }
        // Create parallels
        centerLat = Math.floor(centerLat / interval) * interval;
        lat = clamp(centerLat, this.minLat_, this.maxLat_);
        idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, 0);
        cnt = 0;
        while (lat != this.minLat_ && cnt++ < maxLines) {
            lat = Math.max(lat - interval, this.minLat_);
            idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
        }
        lat = clamp(centerLat, this.minLat_, this.maxLat_);
        cnt = 0;
        while (lat != this.maxLat_ && cnt++ < maxLines) {
            lat = Math.min(lat + interval, this.maxLat_);
            idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
        }
        this.parallels_.length = idx;
        if (this.parallelsLabels_) {
            this.parallelsLabels_.length = idx;
        }
    };

    getMeridian_(lon, minLat, maxLat, squaredTolerance, index) {
        //@@ use 'this'.meridian, not geodesic's
        var flatCoordinates = this.meridian(lon, minLat, maxLat, this.projection_, squaredTolerance);
        var lineString = this.meridians_[index];
        if (!lineString) {
            lineString = new LineString(flatCoordinates, GeometryLayout.XY);
            this.meridians_[index] = lineString;
        }
        else {
            lineString.setFlatCoordinates(GeometryLayout.XY, flatCoordinates);
            lineString.changed();
        }
        return lineString;
    };

    meridian(lon, lat1, lat2, projection, squaredTolerance) {
        const line = geomLine;
        return line(
            /**
             * @param {number} frac Fraction.
             * @return {import("../../coordinate.js").Coordinate} Coordinate.
             */
            function (frac) {
                return [lon, lat1 + ((lat2 - lat1) * frac)];
            }, getTransform(this.gridProjection, projection), squaredTolerance);
    }

    getParallel_(lat, minLon, maxLon, squaredTolerance, index) {
        //@@ use 'this'.meridian, not geodesic's
        var flatCoordinates = this.parallel(lat, minLon, maxLon, this.projection_, squaredTolerance);
        var lineString = this.parallels_[index];
        if (!lineString) {
            lineString = new LineString(flatCoordinates, GeometryLayout.XY);
        }
        else {
            lineString.setFlatCoordinates(GeometryLayout.XY, flatCoordinates);
            lineString.changed();
        }
        return lineString;
    };

    parallel(lat, lon1, lon2, projection, squaredTolerance) {
        //var epsg4326Projection = getProjection('EPSG:4326');
        const line = geomLine;
        return line(
        /**
         * @param {number} frac Fraction.
         * @return {import("../../coordinate.js").Coordinate} Coordinate.
         */
        function (frac) {
            return [lon1 + ((lon2 - lon1) * frac), lat];
        }, getTransform(this.gridProjection, projection), squaredTolerance);
    }
}

export default ProjGraticule;
