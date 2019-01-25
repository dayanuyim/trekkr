import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';
import {toLonLat} from 'ol/proj';
import {format} from 'ol/coordinate';

Handlebars.registerHelper('gmap', function(coordinate) {
    return format(toLonLat(coordinate), 'https://www.google.com.tw/maps/@{y},{x},15z?hl=zh-TW', 7);
});

Handlebars.registerHelper('fmtEle', function(ele) {
    return ele.toFixed(1);
});

Handlebars.registerHelper('fmtTime', function(moment) {
    return moment.format('YYYY-MM-DD HH:mm:ss');
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
        <select class="pt-coord-title" dir="rtl" data-pt-coord="{{coordinate}}">
            <option value="twd67">TWD67</option>
            <option value="twd97">TWD97</option>
            <option value="wgs84">WGS84</option>
        </select>
        <span class="pt-coord-val">N/A</span>
        <a class="pt-gmap" href="{{gmap coordinate}}" target="_blank">
            <img src="./images/googleg.png" alt="Google G">
        </a>
    </div>

    <div class="pt-ele">
        <span class="pt-ele-title">ELE.</span>
        <span>{{#if ele}}{{fmtEle ele}} m{{else}}N/A{{/if}}</span>
    </div>

    <div class="pt-time">
        <span class="pt-title pt-time-title">TIME</span>
        <span>{{#if time}}{{fmtTime time}}{{else}}N/A{{/if}}</span>
    </div>

    {{#if symbol}}
        <footer class="sym-license">&copy; The icon made by
            <a href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
            <a href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
            <a href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
        </footer>
    {{/if}}

`);
