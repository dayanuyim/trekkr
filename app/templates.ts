import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';
import {toTWD97, toTWD67} from './coord';
import {toLonLat} from 'ol/proj';
import {toStringXY, format} from 'ol/coordinate';

//TODO what is exactly @cooriante?
Handlebars.registerHelper('ele', function(coordinate) {
  const values = coordinate.toString().split(',');
  return (values.length >= 3)? Number(values[2]).toFixed(1): '0.0';
});

Handlebars.registerHelper('twd67', function(coordinate) {
    return toStringXY(toTWD67(coordinate));
});

Handlebars.registerHelper('twd97', function(coordinate) {
    return toStringXY(toTWD97(coordinate));
});

Handlebars.registerHelper('wgs84', function(coordinate) {
    return toStringXY(toLonLat(coordinate), 7);
});

Handlebars.registerHelper('gmap', function(coordinate) {
    return format(toLonLat(coordinate), 'https://www.google.com.tw/maps/@{y},{x},15z?hl=zh-TW', 7);
});

export const main = Handlebars.compile(`
    <div id="map" class="ol-map-container"></div>

    <div id="pt-popup" class="ol-popup">
        <a href="#" class="ol-popup-closer"></a>
        <div class="ol-popup-content"></div>
    </div>
`);

export const ptPopup = Handlebars.compile(`
    <div class="pt-name">{{name}}</div>
    <div class="pt-coord">
        <select class="pt-coord-title" dir="rtl">
            <option value="twd67">TWD67</option>
            <option value="twd97">TWD97</option>
            <option value="wgs84">WGS84</option>
        </select>

        <span class="pt-coord-val pt-coord-val-twd67">{{twd67 coordinate}}</span>
        <span class="pt-coord-val pt-coord-val-twd97">{{twd97 coordinate}}</span>
        <span class="pt-coord-val pt-coord-val-wgs84">{{wgs84 coordinate}}</span>

        <a class="pt-gmap" href="{{gmap coordinate}}" target="_blank">
            <img src="./images/googleg.png" alt="Google G">
        </a>
    </div>

    <div class="pt-ele">
        <span class="pt-ele-title">ELE.</span>
        <span>{{ele coordinate}} m</span>
    </div>
    {{#if symbol}}
        <footer class="sym-license">&copy; The icon made by
            <a href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
            <a href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
            <a href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
        </footer>
    {{/if}}

`);
