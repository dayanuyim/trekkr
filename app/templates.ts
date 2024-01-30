import * as Handlebars from 'handlebars/dist/handlebars';
import './lib/handlebars-utils';

import {toLonLat} from 'ol/proj';
import {format} from 'ol/coordinate';
import { gmapUrl, colorCode } from './common';

Handlebars.registerHelper('isdefined', function (value) {
  return value !== undefined;
});

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

Handlebars.registerHelper("colorcode", (color, options)=>{
    return colorCode(color);
});

export const colorboardItems = Handlebars.compile(`
    <div class="pt-colorboard-items">
    {{#each colors}}
        <div class="pt-colorboard-item color-item" style="background-color:{{colorcode this}}" title="{{this}}"></div>
    {{/each}}
    </div>
`);

Handlebars.registerHelper("colorboardItems", (options)=>{
    return new Handlebars.SafeString(colorboardItems({
        colors: [
            'White',     'Yellow',    'Cyan',     'Magenta',
            'LightGray', 'DarkYellow','DarkCyan', 'DarkMagenta',
            'DarkGray',  'Green',     'Blue',     'Red',
            'Black',     'DarkGreen', 'DarkBlue', 'DarkRed',
        ]
    }));
});


const coordsysMenu = Handlebars.compile(`
    <select class="{{cls}}" dir="rtl">
        {{selop ""         coordsys "-"       "disabled hidden"}}
        {{selop "wgs84"    coordsys "WGS84"}}
        {{selop "twd97"    coordsys "TWD97"}}
        {{selop "twd67"    coordsys "TWD67"}}
        {{selop "taipower" coordsys "電力座標"}}
        {{selop "twd97_6"  coordsys "&#x3285;TWD97"}}
        {{selop "twd67_6"  coordsys "&#x3285;TWD67"}}
    </select>
`);
Handlebars.registerHelper("coordsysMenu", (cls, options)=>{
    return new Handlebars.SafeString(coordsysMenu({cls}));
});

export const ptPopup = Handlebars.compile(`
    <div class="pt-trk">
        <fieldset class="pt-trk-tool">
            <!--<legend>track</legend>-->
            <legend>
            <button class="pt-tool-rm-trk" title="Remove Track"><i class="fa-solid fa-trash-can"></i></button>
            <button class="pt-tool-split-trk" title="Split Track"><i class="fa-solid fa-scissors"></i></button>
            <button class="pt-tool-join-trk" title="Join Track"><i class="fa-solid fa-link"></i></button>
            </legend>
        </fieldset>
        <div class="pt-trk-header">
            <div class="pt-trk-color color-item"></div><!--
         --><span class="pt-trk-name" contenteditable="true" data-placeholder="NAME"></span>
            <span class="pt-trk-seg-sn"></span>
        </div>
        <div class="pt-row">
            <span class="pt-trk-desc" contenteditable="true" data-placeholder="Description for the track">{{desc}}</span>
        </div>
    </div>
    <div class="pt-colorboard glassmophism hidden">
        {{colorboardItems}}
    </div>

    <!-------------- Wpt or Trkpt -------------->
    <div class="pt-content">
        <fieldset class="pt-wpt-tool">
            <button class="pt-tool-mk-wpt" title="Make Wpt"><i class="fas fa-map-pin"></i></button>
            <button class="pt-tool-rm-wpt" title="Delete Wpt"><i class="fas fa-trash-can"></i></button>
        </fieldset>

        <div class="pt-header">
            <img class="pt-sym" width="24" heigh="24" src="{{sym}}"><!--
        --><span class="pt-name" contenteditable="true" data-placeholder="NAME">{{name}}</span>
            <!--<input type="text" class="pt-name" value="{{name}}">-->
        </div>
        <div class="pt-symboard glassmophism hidden"></div>

        <div class="pt-desc">
            <span class="pt-desc-value" contenteditable="true" data-placeholder="Description for the wpt">{{desc}}</span>
        </div>

        <div class="pt-coord" data-pt-coord="{{coordinate}}">
            {{coordsysMenu "pt-coord-title"}}
            <span class="pt-coord-value">N/A</span>
            <a class="pt-gmap" href="{{gmap coordinate}}" target="_blank">
                <img src="./images/googleg.png" alt="Google G">
                <!--<i class="fab fa-google"></i>-->
            </a>
        </div>

        <div class="pt-ele">
            <span class="pt-ele-title">ELE.</span>
            <span class="pt-ele-value" contenteditable="true" data-placeholder="0.0">{{fmtEle ele.value}}</span> m
            <!--<input type="text" class="pt-ele-value" pattern="[0-9]+([\.][0-9]+)?" value="{{fmtEle ele.value}}"> m-->
            <span class="pt-ele-est">(est.)</span>
        </div>

        <div class="pt-time">
            <span class="pt-time-title">TIME</span>
            <span class="pt-time-value">{{fmtTime time}}</span>
        </div>

        <footer class="sym-copyright">&copy; The icon made by
            <a class="sym-maker" href="{{symbol/maker/url}}" target="_blank">{{symbol/maker/title}}</a> from
            <a class="sym-provider" href="{{symbol/provider/url}}" target="_blank">{{symbol/provider/title}}</a> is licensed by
            <a class="sym-license" href="{{symbol/license/url}}" target="_blank">{{symbol/license/title}}</a>
        </footer>
    </div>
`);

export const license_pd = Handlebars.compile(`
    <i class="fa-brands fa-creative-commons-pd"></i>
`);
export const license_cc_by = Handlebars.compile(`
    <i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i>
`);
export const license_cc_by_sa= Handlebars.compile(`
    <i class="fa-brands fa-creative-commons"></i><i class="fa-brands fa-creative-commons-by"></i><i class="fa-brands fa-creative-commons-sa"></i>
`);

Handlebars.registerHelper("ptPopup", (data, options)=>{
    data = Object.assign({
        name: '',
        desc: '',
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
    <li data-layer-id="{{id}}" data-layer-type="{{type}}" data-layer-url="{{url}}" >
        <input class="ly-checked" type="checkbox" {{#if checked}}checked{{/if}}><!--
     --><span class="ly-body"><!--
         --><span class="ly-desc">{{desc}}</span>
            <span class="ly-opt ly-opt-spy {{#if legend}}hidden{{/if}}"><i class="fas fa-crosshairs"></i></span>
            <span class="ly-opt ly-opt-filter {{#unless (isdefined filterable)}}hidden{{/unless}}"><i class="fas fa-filter"></i></span>
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
            <span class="tablink" data-content="setting-layers">圖層</span>
            <span class="tablink" data-content="setting-opts">設定</span>
            <span class="tablink" data-content="setting-about">關於</span>
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
            <!----------------------------- Waypoint --------------------------------------->
            <fieldset class="opt-group">
                <legend class="opt-header">Waypoint</legend>
                <!----------------------------- font size --------------------------------------->
                <ul class="opt-item">航點名稱
                    <li>
                        <label for="wpt-fontsize">字型大小</label>
                        <input type="number" id="wpt-fontsize" name="wpt-fontsize" min="1" max="64" />
                    </li>
                </ul>
                <!----------------------------- display --------------------------------------->
                <ul class="opt-item">顯示方式
                    <li>
                        <input type="radio" id="wpt-display-need" name="wpt-display" value="need" />
                        <label for="wpt-display-need">Always</label>
                    </li>
                    <li>
                        <input type="radio" id="wpt-display-none" name="wpt-display" value="none" />
                        <label for="wpt-display-none">None</label>
                    </li>
                    <li>
                        <input type="radio" id="wpt-display-auto" name="wpt-display" value="auto" />
                        <label for="wpt-display-auto">Auto</label>
                        <button id="wpt-display-auto-zoom">使用目前縮放值</button>
                    </li>
                </ul>
            </fieldset>
            <!----------------------------- Track --------------------------------------->
            <fieldset class="opt-group">
                <legend class="opt-header">Track</legend>
                <ul class="opt-item">航線箭號
                    <li>
                        <label for="trk-arrow-max-num">最大數量</label>
                        <input type="number" id="trk-arrow-max-num" min="0" max="999" />
                        <label for="trk-arrow-max-num">(0: disable)</label>
                    </li>
                    <li class="hidden">
                        <label for="trk-arrow-interval">每</label>
                        <input type="number" id="trk-arrow-interval" min="1" max="999"/>
                        <label for="trk-arrow-interval">個航跡點標識</label>
                    </li>
                    <li class="hidden">
                        <label for="trk-arrow-radius">箭頭大小</label>
                        <input type="number" id="trk-arrow-radius" min="1" max="99"/>
                    </li>
                </ul>
            </fieldset>
        </div>

        <div class="tabcontent" id="setting-about">
            <span>使用手冊</span> <a href="javascript:void(0)">建構中...</a>
        </div>

    </div>
`);

export const toolbarSide = Handlebars.compile(`
    <div class="ol-control">
        <button class="ctrl-btn spy-btn" title="Spy Mode"><i class="fas fa-crosshairs"></i></button>
    </div>
`);
Handlebars.registerHelper("toolbarSide", ()=>{
    return new Handlebars.SafeString(toolbarSide());
});

const filterRow = Handlebars.compile(`
    <div class="filter-row">
        <input type="checkbox" id="filter-wpt-{{kind}}-en"/>
        <label for="filter-wpt-{{kind}}-en">{{kind}}</label>
        <input type="text" id="filter-wpt-{{kind}}"/>
        <button type="button" class="filter-wpt-regex" id="filter-wpt-{{kind}}-regex" title="use regex">.*</button>
    </div>
`);
Handlebars.registerHelper("filterRow", (kind)=>{
    return new Handlebars.SafeString(filterRow({kind}));
});

export const toolbarTop = Handlebars.compile(`
    <div class="ol-control">
        <button class="ctrl-btn ctrl-btn-filter" title="Filter..."><i class="fas fa-filter"></i></button>
        <div class="filter-panel glassmophism">
            <div class="tab">
                <span class="tablink" data-content="filter-wpt">Waypoint</span>
                <span class="tablink" data-content="filter-trk">Track</span>
            </div>
            <div class="tabcontent" id="filter-wpt">
                {{filterRow "name"}}
                {{filterRow "desc"}}
                {{filterRow "sym"}}
            </div>
            <div class="tabcontent" id="filter-trk">
                <p>The fitlers for tracks</p>
            </div>
            <div class="footer">
                <div class="filter-force">
                    <input type="checkbox" id="filter-force"/>
                    <label for="filter-force" title="Filter all including system layers">all layers</label>
                </div>
            </div>
        </div>
    </div>
    <div class="ol-control">
        <button class="ctrl-btn ctrl-btn-goto" title="Goto..."><i class="fas fa-person-walking"></i></button>
        <span class="goto-panel">
            {{coordsysMenu "goto-coordsys"}}<!--
         --><input type="text" class="goto-coord-txt" placeholder="X, Y"/><!--
         --><button class="goto-coord-go"><i class="fas fa-person-walking-arrow-right"></i></button>
        </span>
    </div>
`);
Handlebars.registerHelper("toolbarTop", ()=>{
    return new Handlebars.SafeString(toolbarTop());
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
    <div class="toolbar toolbar-side">{{toolbarSide}}</div>
    <div class="toolbar toolbar-top">{{toolbarTop}}</div>

    <div id="ctx-menu">{{ctxMenuItems}}</div>

    <div id="map" class="ol-map-container"></div>
`);

const ctxMenuItems = Handlebars.compile(`
    <div class="ctx-item"><a class="item-gmap" target="_blank"><i class="fab fa-google"></i>GoogleMap&nbsp;Here</a></div>
    <div class="ctx-item"><a class="item-add-wpt"><i class="fas fa-location-dot"></i>新增航點</a></div>
    <div class="ctx-item"><a class="item-apply-sym"><i></i>套用&nbsp;Symbol&nbsp;規則</a></div>
    <div class="ctx-item-bar"></div>
    <div class="ctx-item"><a class="item-promote-trksegs"><i class="fa-solid fa-route"></i>所有航段轉為航跡</a></div>
    <div class="ctx-item-bar"></div>
    <div class="ctx-item"><a class="item-save-gpx"><i class="fas fa-file-contract"></i>匯出&nbsp;GPX&nbsp;航跡檔</a></div>
`);
Handlebars.registerHelper("ctxMenuItems", ()=>{
    return new Handlebars.SafeString(ctxMenuItems());
});
