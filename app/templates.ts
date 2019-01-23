import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';
import {toTWD97, toTWD67} from './coord';
import {toLonLat} from 'ol/proj';
import {toStringXY} from 'ol/coordinate';

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
        <div><span class="pt-coord-title">TWD67</span> {{twd67 coordinate}}</div>
        <div><span class="pt-coord-title">TWD97</span> {{twd97 coordinate}}</div>
        <div><span class="pt-coord-title">WGS84</span> {{wgs84 coordinate}}</div>
    </div>
    <div class="pt-ele">
        <div><span class="pt-ele-title">ELE</span> {{ele coordinate}} H</div>
    </div>
    {{#if symbol}}
        <footer class="sym-license">&copy; The icon made by
            <a href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
            <a href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
            <a href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
        </footer>
    {{/if}}

`);