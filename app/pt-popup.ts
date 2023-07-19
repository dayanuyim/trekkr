'use strict';
import Overlay from 'ol/Overlay';
import {toStringXY} from 'ol/coordinate';
import {toLonLat} from 'ol/proj';
import {toTWD97, toTWD67} from './coord';

import * as moment from 'moment-timezone';
import {toSymPath, getSymbol, getElevationByCoords, getLocalTimeByCoords, gmapUrl} from './common'
import { mkWptFeature } from './layer-gpx';
import Opt from './opt';

const toXY = {
    twd67: (coord) => toStringXY(toTWD67(coord)),
    twd97: (coord) => toStringXY(toTWD97(coord)),
    wgs84: (coord) => toStringXY(toLonLat(coord), 7),
};

function fmtEle(ele){
    return ele.toFixed(1);
}

function fmtTime(moment) {
    return moment.format('YYYY-MM-DD HH:mm:ss');
}

/*
declare class Overlay{
    constructor(options: any);
    getElement(): HTMLElement|undefined;
    getPosition
    
}
*/

//TODO: convert this to typescript
export default class PtPopupOverlay extends Overlay{

    _closer: HTMLElement;
    _content: HTMLElement;
    _pt_sym: HTMLImageElement;
    _pt_name: HTMLElement;
    _pt_coord: HTMLElement;
    _pt_coord_title: HTMLSelectElement;
    _pt_coord_value: HTMLElement;
    _pt_gmap: HTMLAnchorElement;
    _pt_ele: HTMLElement;
    _pt_ele_est: HTMLElement;
    _pt_time: HTMLElement;
    _pt_mk_wpt: HTMLElement;
    _pt_rm_wpt: HTMLElement;
    _sym_copyright: HTMLElement;
    _sym_maker: HTMLAnchorElement;
    _sym_provider: HTMLAnchorElement;
    _sym_license: HTMLAnchorElement;

    _feature;
    _coordinates;
    _listener_mkwpt: CallableFunction;
    _listener_rmwpt: CallableFunction;

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

    set onmkwpt(listener) {this._listener_mkwpt = listener; }
    set onrmwpt(listener) {this._listener_rmwpt = listener; }

    //_coord_title;
    constructor(el: HTMLElement){
        super({
            element: el,
            id: el.getAttribute('id'),
            autoPan: true,
            autoPanAnimation: {
                duration: 250
            }
        });

        this.initProperties();
        this.initEvents();
    }

    private initProperties(){
        const el = this.getElement();
        this._closer =         el.querySelector<HTMLElement>('.ol-popup-closer');
        this._content =        el.querySelector<HTMLElement>('.ol-popup-content');
        this._pt_sym =         el.querySelector<HTMLImageElement>('.pt-sym');
        this._pt_name =        el.querySelector<HTMLElement>('.pt-name');
        this._pt_coord =       el.querySelector<HTMLElement>('.pt-coord');
        this._pt_coord_title = this._pt_coord.querySelector<HTMLSelectElement>('.pt-coord-title');
        this._pt_coord_value = this._pt_coord.querySelector<HTMLElement>('.pt-coord-value');
        this._pt_gmap =        el.querySelector<HTMLAnchorElement>('a.pt-gmap');
        this._pt_ele =         el.querySelector<HTMLElement>('.pt-ele-value');
        this._pt_ele_est =     el.querySelector<HTMLElement>('.pt-ele-est');
        this._pt_time =        el.querySelector<HTMLElement>('.pt-time-value');
        this._pt_mk_wpt =      el.querySelector<HTMLElement>('.pt-tool-mk-wpt');
        this._pt_rm_wpt =      el.querySelector<HTMLElement>('.pt-tool-rm-wpt');
        this._sym_copyright =  el.querySelector<HTMLElement>('.sym-copyright');
        this._sym_maker =      this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-maker');
        this._sym_provider =   this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-provider');
        this._sym_license =    this._sym_copyright.querySelector<HTMLAnchorElement>('.sym-license');
    }

    private initEvents(){
        //close popup
        this._closer.onclick = e => {
            this.setPosition(undefined);
            (<HTMLElement>e.currentTarget).blur();
            return false;
        };

        // view control
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
            const wpt = mkWptFeature(this._coordinates, {sym: "City (Small)"});
            this.popContent(wpt);
            if(this._listener_mkwpt)
                this._listener_mkwpt(wpt);
        };

        this._pt_rm_wpt.onclick = e => {
            if(this._listener_rmwpt)
                this._listener_rmwpt(this._feature);
        }
    }

    async popContent(feature) {
        // get data
        const name = feature.get('name') || feature.get('desc');   //may undefined
        const sym = feature.get('sym');              //may undefined
        const coordinates = feature.getGeometry().getCoordinates();

        // saving for later to use
        this._feature = feature;
        this._coordinates = coordinates;

        this.setContent({
            name,
            coordsys: Opt.coordsys,
            coordinate: coordinates.slice(0, 2),
            time: getLocalTimeByCoords(coordinates),
            ele: await getElevationByCoords(coordinates),
            symbol: getSymbol(sym),
        });

        //position
        this.setPosition(coordinates);
    }

    private setContent({name, coordsys, coordinate, time, ele, symbol})
    {
        this.pt_coord = coordinate;
        this.pt_coord_title = coordsys;
        this.pt_coord_value = toXY[coordsys](coordinate)
        this.pt_gmap = gmapUrl(coordinate);

        this.pt_name = name;
        this.pt_ele = ele? fmtEle(ele.value): '-';
        this._pt_ele_est.classList.toggle('hidden', !ele.est)
        this.pt_time = time? fmtTime(time): '-';

        this._pt_mk_wpt.classList.toggle('hidden', !!name);
        this._pt_rm_wpt.classList.toggle('hidden', !name);

        this._pt_sym.classList.toggle('hidden', !symbol);
        this._sym_copyright.classList.toggle('hidden', !symbol);
        if(symbol){
            this.pt_sym = toSymPath(symbol, 128);
            this.setUrlContent(this._sym_maker,    symbol.maker);
            this.setUrlContent(this._sym_provider, symbol.provider);
            this.setUrlContent(this._sym_license,  symbol.license);
        }
    }

    private setUrlContent(el: HTMLAnchorElement, sym){
        el.href = sym.url;
        el.textContent = sym.title;
    }
}