import './tool-areamarker.css';

import { Pixel } from 'ol/pixel';
import Map from 'ol/Map';
import { transform, fromLonLat, toLonLat  } from 'ol/proj';
import { Coordinate, toStringXY } from 'ol/coordinate.js';
import { offset } from 'ol/sphere.js';

import * as Handlebars from 'handlebars/dist/handlebars';
import { coordsysMenu } from '../templates';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2codes, WEB_MERCATOR, WGS84, TWD97, TWD67 } from '../coord';

const toolHTML = Handlebars.compile(`
<div class="tool-areamarker">
    <header class="areamarker-header">圖檔匯出設定</header>
    <span class="areamarker-anchor-icon"><i class="fa-solid fa-anchor"></i></span>
    <p>
        <span class="areamarker-opt">左上角座標</span>
        {{coordsysMenu "areamarker-coordsys"}} <input type="text" class="areamarker-anchor" placeholder="X, Y"/>
        <span class="areamarker-lock areamarker-anchor-lock locked">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
    </p>
    <p>
        <span class="areamarker-opt">尺寸</span>
        寬 <input type="number" class="areamarker-width" value="1000" min="1000" step="1000"/> 公尺
        <span class="areamarker-lock areamarker-width-lock">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
        &times;
        高 <input type="number" class="areamarker-height" value="1000" min="1000" step="1000"/> 公尺
        <span class="areamarker-lock areamarker-height-lock">
            <i class="fa-solid fa-lock"></i>
            <i class="fa-solid fa-lock-open"></i>
        </span>
    </p>
    <p>
        <span class="areamarker-opt">格線</span>
        <select class="areamarker-coordline">
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
        <span>[通用地圖]</span>
        縮放層級<input type="number" class="areamarker-zoom" value="17" min="1" max="24" step="1"/>
    </p>
    <p>
        <button class="areamarker-export">匯出圖檔</button>
    </p>
</div>
`);

const array_adds = ([x1, y1]: Coordinate, [x2, y2]: Coordinate) => [x1 + x2, y1 + y2];

const webcoordAdds = (webcoord: Coordinate, diff_meter: Coordinate) => {
    const tm2coord = transform(webcoord, WEB_MERCATOR, TWD97);
    const newcoord = array_adds(tm2coord, diff_meter);
    return transform(newcoord, TWD97, WEB_MERCATOR);
}

//type Coordinate = [lon: number, lat: number];

function coordAdds(
  [lon, lat]: Coordinate,
  [dx, dy]: [number, number],
): Coordinate {
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [lon, lat];

  // offset 的角度以弧度表示，0 = 北，PI / 2 = 東
  const bearing = Math.atan2(dx, dy);

  return offset([lon, lat], distance, bearing);
}

export default class AreaMarker{
    _base: HTMLElement;
    _coordsys: HTMLSelectElement;
    _anchor: HTMLInputElement;
    _width: HTMLInputElement;
    _height: HTMLInputElement;
    _anchor_lock: HTMLElement;
    _width_lock: HTMLElement;
    _height_lock: HTMLElement;

    _map: Map;
    //_opt: any;
    _listeners = {};

    get coordsys(): string { return this._coordsys.value; }
    set coordsys(val: string) { this._coordsys.value = val; }

    get anchor(): string { return this._anchor.value; }
    set anchor(val: string) { this._anchor.value = val; }

    get width(): number { return parseInt(this._width.value); }
    set width(val: number) { this._width.value = val.toString(); }

    get height(): number { return parseInt(this._height.value); }
    set height(val: number) { this._height.value = val.toString(); }

    get width_locked(): boolean { return this._width_lock.classList.contains("locked"); }
    get height_locked(): boolean { return this._height_lock.classList.contains("locked"); }
    get anchor_locked(): boolean { return this._anchor_lock.classList.contains("locked"); }

    set width_locked(locked: boolean) { this._width_lock.classList.toggle("locked", locked); }
    set height_locked(locked: boolean) { this._height_lock.classList.toggle("locked", locked); }
    set anchor_locked(locked: boolean) { this._anchor_lock.classList.toggle("locked", locked); }

    constructor(map: Map, opt?){
        this._map = map;
        opt = Object.assign({
            coordsys: 'twd97',
            center: [0, 0],
            width: 7000,
            height: 5000,
            anchor_locked: false,
            width_locked: false,
            height_locked: false,
            grid_align: true,
            grid_draw: true,
            gpx_wpt: false,
            gpx_trk: false,
            zoom_level: 17,
        }, opt) 

        this.initElements();
        this.init(opt);
    }

    private initElements(){
        document.body.insertAdjacentHTML('beforeend', toolHTML());
        this._base = document.querySelector('.tool-areamarker');
        this._coordsys = this._base.querySelector(".areamarker-coordsys");
        this._anchor = this._base.querySelector(".areamarker-anchor");
        this._width = this._base.querySelector(".areamarker-width");
        this._height = this._base.querySelector(".areamarker-height");
        this._anchor_lock = this._base.querySelector(".areamarker-anchor-lock");
        this._width_lock = this._base.querySelector(".areamarker-width-lock");
        this._height_lock = this._base.querySelector(".areamarker-height-lock");
    }

    private init(opt){
        //const opt = this._opt; 
        console.log("areamarker initialized", opt);

        const tm2coord = opt.coordsys == 'twd67'? toTWD67: toTWD97;

        //const center = toLonLat(opt.center);
        const center = this._map.getView().getCenter();
        const left_top = webcoordAdds(center, [-opt.width/2, opt.height/2]);
        const right_bottom = webcoordAdds(center, [opt.width/2, -opt.height/2]);
        const left_top_px = this._map.getPixelFromCoordinate(left_top);
        const right_bottom_px = this._map.getPixelFromCoordinate(right_bottom);
        console.log({center, left_top, right_bottom, left_top_px, right_bottom_px});

        // init input fields
        this.coordsys = opt.coordsys;
        this.anchor = toStringXY(tm2coord(left_top));   // TODO 根據 coordsys 轉換
        this.width = opt.width;
        this.height = opt.height;
        this.anchor_locked = opt.anchor_locked;
        this.width_locked = opt.width_locked;
        this.height_locked = opt.height_locked;
        this.setPanelMovable();
        this.setPanelResize();
        this.setPanelPosSize(left_top_px, right_bottom_px);

        // init event listeners
        this._anchor_lock.addEventListener('click', (e) => {
            const locked = this.anchor_locked = !this.anchor_locked;
            this.setPanelMovable(!locked);
        });

        this._width_lock.addEventListener('click', (e) => {
            this.width_locked = !this.width_locked;
            this.setPanelResize();
        });
        this._height_lock.addEventListener('click', (e) => {
            this.height_locked = !this.height_locked;
            this.setPanelResize();
        });

        // panel dragging ==========
        let dragging = false;
        let offset_x = 0;
        let offset_y = 0;

        this._base.addEventListener('mousedown', (e) => {
            if (this.anchor_locked) return;

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
            minWidth: `${width * 1000 / this.width }px`,    // set the minWidth pixel to 1000 meter
            minHeight: `${height * 1000 / this.height }px`,
        });
    }

    setPanelMovable(movable?: boolean){
        if(movable === undefined)
            movable = !this.anchor_locked;
        this._base.classList.toggle('movable', movable);
    }

    private setPanelResize(){
        this._base.style.resize = this.width_locked?
            this.height_locked? "none": "vertical":
            this.height_locked? "horizontal": "both";
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }
}