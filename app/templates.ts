import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';

export const main = Handlebars.compile(`
    <div id="map" class="ol-map-container"></div>

    <div id="wpt-popup" class="ol-popup">
        <a href="#" class="ol-popup-closer"></a>
        <div class="ol-popup-content"></div>
    </div>
`);

export const wptPopup = Handlebars.compile(`
    <div class="wpt-name">{{name}}</div>
    <div class="wpt-location">{{location}}</div>
    <div class="wpt-elevation">{{#if elevation}}{{elevation}} H{{/if}}</div>
    <div><code>{{license}}</code></div>
`);