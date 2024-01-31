'use strict';
import sortable from 'html5sortable/dist/html5sortable.es.js'
import {tablink} from './lib/dom-utils';
import * as templates from './templates';
import Opt from './opt';

function limit(n, low, up){
    return Math.max(low, Math.min(n, up));
}

class Layer {
    static of(el: HTMLElement){
        return new Layer(el);
    }
    static listenify = (fn) => { return (e) => fn(Layer.of(e.target.closest('li')), e.currentTarget, e); }

    _base: HTMLElement;
    get _checkbox()  { return this._base.querySelector<HTMLInputElement>('.ly-checked');}
    get _desc()      { return this._base.querySelector<HTMLSpanElement>('.ly-desc');}
    get _opacity()   { return this._base.querySelector<HTMLInputElement>('.ly-opacity');}
    get _opt_spy()   { return this._base.querySelector<HTMLElement>('.ly-opt-spy');}
    get _opt_filter(){ return this._base.querySelector<HTMLElement>('.ly-opt-filter');}
    get _body()      { return this._base.querySelector<HTMLElement>('.ly-body');}

    get legend()     { return this._base.parentElement.classList.contains('layer-legend');}
    get id(){ return this._base.dataset.layerId;}
    get type(){ return this._base.dataset.layerType;}
    get url(){ return this._base.dataset.layerUrl;}
    get desc(){ return this._desc.textContent.trim();}
    get opacity(){ return limit(Number(this._opacity.value)/100, 0, 1);}
    get checked(){ return this._checkbox.checked;}
    get is_spy(){ return this._opt_spy.classList.contains('active');}
    set is_spy(value){ this._opt_spy.classList.toggle('active', value)};

    //events
    set onspy(listener){
        this._opt_spy.onclick = e => {
            if(Opt.update('spy.layer', this.id)) // update opt
                if(listener) listener(this.id);
        };
    }

    set oncheck(listener){
        this._checkbox.onchange = e => {
            const checked = this.checked;
            if(Opt.updateLayer(this.id, 'checked', checked))  // update opt
                if(listener) listener(this.id, checked);
        };
    }

    set onopacity(listener){
        this._opacity.onchange = e => {
            const opacity = this.opacity;
            if(Opt.updateLayer(this.id, 'opacity', opacity)) // update opt
                if(listener) listener(this.id, opacity);
        };
    }

    set onfilter(listener){
            this._opt_filter.onclick = e => {
                const active = this._opt_filter.classList.toggle('active');
                if (Opt.updateLayer(this.id, 'filterable', active)) // update opt
                    if(listener) listener(this.id, active);
            };
        }

    //The class is used on-the-fly, only set base element only in the ctor
    constructor(el: HTMLElement){
        this._base = el;
    }
        
    /*
    // Depricated: since updating to Opt.layers synchronously, just using Opt.layers is ok
    obj() {
        return {
            id: this.id,
            desc: this.desc,
            legend: this.legend,
            type: this.type,
            url: this.url,
            checked: this.checked,
            opacity: this.opacity,
        };
    }
    */
}

export class Settings{
    static of(el: HTMLElement){
        return new Settings(el);
    }
    //static listenify = (fn) => { return (e) => fn(Settings.of(e.target.closest('.settings')), e.currentTarget, e); }

    _base: HTMLElement;
    _toggle_btn: HTMLButtonElement;
    _opt_wpt_fontsize: HTMLInputElement;
    _opt_wpt_displays: HTMLInputElement[];
    _opt_wpt_display_auto_zoom: HTMLButtonElement;
    _opt_trk_arrow_max_num: HTMLInputElement;
    _opt_trk_arrow_interval: HTMLInputElement;
    _opt_trk_arrow_radius: HTMLInputElement;
    _listeners = {};;

    get layers(){ return Array.from(this._base.querySelectorAll('#setting-layers li')).map(Layer.of); }

    constructor(el: HTMLElement){
        el.innerHTML = templates.settings({ layers: Opt.layers });
        this.initElements(el);
        this.initLayers();
        this.initOpts();
    }

    private initElements(el: HTMLElement){
        this._base = el;
        this._toggle_btn = this._base.querySelector<HTMLButtonElement>('button.btn-toggle');

        const opts = this._base.querySelector('#setting-opts');
        this._opt_wpt_fontsize = opts.querySelector<HTMLInputElement>('#wpt-fontsize');
        this._opt_wpt_displays = Array.from(opts.querySelectorAll<HTMLInputElement>('input[name="wpt-display"]'));
        this._opt_wpt_display_auto_zoom = opts.querySelector<HTMLButtonElement>('#wpt-display-auto-zoom');
        this._opt_trk_arrow_max_num = opts.querySelector<HTMLInputElement>('#trk-arrow-max-num');
        this._opt_trk_arrow_interval = opts.querySelector<HTMLInputElement>('#trk-arrow-interval');
        this._opt_trk_arrow_radius = opts.querySelector<HTMLInputElement>('#trk-arrow-radius');
    }

    // ----------------------------------------------------------------

    private initLayers(){
        tablink('.settings-main .tablink', '.settings-main .tabcontent');

        this._toggle_btn.onclick = () => this._base.classList.toggle('collapsed');
        this._toggle_btn.title = Opt.tooltip.btn_settings;

        //set layers sortable
        ['.layer-legend', '.layer-base'].forEach(selector =>{
            sortable(selector, {
                forcePalceholderSize: true,
                placeholderClass: 'ly-placeholder',
                //placeholder: templates.layer(),
                placeholder: '<li></li>',
                hoverClass: 'ly-hover',
            });
            sortable(selector)[0].addEventListener('sortupdate', () => {
                Opt.updateLayersOrder(this.layers.map(ly => ly.id));
                this._listeners['layerschanged']?.(Opt.layers);
            });
        });

        //layer events
        this.layers.forEach(layer => {
            layer.is_spy = (layer.id == Opt.spy.layer);  //init
            layer.onspy = (id) => {
                this.layers.forEach(layer => layer.is_spy = (layer.id == id));   // here we re-create 'layers', this is not necessary. but beware that layers vary in their order.
                this._listeners['spychanged']?.(Opt.spy);
            }
            layer.oncheck = (id) => this._listeners['layerschanged']?.(Opt.layers);
            layer.onopacity = (id, opacity) => this._listeners['opacitychanged']?.(id, opacity);
            layer.onfilter = (id, filterable) => this._listeners['filterchanged']?.(id, filterable);
        });
    }

    // ----------------------------------------------------------------


    private initOpts(){
        const empty_check = (el, orig_val) =>{
            if(!el.value){
                el.value = orig_val.toString();
                return false;
            }
            return true;;
        };
        const pos_int_check = el => {
            const value = Math.max(1, Math.round(el.value));
            el.value = value.toString();
            return value;
        }

        const nonneg_int_check = el => {
            const value = Math.max(0, Math.round(el.value));
            el.value = value.toString();;
            return value;
        }

        // wpt fontsize
        this._opt_wpt_fontsize.value = Opt.waypoint.fontsize;
        this._opt_wpt_fontsize.onchange = e => {
            if(!empty_check(e.target, Opt.waypoint.fontsize))
                return;
            const fontsize = pos_int_check(e.target);
            Opt.update( 'waypoint.fontsize', fontsize);  // coockie
            this._listeners['wptchanged']?.();   // map
        };

        // wpt display
        this._opt_wpt_displays.forEach(disp => {
            disp.checked = (disp.value == Opt.waypoint.display);
            disp.onchange = () => {   //checked
                this._opt_wpt_display_auto_zoom.disabled = disp.value != 'auto';
                Opt.update('waypoint.display', disp.value);            // coockie
                this._listeners['wptchanged']?.();                        // map
            }
        });

        this._opt_wpt_display_auto_zoom.disabled = !this._opt_wpt_displays.find(disp => disp.value == 'auto').checked;
        this._opt_wpt_display_auto_zoom.onclick = e => {
                Opt.update('waypoint.display_auto_zoom', Opt.zoom);    // coockie
                this._listeners['wptchanged']?.();                        // map
        };

        // trk arrow
        this._opt_trk_arrow_max_num.value  = Opt.track.arrow.max_num;
        this._opt_trk_arrow_max_num.onchange = e => {
            if(!empty_check(e.target, Opt.track.arrow.max_num))
                return;
            const max_num = nonneg_int_check(e.target);

            this._opt_trk_arrow_interval.disabled = !max_num;
            this._opt_trk_arrow_radius.disabled = !max_num;

            Opt.update('track.arrow.max_num', max_num);
            this._listeners['trkchanged']?.();   // map
        };

        this._opt_trk_arrow_interval.value = Opt.track.arrow.interval;
        this._opt_trk_arrow_interval.onchange = e => {
            if(!empty_check(e.target, Opt.track.arrow.interval))
                return;
            const interval = pos_int_check(e.target);
            Opt.update('track.arrow.interval', interval);
            this._listeners['trkchanged']?.();   // map
        };

        this._opt_trk_arrow_radius.value = Opt.track.arrow.radius;
        this._opt_trk_arrow_radius.onchange = e => {
            if(!empty_check(e.target, Opt.track.arrow.radius))
                return;
            const radius = pos_int_check(e.target);
            Opt.update('track.arrow.radius', radius);
            this._listeners['trkchanged']?.();   // map
        };
    }

    // ----------------------------------------------------------------

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggle(){
        this._toggle_btn.click();
        return this;
    }
}