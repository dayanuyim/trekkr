'use strict';
import 'long-press-event';
import sortable from 'html5sortable/dist/html5sortable.es.js'
import { tablink, keyEnterToBlur } from './lib/dom-utils';
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


    // Observer a key change
    private static _observers = {};

    // Notify when a key is changed to value
    private static notifyObservers(key, value){
       this._observers[key]?.forEach(observer => observer(value));
    }

    // Add a observer for a key
    private static addObserver(key, observer){
        if(!this._observers[key]?.push(observer))  // if push is called, it will return the array length, which should >= 1
            this._observers[key] = [observer];
    }

    _base: HTMLElement;
    _desc: HTMLElement;
    _checked: HTMLInputElement;
    _opacity: HTMLInputElement;
    _seefilter: HTMLDivElement;
    _seeable: HTMLElement;
    _spy: HTMLElement;
    //_filter_btn: HTMLButtonElement;

    private _listeners = {};

    get legend(){ return this._base.parentElement.classList.contains('layer-legend');}
    get id(){ return this._base.dataset.layerId;}
    get url(){ return this._base.dataset.layerUrl;}
    get type(){ return this._base.dataset.layerType;}
    get desc(){ return this._desc.textContent.trim();}
    get opacity(){ return limit(Number(this._opacity.value)/100, 0, 1);}
    get checked(){ return this._checked.checked;}
    get isspy(){ return this._spy.classList.contains('enabled');}
    set isspy(v){ this._spy.classList.toggle('enabled', v)};
    get seeable(){ return this._seeable.classList.contains('filtered')? 'filtered':
                          this._seeable.classList.contains('enabled');}
    get seefilter(){
        if(!this._seefilter) return undefined;

        const data = {};
        this._seefilter.querySelectorAll<HTMLElement>('.tabcontent').forEach(tab => {
            const kind = tab.classList.contains('filter-wpt')? 'wpt':
                         tab.classList.contains('filter-trk')? 'trk':
                         undefined;
            if(!kind)
                return console.error(`Unknown filter kind for tab '${tab.className}'`);

            data[kind] = {};

            // Select all filter rows within this tab
            const rows = tab.querySelectorAll<HTMLElement>('.filter-row');

            rows.forEach(row => {
                // Get the attr (name, desc, sym) - cleaning up potential syntax artifacts from the HTML
                const attr = row.dataset.attr;
                const en = row.querySelector<HTMLInputElement>('.filter-row-en');
                const text = row.querySelector<HTMLInputElement>('.filter-row-text');
                const regex = row.querySelector<HTMLButtonElement>('.filter-row-regex');

                // Build the entry for this specific filter attr
                data[kind][attr] = {
                    enabled: en.checked,
                    type: regex.classList.contains('active') ? "regex" : "contains",
                    text: text.value.trim().toLowerCase(),  // saving lower, for caseignore
                };
            });
        });

        return data;
    }

    constructor(el: HTMLElement){
        this._base =       el;
        this._desc =       el.querySelector<HTMLElement>('.ly-opt-desc');
        this._checked =    el.querySelector<HTMLInputElement>('.ly-opt-checked');
        this._opacity =    el.querySelector<HTMLInputElement>('.ly-opt-opacity');
        this._seefilter =  el.querySelector<HTMLDivElement>('.filter-panel');
        this._seeable =    el.querySelector<HTMLElement>('.ly-opt-seeable');
        this._spy =        el.querySelector<HTMLElement>('.ly-attr-spy')

        this.init();
    }

    private init(){
//        this._base.querySelectorAll<HTMLElement>('.ly-ctrl.ly-opt').forEach((el) => {
//            const prefix = "ly-opt-";
//            const name = el.classList.value.split(' ').find(c => c.startsWith(prefix))?.substring(prefix.length);
//
//            const event = (el instanceof HTMLInputElement) ?  // ctrl type
//                'change' : 'click';
//            el.addEventListener(event, e => this._updateOption(el, name));
//        });

        this._checked.addEventListener('change', e => this._updateOption(this._checked, 'checked'));
        this._opacity.addEventListener('change', e => this._updateOption(this._opacity, 'opacity'));

        this._seeable.addEventListener('click', e => {
            // disable if seefilter panel is popup.
            if(this._seefilter?.hidden === false)   // _seefilter may undefined 
                return;
            // to restore to the normal state anyway if clicked.
            this._seeable.classList.remove('filtered');
            // toggle seeable and update
            this._updateOption(this._seeable, 'seeable');
        });

        this.initFilterPanel();

        // init spy observer to sync between layers, since only one layer can be spy at the same time
        Layer.addObserver('isspy', (id) => this.isspy = (this.id == id) );
        this._spy.onclick = e => {
            Layer.notifyObservers('isspy', this.id);
            if(Opt.update('spy.id', this.id)) // update opt
                this._listeners['spy']?.(this.id);
        };
    }

    /*
    private _initOption(el, name){
        const event = (el instanceof HTMLInputElement)?  // ctrl type
            'change' : 'click';
        el.addEventListener(event, e => this._updateOption(el, name));
    }
    */

    private _updateOption(el, name){
        // toggle button class if not input
        if(!(el instanceof HTMLInputElement))
            el.classList.toggle('enabled');

        const value = this[name];                     // get input value from the accessor
        if(Opt.updateLayer(this.id, name, value))     // update cookie
            this._listeners[name]?.(this.id, value);  // notify change
    }

    private initFilterPanel() {
        if (!this._seefilter)
            return;

        //init filter-panel
        tablink('.filter-panel .tablink', 0, this._base);
        this.initFilterRows();

        //long press to show
        this._seeable.dataset.longPressDelay = '750';
        this._seeable.addEventListener('long-press', e => {
            this._seefilter.hidden = false;
        });

        // unfocus to hide filter panel
        window.addEventListener('click', e => {
            if (this._seefilter.hidden)
                return;
            if (this._seeable.contains(e.target as Node) ||
                this._seefilter.contains(e.target as Node))
                return;

            this._seefilter.hidden = true;

            // finish the filter setting ------------

            // udpate ui
            this._seeable.classList.add('filtered');
            this._seeable.classList.add('enabled');

            //data collected from ui
            const seeable = this.seeable;
            const seefilter = this.seefilter;

            // udpate conf
            const c1 = Opt.updateLayer(this.id, 'seeable', seeable);
            const c2 = Opt.updateLayer(this.id, 'seefilter', seefilter);

            // notify if changed
            if (c1 || c2) this._listeners['seefilter']?.(this.id, seeable, seefilter);
        });
    }

    private initFilterRows(){
        const conf = Opt.getLayer(this.id)?.seefilter;

        this._base.querySelectorAll<HTMLElement>('.tabcontent .filter-row').forEach(row => {
            const kind = row.closest('.tabcontent').classList.contains('filter-wpt')? 'wpt': 'trk';
            const attr = row.dataset.attr; //name, desc, sym
            const _en    = row.querySelector<HTMLInputElement>('.filter-row-en');
            const _text  = row.querySelector<HTMLInputElement>('.filter-row-text');
            const _regex = row.querySelector<HTMLButtonElement>('.filter-row-regex');

            //init data
            _en.checked = conf?.[kind]?.[attr]?.enabled;
            _text.value = conf?.[kind]?.[attr]?.text?? '';
            _regex.classList.toggle('active', conf?.[kind]?.[attr]?.type == "regex");

            //set event handers
            keyEnterToBlur(_text);
            _regex.onclick = e => _regex.classList.toggle('active');
        });
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
        el.innerHTML = templates.settings(Opt);
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
        tablink('.settings-main>.tab>.tablink', 0, this._base);  //init settings-main tab

        this._toggle_btn.onclick = () => this._base.classList.toggle('collapsed');
        this._toggle_btn.title = Opt.data.tooltip.btn_settings;

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
                const ids = this._layers.map(el => el.dataset.layerId);  // Not use the order of `this.layers`, recapture the order
                Opt.updateLayersOrder(ids);  
                this._listeners['layers_reorder']?.(ids);
            });
        });

        //layer events
        this.layers.forEach(layer =>
            layer.setListener('spy',       (id)                     => this._listeners['spy']?.(id))
                 .setListener('checked',   (id, checked)            => this._listeners['layer_checked']?.(id, checked))
                 .setListener('opacity',   (id, opacity)            => this._listeners['layer_opacity']?.(id, opacity))
                 .setListener('seefilter', (id, seeable, seefilter) => this._listeners['layer_seefilter']?.(id, seeable, seefilter))
                 .setListener('seeable',   (id, seeable)            => this._listeners['layer_seeable']?.(id, seeable))
        );
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
