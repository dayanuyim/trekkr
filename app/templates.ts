import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';

Handlebars.registerHelper('fmtElevation', function(distance) {
    return distance.toFixed(1);
});

export const main = Handlebars.compile(`
    <div id="map" class="ol-map-container"></div>

    <div id="pt-popup" class="ol-popup">
        <a href="#" class="ol-popup-closer"></a>
        <div class="ol-popup-content"></div>
    </div>
`);

export const ptPopup = Handlebars.compile(`
    <div class="pt-name">{{pt/name}}</div>
    <div class="pt-location">{{pt/location}}</div>
    <div class="pt-elevation">{{fmtElevation pt/elevation}} H</div>
    {{#if symbol}}
        <footer class="sym-license">&copy; The icon made by
            <a href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
            <a href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
            <a href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
        </footer>
    {{/if}}

`);