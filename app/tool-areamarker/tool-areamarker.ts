import './tool-areamarker.css';

import type { Pixel } from 'ol/pixel';
import type Map from 'ol/Map';
import type { Coordinate } from 'ol/coordinate.js';
import type { Extent } from 'ol/extent';
import { transform, fromLonLat, toLonLat, Projection  } from 'ol/proj';
import { toStringXY } from 'ol/coordinate.js';
import { containsCoordinate, boundingExtent, containsExtent } from 'ol/extent';
import { offset } from 'ol/sphere.js';

import * as Handlebars from 'handlebars/dist/handlebars';
//import { coordsysMenu } from '../templates';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2codes, WEB_MERCATOR, WGS84, TWD97, TWD67 } from '../coord';
import { waitForMapMoveEnd, waitForMapRender } from '../ol-utils';
import { throttle, debounce } from 'lodash';
import { keyEnterToBlur, rafThrottle } from '../lib/dom-utils';

/* 1. SPANs 不改變，但Coordinate 會改變的操作:
 *  - 拖曳 Panel
 *  - 直接設定 coordinate
 *  - 拖曳地圖
 *  - 地圖 View Resize (視窗大小改變)
 *  - Auto Alignment
 *
 * 2. 需要 evalPanelAlignCoord() 的行為：
 *  - 初始化
 *  - 參數 boolean 值改變
 *  - 拖曳行為
 *      - DnD the panel
 *      - DnD the map
 *      - Resize the map
 *  - 直接設定 coordinate 由於為使用者指定，故不觸發 Alignment 行為
 */

function km_str_to_meter_num(km: string): number { return Math.round(1000 * parseFloat(km)); }
function meter_num_to_km_str(m: number): string { return (m / 1000).toFixed(3); }

function getLayerDefaultZoom(layer: string): number {
    return (['EMAP5',  'NLSC_PHOTO_MIX'].includes(layer))?  16: 15;   // 通用地圖預設16，其餘15
}

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
    <span class="areamarker-anchor"><i class="fa-solid fa-thumbtack"></i></span>
    <button class="areamarker-closer"><i class="fa-solid fa-circle-xmark"></i></button>
    <section class="areamarker-header">
        <span class="areamarker-header-title">圖檔匯出設定</span>
    </section>
    <section class="areamarker-content">
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
            <span class="areamarker-spans">
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
            </span>
        </p>
        <p>
            <span class="areamarker-opt">格線</span>
            <select class="areamarker-grid-coordsys">
                <option value="" disabled hidden>--座標--</option>
                <option value="twd67">TWD67</option>
                <option value="twd97">TWD97</option>
            </select>
            <input type="checkbox" class="areamarker-grid-align" id="areamarker-grid-align"/>
            <label for="areamarker-grid-align">對齊格線</label>
            <input type="checkbox" class="areamarker-grid-draw" id="areamarker-grid-draw"/>
            <label for="areamarker-grid-draw">顯示格線</label>
        </p>
        <!------ TODO: 之後再實作 先 disable ------------------->
        <p hidden>
            <span class="areamarker-opt">航跡</span>
            <input type="checkbox" class="areamarker-gpx-wpt" id="areamarker-gpx-wpt" disabled/>
            <label for="areamarker-gpx-wpt">顯示航點</label>
            <input type="checkbox" class="areamarker-gpx-trk" id="areamarker-gpx-trk" disabled/>
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
            縮放層級<input type="number" class="areamarker-zoom" value="16" min="1" max="16" step="1" />
        </p>
        <p>
            <span class="areamarker-opt">格式</span>
            <span class="areamarker-filetypes">
                <input type="checkbox" value="png" id="areamarker-filetypes-png"/>
                <label for="areamarker-filetypes-png">PNG圖檔</label>
                <input type="checkbox" value="pdf" id="areamarker-filetypes-pdf"/>
                <label for="areamarker-filetypes-pdf">PDF檔</label>
                <select class="areamarker-pagesize">
                    <option value="" disabled hidden>--紙張--</option>
                    <option value="a3">A3</option>
                    <option value="a4">A4</option>
                </select>
            </span>
        </p>
        <p>
            <button class="areamarker-setup"><i class="fa-solid fa-file-arrow-down"></i>匯出圖檔</button>
            <button class="areamarker-abort"><i class="fa-solid fa-circle-stop"></i>取消匯出</button>
        </p>
    </section>
    <section class="areamarker-footer">
        <div class="areamarker-prog" aria-label="圖檔輸出進度" >
            <div class="areamarker-prog-heading">
                <strong class="areamarker-prog-status"></strong>
                <span class="areamarker-prog-percent">0</span>
            </div>
            <progress class="areamarker-prog-bar" value="0" max="100" aria-label="輸出進度" aria-valuetext="0%" ></progress>
            <p class="areamarker-prog-msg" role="status" aria-live="polite" ></p>
        </div>
    </section>
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
    grid_coordsys?: string,
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
    _spans: HTMLInputElement;
    _xspan: HTMLInputElement;
    _yspan: HTMLInputElement;
    _coord_lock: HTMLElement;
    _xspan_lock: HTMLElement;
    _yspan_lock: HTMLElement;
    _grid_coordsys: HTMLSelectElement;
    _grid_align: HTMLInputElement;
    _grid_draw: HTMLInputElement;
    _gpx_wpt: HTMLInputElement;
    _gpx_trk: HTMLInputElement;
    _layer: HTMLSelectElement;
    _zoom: HTMLInputElement;
    _filetypes: HTMLElement;
    _pagesize: HTMLSelectElement;

    _closer: HTMLButtonElement;
    _setup: HTMLButtonElement;
    _abort: HTMLButtonElement;

    _prog_status: HTMLElement;
    _prog_percent: HTMLElement;
    _prog_bar: HTMLProgressElement;
    _prog_msg: HTMLElement;

    map: Map;
    //map_listen_enabled = true;
    map_resize_observer;
    map_on_change_resolution;
    map_on_change_center;

    init_width: number;
    init_height: number;

    listeners = {};

    get hidden(): boolean { return this._base.hidden !== false; }

    get coordsys(): string { return this._coordsys.value; }
    set coordsys(val: string) { this._coordsys.value = val; }

    get grid_coordsys_opts(): Array<string> { return Array.from(this._grid_coordsys.options).map(opt => opt.value).filter(v => v); }

    get coord(): Coordinate {
        const v = this._coord.value.split(',').map(Number);
        return (v && v.length >= 2 && v[0] && v[1])? v: undefined;
    }
    set coord(val: Coordinate) { this._coord.value = (val && val.length >= 2)? toStringXY(val): ''; }

    // UI單位為公里，數值為浮點數。但程式內部透過getter/setter 存取，單位為公尺。
    get xspan(): number { return km_str_to_meter_num(this._xspan.value) }
    set xspan(val: number) { this._xspan.value = meter_num_to_km_str(val); }

    get yspan(): number { return km_str_to_meter_num(this._yspan.value) }
    set yspan(val: number) { this._yspan.value = meter_num_to_km_str(val); }

    get coord_locked(): boolean { return this._coord_lock.classList.contains("locked"); }
    set coord_locked(locked: boolean) { this._coord_lock.classList.toggle("locked", locked); }

    get xspan_locked(): boolean { return this._xspan_lock.classList.contains("locked"); }
    set xspan_locked(locked: boolean) { this._xspan_lock.classList.toggle("locked", locked); }

    get yspan_locked(): boolean { return this._yspan_lock.classList.contains("locked"); }
    set yspan_locked(locked: boolean) { this._yspan_lock.classList.toggle("locked", locked); }

    get grid_coordsys(): string { return this._grid_coordsys.value; }
    set grid_coordsys(val: string) { this._grid_coordsys.value = val; }

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

    get filetypes(): string[] {
        return Array.from(this._filetypes.querySelectorAll<HTMLInputElement>('input:checked')).map(i => i.value);
    }
    set filetypes(vals: string[]) {
        this._filetypes.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(ckbox => {
            ckbox.checked = vals.includes(ckbox.value);
        });
    }

    get pagesize(): string { return this._pagesize.value; }
    set pagesize(val: string) { this._pagesize.value = val; }

    get prog_status(): string { return this._prog_status.innerText; }
    set prog_status(val: string) { this._prog_status.innerHTML = val; }

    get prog_percent(): string { return this._prog_percent.innerText; }
    set prog_percent(val: string) { this._prog_percent.innerHTML = val; }

    get prog_bar(): number { return this._prog_bar.value; }
    set prog_bar(val: number) { this._prog_bar.value = val; }

    get prog_msg(): string { return this._prog_msg.innerText; }
    set prog_msg(val: string) { this._prog_msg.innerHTML = val; }

    constructor(map: Map, layers: Array<LayerOpt>, opt?: AreaMarkerOpt){
        this.map = map;
        this.initElements(layers);
        this.init(opt);
    }

    private initElements(layers: Array<LayerOpt>){
        document.body.insertAdjacentHTML('beforeend', toolHTML({layers}));
        this._base          = document.querySelector('.tool-areamarker');
        this._coordsys      = this._base.querySelector(".areamarker-coordsys");
        this._coord         = this._base.querySelector(".areamarker-coord");
        this._spans         = this._base.querySelector(".areamarker-spans");
        this._xspan         = this._base.querySelector(".areamarker-xspan");
        this._yspan         = this._base.querySelector(".areamarker-yspan");
        this._coord_lock    = this._base.querySelector(".areamarker-coord-lock");
        this._xspan_lock    = this._base.querySelector(".areamarker-xspan-lock");
        this._yspan_lock    = this._base.querySelector(".areamarker-yspan-lock");
        this._grid_coordsys = this._base.querySelector(".areamarker-grid-coordsys");
        this._grid_align    = this._base.querySelector(".areamarker-grid-align");
        this._grid_draw     = this._base.querySelector(".areamarker-grid-draw");
        this._gpx_wpt       = this._base.querySelector(".areamarker-gpx-wpt");
        this._gpx_trk       = this._base.querySelector(".areamarker-gpx-trk");
        this._layer         = this._base.querySelector(".areamarker-layer");
        this._zoom          = this._base.querySelector(".areamarker-zoom");
        this._filetypes     = this._base.querySelector(".areamarker-filetypes");
        this._pagesize      = this._base.querySelector(".areamarker-pagesize");
        this._closer        = this._base.querySelector(".areamarker-closer");
        this._setup         = this._base.querySelector(".areamarker-setup");
        this._abort         = this._base.querySelector(".areamarker-abort");
        this._prog_status   = this._base.querySelector(".areamarker-prog-status");
        this._prog_percent  = this._base.querySelector(".areamarker-prog-percent");
        this._prog_bar      = this._base.querySelector(".areamarker-prog-bar");
        this._prog_msg      = this._base.querySelector(".areamarker-prog-msg");

        // get the bounding rect of hidden element
        this._base.style.visibility = 'hidden';
        this._base.hidden = false;
        ({
            width: this.init_width,
            height: this.init_height
        } = this._base.getBoundingClientRect());
        this._base.hidden = true;
        this._base.style.visibility = '';
    }

    private init(opt?){
        this.applyOption(Object.assign({
            coordsys: 'twd97',
            coord: undefined,
            xspan: 7000,
            yspan: 5000,
            coord_locked: false,
            xspan_locked: false,
            yspan_locked: false,
            grid_coordsys: 'twd97',
            grid_align: false,
            grid_draw: true,
            gpx_wpt: false,
            gpx_trk: false,
            layer: "",
            zoom: 16,
            filetypes: ['png', 'pdf'],
            pagesize: 'a4',
        }, opt));

        this.initProgress();

        // init event listeners
        this._closer.addEventListener('click', (e) => {
            //this._base.hidden = true;
            // 直接關掉好像有點無趣，這邊用一個動畫，動畫結束才關閉。
            const on_trans_end = (e) => {
                if (e.target === this._base && e.propertyName === 'opacity') {
                    this.enableMapListeners(false);  //關閉不必要的 listeners
                    this._base.hidden = true;
                    this._base.classList.remove('closing');
                    this._base.removeEventListener('transitionend', on_trans_end);  //用 addEventListener(..., {once: true}) 可能會有風險，應明確進到 if block 後才移除。
                }
            };
            this._base.addEventListener('transitionend', on_trans_end);
            this._base.classList.add('closing');
        });

        this._setup.addEventListener('click', (e) => {
            const opt = this.fetchOption();
            if(!opt.filetypes.length)
                return alert("未選擇檔案輸出格式");
            this.listeners['setup']?.(opt);
        });

        this._abort.addEventListener('click', (e) => {
            this.listeners['abort']?.();
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
            this.evalPanelAlignCoord();
            this.fitPanelPanning();
        });

        this._base.querySelectorAll<HTMLInputElement>('input[type="number"][max]').forEach(input => {
            input.addEventListener('input', () => {
                if (input.value !== '' && input.valueAsNumber > Number(input.max)) {
                    input.value = input.max;
                }
            });
        });

        this._layer.addEventListener('change', e => {
            this.zoom = getLayerDefaultZoom(this.layer);
        })

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
            if (resizing) this.evalPanelSpans({
                evalx: !this.xspan_locked,
                evaly: !this.yspan_locked,
            });
        }, 150));

        document.addEventListener('mousemove', rafThrottle((e) => {
            if (dragging){
                const left = e.clientX - offset_x;
                const top = e.clientY - offset_y;

                // Update position
                this._base.style.left = `${left}px`;
                this._base.style.top = `${top}px`;

                // Update coord of the position
                this.evalPanelCoord()
            }
        }));

        document.addEventListener('mouseup', (e) => {
            if(resizing){
                resizing = false;
                this.fitPanelResize(true);
            }
            if(dragging){
                dragging = false;
                this._base.classList.remove('dragging');
                this.evalPanelAlignCoord();
                this.fitPanelPanning();     // 調整 panel 位置，確保 panel 可見
            }
        });

        // user inputs =========================
        this._coord.addEventListener('input', e => {
            this._coord.classList.remove('invalid');
        });

        this._coord.addEventListener('blur', async (e) => {
            const coord = this.parseCoordByText(this._coord.value);
            if(!coord)
                return this._coord.classList.add('invalid');
            this.coord = coord;              // re-format anyway to normalize the coord string
            this.fitPanelPanning();
        })

        this._spans.addEventListener('blur', (e) => {
            if( !(e.target instanceof HTMLInputElement)) return;
            // 延後判斷，等待焦點轉移完成
            setTimeout(() => {
                if (!this._spans.contains(document.activeElement)) { // xspan and yspan BOTH blur
                    this.fitPanelResize();
                }
            }, 0);
        }, true); // let the blur event bubble up

        keyEnterToBlur(this._coord);
        keyEnterToBlur(this._xspan);
        keyEnterToBlur(this._yspan);

        // Map Events =========
        this.setMapListeners();
    }

    private setMapListeners(){
        const view = this.map.getView();

        // 注意：要等 panel 初始化，故要判斷 panel 是否 hidden

        // Map pan events.
        let pan_resolution;
        let map_panning = false;

        this.map.on('movestart', () => {
            map_panning = true;
            pan_resolution = view.getResolution();
        });

        this.map.on('moveend', () => {
            map_panning = false;
        });

        this.map_on_change_center = throttle((event) => {
            if(this.hidden) return;
            if (map_panning && view.getResolution() === pan_resolution){  // 確認為人類操作，且非 zoom in/out
                this.evalPanelCoord();
                this.evalPanelAlignCoord();
                this.fitPanelPanning();
            }
        }, 150);

        // Map zoom event
        this.map_on_change_resolution = throttle(() => {
            if(this.hidden) return;
            this.evalPanelCoord();
            this.evalPanelSpans();
        }, 150);


        // Map resize observer
        // 與 map pan 行為很相似，但並不會觸發 change:center 事件
        // 另外 windows size 改變，也會有是否需要重新 fit 的議題
        this.map_resize_observer = new ResizeObserver(throttle( ([entry])=>{
            if(this.hidden) return;
            //const { width, height } = entry.contentRect;  //這個資訊好像不重要，因 panel 並不跟著 window 變化而移動
            this.evalPanelCoord();
            this.evalPanelAlignCoord();
            this.fitPanelPanning();
        }, 150));
    }

    private enableMapListeners(enabled: boolean){
        const elem = this.map.getTargetElement();
        const view = this.map.getView();

        if(enabled){
            view.on('change:center', this.map_on_change_center);
            view.on('change:resolution', this.map_on_change_resolution);
            this.map_resize_observer.observe(elem);
        }
        else{
            view.un('change:center', this.map_on_change_center);
            view.un('change:resolution', this.map_on_change_resolution);
            this.map_resize_observer.unobserve(elem);
        }
    }

    private evalPanelCoord()
    {
        const { left, top } = this._base.getBoundingClientRect()
        const webcoord = this.map.getCoordinateFromPixel([left, top]);
        this.coord = transform(webcoord, WEB_MERCATOR, this.getProj());
    }

    private evalPanelAlignCoord(){
        if(this.coord_locked || !this.grid_align) return;

        const scale = 1000;
        const round = (n): number => Math.round(n / scale) * scale;
        const differ = (c1, c2): [number, number] => [c2[0] - c1[0], c2[1] - c1[1]];

        // 需測試的角落。若 span 是格線倍數的情況下，不需每個角落都測試。
        const coord = this.coord;
        const corners = [coord];                                                            // top-left
        if(this.xspan % scale != 0) corners.push(this.calcProjCoord(coord, [this.xspan, 0]));   // top-right
        if(this.yspan % scale != 0) corners.push(this.calcProjCoord(coord, [0, -this.yspan]));  // bottom-left
        if(this.yspan % scale != 0 && this.yspan % scale != 0)
            corners.push(this.calcProjCoord(coord, [this.xspan, -this.yspan]));                 // bottom-right

        // get the minimum difference
        const rounds = corners.map(coord => coord.map(round));
        const diffs = corners.map((coord, i) => differ(coord, rounds[i]));
        const dists = diffs.map(([x, y]) => x ** 2 + y ** 2);
        const i = dists.indexOf(Math.min(...dists));

        // update the new top-left coord
        this.coord = diffCoord(coord, diffs[i]);
    }

    private evalPanelSpans({
        evalx = true,
        evaly = true,
    } = {}){
        if(!evalx && !evaly) return;
        
        const {right, bottom} = this._base.getBoundingClientRect();
        const [br_x, br_y] = this.toProjCoord(this.map.getCoordinateFromPixel([right, bottom]));
        const [tl_x, tl_y] = this.coord;

        const mpu = this.getProj().getMetersPerUnit();
        if(evalx) this.xspan = Math.abs(Math.round(br_x - tl_x)) * mpu;
        if(evaly) this.yspan = Math.abs(Math.round(br_y - tl_y)) * mpu;
    }

    // ============================================================ 

    private async fitPanelPanning(){
        const top_left     = this.toWebCoord(this.coord);
        const bottom_right = this.toWebCoord(this.calcProjCoord(this.coord, [this.xspan, -this.yspan]));

        const extent = this.map.getView().calculateExtent();

        // pan the map for the panel to fit
        if(!containsCoordinate(extent, top_left) || !containsCoordinate(extent, bottom_right)){
            // move map
            try{
                this.enableMapListeners(false);

                this.map.getView().animate({
                    center: this.toWebCoord(this.calcProjCoord(this.coord, [this.xspan/2, - this.yspan/2])),
                    duration: 0.3,
                });

                await waitForMapMoveEnd(this.map);
            }
            finally {
                this.enableMapListeners(true);
            }
        }

        // 這邊會順便微調一點點 因投影位置造成的 size 差異
        this.setPanelPosSize(
            this.map.getPixelFromCoordinate(top_left),
            this.map.getPixelFromCoordinate(bottom_right),
        );
    }

    private async fitPanelResize(is_ui_ready=false){

        let { x, y, width, height } = this._base.getBoundingClientRect();
        const [px, py] = is_ui_ready?
            [ x + width, y + height]:
            this.map.getPixelFromCoordinate(
                this.toWebCoord(this.calcProjCoord(this.coord, [this.xspan, -this.yspan])));  //bottom-right

        // new width/height
        if(!is_ui_ready){
            width = px - x;
            height = py - y;
        }

        // fit, set size, or do nothing
        const { width: mw, height: mh } = this.map.getTargetElement().getBoundingClientRect();
        if(width < this.init_width || height < this.init_height || px > mw || py > mh)
            await this.fitPanel();
        else if(!is_ui_ready)
            this.setPanelSize(width, height);
    }

    // ZOOM Fit 之後再放置 Panel。建議必要時才使用，減少畫面跳動
    private async fitPanel(left_top?: Coordinate, right_bottom?: Coordinate){  //webcoord
        left_top     = left_top     || this.toWebCoord(this.coord);
        right_bottom = right_bottom || this.toWebCoord(this.calcProjCoord(this.coord, [this.xspan, -this.yspan]));

        // Zoom the map to fit the panel
        const extent = boundingExtent([left_top, right_bottom]);

        try {
            this.enableMapListeners(false);

            this.map.getView().fit(extent, {
                padding: [120, 120, 120, 120],
                duration: 300,
            });
            await waitForMapMoveEnd(this.map);
        }
        finally {
            this.enableMapListeners(true);
        }

        // fit the panel
        this.setPanelPosSize(
            this.map.getPixelFromCoordinate(left_top),
            this.map.getPixelFromCoordinate(right_bottom),
        );
    }


    // ============================================================ 

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
            minWidth: `${width * 500 / this.xspan }px`,    // set the minWidth pixel to 500 meter
            minHeight: `${height * 500 / this.yspan }px`,
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

    // ============================================================ 

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

    // TODO 整合 goto tool ======================
    private parseCoordByText(coord_txt: string): Coordinate {
        if(!coord_txt) return undefined;

        // get coordsys profile
        const coordsys = this.coordsys;
        const profile = coordsys_profiles[coordsys];

        // get coord
        const tokens = coord_txt.split(profile.field.separator).filter(x=>x);
        const coord = this.parseTokens(profile, tokens);
        if(!coord || !containsCoordinate(profile.projection.getExtent(), coord))  //check range
            return undefined;
        return coord;
    }

    private parseTokens(profile, tokens){
        if(profile.has_ref){
            const ref = this.map.getView().getCenter(); // webcoord center
            return ref? profile.parse(ref, tokens): undefined;
        }
        return profile.parse(tokens);
    }

    // ===================
    public async show(opt?: AreaMarkerOpt){
        // 避免未關閉 Panel 情況下，map events 的干擾
        this._base.hidden = true;

        //console.debug("areamarker initialized", opt);
        this.applyOption(opt);

        // Get left-top coord
        if(!this.coord){
            const center = this.toProjCoord(this.map.getView().getCenter());
            this.coord = this.calcProjCoord(center, [-this.xspan/2,  this.yspan/2]);
        }

        // align the grid
        this.evalPanelAlignCoord();

        // fit the map and pose the panel
        await this.fitPanel();

        // Set Attributes
        this.setPanelMovable();
        this.setPanelResizer();

        // enable map handler
        this.enableMapListeners(true);

        // other options

        // showing
        this._base.hidden = false;
    }

    // Data -> UI
    private applyOption(opt){
        if(!opt) return;

        if(!opt.grid_coordsys || !this.grid_coordsys_opts.includes(opt.grid_coordsys))
            opt.grid_coordsys = 'twd97';   // default to twd97

        if(!opt.coordsys)
            opt.coordsys = opt.grid_coordsys;

        opt.zoom = getLayerDefaultZoom(opt.layer);

        Object.assign(this, opt);
    }

    // UI -> Data
    // 這邊目的是回傳 AreaMarker 搜集到的資訊，並非完全對應 applyOption
    private fetchOption(){
        return {
            lonlat: transform(this.coord, to_proj(this.coordsys), WGS84),
            xspan: this.xspan,
            yspan: this.yspan,
            grid_proj: this.grid_draw? to_proj(this.grid_coordsys): null,
            gpx_wpt: this.gpx_wpt,
            gpx_trk: this.gpx_wpt,
            layer: this.layer,
            zoom: this.zoom,
            filetypes: this.filetypes,
            pagesize: this.pagesize,
        };
    }

    public onProcess(status: string, progress: number, msg: string){
        this.prog_status = status;
        this.prog_percent = progress.toFixed(1);
        this.prog_bar = progress;
        this.prog_msg = msg;

        const doing = 0 < progress && progress < 100;
        this._base.classList.toggle('doing', doing);
        this._setup.disabled = doing;
    }

    private initProgress(){
        this.onProcess("準備就緒", 0,  "設定完成後，按下「匯出圖檔」");
    }

    // utilts ======================

    // 若座標系統是 TM2，直接使用 TM2，減少轉換造成的誤差。
    private getProj(){
        return to_proj(this.coordsys);
    }

    private calcProjCoord(coord: Coordinate, diff: [number, number]){
        return (['twd67', 'twd97'].includes(this.coordsys))? // TM2
            diffCoord(coord, diff):
            shiftCoord(this.getProj(), coord, diff);
    }

    private toWebCoord(coord: Coordinate){
        return transform(coord, this.getProj(), WEB_MERCATOR);
    }

    private toProjCoord(webcoord: Coordinate){
        return transform(webcoord, WEB_MERCATOR, this.getProj());
    }

    public setListener(event, listener){
        this.listeners[event] = listener;
        return this;
    }
}