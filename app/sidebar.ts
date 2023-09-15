import Opt from './opt';
import { transform  } from 'ol/proj';
import { taipowerCoordToTWD67, toTWD67, toTWD97, TM2Sixcodes, WEB_MERCATOR } from './coord';
import { WGS84, TWD97, TWD67, } from './coord';
import { containsCoordinate } from 'ol/extent';

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
        this._spy_btn.classList.toggle('active', Opt.spy.enabled);
        this._spy_btn.title = Opt.tooltip.btn_spy;
        this._spy_btn.addEventListener('click', e =>{
            const enabled = this._spy_btn.classList.toggle('active');
            Opt.update({enabled}, 'spy');
            this._listeners['click']?.();
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
    _goto_btn: HTMLButtonElement;
    _goto_coordsys: HTMLSelectElement;
    _goto_coord_txt: HTMLInputElement;
    _goto_coord_go: HTMLButtonElement;
    _listeners = {}

    get goto_coordsys(){ return this._goto_coordsys.value; }
    set goto_coordsys(v){ this._goto_coordsys.value = v; }
    get goto_coord_txt(){ return this._goto_coord_txt.value.trim(); }
    set goto_coord_txt(txt){ this._goto_coord_txt.value = txt.trim(); }

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base           = el;
        this._goto_btn       = el.querySelector<HTMLButtonElement>('button.goto-btn');
        this._goto_coordsys  = el.querySelector<HTMLSelectElement>('select.goto-coordsys');
        this._goto_coord_txt   = el.querySelector<HTMLInputElement>('input.goto-coord-txt');
        this._goto_coord_go   = el.querySelector<HTMLButtonElement>('button.goto-coord-go');
    }

    private init(){
        this._goto_btn.classList.toggle('active', Opt.goto.active);  //init
        this._goto_btn.onclick = e =>{
            const active = this._goto_btn.classList.toggle('active');
            Opt.update({active}, 'goto');
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
            Opt.update({coordsys: this.goto_coordsys}, 'goto');
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
