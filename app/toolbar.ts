import Opt from './opt';
import { transform  } from 'ol/proj';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2Sixcodes, WEB_MERCATOR } from './coord';
import { WGS84, TWD97, TWD67, } from './coord';
import { containsCoordinate } from 'ol/extent';
import { tablink, keyEnterToBlur } from './lib/dom-utils';

export class Sidebar{

    _base: HTMLElement;
    _spy_btn: HTMLButtonElement;
    //_goto_btn: HTMLButtonElement;
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

        //this._goto_btn.classList.add('active');
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
}

export class Topbar{

    _base: HTMLElement;
    _filter_btn: HTMLButtonElement;
    _filter_force: HTMLInputElement
    //_filter_wpt_name_en: HTMLInputElement;
    //_filter_wpt_name: HTMLInputElement;
    //_filter_wpt_name_regex: HTMLButtonElement;
    //_filter_wpt_desc_en: HTMLInputElement;
    //_filter_wpt_desc: HTMLInputElement;
    //_filter_wpt_desc_regex: HTMLButtonElement;
    //_filter_wpt_sym_en: HTMLInputElement;
    //_filter_wpt_sym: HTMLInputElement;
    //_filter_wpt_sym_regex: HTMLButtonElement;
    _goto_btn: HTMLButtonElement;
    _goto_coordsys: HTMLSelectElement;
    _goto_coord_txt: HTMLInputElement;
    _goto_coord_go: HTMLButtonElement;

    _listeners = {}

    get filter_force(){ return this._filter_force.checked; }
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
        this._filter_btn         = el.querySelector<HTMLButtonElement>('button.ctrl-btn-filter');
        this._filter_force       = el.querySelector<HTMLInputElement>('#filter-force');
        //this._filter_wpt_name_en = el.querySelector<HTMLInputElement>('#filter-wpt-name-en');
        //this._filter_wpt_desc_en = el.querySelector<HTMLInputElement>('#filter-wpt-desc-en');
        //this._filter_wpt_sym_en  = el.querySelector<HTMLInputElement>('#filter-wpt-sym-en');
        this._goto_btn           = el.querySelector<HTMLButtonElement>('button.ctrl-btn-goto');
        this._goto_coordsys      = el.querySelector<HTMLSelectElement>('select.goto-coordsys');
        this._goto_coord_txt     = el.querySelector<HTMLInputElement>('input.goto-coord-txt');
        this._goto_coord_go      = el.querySelector<HTMLButtonElement>('button.goto-coord-go');
    }

    private init(){
        // filter -----------------------
        tablink('.filter-panel .tablink', '.filter-panel .tabcontent');  //init tab

        this.initFilterRow('name');
        this.initFilterRow('desc');
        this.initFilterRow('sym');

        this._filter_force.checked = Opt.filter.force;
        this._filter_force.onchange = e => {
            if(Opt.update('filter.force', this.filter_force))
                this._listeners['filterchanged']?.(this.filter_force);
        };

        this._filter_btn.classList.toggle('enabled', this.is_filter_enabled);
        this._filter_btn.classList.toggle('active', Opt.filter.visible);      // show panel or not
        this._filter_btn.onclick = e =>{
            const active = this._filter_btn.classList.toggle('active');
            Opt.update('filter.visible', active);
        };

        // goto -----------------------
        this._goto_btn.classList.toggle('active', Opt.goto.visible);  //init
        this._goto_btn.onclick = e =>{
            const active = this._goto_btn.classList.toggle('active');
            Opt.update('goto.visible', active);
        };

        const set_coord_panel = (coordsys) => {
            const profile = coordsys_profiles[coordsys];
            this._goto_coord_txt.placeholder = profile.placeholder;
            this._goto_coord_txt.style.width = profile.field.width;
        };

        if(Opt.goto.coordsys){   //init
            this.goto_coordsys = Opt.goto.coordsys;
            set_coord_panel(this.goto_coordsys)
        }
        this._goto_coordsys.onchange = e =>{
            Opt.update('goto.coordsys', this.goto_coordsys);
            set_coord_panel(this.goto_coordsys);
        }

        this._goto_coord_txt.oninput = e => this._goto_coord_txt.classList.remove('invalid');
        this._goto_coord_txt.onkeyup = e => {if(e.key == 'Enter') this._goto_coord_go.click()};

        this._goto_coord_go.onclick = e => {
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
    }

    private initFilterRow(kind: string){
        const en    = this._base.querySelector<HTMLInputElement>(`#filter-wpt-${kind}-en`);
        const text  = this._base.querySelector<HTMLInputElement>(`#filter-wpt-${kind}`);
        const regex = this._base.querySelector<HTMLButtonElement>(`#filter-wpt-${kind}-regex`);

        en.checked = Opt.filter.wpt[kind].enabled;
        text.value = Opt.filter.wpt[kind].text;
        regex.classList.toggle('active', Opt.filter.wpt[kind].type == "regex");

        en.onchange = e => {
            if(Opt.update(`filter.wpt.${kind}.enabled`, en.checked))
                this._listeners['filterrulechanged']?.();
            // set button state after Opt updated
            this._filter_btn.classList.toggle('enabled', this.is_filter_enabled);
        };

        keyEnterToBlur(text);
        text.onchange = e => {
            if(Opt.update(`filter.wpt.${kind}.text`, text.value.toLowerCase()) &&  // saving lower, for caseignore
               Opt.filter.wpt[kind].enabled)
                this._listeners['filterrulechanged']?.();
        };

        regex.onclick = e => {
            const active = regex.classList.toggle('active');
            if(Opt.update(`filter.wpt.${kind}.type`, active?"regex":"contains") &&
               Opt.filter.wpt[kind].enabled)
                this._listeners['filterrulechanged']?.();
        };
    }

    private parseTokens(profile, tokens){
        if(profile.has_ref){
            const ref = this._listeners['getcenter']?.();      // webcoord center
            return ref? profile.parse(ref, tokens): undefined;
        }
        return profile.parse(tokens);
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
