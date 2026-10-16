import './tool-areamarker.css';

import type { Pixel } from 'ol/pixel';
import type Map from 'ol/Map';
import type { Coordinate } from 'ol/coordinate.js';
import type { Extent } from 'ol/extent';
import { transform, fromLonLat, toLonLat, Projection  } from 'ol/proj';
import { toStringXY } from 'ol/coordinate.js';
import { containsCoordinate, boundingExtent } from 'ol/extent';
import { offset } from 'ol/sphere.js';

import * as Handlebars from 'handlebars/dist/handlebars';
//import { coordsysMenu } from '../templates';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2codes, WEB_MERCATOR, WGS84, TWD97, TWD67 } from '../coord';
import { waitForMapMoveEnd, waitForMapRender } from '../ol-utils';
import { throttle, debounce } from 'lodash';
import { keyEnterToBlur, rafThrottle } from '../lib/dom-utils';

const to_proj = (coordsys) => coordsys_profiles[coordsys].projection;

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
    <span class="areamarker-anchor"><i class="fa-solid fa-thumbtack"></i></span>
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
        橫向 <input type="number" class="areamarker-xspan" value="1" min="1" step="1"/> 公里
        <span class="areamarker-lock areamarker-xspan-lock">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
        &times;
        縱向 <input type="number" class="areamarker-yspan" value="1" min="1" step="1"/> 公里
        <span class="areamarker-lock areamarker-yspan-lock">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
    </p>
    <p>
        <span class="areamarker-opt">格線</span>
        <select class="areamarker-grid-proj">
            <option value="" disabled hidden>--座標--</option>
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
        <label for="areamarker-gpx-trk">顯示航跡</label>
    </p>
    <p>
        <span class="areamarker-opt">底圖</span>
        <select class="areamarker-layer">
            <option value="" disabled hidden>--圖層--</option>
            {{#each layers}}
                <option value="{{id}}">{{desc}}</option>
            {{/each}}
        </select>
        縮放層級<input type="number" class="areamarker-zoom" value="16" min="1" max="24" step="1" disabled />
    </p>
    <p>
        <button class="areamarker-export">匯出圖檔</button>
    </p>
</div>
`);

const diffCoord = ([x1, y1]: Coordinate, [x2, y2]: [number, number]) => [x1 + x2, y1 + y2];

const shiftWebCoord = (coord: Coordinate, diff_meter: [number, number]) => {
    return shiftCoord(WEB_MERCATOR, coord, diff_meter);
}

const shiftCoord = (proj: Projection, coord: Coordinate, diff_meter: [number, number]) => {
    const lonlat = transform(coord, proj, WGS84);
    const lonlat2 = shiftLonLat(lonlat, diff_meter);
    return transform(lonlat2, WGS84, proj)
}

//type Coordinate = [lon: number, lat: number];

function shiftLonLat(
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

    get coordsys_options(): Array<string> { return Array.from(this._coordsys.options).map(opt => opt.value); }

    get coord(): Coordinate {
        const v = this._coord.value.split(',').map(Number);
        return (v && v.length >= 2 && v[0] && v[1])? v: undefined;
    }
    set coord(val: Coordinate) { this._coord.value = (val && val.length >= 2)? toStringXY(val): ''; }

    // UI單位為公里，數值為浮點數。但程式內部透過getter/setter 存取，單位為公尺。
    get xspan(): number { return parseFloat(this._xspan.value)*1000; }
    set xspan(val: number) { this._xspan.value = (val/1000).toFixed(3); }

    get yspan(): number { return parseFloat(this._yspan.value)*1000; }
    set yspan(val: number) { this._yspan.value = (val/1000).toFixed(3); }

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
    set layer(val: string) { this._layer.value = val?? ""; }

    get zoom(): number { return parseFloat(this._zoom.value); }
    set zoom(val: number) { this._zoom.value = val.toString(); }

    constructor(map: Map, layers: Array<LayerOpt>, opt?: AreaMarkerOpt){
        this._map = map;
        this.initElements(layers);
        this.init(opt);
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

    private init(opt?){
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

        this.applyOption(opt);


        // init event listeners
        this._closer.addEventListener('click', (e) => {
            this._base.hidden = true;
        });

        this._export.addEventListener('click', (e) => {
            const opt = this.fetchOption();
            this._listeners['getoption']?.(opt);
        });

        this._coord_lock.addEventListener('click', (e) => {
            this._coord.disabled = this.coord_locked = !this.coord_locked;
            this.setPanelMovable();
        });

        this._xspan_lock.addEventListener('click', (e) => {
            this._xspan.disabled = this.xspan_locked = !this.xspan_locked;
            this.setPanelResizer();
        });
        this._yspan_lock.addEventListener('click', (e) => {
            this._yspan.disabled = this.yspan_locked = !this.yspan_locked;
            this.setPanelResizer();
        });

        this._grid_align.addEventListener('change', (e) => {
            this.setPanelAlignPos();
        });

        this._gpx_wpt.addEventListener('change', (e) => {
            if(this._gpx_wpt.checked) alert('Not Implement Yet!');
            this.gpx_wpt = false;
        })

        this._gpx_trk.addEventListener('change', (e) => {
            if(this._gpx_trk.checked) alert('Not Implement Yet!');
            this.gpx_trk = false;
        })

        // panel dragging ==========
        let resizing = false;
        let dragging = false;
        let offset_x = 0;
        let offset_y = 0;

        this._base.addEventListener('mousedown', (e) => {
            if (this.coord_locked) return;
            if (e.target instanceof HTMLInputElement) return;

            const rect = this._base.getBoundingClientRect();

            // check if the div is resizing
            const resize_handler_sz = 16;
            resizing =
                e.clientX >= rect.right - resize_handler_sz &&
                e.clientY >= rect.bottom - resize_handler_sz;
            if (resizing) return;

            // start dragging
            dragging = true;
            this._base.classList.add('dragging');
            offset_x = e.clientX - rect.left;
            offset_y = e.clientY - rect.top;
        });

        document.addEventListener('mousemove', throttle((e) => {
            if(resizing){
                const {bottom, right} = this._base.getBoundingClientRect();
                const tl = this.coord;
                const br = this.fromWebCoord(this._map.getCoordinateFromPixel([right, bottom]));
                this.xspan = Math.abs(Math.round(br[0] - tl[0]));
                this.yspan = Math.abs(Math.round(br[1] - tl[1]));
            }
            else if (dragging){
                const left = e.clientX - offset_x;
                const top = e.clientY - offset_y;

                // Update position
                this._base.style.left = `${left}px`;
                this._base.style.top = `${top}px`;

                // Update coord of the position
                const webcoord = this._map.getCoordinateFromPixel([left, top]);
                this.coord = transform(webcoord, WEB_MERCATOR, to_proj(this.coordsys));
            }
        }, 120));

        document.addEventListener('mouseup', (e) => {
            resizing = false;

            if(dragging){
                dragging = false;
                this._base.classList.remove('dragging');

                this.setPanelAlignPos();
            }
        });

        // TODO handle the map zoom in/out
        // TODO handle the map shift

        // user inputs =========================
        this._coord.addEventListener('input', e => {
            this._coord.classList.remove('invalid');
        });

        this._coord.addEventListener('blur', e => {
            this.updateCoord(this._coord.value);
        })

        this._xspan.addEventListener('blur', e => {
            this.updateSpans(this.xspan, this.yspan);
        })

        this._yspan.addEventListener('blur', e => {
            this.updateSpans(this.xspan, this.yspan);
        })

        keyEnterToBlur(this._coord);
        keyEnterToBlur(this._xspan);
        keyEnterToBlur(this._yspan);
    }

    private async updateSpans(xspan, yspan){
        const br = this.calcCoord(this.coord, [xspan, -yspan]);
        const bottom_right = this.toWebCoord(br);
        const [ px, py ] = this._map.getPixelFromCoordinate(bottom_right);

        const { width: mw, height: mh } = this._map.getTargetElement().getBoundingClientRect();
        if(px <= mw && py <= mh){
            const { top, left } = this._base.getBoundingClientRect();
            this.setPanelSize(px - left, py - top);
        }
        else{
            const top_left = this.toWebCoord(this.coord);
            await this.fitsPanelToMap(top_left, bottom_right);
        }
    }

    private setPanelPos([x, y]: Pixel){
        Object.assign(this._base.style, {
            top: `${y}px`,
            left: `${x}px`,
        });
    }

    private setPanelSize(width: number, height: number){
        if(width <= 0 || height <= 0)
            return;
        Object.assign(this._base.style, {
            width: `${width}px`,
            height: `${height}px`,
            minWidth: `${width * 1000 / this.xspan }px`,    // set the minWidth pixel to 1000 meter
            minHeight: `${height * 1000 / this.yspan }px`,
        });
    }

    // The function is to SET the POSITION either.
    // This should be reasonable to align all relative attributes consistent.
    private setPanelPosSize(top_left_px: Pixel, down_right_px: Pixel){
        const [left, top] = top_left_px;
        const [right, bottom] = down_right_px;
        const width = right - left;
        const height = bottom - top;

        this.setPanelPos(top_left_px);
        this.setPanelSize(width, height);
    }

    setPanelMovable(movable?: boolean){
        if(movable === undefined)
            movable = !this.coord_locked;
        this._base.classList.toggle('movable', movable);
    }

    private setPanelResizer(){
        this._base.style.resize = this.xspan_locked?
            this.yspan_locked? "none": "vertical":
            this.yspan_locked? "horizontal": "both";
    }

    private setPanelAlignPos(){
        if(this.coord_locked || !this.grid_align) return;

        const scale = 1000;
        const round = (n): number => Math.round(n / scale) * scale;
        const differ = (c1, c2): [number, number] => [c2[0] - c1[0], c2[1] - c1[1]];

        // 需測試的角落。若 span 是格線倍數的情況下，不需每個角落都測試。
        const coord = this.coord;
        const corners = [coord];                                                       // top-left  
        if(this.xspan % scale != 0) corners.push(this.calcCoord(coord, [this.xspan, 0]));   // top-right
        if(this.yspan % scale != 0) corners.push(this.calcCoord(coord, [0, -this.yspan]));  // bottom-left
        if(this.yspan % scale != 0 && this.yspan % scale != 0)
            corners.push(this.calcCoord(coord, [this.xspan, -this.yspan]));                 // bottom-right

        // get the minimum difference
        const rounds = corners.map(coord => coord.map(round));
        const diffs = corners.map((coord, i) => differ(coord, rounds[i]));
        const dists = diffs.map(([x, y]) => x ** 2 + y ** 2);
        const i = dists.indexOf(Math.min(...dists));

        // update the new top-left coord
        const top_left = diffCoord(coord, diffs[i]);
        this._updateCoord(top_left);
    }

    // TODO 整合 goto tool ======================
    private updateCoord(coord_str: string){
        if(!coord_str) return;

        // get coordsys profile
        const coordsys = this.coordsys;
        const profile = coordsys_profiles[coordsys];

        // get coord
        const tokens = coord_str.split(profile.field.separator).filter(x=>x);
        const coord = this.parseTokens(profile, tokens);
        if(!coord || !containsCoordinate(profile.projection.getExtent(), coord))  //check range
            return this._coord.classList.add('invalid');

        this._updateCoord(coord);
    }
    private parseTokens(profile, tokens){
        if(profile.has_ref){
            const ref = this._listeners['getcenter']?.();      // webcoord center
            return ref? profile.parse(ref, tokens): undefined;
        }
        return profile.parse(tokens);
    }

    // ============================================================ 

    private _updateCoord(coord: Coordinate){

        // re-format anyway to normalize the coord string
        this.coord = coord;

        const proj = coordsys_profiles[this.coordsys].projection;

        const {width: mw, height: mh} = this._map.getTargetElement().getBoundingClientRect();
        const {width: aw, height: ah} = this._base.getBoundingClientRect();

        // 方法1: 只移動 Panel
        const webcoord = transform(coord, proj, WEB_MERCATOR);
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
            const center = diffCoord(coord, [this.xspan/2, - this.yspan/2]);
            const webcenter = transform(center, proj, WEB_MERCATOR);
            this._map.getView().animate({
                center: webcenter,
                duration: 0.3,
            });

            // mvoe panel
            this.setPanelPos([(mw-aw)/2, (mh-ah)/2]);
        }
    }

    // ===================
    public async show(opt?: AreaMarkerOpt){
        console.debug("areamarker initialized", opt);
        this.applyOption(opt);

        const proj = to_proj(this.coordsys);

        // Get left-top point
        const left_top = this.coord?
            transform(this.coord, proj, WEB_MERCATOR):
            shiftWebCoord(this._map.getView().getCenter(), [-this.xspan/2,  this.yspan/2]);  // 由目前的位置 決定左上座標

        const right_bottom = shiftWebCoord(left_top, [this.xspan, -this.yspan]);

        if(!this.coord)
            this.coord = transform(left_top, WEB_MERCATOR, proj);

        // fit the map and opose the panel
        await this.fitsPanelToMap(left_top, right_bottom);

        // Set Attributes
        this.setPanelMovable();
        this.setPanelResizer();
        this.setPanelAlignPos();

        // showing
        this._base.hidden = false;
    }

    private async fitsPanelToMap(left_top: Coordinate, right_bottom: Coordinate){  //webcoord
        // Zoom the map to fix the panel
        const extent = boundingExtent([left_top, right_bottom]);

        this._map.getView().fit(extent, {
            padding: [100, 100, 100, 100],
            duration: 300,
        });
        await waitForMapMoveEnd(this._map);

        // Settle the panel
        this.setPanelPosSize(
            this._map.getPixelFromCoordinate(left_top),
            this._map.getPixelFromCoordinate(right_bottom),
        );
    }

    // Data -> UI
    private applyOption(opt){
        if(!opt) return;

        if('coordsys' in opt && !this.coordsys_options.includes(opt.coordsys))
            opt.coordsys = 'twd97';   // default to twd97

        Object.assign(this, opt);
    }

    // UI -> Data
    // 這邊目的是回傳 AreaMarker 搜集到的資訊，並非完全對應 applyOption
    private fetchOption(){
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

    // utilts ======================
    // 若座標系統是 TM2，直接使用 TM2，減少轉換造成的誤差。
    private calcCoord(coord: Coordinate, diff: [number, number]){
        return (['twd67', 'twd97'].includes(this.coordsys))? // TM2
            diffCoord(coord, diff):
            shiftCoord(to_proj(this.coordsys), coord, diff);
    }

    private toWebCoord(coord: Coordinate){
        return transform(coord, to_proj(this.coordsys), WEB_MERCATOR);
    }

    private fromWebCoord(webcoord: Coordinate){
        return transform(webcoord, WEB_MERCATOR, to_proj(this.coordsys));
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }
}