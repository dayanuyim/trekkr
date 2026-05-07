import Opt from './opt';
import spots from './data/spots.js';
import { transform  } from 'ol/proj';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2Sixcodes, WEB_MERCATOR, WGS84, TWD97, TWD67 } from './coord';
import { toLonLat } from 'ol/proj';
import { containsCoordinate } from 'ol/extent';
import { getDistance } from 'ol/sphere';
import { spotItem as spotItemHTML } from './templates';

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
            width: '14em',
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
            width: '10em',
        },
        parse: (tokens) => (tokens.length == 2)? tokens.map(Number): undefined,
    },
    twd67: {
        projection: TWD67,
        placeholder: 'X 241630, Y 2606394',
        field: {
            separator: /[^-+.0-9]/,
            width: '10em',
        },
        parse: (tokens) => (tokens.length == 2)? tokens.map(Number): undefined,
    },
    taipower: {
        projection: TWD67,
        placeholder: 'K8912ED3904',
        field: {
            separator: /[^a-zA-Z0-9]/,
            width: '8em',
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
            width: '5em',
        },
        has_ref: true,
        parse: (ref, tokens) => sixcode_parser(ref, tokens, toTWD97),
    },
    twd67_6: {
        projection: TWD67,
        placeholder: '六碼 416063',
        field: {
            separator: /[^0-9]/,
            width: '5em',
        },
        has_ref: true,
        parse: (ref, tokens) => sixcode_parser(ref, tokens, toTWD67),
    },
    findspot: {
        projection: WGS84,
        placeholder: '地點名稱',
        field: {
            separator: / /,   //space split
            width: '20em',
        },
        parse: (tokens) => (tokens.length)? tokens[0].trim(): undefined,
    },
}

export class Topbar{

    _base: HTMLElement;
    //_filter_wpt_name_en: HTMLInputElement;
    //_filter_wpt_name: HTMLInputElement;
    //_filter_wpt_name_regex: HTMLButtonElement;
    //_filter_wpt_desc_en: HTMLInputElement;
    //_filter_wpt_desc: HTMLInputElement;
    //_filter_wpt_desc_regex: HTMLButtonElement;
    //_filter_wpt_sym_en: HTMLInputElement;
    //_filter_wpt_sym: HTMLInputElement;
    //_filter_wpt_sym_regex: HTMLButtonElement;
    _goto_panel: HTMLElement;
    _goto_btn: HTMLButtonElement;
    _goto_coordsys: HTMLSelectElement;
    _goto_coord_txt: HTMLInputElement;
    _goto_coord_go: HTMLButtonElement;

    _goto_spot_list: HTMLUListElement;
    _goto_spot_more: HTMLButtonElement;

    _listeners = {}
    candi_sopts = [];
    candi_spots_idx = 0;
    candi_spots_batch_size = 10;

    get is_filter_enabled(){ return !!Object.values(Opt.filter.wpt).find((rule: any)=>rule.enabled); } // viewed as enabled if any rule is enabled.
    get goto_coordsys(){ return this._goto_coordsys.value; }
    set goto_coordsys(v){ this._goto_coordsys.value = v; }
    get goto_coord_txt(){ return this._goto_coord_txt.value.trim(); }
    set goto_coord_txt(txt){ this._goto_coord_txt.value = txt.trim(); }

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base               = el;
        //this._filter_btn         = el.querySelector<HTMLButtonElement>('button.ctrl-btn-filter');
        //this._filter_wpt_name_en = el.querySelector<HTMLInputElement>('#filter-wpt-name-en');
        //this._filter_wpt_desc_en = el.querySelector<HTMLInputElement>('#filter-wpt-desc-en');
        //this._filter_wpt_sym_en  = el.querySelector<HTMLInputElement>('#filter-wpt-sym-en');
        this._goto_panel         = el.querySelector<HTMLElement>('.goto-panel');
        this._goto_btn           = el.querySelector<HTMLButtonElement>('button.ctrl-btn-goto');
        this._goto_coordsys      = el.querySelector<HTMLSelectElement>('select.goto-coordsys');
        this._goto_coord_txt     = el.querySelector<HTMLInputElement>('input.goto-coord-txt');
        this._goto_coord_go      = el.querySelector<HTMLButtonElement>('button.goto-coord-go');
        this._goto_spot_list     = el.querySelector<HTMLUListElement>('.goto-spot-list');
        this._goto_spot_more     = el.querySelector<HTMLButtonElement>('.goto-spot-more');
    }

    private init(){
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
            this._goto_coord_txt.placeholder = profile.placeholder;
            this._goto_coord_txt.style.width = profile.field.width;
        };

        // set coordsys select
        if(Opt.goto.coordsys){   //init
            this.goto_coordsys = Opt.goto.coordsys;
            set_coord_panel(this.goto_coordsys)
        }
        this._goto_coordsys.onchange = e =>{
            Opt.update('goto.coordsys', this.goto_coordsys);
            set_coord_panel(this.goto_coordsys);
        }

        this._goto_coord_txt.addEventListener('input', e => {
            this._goto_coord_txt.classList.remove('invalid');
        });

        // Enter to click
        this._goto_coord_txt.onkeyup = e => {
            if(this.goto_coordsys != 'findspot' && e.key == 'Enter')
                this._goto_coord_go.click();
        };

        this._goto_coord_go.onclick = e => this.gotoCoordinate();
    }

    private gotoCoordinate(){
        const txt = this.goto_coord_txt;
        if(!txt) return;
        const coordsys = this.goto_coordsys;
        const profile = coordsys_profiles[coordsys];

        const tokens = txt.split(profile.field.separator).filter(x=>x);
        const coord = this.parseTokens(profile, tokens);
        if(!coord || !containsCoordinate(profile.projection.getExtent(), coord))  //check range
            return this._goto_coord_txt.classList.add('invalid');

        const webcoord = transform(coord, profile.projection, WEB_MERCATOR);
        if(webcoord)
            this._listeners['goto']?.(webcoord);
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
        this._goto_coord_txt.addEventListener('input', e => {
            if(this.goto_coordsys != 'findspot')
                return;
            const keyword = this.goto_coord_txt.toLowerCase();
            const center = toLonLat(this._listeners['getcenter']?.());

            // 過濾並計算距離
            this.candi_sopts = !keyword ? [] : spots
                .filter(s => s.name.toLowerCase().includes(keyword))
                .map(s => Object.assign(s, {
                    dist: center? getDistance(center, [s.lon, s.lat]) / 1000: null
                }))
                .sort((a, b) => (a.dist || 0) - (b.dist || 0));
            this.renderSpotList(true);
        });

        // close spot list when click outside of the panel
        window.addEventListener('click', e => {
            if (!this.candi_sopts.length)
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

    private renderSpotList(reset = false) {
        if (reset) {
            this.candi_spots_idx = 0;
            this._goto_spot_list.innerHTML = '';
        }

        let _spot_item = null;

        //set the next batch of spots
        const batch = this.candi_sopts.slice(this.candi_spots_idx, this.candi_spots_idx + this.candi_spots_batch_size);
        batch.forEach(spot => {
            this._goto_spot_list.insertAdjacentHTML('beforeend', spotItemHTML(spot));
            _spot_item = this._goto_spot_list.lastElementChild;
            _spot_item.onclick = () => this.gotoSpot(spot);
        });

        this.candi_spots_idx += batch.length;

        if(_spot_item)
            _spot_item.scrollIntoView({behavior: 'smooth', block: 'center'});

        // show ui
        this._goto_spot_list.classList.toggle('active', this.candi_sopts.length > 0);
        this._goto_spot_more.classList.toggle('active', this.candi_spots_idx < this.candi_sopts.length);
    }

    private clearSpotList(){
        this.candi_sopts = [];      //data
        this.renderSpotList(true);  //ui
    }

    private gotoSpot({lat, lon}){
        const coordsys = this.goto_coordsys;
        const profile = coordsys_profiles[coordsys];

        const webcoord = transform([lon, lat], profile.projection, WEB_MERCATOR);  //becare lon, lat order for transform
        if(webcoord)
            this._listeners['goto']?.(webcoord);

        //TODO: 不一定要每次都清除，可以保留之前的搜尋結果，讓使用者可以點選其他地點。
        // 要有主動清除的機制，例如「清除搜尋」或是「切換搜尋類型」時再清除。
        //this.clearSpotList();
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
