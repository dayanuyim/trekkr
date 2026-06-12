import Opt from './opt';
import spots from './data/spots.js';
import { transform, fromLonLat  } from 'ol/proj';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2Sixcodes, WEB_MERCATOR, WGS84, TWD97, TWD67 } from './coord';
import { toLonLat } from 'ol/proj';
import { containsCoordinate } from 'ol/extent';
import { getDistance } from 'ol/sphere';
import {toRadians, toDegrees} from 'ol/math';
import { spotItem as spotItemHTML } from './templates';
import { EleProfileCanvas } from './lib/ele-profile-canvas';

/**
 * Calculates the bearing between two points in degrees
 * @param {Array<number>} c1 - Starting coordinate [lon, lat]
 * @param {Array<number>} c2 - Ending coordinate [lon, lat]
 * @return {number} Bearing in degrees
 */
function getBearing(c1, c2) {
    const lat1 = toRadians(c1[1]);
    const lon1 = toRadians(c1[0]);
    const lat2 = toRadians(c2[1]);
    const lon2 = toRadians(c2[0]);

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

    const brng = Math.atan2(y, x);

    // Convert radians to degrees and normalize to 0-360
    return (toDegrees(brng) + 360) % 360;
}

function toDirection(degree, granularity=8){
  // Normalize the degree to ensure it stays within 0-360
  degree = ((degree % 360) + 360) % 360;

  const directions = (granularity <= 8)? [
        "N", "NE", "E", "SE",
        "S", "SW", "W", "NW"
    ]:[
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ];

  granularity = directions.length;  // must be 8 or 16
  const n = 360 / granularity;
  const n_2 = n / 2;

  // Divide 360 by the number of directions (360 / 8 = 45)
  // We add 22.5 to offset the index so that "North" spans from 337.5 to 22.5
  const index = Math.floor(((degree + n_2) % 360) / n);
  return directions[index];
};

function dirCht(dir){
    switch(dir){
        case "N":   return "北";
        case "NNE": return "東北偏北";
        case "NE":  return "東北";
        case "ENE": return "東北偏東";
        case "E":   return "東";
        case "ESE": return "東南偏東";
        case "SE":  return "東南";
        case "SSE": return "東南偏南";
        case "S":   return "南";
        case "SSW": return "西南偏南";
        case "SW":  return "西南";
        case "WSW": return "西南偏西";
        case "W":   return "西";
        case "WNW": return "西北偏西";
        case "NW":  return "西北";
        case "NNW": return "西北偏北";
        default:    return "N/A";
    }
}

/*
function getDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // 地球半徑 km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
*/

export class Sidebar{

    _base: HTMLElement;
    _spy_btn: HTMLButtonElement;
    _listeners = {}

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base     = el;
        this._spy_btn  = el.querySelector<HTMLButtonElement>('button.spy-btn');
    }

    private init(){
        //init spy
        this._spy_btn.classList.toggle('enabled', Opt.spy.enabled);
        this._spy_btn.title = Opt.data.tooltip.btn_spy;
        this._spy_btn.addEventListener('click', e =>{
            const enabled = this._spy_btn.classList.toggle('enabled');
            Opt.update('spy.enabled', enabled);
            this._listeners['spyenabled']?.(Opt.spy);
        });
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggleSpy(){
        this._spy_btn.click();
        return this;
    }
}

///////////////////////////////////////////
//  WGS84    24.2955986, 121.1699175
//  WGS84    24 17 44.15, 121 10 11.7
//  TWD97    267248, 2687771
//  TWD67    266419, 2687977
//  TAIPOWER H2075EE1797
//  TWD97_6  672878
//  TWD67_6  664880
///////////////////////////////////////////

const deg_to_decimal = ([d, m, s]) => Number(d) + m / 60.0 + s / 3600.0;
const swap = ([a, b]) => [b, a];

/* @ref: webmercator coord */
const sixcode_parser = (ref, tokens, trans_webcoord_to) => {
    if(tokens.length == 1 && tokens[0].length == 6){
        ref = trans_webcoord_to(ref);
        return TM2Sixcodes(ref, tokens[0]);
    }
    return undefined;
};

const coordsys_profiles = {
    wgs84: {
        projection: WGS84,
        placeholder: '緯度 23 33 32.45, 經度 120.926126',
        field: {
            separator: /[^-+.0-9]/,
            width: '22em',
        },
        parse: (tokens) => {
            switch(tokens.length) {
                case 2: return swap(tokens).map(Number);                                      //swap lat/lon to lon/lat
                case 6: return [tokens.slice(3, 6), tokens.slice(0, 3)].map(deg_to_decimal);  //swap lat/lon to lon/lat
                default: return undefined;
            }
        },
    },
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
    },
    taipower: {
        projection: TWD67,
        placeholder: 'K8912ED3904',
        field: {
            separator: /[^a-zA-Z0-9]/,
            width: '16em',
        },
        parse: (tokens) => {
            if(tokens.length == 1){
                const txt = tokens[0].toUpperCase();
                if(txt.match(/^[A-HJ-Z]\d{4}[A-H][A-E]\d{2}(\d{2})?$/))
                    return taipowerCoordToTWD67(txt);
            }
            return undefined;
        },
    },
    twd97_6: {
        projection: TWD97,
        placeholder: '六碼 424061',
        field: {
            separator: /[^0-9]/,
            width: '13em',
        },
        has_ref: true,
        parse: (ref, tokens) => sixcode_parser(ref, tokens, toTWD97),
    },
    twd67_6: {
        projection: TWD67,
        placeholder: '六碼 416063',
        field: {
            separator: /[^0-9]/,
            width: '13em',
        },
        has_ref: true,
        parse: (ref, tokens) => sixcode_parser(ref, tokens, toTWD67),
    },
    findspot: {
        projection: WGS84,
        placeholder: '玉山',
        field: {
            separator: / /,   //space split
            width: '16em',
        },
        parse: (tokens) => (tokens.length)? tokens[0].trim(): undefined,
    },
}

export class Topbar{

    _base: HTMLElement;
    _whereami_btn: HTMLButtonElement;
    _goto_panel: HTMLElement;
    _goto_btn: HTMLButtonElement;
    _goto_coordsys: HTMLSelectElement;
    _goto_txt: HTMLInputElement;
    _goto_aux_run: HTMLButtonElement;
    _goto_aux_clear: HTMLButtonElement;

    _goto_spot_list: HTMLUListElement;
    _goto_spot_more: HTMLButtonElement;

    _listeners = {}
    candi_spots = [];
    candi_spots_idx = 0;
    candi_spots_batch_size = 10;

    get goto_coordsys(){ return this._goto_coordsys.value; }
    set goto_coordsys(v){ this._goto_coordsys.value = v; }
    get goto_txt(){ return this._goto_txt.value.trim(); }
    set goto_txt(txt){ this._goto_txt.value = txt.trim(); }

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base               = el;
        this._whereami_btn       = el.querySelector<HTMLButtonElement>('button.ctrl-btn-whereami');
        this._goto_panel         = el.querySelector<HTMLElement>('.goto-panel');
        this._goto_btn           = el.querySelector<HTMLButtonElement>('button.ctrl-btn-goto');
        this._goto_coordsys      = el.querySelector<HTMLSelectElement>('select.goto-coordsys');
        this._goto_txt           = el.querySelector<HTMLInputElement>('input.goto-txt');
        this._goto_aux_clear     = el.querySelector<HTMLButtonElement>('button.goto-aux-clear');
        this._goto_aux_run       = el.querySelector<HTMLButtonElement>('button.goto-aux-run');
        this._goto_spot_list     = el.querySelector<HTMLUListElement>('.goto-spot-list');
        this._goto_spot_more     = el.querySelector<HTMLButtonElement>('.goto-spot-more');
    }

    private init(){
        // where am I
        this._whereami_btn.onclick = e => {
            navigator.geolocation.getCurrentPosition(pos => {
                const coord = [pos.coords.longitude, pos.coords.latitude];
                this._gotoLocation(coord, WGS84);
            }, err => {
                console.warn('Get current position error:', err);
                alert('無法取得目前位置，請確認裝置定位功能是否開啟，並允許網頁使用定位資訊。');
            }, {
                enableHighAccuracy: true,
                timeout: 10000, // 10 seconds
                maximumAge: 0
            });
        };

        // goto-option button
        this._goto_btn.classList.toggle('active', Opt.goto.visible);  //init
        this._goto_btn.onclick = e =>{
            const active = this._goto_btn.classList.toggle('active');
            Opt.update('goto.visible', active);
        };

        this.initGotoCoordinate();
        this.initGotoSpot();
    }

    // goto coordinate ----------------------------------------------

    private initGotoCoordinate(){
        const set_coord_panel = (coordsys) => {
            this.clearSpotList();  //reset anyway
            const profile = coordsys_profiles[coordsys];
            this._goto_txt.placeholder = profile.placeholder;
            this._goto_txt.style.minWidth = profile.field.width;
        };

        // set coordsys select
        if(Opt.goto.coordsys){   //init
            this.goto_coordsys = Opt.goto.coordsys;
            set_coord_panel(this.goto_coordsys)
        }
        this._goto_coordsys.onchange = e =>{
            Opt.update('goto.coordsys', this.goto_coordsys);
            set_coord_panel(this.goto_coordsys);
            // reset validiity check
            this._goto_txt.classList.remove('invalid');
        }

        // reset validiity check for the new input
        this._goto_txt.addEventListener('input', e => {
            this._goto_txt.classList.remove('invalid');
        });

        // hotkey to click buttons
        this._goto_txt.onkeyup = e => {
            switch(e.key){
                case 'Enter':  return this._goto_aux_run.click();
                case 'Escape': return this._goto_aux_clear.click();
            }
        };

        // run the action
        this._goto_aux_run.onclick = e => {
            if(this.goto_coordsys == 'findspot')
                this.filterSpotList();
            else
                this.gotoCoordinate();
        };

        // clear the input
        this._goto_aux_clear.onclick = e => {
            this.goto_txt = '';
            this._goto_txt.dispatchEvent(new Event('input', {bubbles: true}));
        };
    }

    private gotoCoordinate(){
        const txt = this.goto_txt;
        if(!txt) return;
        const coordsys = this.goto_coordsys;
        const profile = coordsys_profiles[coordsys];

        const tokens = txt.split(profile.field.separator).filter(x=>x);
        const coord = this.parseTokens(profile, tokens);
        if(!coord || !containsCoordinate(profile.projection.getExtent(), coord))  //check range
            return this._goto_txt.classList.add('invalid');

        this._gotoLocation(coord, profile.projection)
    }

    private parseTokens(profile, tokens){
        if(profile.has_ref){
            const ref = this._listeners['getcenter']?.();      // webcoord center
            return ref? profile.parse(ref, tokens): undefined;
        }
        return profile.parse(tokens);
    }

    // goto spot ----------------------------------------------

    private initGotoSpot(){
        this._goto_txt.addEventListener('input', e => {
            this.filterSpotList();
        });

        // close spot list when click outside of the panel
        window.addEventListener('mouseup', e => {
            if (!this.candi_spots.length)
                return;
            if (this._goto_panel.contains(e.target as Node))
                return;
            this.clearSpotList();
        });

        // load more spots
        this._goto_spot_more.onclick = e => {
            this.renderSpotList();
        };
    }

    private filterSpotList = () => {
        if(this.goto_coordsys != 'findspot')
            return;

        const keyword = this.goto_txt.toLowerCase();
        if(!keyword)
            return this.clearSpotList();

        // filter spots
        const center = this.getCenterLonLat();
        this.candi_spots = spots
            .filter(s => s.name.toLowerCase().includes(keyword))                   // 過濾
            .map(s => Object.assign(s, {
                dist: center ? getDistance(center, [s.lon, s.lat]) / 1000 : null   //計算距離
            }))
            .sort((a, b) => (a.dist || 0) - (b.dist || 0));

        // check validity
        this._goto_txt.classList.toggle('invalid', !this.candi_spots.length);

        // render spots
        this.renderSpotList(true);
    };

    private renderSpotList(reset = false) {
        if (reset) {
            this.candi_spots_idx = 0;
            this._goto_spot_list.innerHTML = '';
        }

        // calc bearing
        const center = this.getCenterLonLat();
        const bearing = ({lat, lon}) => center ? getBearing(center, [lon, lat]): null;

        // trace the last spot for scolling
        let _spot_item: HTMLElement = null;

        //set the next batch of spots
        const batch = this.candi_spots.slice(this.candi_spots_idx, this.candi_spots_idx + this.candi_spots_batch_size);
        batch.forEach(spot => {
            spot.dir = (spot.dist > 0.001)? toDirection(bearing(spot)): ''; // adding more info
            const webcoord = fromLonLat([spot.lon, spot.lat]);

            this._goto_spot_list.insertAdjacentHTML('beforeend', spotItemHTML(spot));
            _spot_item = this._goto_spot_list.lastElementChild as HTMLElement;
            _spot_item.onclick = () => this._gotoLocation(webcoord);
            _spot_item.onmouseenter = () => this._listeners['goto_preview']?.(webcoord);
            _spot_item.onmouseleave = () => this._listeners['goto_preview_end']?.(webcoord);
        });

        this.candi_spots_idx += batch.length;

        if(_spot_item)
            _spot_item.scrollIntoView({behavior: 'smooth', block: 'center'});

        // show ui
        this._goto_spot_list.classList.toggle('active', this.candi_spots.length > 0);
        this._goto_spot_more.classList.toggle('active', this.candi_spots_idx < this.candi_spots.length);
    }

    private clearSpotList(){
        this.candi_spots = [];      //data
        this.renderSpotList(true);  //ui
    }

    private gotoSpot({lat, lon}){
        this._gotoLocation([lon, lat], WGS84);

        // 不一定要每次都清除，可以保留之前的搜尋結果，讓使用者可以點選其他地點。
        // 要有主動清除的機制，例如「清除搜尋」或是「切換搜尋類型」時再清除。
        //this.clearSpotList();
    }

    // @coord is an arry of [x, y, ...], so it should be [lon, lat, ...] if @proj is WGS84
    // @proj should be provided for transorm if @coord is not web mercator
    private _gotoLocation(coord, proj?){
        if(proj)
            coord = transform(coord, proj, WEB_MERCATOR);
        if(!coord)
            return console.warn(`error coord transform for pojection '${proj}'`, coord);
        this._listeners['goto']?.(coord);
    }

    private getCenterLonLat(){
        const center = this._listeners['getcenter']?.();
        return center? toLonLat(center): null;  // it's needed to check the nullity before toLonLat()
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggleGoto(){
        this._goto_btn.click();
        return this;
    }
}

//=======================================================================================================

export class Footbar{

    _base: HTMLElement;
    _listeners = {};

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base = el;
    }

    private init(){
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }
}