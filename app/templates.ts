import * as Handlebars from 'handlebars/dist/handlebars';
import './lib/handlebars-utils';

import {toLonLat} from 'ol/proj';
import {format} from 'ol/coordinate';
import { gmapUrl } from './common';

Handlebars.registerHelper("mul", (val, mul, options) => {
    return Math.floor(val * mul);
});

Handlebars.registerHelper('gmap', function(coordinate) {
    return gmapUrl(coordinate);
});

Handlebars.registerHelper('sympos', function(offset, idx) {
    return (offset + idx) * 32;
});

Handlebars.registerHelper('fmtEle', function(ele) {
    return ele.toFixed(1);
});

Handlebars.registerHelper('fmtTime', function(moment) {
    return moment? moment.format('YYYY-MM-DD HH:mm:ss'): '-';
});

Handlebars.registerHelper("selop", (value, selected, text, attrs, options)=>{
    if(value === selected)
        attrs += " selected";
    return new Handlebars.SafeString(`<option value="${value}" ${attrs}>${text}</option>`);
});


export const colorboardItems = Handlebars.compile(`
    <div class="pt-colorboard-items">
    {{#each colors}}
        <div class="pt-colorboard-item color-item" style="background-color:{{this}}" title="{{this}}"></div>
    {{/each}}
    </div>
`);

Handlebars.registerHelper("colorboardItems", (options)=>{
    return new Handlebars.SafeString(colorboardItems({
        colors: [
            'White', 'LightGray', 'DarkGray', 'Black', 'Yellow',
            'Magenta', 'Cyan', 'Blue', 'Green', 'Red',
            'DarkMagenta', 'DarkCyan', 'DarkBlue', 'DarkGreen', 'DarkRed',
        ]
    }));
});

export const ptPopup = Handlebars.compile(`
    <div class="pt-trk-header">
        <div class="pt-trk-color color-item"></div><!--
     --><span class="pt-trk-name" contenteditable></span>
    </div>
    <div class="pt-colorboard glassmophism hidden">
        {{colorboardItems}}
    </div>

    <div class="pt-wpt-header">
        <img class="pt-sym" width="24" heigh="24" src="{{sym}}"><!--
     --><span class="pt-name" contenteditable>{{name}}</span>
        <!--<input type="text" class="pt-name" value="{{name}}">-->
    </div>
    <div class="pt-symboard glassmophism hidden"></div>

    <div class="pt-coord" data-pt-coord="{{coordinate}}">
        <select class="pt-coord-title" dir="rtl">
            {{selop ""         coordsys "-"  "disabled hidden"}}
            {{selop "wgs84"    coordsys "WGS84"}}
            {{selop "twd97"    coordsys "TWD97"}}
            {{selop "twd67"    coordsys "TWD67"}}
            {{selop "taipower" coordsys "電力座標"}}
        </select>
        <span class="pt-coord-value">N/A</span>
        <a class="pt-gmap" href="{{gmap coordinate}}" target="_blank">
            <img src="./images/googleg.png" alt="Google G">
            <!--<i class="fab fa-google"></i>-->
        </a>
    </div>

    <div class="pt-ele">
        <span class="pt-ele-title">ELE.</span>
        <span class="pt-ele-value" contenteditable>{{fmtEle ele.value}}</span> m
        <!--<input type="text" class="pt-ele-value" pattern="[0-9]+([\.][0-9]+)?" value="{{fmtEle ele.value}}"> m-->
        <span class="pt-ele-est">(est.)</span>
    </div>

    <div class="pt-time">
        <span class="pt-time-title">TIME</span>
        <span class="pt-time-value">{{fmtTime time}}</span>
    </div>

    <div class="pt-tool pt-tool-mk-wpt" title="Make Wpt">
        <button><i class="fas fa-map-pin"></i></button>
    </div>

    <div class="pt-tool pt-tool-rm-wpt" title="Delete Wpt">
        <button><i class="fas fa-trash-can"></i></button>
    </div>

    <footer class="sym-copyright">&copy; The icon made by
        <a class="sym-maker" href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
        <a class="sym-provider" href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
        <a class="sym-license" href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
    </footer>

`);

Handlebars.registerHelper("ptPopup", (data, options)=>{
    data = Object.assign({
        name: '',
        coordsys: '',
        coordinate: [0, 0],
        time: undefined,
        ele: {
            value: 0,
            est: false,
        },
        symbol: {
            maker: { title: '', url: '' },
            provider: { title: '', url: '' },
            license: { title: '', url: '' },
        }
    }, data);
    return new Handlebars.SafeString(ptPopup(data));
});

export const symboardItem = Handlebars.compile(`
    {{#each symbols}}
        <div class="pt-symboard-item {{#if ../offset}}extra{{/if}}" title="{{name}}">
            <div class="pt-symboard-item-img" style="background-position-x:-{{sympos ../offset @index}}px"></div>
        </div>
    {{/each}}
`);

Handlebars.registerHelper("symboardItem", (offset, symbols, options) => {
    return new Handlebars.SafeString(symboardItem({offset, symbols}));
});

export const symboard = Handlebars.compile(`
    <div class="pt-symboard-items">
        {{symboardItem             0 basics}}
        {{symboardItem basics.length extras}}
    </div>
    <div class="pt-symboard-footer">
        <label for="pt-symboard-filter"><i class="fas fa-magnifying-glass"></i></label>
        <input type="text" id="pt-symboard-filter" placeholder="Search...">
    </div>
`);

export const mkLayer = Handlebars.compile(`
    {{#with layer}}
    <li data-layer-id="{{id}}" data-layer-type="{{type}}" data-layer-url="{{url}}">
        <input class="ly-checked" type="checkbox" {{#if checked}}checked{{/if}}><!--
     --><span class="ly-body"><!--
         --><span class="ly-desc">{{desc}}</span>
            <span class="ly-spy"><i class="fas fa-crosshairs"></i></span>
        </span>
        <input class="ly-opacity" type="number" max="100" min="0" step="5" value="{{mul opacity 100}}">
        <i class="fas fa-percent"></i>
    </li>
    {{/with}}
`);

Handlebars.registerHelper("mkLayer", (layer, options) => {
    return new Handlebars.SafeString(mkLayer({layer}));
});
/*
Handlebars.registerHelper("layer", (layer, options) => {
    const {id, type, url, desc, checked, opacity} = layer;
    return new Handlebars.SafeString(`
        <li data-layer-id="${id}" data-layer-type="${type}" data-layer-url="${url}">
            <input class="ly-checked" type="checkbox" ${checked? 'checked': ''}><!--
         --><span class="ly-desc">${desc}</span>
            <input class="ly-opacity" type="number" max="100" min="0" step="5" value="${Math.floor(opacity*100)}">
            <i class="fas fa-percent"></i>
        </li>
`)});
*/

export const settings = Handlebars.compile(`
    <div class="settings-ctrl ol-control">
        <button class="btn-toggle"><i class="fas fa-gear"></i></button>
    </div>
    <div class="settings-main">
        <div class="tab">
            <button class="tablink" data-content="setting-layers">圖層</button>
            <button class="tablink" data-content="setting-opts">設定</button>
            <button class="tablink" data-content="setting-about">說明</button>
        </div>

        <div class="tabcontent" id="setting-layers">
            <ul class="layer-legend">
                {{#each layers}}
                    {{#if legend}}
                        {{mkLayer this}}
                    {{/if}}
                {{/each}}
            </ul>
            <ul class="layer-base">
                {{#each layers}}
                    {{#unless legend}}
                        {{mkLayer this}}
                    {{/unless}}
                {{/each}}
            </ul>
        </div>

        <div class="tabcontent" id="setting-opts">
            <fieldset class="opt-group">
                <legend class="opt-header">Waypoint名稱</legend>
                <!----------------------------- font size --------------------------------------->
                <div class="opt-item">
                    <label for="wpt-fontsize">字型大小</label>
                    <input type="number" id="wpt-fontsize" name="wpt-fontsize" min="1" max="64" />
                </div>
                <!----------------------------- display --------------------------------------->
                <div class="opt-item">
                    <label>顯示方式</lable>
                    <div>
                        <div>
                            <input type="radio" id="wpt-display-need" name="wpt-display" value="need" />
                            <label for="wpt-display-need">Always</label>
                        </div>
                        <div>
                            <input type="radio" id="wpt-display-none" name="wpt-display" value="none" />
                            <label for="wpt-display-none">None</label>
                        </div>
                        <div>
                            <input type="radio" id="wpt-display-auto" name="wpt-display" value="auto" />
                            <label for="wpt-display-auto">Auto</label>
                            <button id="wpt-display-auto-zoom">使用目前縮放值</button>
                        </div>
                    </div>
                </div>
            </fieldset>
        </div>

        <div class="tabcontent" id="setting-about">
            <span>使用手冊</span> <a href="javascript:void(0)">建構中...</a>
        </div>

    </div>
`);

export const settingsSidebar = Handlebars.compile(`
    <button class="spy-btn" title="Spy Mode"><i class="fas fa-crosshairs"></i></button>
`);
Handlebars.registerHelper("settingsSidebar", ()=>{
    return new Handlebars.SafeString(settingsSidebar());
});

export const settingsTopbar = Handlebars.compile(`
    <span class="goto-panel">
        <button class="goto-btn" title="Goto..."><i class="fas fa-person-walking-arrow-right"></i></button><!--
     --><span class="goto-coord"><!--
         --><span class="goto-coordsys">TWD67</span><!--
         --><input type="text" class="goto-coord-x" placeholder="x"/><!--
         --><input type="text" class="goto-coord-y" placeholder="y"/><!--
         --><button>Go</button>
        </span>
    <span>
`);
Handlebars.registerHelper("settingsTopbar", ()=>{
    return new Handlebars.SafeString(settingsTopbar());
});

export const main = Handlebars.compile(`
    <div id="pt-popup" class="ol-popup">
        <div class="popup-resizer">
            <div class="pt-image popup-resizer-content">
                <a href="#" class="ol-popup-closer"></a>
                <div class="ol-popup-content">
                    {{ptPopup}}
                </div>
            </div>
        </div>
    </div>

    <div class="settings collapsed"></div>
    <div class="settings-bar side ol-control">{{settingsSidebar}}</div>
    <div class="settings-bar top  ol-control">{{settingsTopbar}}</div>

    <div id="ctx-menu">{{ctxMenuItems}}</div>

    <div id="map" class="ol-map-container"></div>
`);

const ctxMenuItems = Handlebars.compile(`
    <div class="ctx-item"><a class="item-gmap" target="_blank"><i class="fab fa-google"></i>GoogleMap&nbsp;Here</a></div>
    <div class="ctx-item"><a class="item-add-wpt"><i class="fas fa-location-dot"></i>新增航點</a></div>
    <div class="ctx-item"><a class="item-apply-sym"><i></i>套用&nbsp;Symbol&nbsp;規則</a></div>
    <div class="ctx-item-bar"></div>
    <div class="ctx-item"><a class="item-save-gpx"><i class="fas fa-file-contract"></i>匯出&nbsp;GPX&nbsp;航跡檔</a></div>
`);
Handlebars.registerHelper("ctxMenuItems", ()=>{
    return new Handlebars.SafeString(ctxMenuItems());
});
