import * as Handlebars from '../node_modules/handlebars/dist/handlebars.js';

export const main = Handlebars.compile(`
    <div id="{{mapId}}"></div>
`);
