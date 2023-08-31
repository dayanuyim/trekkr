'use strict';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay';
import {toStringXY} from 'ol/coordinate';
import {toLonLat} from 'ol/proj';
import {toTWD97, toTWD67, toTaipowerCoord} from './coord';

//import * as moment from 'moment-timezone';
import { getSymbol, matchRules, symbol_inv } from './sym'
import { getEleByCoords, getEleOfCoords, setEleOfCoords, getLocalTimeByCoords, gmapUrl } from './common'
import { olWptFeature, def_trk_color, getTrkptIndicesAtEnds, getTrkptIndicesByCoord, isTrkFeature} from './gpx';
import { delayToEnable } from './lib/dom-utils';
import Opt from './opt';
import * as templates from './templates';

const toXY = {
    wgs84:    (coord) => toStringXY(toLonLat(coord), 7),
    twd97:    (coord) => toStringXY(toTWD97(coord)),
    twd67:    (coord) => toStringXY(toTWD67(coord)),
    taipower: (coord) => toTaipowerCoord(coord),
};

function fmtEle(ele){
    return ele.toFixed(1);
}

function fmtTime(moment) {
    return moment.format('YYYY-MM-DD HH:mm:ss');
}

function setSubBoardEvents(main: HTMLElement, trigger: HTMLElement, subboard: HTMLElement,
    subitems: NodeListOf<HTMLElement>|HTMLElement[], subitem_cb: CallableFunction): void
{
    // main -> close subboard
    main.addEventListener('click', e => {
        subboard.classList.add('hidden');
    });

    // trigger -> togger subboard
    trigger.addEventListener('click', e => {
        e.stopPropagation();
        subboard.classList.toggle('hidden');
    });

    // subboard -> do nothing
    subboard.addEventListener('click', e => {
        e.stopPropagation();
    });

    // subitems -> do something, then close subboard
    subitems.forEach(item => {
        item.addEventListener('click', e => {
            e.stopPropagation();
            if(subitem_cb) subitem_cb(item, e);
            subboard.classList.add('hidden');
        });
    });
}

const enter_to_blur_listener = e => {
    if(e.key == "Enter"){
        e.preventDefault();
        e.target.blur();
        return false;
    }
}

/*
declare class Overlay{
    constructor(options: any);
    getElement(): HTMLElement|undefined;
    getPosition
    
}
*/

function scaleDown({width, height}, max){
    if(width <= max && height <= max)
        return {width, height};

    if(width > height)
        return {width: max, height: height/width*max};
    else
        return {width: width/height*max, height: max};
}

const xy_equals = ([x1, y1], [x2, y2]) => (x1 === x2 && y1 === y2);
const xy_approximate = ([x1, y1], [x2, y2]) => Math.abs(x2-x1) < 0.000001 && Math.abs(y2-y1) < 0.000001;

//TODO: convert this to typescript
export default class PtPopupOverlay extends Overlay{
    _closer: HTMLElement;
    _resizer: HTMLElement;
    _resizer_content: HTMLElement;
    _content: HTMLElement;
    _pt_image: HTMLElement;
    _pt_trk: HTMLElement;
    _pt_trk_name: HTMLElement;
    _pt_trk_seg_sn: HTMLElement;
    _pt_trk_color: HTMLElement;
    _pt_colorboard: HTMLElement;
    _pt_wpt_header: HTMLElement;
    _pt_sym: HTMLImageElement;
    _pt_symboard: HTMLElement;
    _pt_symboard_filter: HTMLInputElement;
    _pt_name: HTMLElement;
    _pt_coord: HTMLElement;
    _pt_coord_title: HTMLSelectElement;
    _pt_coord_value: HTMLElement;
    _pt_gmap: HTMLAnchorElement;
    _pt_ele: HTMLElement;
    _pt_ele_est: HTMLElement;
    _pt_time: HTMLElement;
    _pt_mk_wpt: HTMLButtonElement;
    _pt_rm_wpt: HTMLButtonElement;
    _pt_split_trk: HTMLButtonElement;
    _pt_join_trk: HTMLButtonElement;
    _pt_rm_trk: HTMLButtonElement;
    _sym_copyright: HTMLElement;
    _sym_maker: HTMLAnchorElement;
    _sym_provider: HTMLAnchorElement;
    _sym_license: HTMLAnchorElement;

    _feature;
    _data;
    _resize_observer;
    _listeners = {};

    get pt_trk_name() { return this._pt_trk_name.textContent; }
    set pt_trk_name(value) { this._pt_trk_name.textContent = value; }
    get pt_trk_seg_sn() { return this._pt_trk_seg_sn.textContent; }
    set pt_trk_seg_sn(value) { this._pt_trk_seg_sn.textContent = value; }
    get pt_trk_color() { return this._pt_trk_color.style.backgroundColor; }
    set pt_trk_color(value) { this._pt_trk_color.style.backgroundColor = value; }
    get pt_sym() { return this._pt_sym.src; }
    set pt_sym(src) { this._pt_sym.src = src;}
    get pt_name() { return this._pt_name.textContent; }
    set pt_name(value) { this._pt_name.textContent = value; }
    get pt_coord() { return this._pt_coord.getAttribute('data-pt-coord').split(',').map(Number); }
    set pt_coord(value) { this._pt_coord.setAttribute('data-pt-coord', value.join(',')); }
    get pt_coord_title() { return this._pt_coord_title.value; }
    set pt_coord_title(value) { this._pt_coord_title.value = value; }
    get pt_coord_value() { return this._pt_coord_value.textContent; }
    set pt_coord_value(value) { this._pt_coord_value.textContent = value; }
    get pt_gmap() { return this._pt_gmap.href; }
    set pt_gmap(value) { this._pt_gmap.href = value; }
    get pt_ele() { return this._pt_ele.textContent; }
    set pt_ele(value) { this._pt_ele.textContent = value; }
    get pt_time() { return this._pt_time.textContent; }
    set pt_time(value) { this._pt_time.textContent = value; }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    //_coord_title;
    constructor(el: HTMLElement){
        super({
            element: el,
            id: el.getAttribute('id'),
            autoPan: {
                animation: {
                    duration: 250,
                }
            }
        });

        this.initProperties();
        this.initEvents();
    }

    private initProperties(){
        const el = this.getElement();
        this._closer =             el.querySelector<HTMLElement>('.ol-popup-closer');
        this._resizer =            el.querySelector<HTMLElement>('.popup-resizer');
        this._resizer_content =    this._resizer.querySelector<HTMLElement>('.popup-resizer-content');
        this._content =            el.querySelector<HTMLElement>('.ol-popup-content');
        this._pt_image =           el.querySelector<HTMLElement>('.pt-image');
        this._pt_trk =             el.querySelector<HTMLElement>('.pt-trk');
        this._pt_trk_name =        el.querySelector<HTMLElement>('.pt-trk-name');
        this._pt_trk_seg_sn =      el.querySelector<HTMLElement>('.pt-trk-seg-sn');
        this._pt_trk_color =       el.querySelector<HTMLElement>('.pt-trk-color');
        this._pt_colorboard =      el.querySelector<HTMLElement>('.pt-colorboard');
        this._pt_wpt_header =      el.querySelector<HTMLElement>('.pt-wpt-header');
        this._pt_sym =             el.querySelector<HTMLImageElement>('.pt-sym');
        this._pt_symboard =        el.querySelector<HTMLElement>('.pt-symboard');
        //this._pt_symboard_filter = ... //DONT DO THIS since symboard is lazy initailized
        this._pt_name =            el.querySelector<HTMLElement>('.pt-name');
        this._pt_coord =           el.querySelector<HTMLElement>('.pt-coord');
        this._pt_coord_title =     this._pt_coord.querySelector<HTMLSelectElement>('.pt-coord-title');
        this._pt_coord_value =     this._pt_coord.querySelector<HTMLElement>('.pt-coord-value');
        this._pt_gmap =            el.querySelector<HTMLAnchorElement>('a.pt-gmap');
        this._pt_ele =             el.querySelector<HTMLElement>('.pt-ele-value');
        this._pt_ele_est =         el.querySelector<HTMLElement>('.pt-ele-est');
        this._pt_time =            el.querySelector<HTMLElement>('.pt-time-value');
        this._pt_mk_wpt =          el.querySelector<HTMLButtonElement>('.pt-tool-mk-wpt');
        this._pt_rm_wpt =          el.querySelector<HTMLButtonElement>('.pt-tool-rm-wpt');
        this._pt_split_trk =       el.querySelector<HTMLButtonElement>('.pt-tool-split-trk');
        this._pt_join_trk =        el.querySelector<HTMLButtonElement>('.pt-tool-join-trk');
        this._pt_rm_trk =          el.querySelector<HTMLButtonElement>('.pt-tool-rm-trk');
        this._sym_copyright =      el.querySelector<HTMLElement>('.sym-copyright');
        this._sym_maker =          this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-maker');
        this._sym_provider =       this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-provider');
        this._sym_license =        this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-license');
    }

    public hide(){
        this.setPosition(undefined);
    }

    private resetDisplay(image?){
        const show = (el, en) => el.classList.toggle('hidden', !en)

        //trk
        show(this._pt_trk, this._data.trk);
        if(this._data.trk){
            show(this._pt_join_trk, this._data.trk.is_end);
            show(this._pt_split_trk, !this._data.trk.is_end && this._data.trk.is_real);
            this.pt_trk_seg_sn = this.getTrksegSnText();
        }

        //colorboard
        show(this._pt_colorboard, false);   //colorboard hidden, if any

        //symboard
        show(this._pt_symboard, false);     //symboard hidden, if any
        this.resetSymboardFilter();         //symboard filter reset

        //resizer
        this._resize_observer.disconnect();
        this._resizer.classList.toggle('active', !!image);
        this._resizer.style.width = '';              //reset resizer size
        this._resizer.style.height = '';
        this._resizer_content.style.width = '';      //reset resizer-content size
        this._resizer_content.style.height = '';
        if(image) this._resize_observer.observe(this._resizer);

        //image
        const {url, size} = image || {};
        const {width, height} = size? scaleDown(size, 400): {width: undefined, height: undefined};
        this._pt_image.classList.toggle('active', !!image);
        this._pt_image.style.backgroundImage = url? `url('${url}')`: '';
        this._pt_image.style.width = width? `${width}px`: '';
        this._pt_image.style.height = height? `${height}px`: '';
    }

    private initEvents(){
        //close popup
        this._closer.onclick = e => { this.hide();
            (<HTMLElement>e.currentTarget).blur();
            return false;
        };

        /*
        // !! NOT WORK! NOT WAY TO CHANGE RESIZE CURSOR !!
        //change resizer cursor, when mouser in right-top corner
        this._resizer.onmousemove = e => {
            const n = 16;
            const {right, top} = this._resizer.getBoundingClientRect();
            console.log(`x: ${e.pageX} > (${right} - ${n} = ${right -n}): ${e.pageX > (right - n)}`);
            console.log(`y: ${e.pageY} < (${top} + ${n} = ${top + n}): ${e.pageY < (right - n)}`);
            this._resizer.style.cursor= e.pageX > (right - n) && e.pageY < (top + n)? 'nesw-resize' : ''
        };
        */

        // colorboard
        setSubBoardEvents(
            this.getElement(),
            this._pt_trk_color,
            this._pt_colorboard,
            this._pt_colorboard.querySelectorAll<HTMLElement>('.pt-colorboard-item'), (item) => {
                const color = item.getAttribute("title");
                if(this._data.trk.color != color){
                    this._data.trk.color = color;
                    this._data_trk_color_changed();
                }
            });

        // change trk name
        this._pt_trk_name.onkeydown = enter_to_blur_listener;
        this._pt_trk_name.onblur = e => {
            if(!this.pt_trk_name)
                return this.setContent(this._data);  //reload the data to restore the erased value
            if(this._data.trk.name != this.pt_trk_name){
                this._data.trk.name = this.pt_trk_name;
                this._data_trk_name_changed();
            }
        }

        // set resizer-conetnt as the same size as the resizer
        this._resize_observer = new ResizeObserver((entries)=>{
            const {width, height} = entries[0].contentRect;
            if(width && height) {
                this._resizer_content.style.width = width + 'px';
                this._resizer_content.style.height = height + 'px';
            }
        });

        // disable resizer if symboard is visible
        new IntersectionObserver((entries) => {
            const visible = entries[0].intersectionRatio > 0;
            this._resizer.classList.toggle('disabled', visible);
        }).observe(this._pt_symboard);

        //lazy init symboard
        this._pt_sym.addEventListener('mousedown', () => {
            console.log('init symboard');
            this.initSymboard();
        }, {once: true});

        // change wpt name
        this._pt_name.onkeydown = enter_to_blur_listener;
        this._pt_name.onblur = e => {
            const name = this.pt_name.trim();
            if(!name)
                return this.setContent(this._data);  //reload the data to restore the erased value
            if(this._data.name != name){     //cache != ui
                this._data.name = name;
                this._data_name_changed();
            }
        }

        // check elevation, be careful not to limit editing key
        //const valid_ele_char = (c) => /^\d$/.test(c) || (c == "." && !this.pt_ele.includes("."));
        this._pt_ele.onkeydown = (e) => {
            if(enter_to_blur_listener(e) === false)
                return false;
            if(e.key == "." && this.pt_ele.includes("."))  //multiple 'dot'
                e.preventDefault();
        };
        this._pt_ele.onkeyup = e => {
            if(isNaN(+this.pt_ele))
                this.pt_ele = this.pt_ele.replace(/[^0-9.]/g, "");  // remove non-digit characters
        };
        this._pt_ele.onblur = e => {
            if(!this.pt_ele){
                this.setContent(this._data);  //reload the data to restore the erased value
                return;
            }
            const ele = +this.pt_ele;
            if(getEleOfCoords(this._data.coord) != ele){
                setEleOfCoords(this._data.coord, ele);
                this._data_ele_changed();
            }
        };

        // change coordsys
        this._pt_coord_title.onchange = e => {
            const el = <HTMLSelectElement>e.currentTarget;
            const coordsys = el.value;
            this.pt_coord_value = toXY[coordsys](this.pt_coord)
            Opt.update({coordsys});
        };

        // make wpt from trkpt
        this._pt_mk_wpt.onclick = e => {
            /*
            //sometimes coordiantes changed when getting it from feature again. Why??
            const wpt = this._feature.clone();
            wpt.setProperties({
                name: "WPT",
                sym: "City (Small)",
            });
            */
            const wpt = olWptFeature(this._data.coord, {sym: "City (Small)"});
            this.popContent(wpt);
            this._listeners['mkwpt']?.(wpt);
        };

        delayToEnable(this._pt_rm_wpt, 1000); // delay to enable button, prevent from click by mistake
        this._pt_rm_wpt.onclick = e => {
            this._listeners['rmwpt']?.(this._feature);
            this.hide();
        };

        delayToEnable(this._pt_rm_trk, 1000); // delay to enable button, prevent from click by mistake
        this._pt_rm_trk.onclick = e => {
            this._listeners['rmtrk']?.(this._feature);
            this.hide();
        };

        this._pt_split_trk.onclick = e => {
            this._listeners['splittrk']?.(this._feature, this._data.coord);
            this.resetDisplay();  // just refresh ui
        };

        this._pt_join_trk.onclick = e => {
            const trk_suckedup = this._listeners['jointrk']?.(this._feature, this._data.coord); // the trk is removed after the join
            trk_suckedup? this.hide(): this.resetDisplay();
        }
    }

    private initSymboard(){
        if(this._pt_symboard.childElementCount) // already initialized
            return;
        this._pt_symboard.innerHTML = templates.symboard(symbol_inv);

        // show the board and pick
        setSubBoardEvents(
            this.getElement(),
            this._pt_sym,
            this._pt_symboard,
            this._pt_symboard.querySelectorAll<HTMLElement>('.pt-symboard-item'), (item) => {
                const sym = item.getAttribute("title");
                if (this._data.sym != sym){
                    this._data.sym = sym;
                    this._data_sym_changed();
                }
            });

        // filter
        this._pt_symboard_filter = this._pt_symboard.querySelector<HTMLInputElement>('#pt-symboard-filter');
        let filter_orig;
        this._pt_symboard_filter.onkeydown= e => { filter_orig = this._pt_symboard_filter.value; }
        this._pt_symboard_filter.onkeyup = e => {
            if (filter_orig == this._pt_symboard_filter.value)
                return;
            const val = this._pt_symboard_filter.value.toLowerCase();
            this._pt_symboard.querySelectorAll<HTMLElement>('.pt-symboard-item').forEach(el => {
                const name = el.getAttribute('title').toLowerCase();
                el.style.visibility = name.includes(val) ? "unset" : "hidden";
            });
        };
    }

    private resetSymboardFilter(){
        if(!this._pt_symboard_filter)
            return;
        this._pt_symboard_filter.value = '';
        this._pt_symboard.querySelectorAll<HTMLElement>('.pt-symboard-item').forEach(el => {
            el.style.visibility = "unset";
        });
    }

    private _data_trk_name_changed(){
        this._feature.set('name', this._data.trk.name);
    }

    private _data_trk_color_changed(){
        this._feature.set('color', this._data.trk.color);
        this.setContent(this._data);
    }

    private _data_sym_changed(){
        this._feature.set('sym', this._data.sym);
        this.setContent(this._data);
    }

    private _data_name_changed(){
        this._feature.set('name', this._data.name);
        const symbol = matchRules(this._data.name); // auto pick symbol
        if(symbol){
            if(this._data.sym != symbol.name){
                this._data.sym = symbol.name;
                this._data_sym_changed();
            }
        }
    }

    private _data_ele_changed(){
        this._pt_ele_est.classList.add('hidden');
        this._feature.getGeometry().setCoordinates(this._data.coord);
    }

    async popContent(feature) {
        // wpt data
        const name = feature.get('name') || feature.get('desc');     //maybe undefined
        const sym = feature.get('sym');                              //maybe undefined
        const image = feature.get('image');
        let coord = feature.getGeometry().getCoordinates();          //x, y, [ele, [time]]

        // trk data
        const track = this._track_feature_of(feature);                // for trkpt
        const trk = track ? {
            name: track.get('name'),
            color: track.get('color'),
            is_real: track.getGeometry().getLayout() == feature.getGeometry().getLayout(),
            is_end: !!getTrkptIndicesAtEnds(track.getGeometry().getCoordinates(), coord),
        } : undefined;

        if(trk && !trk.is_real) // to get more info from estimation
            coord = track.getGeometry().getClosestPoint(coord);

        // cache for later to use
        this._feature = track? track: feature;  // trk(for rm/split/join) or wpt (for rm)
        this._data = {trk, name, sym, coord};   // for creating/updating

        this.resetDisplay(image);
        await this.setContent(this._data);
        this.setPosition(coord);
    }

    private _track_feature_of(trkpt: Feature<Point>){
        const features = trkpt.get('features');
        return features ? features.find(isTrkFeature) : undefined;
    }

    private async setContent({trk, name, sym, coord})
    {
        this._setContent({
            trk,
            name,
            coordsys: Opt.coordsys,
            coordxy: coord.slice(0, 2),
            time: getLocalTimeByCoords(coord),
            ele: await getEleByCoords(coord),
            symbol: getSymbol(sym),
        });
    }

    private _setContent({trk, name, coordsys, coordxy, time, ele, symbol})
    {
        const show = (el, en) => el.classList.toggle('hidden', !en)
        const is_wpt = !!(name || symbol);

        if(trk){
            this.pt_trk_name = trk.name;
            this.pt_trk_color = trk.color || def_trk_color;
        }

        this.pt_coord = coordxy;
        this.pt_coord_title = coordsys;
        this.pt_coord_value = toXY[coordsys](coordxy);  //to web xy
        this.pt_gmap = gmapUrl(coordxy);

        this.pt_name = name;
        this.pt_ele = ele? fmtEle(ele.value): '-';
        show(this._pt_ele_est, ele.est);
        this.pt_time = time? fmtTime(time): '-';

        show(this._pt_mk_wpt, !is_wpt);
        show(this._pt_rm_wpt, is_wpt);

        show(this._pt_wpt_header, is_wpt);   // header contains sym & name
        show(this._sym_copyright, is_wpt);
        if(symbol){
            this.pt_sym = symbol.path(128);
            this.setUrlContent(this._sym_maker,    symbol.maker);
            this.setUrlContent(this._sym_provider, symbol.provider);
            this.setUrlContent(this._sym_license,  symbol.license);
        }
    }

    private getTrksegSnText(){
        const trksegs = this._feature.getGeometry().getCoordinates();
        if(trksegs.length <= 1)
            return '';

        if(!this._data.trk.is_real)
            return `-/${trksegs.length}`;

        const indices = getTrkptIndicesByCoord(trksegs, this._data.coord);  // real trkpt coord
        if(!indices){
            console.error("cannot find the trkseg index by the coord");  //should not happen
            return `-/${trksegs.length}`;
        }

        const [idx, _] = indices;
        return `${idx + 1}/${trksegs.length}`;
    }

    private setUrlContent(el: HTMLAnchorElement, link){
        el.href = link.url;
        el.textContent = link.title;
    }

    /*
    private profileFeature(feature){
        const profile = {
            is_wpt: undefined,
            is_trkpt: undefined,
            is_real: undefined,
            is_end: undefined,
            trkseg_idx: undefined,
            trkseg_num: undefined,
        };

        const track = this._track_feature_of(feature);
        profile.is_trkpt = !!track;
        profile.is_wpt = !track;
        if(track){
            const trksegs = track.getGeometry().getCoordinates();
            const coord = feature.getGeometry().getCoordinates();
            const indices = getTrkptIndicesByCoord(trksegs, coord);

            profile.trkseg_num = trksegs.length;
            profile.is_real = !!indices;
            if(indices){
                const [i, j] = indices;
                profile.is_end = (j == 0 || j == trksegs[i].length - 1);
                profile.trkseg_idx = i;
            }
            else if(trksegs.length == 1){
                profile.is_end = false;
                profile.trkseg_idx = 0;
            }
            else{
                profile.is_end = false;
                // get closest point from each line strings, then get the most closeset
                // really, the information really matters?
                ///const linestrs = track.getGeometry().getLineString();
            }
        }
        return profile;
    }
    */
}