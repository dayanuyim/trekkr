import './tool-areamarker.css';

import { Pixel } from 'ol/pixel';
import Map from 'ol/Map';
import { transform, fromLonLat, toLonLat  } from 'ol/proj';
import { Coordinate, toStringXY } from 'ol/coordinate.js';
import { containsCoordinate, boundingExtent } from 'ol/extent';
import { offset } from 'ol/sphere.js';

import * as Handlebars from 'handlebars/dist/handlebars';
//import { coordsysMenu } from '../templates';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2codes, WEB_MERCATOR, WGS84, TWD97, TWD67 } from '../coord';
import { waitForMapMoveEnd, waitForMapRender } from '../ol-utils';

const to_proj = (coordsys) => (coordsys === "twd67")? TWD67: TWD97;  //TODO: 直援完整 coordsys

// TODO 整合 Topbar 的 goto tool
const coordsys_profiles = {
    twd97: {
        projection: TWD97,
        placeholder: 'X 242459, Y 2606189',
        field: {
            separator: /[^-+.0-9]/,
            width: '18em',
        },
        parse: (tokens) => (tokens.length == 2)? tokens.map(Number): undefined,
    },
    twd67: {
        projection: TWD67,
        placeholder: 'X 241630, Y 2606394',
        field: {
            separator: /[^-+.0-9]/,
            width: '18em',
        },
        parse: (tokens) => (tokens.length == 2)? tokens.map(Number): undefined,
    }
};

const toolHTML = Handlebars.compile(`
<div class="tool-areamarker" hidden>
    <header class="areamarker-header">圖檔匯出設定</header>
    <span class="areamarker-anchor"><i class="fa-solid fa-anchor"></i></span>
    <button class="areamarker-closer"><i class="fa-solid fa-circle-xmark"></i></button>
    <p>
        <span class="areamarker-opt">左上角</span>
        {{coordsysMenu "areamarker-coordsys"}} <input type="text" class="areamarker-coord" placeholder="X, Y"/>
        <span class="areamarker-lock areamarker-coord-lock locked">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
    </p>
    <p>
        <span class="areamarker-opt">尺寸</span>
        東西向 <input type="number" class="areamarker-xspan" value="1000" min="1000" step="1000"/> 公尺
        <span class="areamarker-lock areamarker-xspan-lock">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
        &times;
        南北向 <input type="number" class="areamarker-yspan" value="1000" min="1000" step="1000"/> 公尺
        <span class="areamarker-lock areamarker-yspan-lock">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
    </p>
    <p>
        <span class="areamarker-opt">格線</span>
        <select class="areamarker-grid-proj">
            <option value="">--座標--</option>
            <option value="twd67">TWD67</option>
            <option value="twd97">TWD97</option>
        </select>
        <input type="checkbox" class="areamarker-grid-align" id="areamarker-grid-align"/>
        <label for="areamarker-grid-align">對齊格線</label>
        <input type="checkbox" class="areamarker-grid-draw" id="areamarker-grid-draw"/>
        <label for="areamarker-grid-draw">顯示格線</label>
    </p>
    <p>
        <span class="areamarker-opt">航跡</span>
        <input type="checkbox" class="areamarker-gpx-wpt" id="areamarker-gpx-wpt"/>
        <label for="areamarker-gpx-wpt">顯示航點</label>
        <input type="checkbox" class="areamarker-gpx-trk" id="areamarker-gpx-trk"/>
        <label for="areamarker-gpx-trk">顯示航線</label>
    </p>
    <p>
        <span class="areamarker-opt">底圖</span>
        <select class="areamarker-layer">
            <option value="">--圖層--</option>
            {{#each layers}}
                <option value="{{id}}">{{desc}}</option>
            {{/each}}
        </select>
        縮放層級<input type="number" class="areamarker-zoom" value="16" min="1" max="24" step="1"/>
    </p>
    <p>
        <button class="areamarker-export">匯出圖檔</button>
    </p>
</div>
`);

const coordSum = ([x1, y1]: Coordinate, [x2, y2]: Coordinate) => [x1 + x2, y1 + y2];

const webcoordAddsSpan = (webcoord: Coordinate, diff_meter: Coordinate) => {
    const tm2coord = transform(webcoord, WEB_MERCATOR, TWD97);
    const newcoord = coordSum(tm2coord, diff_meter);
    return transform(newcoord, TWD97, WEB_MERCATOR);
}

//type Coordinate = [lon: number, lat: number];

function lonlatAddsSpan(
  [lon, lat]: Coordinate,
  [dx, dy]: [number, number],
): Coordinate {
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [lon, lat];

  // offset 的角度以弧度表示，0 = 北，PI / 2 = 東
  const bearing = Math.atan2(dx, dy);

  return offset([lon, lat], distance, bearing);
}

interface LayerOpt {
    id: string,
    desc: string,
};

interface AreaMarkerOpt{
    coordsys?: string,
    coord?: Coordinate,
    xspan?: number,
    yspan?: number,
    coord_locked?: boolean,
    xspan_locked?: boolean,
    yspan_locked?: boolean,
    grid_proj?: string,
    grid_align?: boolean,
    grid_draw?: boolean,
    gpx_wpt?: boolean,
    gpx_trk?: boolean,
    layer?: string,
    zoom?: number,
}; 

export default class AreaMarker{
    _base: HTMLElement;
    _coordsys: HTMLSelectElement;
    _coord: HTMLInputElement;
    _xspan: HTMLInputElement;
    _yspan: HTMLInputElement;
    _coord_lock: HTMLElement;
    _xspan_lock: HTMLElement;
    _yspan_lock: HTMLElement;
    _grid_proj: HTMLSelectElement;
    _grid_align: HTMLInputElement;
    _grid_draw: HTMLInputElement;
    _gpx_wpt: HTMLInputElement;
    _gpx_trk: HTMLInputElement;
    _layer: HTMLSelectElement;
    _zoom: HTMLInputElement;

    _closer: HTMLButtonElement;
    _export: HTMLButtonElement;

    _map: Map;
    //_opt: any;
    _listeners = {};

    get coordsys(): string { return this._coordsys.value; }
    set coordsys(val: string) { this._coordsys.value = val; }

    get coord(): Coordinate { return this._coord.value.split(',').map(Number); }
    set coord(val: Coordinate) { this._coord.value = toStringXY(val); }

    get xspan(): number { return parseInt(this._xspan.value); }
    set xspan(val: number) { this._xspan.value = val.toString(); }

    get yspan(): number { return parseInt(this._yspan.value); }
    set yspan(val: number) { this._yspan.value = val.toString(); }

    get coord_locked(): boolean { return this._coord_lock.classList.contains("locked"); }
    set coord_locked(locked: boolean) { this._coord_lock.classList.toggle("locked", locked); }

    get xspan_locked(): boolean { return this._xspan_lock.classList.contains("locked"); }
    set xspan_locked(locked: boolean) { this._xspan_lock.classList.toggle("locked", locked); }

    get yspan_locked(): boolean { return this._yspan_lock.classList.contains("locked"); }
    set yspan_locked(locked: boolean) { this._yspan_lock.classList.toggle("locked", locked); }

    get grid_proj(): string { return this._grid_proj.value; }
    set grid_proj(val: string) { this._grid_proj.value = val; }

    get grid_align(): boolean { return this._grid_align.checked; }
    set grid_align(val: boolean) { this._grid_align.checked = val; }

    get grid_draw(): boolean { return this._grid_draw.checked; }
    set grid_draw(val: boolean) { this._grid_draw.checked = val; }

    get gpx_wpt(): boolean { return this._gpx_wpt.checked; }
    set gpx_wpt(val: boolean) { this._gpx_wpt.checked = val; }

    get gpx_trk(): boolean { return this._gpx_trk.checked; }
    set gpx_trk(val: boolean) { this._gpx_trk.checked = val; }

    get layer(): string { return this._layer.value; }
    set layer(val: string) { this._layer.value = val; }

    get zoom(): number { return parseFloat(this._zoom.value); }
    set zoom(val: number) { this._zoom.value = val.toString(); }

    constructor(map: Map, layers: Array<LayerOpt>){
        this._map = map;
        this.initElements(layers);
        this.init();
    }

    private initElements(layers: Array<LayerOpt>){
        document.body.insertAdjacentHTML('beforeend', toolHTML({layers}));
        this._base       = document.querySelector('.tool-areamarker');
        this._coordsys   = this._base.querySelector(".areamarker-coordsys");
        this._coord      = this._base.querySelector(".areamarker-coord");
        this._xspan      = this._base.querySelector(".areamarker-xspan");
        this._yspan      = this._base.querySelector(".areamarker-yspan");
        this._coord_lock = this._base.querySelector(".areamarker-coord-lock");
        this._xspan_lock = this._base.querySelector(".areamarker-xspan-lock");
        this._yspan_lock = this._base.querySelector(".areamarker-yspan-lock");
        this._grid_proj  = this._base.querySelector(".areamarker-grid-proj");
        this._grid_align = this._base.querySelector(".areamarker-grid-align");
        this._grid_draw  = this._base.querySelector(".areamarker-grid-draw");
        this._gpx_wpt    = this._base.querySelector(".areamarker-gpx-wpt");
        this._gpx_trk    = this._base.querySelector(".areamarker-gpx-trk");
        this._layer      = this._base.querySelector(".areamarker-layer");
        this._zoom       = this._base.querySelector(".areamarker-zoom");
        this._closer     = this._base.querySelector(".areamarker-closer");
        this._export     = this._base.querySelector(".areamarker-export");
    }

    private init(){
        // init event listeners
        this._closer.addEventListener('click', (e) => {
            this._base.hidden = true;
        });

        this._export.addEventListener('click', (e) => {
            const opt = this.getOption();
            this._listeners['getoption']?.(opt);
        });

        this._coord_lock.addEventListener('click', (e) => {
            const locked = this.coord_locked = !this.coord_locked;
            this.setPanelMovable(!locked);
        });

        this._xspan_lock.addEventListener('click', (e) => {
            this.xspan_locked = !this.xspan_locked;
            this.setPanelResize();
        });
        this._yspan_lock.addEventListener('click', (e) => {
            this.yspan_locked = !this.yspan_locked;
            this.setPanelResize();
        });

        // panel dragging ==========
        let dragging = false;
        let offset_x = 0;
        let offset_y = 0;

        this._base.addEventListener('mousedown', (e) => {
            if (this.coord_locked) return;
            if (e.target instanceof HTMLInputElement) return;

            const rect = this._base.getBoundingClientRect();

            // check if the div is resizing
            const resize_handler_sz = 16;
            const is_resizing =
                e.clientX >= rect.right - resize_handler_sz &&
                e.clientY >= rect.bottom - resize_handler_sz;
            if (is_resizing) return;

            // start dragging
            dragging = true;
            this._base.classList.add('dragging');
            offset_x = e.clientX - rect.left;
            offset_y = e.clientY - rect.top;
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const left = e.clientX - offset_x;
            const top = e.clientY - offset_y;
            this._base.style.left = `${left}px`;
            this._base.style.top = `${top}px`;
        });
        document.addEventListener('mouseup', (e) => {
            dragging = false;
            this._base.classList.remove('dragging');
        });


        // panel resize
        // TODO: zoom in/out map if needed

        // set coord
        this._coord.addEventListener('input', e => {
            this._coord.classList.remove('invalid');
        });

        // hotkey to click buttons
        this._coord.onkeyup = e => {
            switch(e.key){
                case 'Enter':
                    return this.updateLocation(this.coord);
            }
        };
    }

    private setPanelPos(top_left_px: Pixel){
        const [left, top] = top_left_px;

        Object.assign(this._base.style, {
            top: `${top}px`,
            left: `${left}px`,
        });
    }

    // The function is to SET the POSITION either.
    // This should be reasonable to align all relative attributes consistent.
    private setPanelPosSize(top_left_px: Pixel, down_right_px: Pixel){
        const [left, top] = top_left_px;
        const [right, bottom] = down_right_px;
        const width = right - left;
        const height = bottom - top;

        Object.assign(this._base.style, {
            top: `${top}px`,
            left: `${left}px`,
            width: `${width}px`,
            height: `${height}px`,
            minWidth: `${width * 1000 / this.xspan }px`,    // set the minWidth pixel to 1000 meter
            minHeight: `${height * 1000 / this.yspan }px`,
        });
    }

    setPanelMovable(movable?: boolean){
        if(movable === undefined)
            movable = !this.coord_locked;
        this._base.classList.toggle('movable', movable);
    }

    private setPanelResize(){
        this._base.style.resize = this.xspan_locked?
            this.yspan_locked? "none": "vertical":
            this.yspan_locked? "horizontal": "both";
    }

    // ===================
    public async show(opt?: AreaMarkerOpt){
        opt = Object.assign({
            coordsys: 'twd97',
            coord: undefined,
            xspan: 7000,
            yspan: 5000,
            coord_locked: false,
            xspan_locked: false,
            yspan_locked: false,
            grid_proj: 'twd97',
            grid_align: false,
            grid_draw: true,
            gpx_wpt: false,
            gpx_trk: false,
            layer: "",
            zoom: 16,
        }, opt);

        if(opt.coordsys != 'twd67')
            opt.coordsys = 'twd97';   // default to twd97

        const proj = to_proj(opt.coordsys);

        if(!opt.coord){
            const webcenter = this._map.getView().getCenter();
            const center = transform(webcenter, WEB_MERCATOR, proj);
            opt.coord = coordSum(center, [-opt.xspan/2,  opt.yspan/2]);
        }
        console.debug("areamarker initialized", opt);

        // init input fields
        this.coordsys = opt.coordsys;
        this.coord = opt.coord;          // TODO 根據 coordsys 轉換
        this.xspan = opt.xspan;
        this.yspan = opt.yspan;
        this.coord_locked = opt.coord_locked;
        this.xspan_locked = opt.xspan_locked;
        this.yspan_locked = opt.yspan_locked;
        this.grid_proj = opt.grid_proj;
        this.grid_align = opt.grid_align;
        this.grid_draw = opt.grid_draw;
        this.gpx_wpt = opt.gpx_wpt;
        this.gpx_trk = opt.gpx_trk;
        this.layer = opt.layer?? "";
        this.zoom = opt.zoom;
        this.setPanelMovable();
        this.setPanelResize();

        const coord2 = coordSum(opt.coord, [opt.xspan, -opt.yspan]);
        const left_top = transform(opt.coord, proj, WEB_MERCATOR);
        const right_bottom = transform(coord2, proj, WEB_MERCATOR);

        // zoom the map to fix the panel
        const extent = boundingExtent([left_top, right_bottom]);
        this._map.getView().fit(extent, {
            padding: [100, 100, 100, 100],
            duration: 300,
        });
        await waitForMapMoveEnd(this._map);

        this.setPanelPosSize(
            this._map.getPixelFromCoordinate(left_top),
            this._map.getPixelFromCoordinate(right_bottom),
        );

        this._base.hidden = false;
    }

    private getOption(){
        return {
            lonlat: transform(this.coord, to_proj(this.coordsys), WGS84),
            xspan: this.xspan,
            yspan: this.yspan,
            grid_proj: this.grid_draw? to_proj(this.grid_proj): null,
            gpx_wpt: this.gpx_wpt,
            gpx_trk: this.gpx_wpt,
            layer: this.layer,
            zoom: this.zoom,
        };
    }

    // TODO 整合 goto tool ======================
    private updateLocation(coord_str){
        if(!coord_str) return;

        // get coordsys profile
        const coordsys = this.coordsys;
        const profile = coordsys_profiles[coordsys];

        // get coord
        const tokens = coord_str.split(profile.field.separator).filter(x=>x);
        const coord = this.parseTokens(profile, tokens);
        if(!coord || !containsCoordinate(profile.projection.getExtent(), coord))  //check range
            return this._coord.classList.add('invalid');
        this.coord = coord;   // normalize the coord string

        const {width: mw, height: mh} = this._map.getTargetElement().getBoundingClientRect();
        const {width: aw, height: ah} = this._base.getBoundingClientRect();

        // 方法1: 只移動 Panel
        const webcoord = transform(coord, profile.projection, WEB_MERCATOR);
        const pixel = this._map.getPixelFromCoordinate(webcoord);
        const [px, py] = pixel;
        if( 0 <= px && px <= (mw - aw) &&
            0 <= py && py <= (mh - ah))
        {
            this.setPanelPos(pixel);
        }
        // 方法 2: 同時移動地圖和 panel 至中心點
        else {
            // move map
            const center = coordSum(coord, [this.xspan/2, - this.yspan/2]);
            const webcenter = transform(center, profile.projection, WEB_MERCATOR);
            this._map.getView().animate({
                center: webcenter,
                duration: 0.3,
            });

            // mvoe panel
            this.setPanelPos([(mw-aw)/2, (mh-ah)/2]);
        }
    }

    private parseTokens(profile, tokens){
        if(profile.has_ref){
            const ref = this._listeners['getcenter']?.();      // webcoord center
            return ref? profile.parse(ref, tokens): undefined;
        }
        return profile.parse(tokens);
    }
    // TODO 整合 goto tool ======================

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }
}