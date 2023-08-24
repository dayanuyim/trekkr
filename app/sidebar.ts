import Opt from './opt';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { fromTWD67, fromTWD97, fromTaipowerCoord } from './coord';

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

const coordsys_info = {
    "wgs84": {
        placeholder: ['(經度)120.926126', '(緯度)23 33 32.45'],
        from: fromLonLat,
    },
    "twd97": {
        placeholder: ['(X)242459', '(Y)2606189'],
        from: fromTWD97,
    },
    "twd67": {
        placeholder: ['(X)241630', '(Y)2606394'],
        from: fromTWD67,
    },
    "taipower": {
        placeholder: ['K8912ED3904'],
        from: fromTaipowerCoord,
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
        this._goto_btn.onclick = e =>{
            this._goto_btn.classList.toggle('active');
        };

        const set_coord_panel = (coordsys) => {
            this._goto_coord_y.classList.toggle('hidden', coordsys == 'taipower');

            const [xtext, ytext] = coordsys_info[coordsys].placeholder;
            this._goto_coord_x.placeholder = xtext;
            this._goto_coord_y.placeholder = ytext;

            const is_tm2 = ['twd67', 'twd97'].includes(coordsys);
            this._goto_coord_x.classList.toggle('short', is_tm2);
            this._goto_coord_y.classList.toggle('short', is_tm2);
        };

        this._goto_coordsys.onclick = e => set_coord_panel(this.goto_coordsys);
        set_coord_panel('wgs84');  //init;

        this._goto_coord_go.onclick = e => {
            const coordsys = this.goto_coordsys;
            const coord = this.parseCoords(coordsys, this.goto_coord_x, this.goto_coord_y);
            if(coord){
                const webcoord = coordsys_info[coordsys].from(coord);
                this._listeners['goto']?.(new Point(webcoord));
            }
        }
    }

    private parseCoords(coordsys, x, y){
        x = x.trim();
        y = y.trim();
        if(!x || !y) return undefined;

        const to_num = s => {
            const nums = s.split(/[^+-.0-9]/);
            switch(nums.length) {
                case 1: return Number(nums[0]);
                case 3:
                    const [d, m, s] = nums;
                    return Number(d) + m / 60.0 + s / 3600.0;
                default:
                    console.error(`invalid latlon format '${s}`)
                    return undefined;
            }
        }

        switch(coordsys){
            case 'wgs84':
                [x, y] = [to_num(x), to_num(y)];
                if(!x || !y) return undefined;
                return [x, y];
            case 'twd97':
            case 'twd67':
                return [Number(x), Number(y)];
            case 'taipower':
                return [x, undefined];   //only one string
            default:
                console.error(`unknown coordsys ${coordsys} for coordinates (${x},${y})`);
                return [x, y];
        }
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
