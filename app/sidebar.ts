import Opt from './opt';
import { fromLonLat } from 'ol/proj';
import { fromTWD67, fromTWD97, fromTaipowerCoord, toTWD67, toTWD97, fromTWD67Sixcodes, fromTWD97Sixcodes,} from './coord';

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
const swap2 = ([a, b]) => [b, a];

const coordsys_profiles = {
    wgs84: {
        placeholder: '緯度 23 33 32.45, 經度 120.926126',
        field: {
            separator: /[^-+.0-9]/,
            width: '14em',
        },
        parse: (nums) => {
            switch(nums.length) {
                case 2: return swap2(nums.map(Number));                                    //swap lat/lon to lon/lat
                case 6: return [nums.slice(3, 6), nums.slice(0, 3)].map(deg_to_decimal);   //swap lat/lon to lon/lat
                default: return undefined;
            }
        },
        from: fromLonLat,
    },
    twd97: {
        placeholder: 'X 242459, Y 2606189',
        field: {
            separator: /[^-+.0-9]/,
            width: '10em',
        },
        parse: (nums) => (nums.length == 2)? nums.map(Number): undefined,
        from: fromTWD97,
        to: toTWD97,
    },
    twd67: {
        placeholder: 'X 241630, Y 2606394',
        field: {
            separator: /[^-+.0-9]/,
            width: '10em',
        },
        parse: (nums) => (nums.length == 2)? nums.map(Number): undefined,
        from: fromTWD67,
        to: toTWD67,
    },
    taipower: {
        placeholder: 'K8912ED3904',
        field: {
            separator: /[^a-zA-Z0-9]/,
            width: '7em',
        },
        parse: (nums) => (nums.length == 1)? nums[0]: undefined,
        from: fromTaipowerCoord,
    },
    twd97_6: {
        base_coordsys: 'twd97',
        placeholder: '六碼 424061',
        field: {
            separator: /[^0-9]/,
            width: '5em',
        },
        parse: (nums) => (nums.length == 1 && nums[0].length == 6)? nums[0]: undefined,
        from: fromTWD97Sixcodes,
    },
    twd67_6: {
        base_coordsys: 'twd67',
        placeholder: '六碼 416063',
        field: {
            separator: /[^0-9]/,
            width: '5em',
        },
        parse: (nums) => (nums.length == 1 && nums[0].length == 6)? nums[0]: undefined,
        from: fromTWD67Sixcodes,
    },
}

export class Topbar{

    _base: HTMLElement;
    _goto_btn: HTMLButtonElement;
    _goto_coordsys: HTMLSelectElement;
    _goto_coord_str: HTMLInputElement;
    _goto_coord_go: HTMLButtonElement;
    _listeners = {}

    get goto_coordsys(){ return this._goto_coordsys.value; }
    set goto_coordsys(v){ this._goto_coordsys.value = v; }
    get goto_coord_str(){ return this._goto_coord_str.value.trim(); }
    set goto_coord_str(str){ this._goto_coord_str.value = str.trim(); }

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base           = el;
        this._goto_btn       = el.querySelector<HTMLButtonElement>('button.goto-btn');
        this._goto_coordsys  = el.querySelector<HTMLSelectElement>('select.goto-coordsys');
        this._goto_coord_str   = el.querySelector<HTMLInputElement>('input.goto-coord');
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
            this._goto_coord_str.placeholder = profile.placeholder;
            this._goto_coord_str.style.width = profile.field.width;
        };

        if(Opt.goto.coordsys){   //init
            this.goto_coordsys = Opt.goto.coordsys;
            set_coord_panel(this.goto_coordsys)
        }
        this._goto_coordsys.onchange = e =>{
            Opt.update({coordsys: this.goto_coordsys}, 'goto');
            set_coord_panel(this.goto_coordsys);
        }

        this._goto_coord_str.onkeyup = e => {if(e.key == 'Enter') this._goto_coord_go.click()};

        this._goto_coord_go.onclick = e => {
            const coordsys = this.goto_coordsys;
            const profile = coordsys_profiles[coordsys];

            const tokens = this.goto_coord_str.split(profile.field.separator).filter(x=>x);
            const coord = profile.parse(tokens);
            if(!coord)
                return console.error(`invalid coordinates string '${this.goto_coord_str}'`);

            const webcoord = this.fromCoord(profile, coord);
            if(webcoord)
                this._listeners['goto']?.(webcoord);
        }
    }

    private fromCoord(profile, coord){
        if(profile.base_coordsys){
            const center = this._listeners['getcenter']?.();                  // webcoord center
            if(!center) return undefined;
            const ref = coordsys_profiles[profile.base_coordsys].to(center);  // to base coordsys, as ref
            return profile.from(ref, coord)
        }
        return profile.from(coord);
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
