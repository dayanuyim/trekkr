import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';

Handlebars.registerHelper('fmtElevation', function(distance) {
    return distance.toFixed(2);
});

export const main = Handlebars.compile(`
    <div id="map" class="ol-map-container"></div>

    <div id="wpt-popup" class="ol-popup">
        <a href="#" class="ol-popup-closer"></a>
        <div class="ol-popup-content"></div>
    </div>
`);

export const wptPopup = Handlebars.compile(`
    <div class="wpt-name">{{wpt/name}}</div>
    <div class="wpt-location">{{wpt/location}}</div>
    <div class="wpt-elevation">{{fmtElevation wpt/elevation}} H</div>
    {{#if symbol}}
        <footer class="sym-license">&copy; The icon made by
            <a href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
            <a href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
            <a href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
        </footer>
    {{/if}}

`);