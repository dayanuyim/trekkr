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
    get _desc()      { return this._base.querySelector<HTMLSpanElement>('.ly-opt-desc');}
    get _checked()   { return this._base.querySelector<HTMLInputElement>('.ly-opt-checked');}
    get _opacity()   { return this._base.querySelector<HTMLInputElement>('.ly-opt-opacity');}
    get _filterable(){ return this._base.querySelector<HTMLElement>('.ly-opt-filterable');}
    get _invisible() { return this._base.querySelector<HTMLElement>('.ly-opt-invisible');}
    get _spy()       { return this._base.querySelector<HTMLElement>('.ly-attr-spy');}
    get _body()      { return this._base.querySelector<HTMLElement>('.ly-body');}

    get legend(){ return this._base.parentElement.classList.contains('layer-legend');}
    get id(){ return this._base.dataset.layerId;}
    get url(){ return this._base.dataset.layerUrl;}
    get type(){ return this._base.dataset.layerType;}
    get desc(){ return this._desc.textContent.trim();}

    get is_spy(){ return this._spy.classList.contains('enabled');}
    set is_spy(v){ this._spy.classList.toggle('enabled', v)};
    get opacity(){ return limit(Number(this._opacity.value)/100, 0, 1);}
    get checked(){ return this._checked.checked;}
    get filterable(){ return this._filterable.classList.contains('enabled');}
    get invisible(){ return this._invisible.classList.contains('enabled');}

    private _listeners = {};

    constructor(el: HTMLElement){
        this._base = el;
        this.init();
    }

    private init(){
        this._spy.onclick = e => {
            if(Opt.update('spy.id', this.id)) // update opt
                this._listeners['spy']?.(this.id);
        };

        //this._initOption(this._checked, 'checked');
        //this._initOption(this._opacity, 'opacity');
        //this._initOption(this._filterable, 'filterable');
        //this._initOption(this._invisible, 'invisible');
        this._base.querySelectorAll<HTMLElement>('.ly-ctrl.ly-opt').forEach((el) => {
            const prefix = "ly-opt-";
            const name = el.classList.value.split(' ').find(c => c.startsWith(prefix))?.substring(prefix.length);
            this._initOption(el, name);
        });
    }

    private _initOption(el, name){
        const is_input = (el instanceof HTMLInputElement);  // ctrl type
        const event = is_input? 'change': 'click';
        
        el.addEventListener(event, e => {
            const value = is_input?
                this[name]:   // get input value from the accesor
                el.classList.toggle('enabled');
            if(Opt.updateLayer(this.id, name, value))
                this._listeners[name]?.(this.id, value);
        })
    }


    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    /*
    // Depricated: since updating to Opt.layers synchronously, just using Opt.layers is ok
    obj() {
        return {
            id: this.id,
            url: this.url,
            type: this.type,
            desc: this.desc,
            legend: this.legend,
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

    //because the order of layers may change on the fly, get them by the accesor
    get _layers(){ return Array.from<HTMLElement>(this._base.querySelectorAll('#setting-layers li')); }

    _listeners = {};;
    layers: Array<Layer>;

    constructor(el: HTMLElement){
        el.innerHTML = templates.settings({ layers: Opt.layers });
        this.initElements(el);
        this.initLayers();
        this.initOpts();
    }

    private initElements(el: HTMLElement){
        this._base = el;
        this._toggle_btn = this._base.querySelector<HTMLButtonElement>('button.btn-toggle');

        this.layers = this._layers.map(Layer.of);   // !! becareful, the order of the array may diff from the actual order in the HML

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
                const ids = this._layers.map(el => Layer.of(el).id);  // Not use the order of this.layers
                Opt.updateLayersOrder(ids);  
                this._listeners['layers_reorder']?.(ids);
            });
        });

        // spy is like a push button from a interlocking switch
        const set_spy_enabled = (id) => {
            this.layers.forEach((layer) => layer.is_spy = (layer.id == id));
        }

        set_spy_enabled(Opt.spy.id);
        //layer events
        this.layers.forEach(layer => {
            layer.setListener('spy', (id) => {
                set_spy_enabled(id);
                this._listeners['spy']?.(id);
            })
            .setListener('checked',    (id, checked)    => this._listeners['layer_checked']?.(id, checked))
            .setListener('opacity',    (id, opacity)    => this._listeners['layer_opacity']?.(id, opacity))
            .setListener('filterable', (id, filterable) => this._listeners['layer_filterable']?.(id, filterable))
            .setListener('invisible',  (id, invisible)  => this._listeners['layer_invisible']?.(id, invisible));
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