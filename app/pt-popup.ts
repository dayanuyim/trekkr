'use strict';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import Overlay from 'ol/Overlay';
import {toStringXY} from 'ol/coordinate';
import {toLonLat} from 'ol/proj';
import {toTWD97, toTWD67, toTaipowerCoord} from './coord';

//import * as moment from 'moment-timezone';
import { getSymbol, matchRules, symbol_inv } from './sym'
import { getEleByCoord, getEleOfCoord, setEleOfCoord, getLocalTimeByCoord, gmapUrl, colorCode } from './common'
import { olWptFeature, def_trk_color, getTrkptIndices, isTrkFeature, isWptFeature} from './ol/gpx-common';
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

function displayElem(el: HTMLElement, en){
    el.classList.toggle('hidden', !en)
}

function readonlyElem(el: HTMLElement, readonly)
{
    if(el instanceof HTMLSpanElement)
        el.contentEditable = readonly? 'false': 'true';
    else
        el.style.pointerEvents = readonly? 'none': '';
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

export class PtPopupOverlay extends Overlay{
    _closer: HTMLElement;
    _resizer: HTMLElement;
    _resizer_content: HTMLElement;
    _image: HTMLElement;
    _trk: HTMLElement;
    _trk_tool: HTMLElement;
    _trk_name: HTMLElement;
    _trk_desc: HTMLElement;
    _trk_seg_sn: HTMLElement;
    _trk_color: HTMLElement;
    _colorboard: HTMLElement;
    _pt_header: HTMLElement;
    _pt_sym: HTMLImageElement;
    _symboard: HTMLElement;
    _symboard_filter: HTMLInputElement;
    _symboard_items: Array<HTMLElement>;
    _pt_name: HTMLElement;
    _pt_desc: HTMLElement;
    _pt_coord: HTMLElement;
    _pt_coord_title: HTMLSelectElement;
    _pt_coord_value: HTMLElement;
    _pt_gmap: HTMLAnchorElement;
    _pt_ele: HTMLElement;
    _pt_ele_est: HTMLElement;
    _pt_time: HTMLElement;
    _tool_split_trk: HTMLButtonElement;
    _tool_join_trk: HTMLButtonElement;
    _tool_rm_trk: HTMLButtonElement;
    _tool_mk_wpt: HTMLButtonElement;
    _tool_rm_wpt: HTMLButtonElement;
    _sym_copyright: HTMLElement;
    _sym_maker: HTMLAnchorElement;
    _sym_provider: HTMLAnchorElement;
    _sym_license: HTMLAnchorElement;

    _feature;
    _data;
    _resize_observer;
    _listeners = {};

    get pt_trk_name() { return this._trk_name.textContent; }
    set pt_trk_name(value) { this._trk_name.textContent = value; }
    get pt_trk_desc() { return this._trk_desc.textContent.trim(); }
    set pt_trk_desc(value) { this._trk_desc.textContent = value?.trim(); }
    get pt_trk_seg_sn() { return this._trk_seg_sn.textContent; }
    set pt_trk_seg_sn(value) { this._trk_seg_sn.textContent = value; }
    get pt_trk_color() { return this._trk_color.style.backgroundColor; }
    set pt_trk_color(value) { this._trk_color.style.backgroundColor = value; }
    get pt_sym() { return this._pt_sym.src; }
    set pt_sym(src) { this._pt_sym.src = src;}
    get pt_name() { return this._pt_name.textContent; }
    set pt_name(value) { this._pt_name.textContent = value; }
    get pt_desc() { return this._pt_desc.textContent.trim(); }
    set pt_desc(value) { this._pt_desc.textContent = value?.trim(); }
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
        this._closer =          el.querySelector<HTMLElement>('.pop-closer');
        this._resizer =         el.querySelector<HTMLElement>('.pop-resizer');
        this._resizer_content = this._resizer.querySelector<HTMLElement>('.pop-resizer-content');
        this._image =           el.querySelector<HTMLElement>('.pop-image');
        this._colorboard =      el.querySelector<HTMLElement>('.pop-colorboard');
        this._symboard =        el.querySelector<HTMLElement>('.pop-symboard');
        this._tool_split_trk =  el.querySelector<HTMLButtonElement>('.pop-tool-split-trk');
        this._tool_join_trk =   el.querySelector<HTMLButtonElement>('.pop-tool-join-trk');
        this._tool_rm_trk =     el.querySelector<HTMLButtonElement>('.pop-tool-rm-trk');
        this._tool_mk_wpt =     el.querySelector<HTMLButtonElement>('.pop-tool-mk-wpt');
        this._tool_rm_wpt =     el.querySelector<HTMLButtonElement>('.pop-tool-rm-wpt');
        this._trk =             el.querySelector<HTMLElement>('.pop-trk');
        this._trk_tool =        el.querySelector<HTMLElement>('.pop-trk-tool');
        this._trk_name =        el.querySelector<HTMLElement>('.pop-trk-name');
        this._trk_desc =        el.querySelector<HTMLElement>('.pop-trk-desc');
        this._trk_seg_sn =      el.querySelector<HTMLElement>('.pop-trk-seg-sn');
        this._trk_color =       el.querySelector<HTMLElement>('.pop-trk-color');
        this._pt_header =       el.querySelector<HTMLElement>('.pop-pt-header');
        this._pt_sym =          el.querySelector<HTMLImageElement>('.pop-pt-sym');
        //this._symboard_filter = ... //DONT DO THIS since symboard is lazy initailized
        this._pt_name =         el.querySelector<HTMLElement>('.pop-pt-name');
        this._pt_desc =         el.querySelector<HTMLElement>('.pop-pt-desc');
        this._pt_coord =        el.querySelector<HTMLElement>('.pop-pt-coord');
        this._pt_coord_title =  this._pt_coord.querySelector<HTMLSelectElement>('.pop-pt-coord-title');
        this._pt_coord_value =  this._pt_coord.querySelector<HTMLElement>('.pop-pt-coord-value');
        this._pt_gmap =         el.querySelector<HTMLAnchorElement>('a.pop-pt-gmap');
        this._pt_ele =          el.querySelector<HTMLElement>('.pop-pt-ele-value');
        this._pt_ele_est =      el.querySelector<HTMLElement>('.pop-pt-ele-est');
        this._pt_time =         el.querySelector<HTMLElement>('.pop-pt-time-value');
        this._sym_copyright =   el.querySelector<HTMLElement>('.sym-copyright');
        this._sym_maker =       this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-maker');
        this._sym_provider =    this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-provider');
        this._sym_license =     this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-license');
    }

    public hide(){
        this.setPosition(undefined);
    }

    // reset to initial display status
    private resetDisplay(image){
        //colorboard
        displayElem(this._colorboard, false);   //colorboard hidden, if any

        //symboard
        displayElem(this._symboard, false);     //symboard hidden, if any
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
        this._image.classList.toggle('active', !!image);
        this._image.style.backgroundImage = url? `url('${url}')`: '';
        this._image.style.width = width? `${width}px`: '';
        this._image.style.height = height? `${height}px`: '';
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
        }).observe(this._symboard);

        //lazy init symboard
        this._pt_sym.addEventListener('mousedown', () => {
            console.log('init symboard');
            this.initSymboard();
        }, {once: true});

        // colorboard
        setSubBoardEvents(
            this.getElement(),
            this._trk_color,
            this._colorboard,
            this._colorboard.querySelectorAll<HTMLElement>('.pop-colorboard-item'), (item) => {
                const color = item.getAttribute("title");
                this._updateData('trk.color', color);
            });

        // change trk name
        this._trk_name.onkeydown = enter_to_blur_listener;
        this._trk_name.onblur = e => {
            const name = this.pt_trk_name.trim();
            if(!name)
                return this.pt_trk_name = this._data.trk.name;
            this._updateData('trk.name', this.pt_trk_name, false);
        }

        // change trk desc
        this._trk_desc.onkeydown = enter_to_blur_listener;
        this._trk_desc.onblur = e => {
            const desc = this.pt_trk_desc.trim();
            this._updateData('pt.desc', desc, false);
        }

        // change pt name
        this._pt_name.onkeydown = enter_to_blur_listener;
        this._pt_name.onblur = e => {
            const name = this.pt_name.trim();
            if(!name)
                return this.pt_name = this._data.pt.name;
            if(!this._updateData('pt.name', name, false))
                return;
            const symbol = matchRules(name); // auto pick symbol
            if(symbol)
                this._updateData('pt.sym', symbol.name);
        };

        // change desc
        this._pt_desc.onkeydown = enter_to_blur_listener;
        this._pt_desc.onblur = e => {
            const desc = this.pt_desc.trim();
            this._updateData('pt.desc', desc, false);
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
            if(!this.pt_ele)
                return this.pt_ele = getEleOfCoord(this._data.pt.coord);
            const ele = +this.pt_ele;
            this._updateDataPtEle(ele);
        };

        // change coordsys
        this._pt_coord_title.onchange = e => {
            const el = <HTMLSelectElement>e.currentTarget;
            const coordsys = el.value;
            this.pt_coord_value = toXY[coordsys](this.pt_coord)
            Opt.update('coordsys', coordsys);
        };

        // make wpt from trkpt
        this._tool_mk_wpt.onclick = e => {
            /*
            //sometimes coordiantes changed when getting it from feature again. Why??
            const wpt = this._feature.clone();
            wpt.setProperties({
                name: "WPT",
                sym: "City (Small)",
            });
            */
            const {name, desc, sym, coord} = this._data.pt
            const wpt = olWptFeature(coord, {
                name: name || "WPT",
                desc,
                sym: sym || "City (Small)",
            });
            this.popContent(wpt);
            this._listeners['mkwpt']?.(wpt);
        };

        delayToEnable(this._tool_rm_wpt, 1000, ()=>Opt.rt.shiftdown); // delay to enable button, prevent from click by mistake
        this._tool_rm_wpt.onclick = e => {
            this._listeners['rmwpt']?.(this._feature);
            this.hide();
        };

        delayToEnable(this._tool_rm_trk, 1000, ()=>Opt.rt.shiftdown); // delay to enable button, prevent from click by mistake
        this._tool_rm_trk.onclick = e => {
            this._listeners['rmtrk']?.(this._feature);
            this.hide();
        };

        this._tool_split_trk.onclick = e => {
            this._listeners['splittrk']?.(this._feature, this._data.pt.coord);
            this.setTrackTools(this._feature, this._data);  // just refresh ui
        };

        this._tool_join_trk.onclick = e => {
            const trk_suckedup = this._listeners['jointrk']?.(this._feature, this._data.pt.coord); // the trk is removed after the join
            trk_suckedup? this.hide(): this.setTrackTools(this._feature, this._data);
        }
    }

    private initSymboard(){
        if(this._symboard.childElementCount) // already initialized
            return;

        this._symboard.innerHTML = templates.symboard(symbol_inv);
        this._symboard_filter = this._symboard.querySelector<HTMLInputElement>('.pop-symboard-filter');
        this._symboard_items = Array.from(this._symboard.querySelectorAll<HTMLElement>('.pop-symboard-item'));

        // show the board and pick
        setSubBoardEvents(
            this.getElement(),
            this._pt_sym,
            this._symboard,
            this._symboard_items, (item) => {
                const sym = item.getAttribute("title");
                this._updateData('pt.sym', sym);
            });

        // filter
        let filter_value_orig;
        this._symboard_filter.onkeydown= e => { filter_value_orig = this._symboard_filter.value; }
        this._symboard_filter.onkeyup = e => {
            if (filter_value_orig == this._symboard_filter.value)   // filter out those key that dont alter text, like arrow keys
                return;
            const val = this._symboard_filter.value.toLowerCase();
            this._symboard_items.forEach(item => {
                const name = item.getAttribute('title').toLowerCase();
                item.style.visibility = name.includes(val) ? "" : "hidden";
            });
        };
    }

    private resetSymboardFilter(){
        if(!this._symboard_filter)
            return;
        this._symboard_filter.value = '';
        this._symboard_items.forEach(item => item.style.visibility = "");
    }

    // Update the cached data and feature, and redraw UI if needed
    //   key0: trk|pt
    //   key1: name|color|desc|sym|ele
    //   reutrn true if update otherwise false
    private _updateData(keypath, value, need_reset=true)
    {
        const keys = keypath.split('.');
        const key = keys.pop();
        const obj = keys.reduce((obj, key) => obj[key], this._data);

        const is_changed = (obj[key] !== value);
        if(is_changed){
            obj[key] = value;
            this._feature.set(key, value);       // TODO: we either modify TRK or PT at a time, so not need to check the feature kind... but be careful if need to support for trkpt edit or something like that.
            this._feature.unset('pseudo');       // pseudo -> normal
            if(need_reset) this.setContent(this._data);
        }
        return is_changed;
    }

    private _updateDataPtEle(ele){
        if(getEleOfCoord(this._data.pt.coord) != ele){
            setEleOfCoord(this._data.pt.coord, ele);
            this._feature.getGeometry().setCoordinates(this._data.pt.coord);
            this._pt_ele_est.classList.add('hidden');
        }
    }

    async popContent(feature) {
        //console.log('popContent', feature);

        // @@! Experimental, restore the hidden wpt
        feature = this._wpt_feature_of(feature) || feature;

        // trk data
        const track = this._track_feature_of(feature);                // for trkpt
        const trk = track ? {
            name: track.get('name'),
            desc: track.get('desc'),
            color: track.get('color'),
        } : undefined;

        // pt data
        const pt = {
            name: feature.get('name'),                        //maybe undefined
            desc: feature.get('desc'),                        //maybe undefined
            sym: feature.get('sym'),                          //maybe undefined
            coord: feature.getGeometry().getCoordinates(),    //x, y, [ele, [time]]
            image: feature.get('image'),
            is_virtual: track && track.getGeometry().getLayout() != feature.getGeometry().getLayout(),
        };
        if(pt.is_virtual) // get data from other dimensions of its track, for example: XY -> XYZM
            pt.coord = track.getGeometry().getClosestPoint(pt.coord);

        // cache for later to use
        this._feature = track? track: feature;  // trk(for rm/split/join) or wpt (for rm)
        this._data = {trk, pt};                 // for creating/updating

        this.resetDisplay(pt.image);
        await this.setContent(this._data);
        this.setPosition(pt.coord);
    }

    private _track_feature_of(trkpt: Feature<Point>){
        const features = trkpt.get('features');
        return features ? features.find(isTrkFeature) : undefined;
    }

    private _wpt_feature_of(trkpt: Feature<Point>){
        const features = trkpt.get('features');
        return features ? features.find(isWptFeature) : undefined;
    }

    private async setContent({trk, pt})
    {
        const readonly = this._feature.get('readonly');

        const is_wpt = !trk;
        const coordsys = Opt.coordsys;
        const coordxy = pt.coord.slice(0, 2);
        const time = getLocalTimeByCoord(pt.coord);
        const {ele, is_est} = await getEleByCoord(pt.coord);
        const symbol = getSymbol(pt.sym);

        //trk --------------------------------
        displayElem(this._trk, trk);
        if(trk){
            this.pt_trk_name = trk.name;
            this.pt_trk_desc = trk.desc;
            this.pt_trk_color = colorCode(trk.color || def_trk_color);
            readonlyElem(this._trk_name, readonly)
            readonlyElem(this._trk_desc, readonly)
            readonlyElem(this._trk_color, readonly)
            displayElem(this._trk_desc, trk.desc);   // show only if set. TODO: show the field on demand
            this.setTrackTools(this._feature, {trk, pt})
        }

        //wpt --------------------------------
        displayElem(this._tool_mk_wpt, readonly || !is_wpt);
        displayElem(this._tool_rm_wpt, !readonly && is_wpt);

        //pt --------------------------------
        this.pt_name = pt.name;
        readonlyElem(this._pt_name, readonly);
        readonlyElem(this._pt_sym, readonly);
        displayElem(this._pt_header, is_wpt || pt.sym || pt.name);   // header contains sym & name

        this.pt_desc = pt.desc ;
        readonlyElem(this._pt_desc, readonly);
        displayElem(this._pt_desc, is_wpt || pt.desc);   // not show for trkpt if empty. TODO: show the field on demand

        this.pt_coord = coordxy;
        this.pt_coord_title = coordsys;
        this.pt_coord_value = toXY[coordsys](coordxy);  //to web xy
        this.pt_gmap = gmapUrl(coordxy);

        this.pt_ele = !ele? '-':
                    (readonly || !is_wpt)? fmtEle(ele):   // only formatting if readonly
                    ele;
        readonlyElem(this._pt_ele, (readonly || !is_wpt));
        displayElem(this._pt_ele_est, is_est);

        this.pt_time = time? fmtTime(time): '-';

        displayElem(this._sym_copyright, is_wpt);
        if(symbol){
            this.pt_sym = symbol.path(128);
            this.setUrlContent(this._sym_maker,    symbol.maker);
            this.setUrlContent(this._sym_provider, symbol.provider);
            this.setUrlContent(this._sym_license,  symbol.license, true);
        }
    }

    private setTrackTools(track, {trk, pt}){
        if(track){
            const readonly = track.get('readonly');
            //tool
            displayElem(this._trk_tool, !readonly && !pt.is_virtual);
            if(!readonly && !pt.is_virtual){
                const endidx = getTrkptIndices(track.getGeometry().getCoordinates(), {coord: pt.coord, atends: true } );
                displayElem(this._tool_join_trk,  endidx);
                displayElem(this._tool_split_trk, !endidx);  // TODO: let a virtual pt can to split
            }
            //header
            this.pt_trk_seg_sn = this.getTrksegSnText();
        }
    }

    private getTrksegSnText(){
        const trksegs = this._feature.getGeometry().getCoordinates();
        if(trksegs.length <= 1)
            return '';

        if(this._data.pt.is_virtual)
            return `-/${trksegs.length}`;

        const indices = getTrkptIndices(trksegs, {coord: this._data.pt.coord});  // real trkpt coord
        if(!indices){
            console.error("cannot find the trkseg index by the coord");  //should not happen
            return `-/${trksegs.length}`;
        }

        const [idx, _] = indices;
        return `${idx + 1}/${trksegs.length}`;
    }

    private setUrlContent(el: HTMLAnchorElement, {url, title}, license_icon=false){
        const license_html = title => {
            switch (title) {
                case "Public Domain":              return templates.license_pd();
                case "Creative Commons BY 3.0":    return templates.license_cc_by();
                case "Creative Commons BY-SA 4.0": return templates.license_cc_by_sa();
                default: return undefined;
            }
        }

        el.href = url;
        const html = license_icon? license_html(title): undefined;
        if (html)
            el.innerHTML = html;
        else
            el.textContent = title;
    }

    /*
    private profileFeature(feature){
        const profile = {
            is_wpt: undefined,
            is_trkpt: undefined,
            is_virtual: undefined,
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
            profile.is_virtual = !indices;
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