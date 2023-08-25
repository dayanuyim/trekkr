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
//  WGS84    121.1699175, 24.2955986
//  TWD97    267248, 2687771
//  TWD67    266419, 2687977
//  TAIPOWER H2075EE1797
//  TWD97_6  672878
//  TWD67_6  664880
///////////////////////////////////////////

const parse_deg_or_decimal = str => {
    const nums = str.split(/[^+-.0-9]/);
    switch(nums.length) {
        case 1:
            return Number(nums[0]);
        case 3:
            const [d, m, s] = nums;
            return Number(d) + m / 60.0 + s / 3600.0;
        default:
            console.error(`invalid latlon format '${str}'`)
            return undefined;
    }
}
const coordsys_profiles = {
    wgs84: {
        placeholder: ['經度 120.926126', '緯度 23 33 32.45'],
        field: {
            num: 2,
            width: '7em',
        },
        parse: (x, y) => {
            x = parse_deg_or_decimal(x);
            y = parse_deg_or_decimal(y);
            return (x && y)? [x, y]: undefined;
        },
        from: fromLonLat,
    },
    twd97: {
        placeholder: ['X 242459', 'Y 2606189'],
        field: {
            num: 2,
            width: '5em',
        },
        parse: (x, y) => [Number(x), Number(y)],
        from: fromTWD97,
        to: toTWD97,
    },
    twd67: {
        placeholder: ['X 241630', 'Y 2606394'],
        field: {
            num: 2,
            width: '5em',
        },
        parse: (x, y) => [Number(x), Number(y)],
        from: fromTWD67,
        to: toTWD67,
    },
    taipower: {
        placeholder: ['K8912ED3904'],
        field: {
            num: 1,
            width: '7em',
        },
        parse: x => x,
        from: fromTaipowerCoord,
    },
    twd97_6: {
        base_coordsys: 'twd97',
        placeholder: ['六碼 424061'],
        field: {
            num: 1,
            width: '5em',
        },
        parse: x => x,
        from: fromTWD97Sixcodes,
    },
    twd67_6: {
        base_coordsys: 'twd67',
        placeholder: ['六碼 416063'],
        field: {
            num: 1,
            width: '5em',
        },
        parse: x => x,
        from: fromTWD67Sixcodes,
    },
}

export class Topbar{

    _base: HTMLElement;
    _goto_btn: HTMLButtonElement;
    _goto_coordsys: HTMLSelectElement;
    _goto_coord_x: HTMLInputElement;
    _goto_coord_y: HTMLInputElement;
    _goto_coord_go: HTMLButtonElement;
    _listeners = {}

    get goto_coordsys(){ return this._goto_coordsys.value; }
    set goto_coordsys(v){ this._goto_coordsys.value = v; }
    get goto_coord_x(){ return this._goto_coord_x.value; }
    set goto_coord_x(v){ this._goto_coord_x.value = v; }
    get goto_coord_y(){ return this._goto_coord_y.value; }
    set goto_coord_y(v){ this._goto_coord_y.value = v; }

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
        //this.toggleGoto(); //@@!
    }

    private initElements(el: HTMLElement){
        this._base           = el;
        this._goto_btn       = el.querySelector<HTMLButtonElement>('button.goto-btn');
        this._goto_coordsys  = el.querySelector<HTMLSelectElement>('select.goto-coordsys');
        this._goto_coord_x   = el.querySelector<HTMLInputElement>('input.goto-coord-x');
        this._goto_coord_y   = el.querySelector<HTMLInputElement>('input.goto-coord-y');
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

            const [xtext, ytext] = profile.placeholder;
            this._goto_coord_x.placeholder = xtext;
            this._goto_coord_y.placeholder = ytext;

            this._goto_coord_x.style.width =
            this._goto_coord_y.style.width = profile.field.width;

            this._goto_coord_y.classList.toggle('hidden', profile.field.num == 1);
        };

        if(Opt.goto.coordsys){   //init
            this.goto_coordsys = Opt.goto.coordsys;
            set_coord_panel(this.goto_coordsys)
        }
        this._goto_coordsys.onchange = e =>{
            Opt.update({coordsys: this.goto_coordsys}, 'goto');
            set_coord_panel(this.goto_coordsys);
        }

        this._goto_coord_x.onkeyup =
        this._goto_coord_y.onkeyup = e => {if(e.key == 'Enter') this._goto_coord_go.click()};

        this._goto_coord_go.onclick = e => {
            const coordsys = this.goto_coordsys;
            const x = this.goto_coord_x.trim();
            const y = this.goto_coord_y.trim();
            const xy = coordsys_profiles[coordsys].parse(x, y);
            if(xy){
                const webcoord = this.fromXY(coordsys, xy);
                if(webcoord)
                    this._listeners['goto']?.(webcoord);
            }
        }
    }

    private fromXY(coordsys, xy){
        const profile = coordsys_profiles[coordsys];
        if(profile.base_coordsys){
            const center = this._listeners['getcenter']?.();                  // webcoord center
            if(!center) return undefined;
            const ref = coordsys_profiles[profile.base_coordsys].to(center);  // to base coordsys, as ref
            return profile.from(ref, xy)
        }
        return profile.from(xy);
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
