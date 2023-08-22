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
    get _checkbox(){ return this._base.querySelector<HTMLInputElement>('.ly-checked');}
    get _desc(){ return this._base.querySelector<HTMLSpanElement>('.ly-desc');}
    get _opacity(){ return this._base.querySelector<HTMLInputElement>('.ly-opacity');}
    get _spy(){ return this._base.querySelector('.ly-spy');}
    get _body(){ return this._base.querySelector<HTMLElement>('.ly-body');}

    get legend(){ return this._base.parentElement.classList.contains('layer-legend');}
    get id(){ return this._base.getAttribute('data-layer-id');}
    get type(){ return this._base.getAttribute('data-layer-type');}
    get url(){ return this._base.getAttribute('data-layer-url');}
    get desc(){ return this._desc.textContent.trim();}
    get opacity(){ return limit(Number(this._opacity.value)/100, 0, 1);}
    get spy(){ return this._spy.classList.contains('active');}
    set spy(value){ this._spy.classList.toggle('active', value)};

    set oncheck(listener){ this._checkbox.onchange = listener; }//Layer.listenify(cb)};
    set onopacity(listener){ this._opacity.onchange = listener;} //Layer.listenify(cb)};
    set onspy(listener){ this._body.ondblclick = e => { if (!this.spy) listener(e); }; }  // trigger only when changed

    constructor(el: HTMLElement){
        this._base = el;
    }

    obj() {
        return {
            id: this.id,
            legend: this.legend,
            type: this.type,
            url: this.url,
            desc: this.desc,
            checked: this._checkbox.checked,
            opacity: this.opacity,
        };
    }
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
    _listeners = {};;

    get layers(){ return Array.from(this._base.querySelectorAll('#layer-grp li')).map(Layer.of); }
    get opt_wpt_fontsize() { return Number(this._opt_wpt_fontsize.value); }
    set opt_wpt_fontsize(size) { this._opt_wpt_fontsize.value = size.toString(); }

    constructor(el: HTMLElement){
        el.innerHTML = templates.settings({ layers: Opt.layers });
        this.initElements(el);
        this.initLayers();
        this.initOptions();
    }

    private initElements(el: HTMLElement){
        this._base = el;
        this._toggle_btn = this._base.querySelector<HTMLButtonElement>('button.btn-toggle');

        const options = this._base.querySelector('#options');
        this._opt_wpt_fontsize = options.querySelector<HTMLInputElement>('#wpt-fontsize');
        this._opt_wpt_displays = Array.from(options.querySelectorAll<HTMLInputElement>('input[name="wpt-display"]'));
    }

    // ----------------------------------------------------------------

    private initLayers(){
        tablink('.tablink', '.tabcontent', 0);

        this._toggle_btn.onclick = () => this._base.classList.toggle('collapsed');
        this._toggle_btn.title = Opt.tooltip.btn_settings;

        //set layers sortable
        ['.layer-legend', '.layer-base'].forEach(selector =>{
            sortable(selector, {
                forcePalceholderSize: true,
                placeholderClass: 'ly-placeholder',
                //placeholder: templates.layer(),
                placeholder: '<li></li>',
                /*hoverClass: 'ly-hover',*/
            });
            sortable(selector)[0].addEventListener('sortupdate', () => {
                this.updateLayers();
            });
        });

        //layer events
        this.layers.forEach(layer => {
            layer.oncheck = () => this.updateLayers();
            layer.onopacity = () => this.updateLayerOpacity(layer.id, layer.opacity);
            layer.onspy = () => this.updateSpy(layer.id);
        });
    }

    private updateLayers(update_opt=true)
    {
        const layers = this.layers.map(ly => ly.obj());
        if(update_opt){
            Opt.update({ layers });
        }
        this._listeners['layerschanged']?.(layers);
    }

    private updateLayerOpacity(id, opacity, update_opt=true){
        if(update_opt){
            const layers = this.layers.map(ly => ly.obj());
            Opt.update({ layers });
        }
        this._listeners['opacitychanged']?.(id, opacity);
    }

    private updateSpy(id, update_opt=true){
        this.layers.forEach(layer => layer.spy = (layer.id === id));  //ui
        if(update_opt){
            Opt.update({layer: id}, 'spy');   // option
        }
        this._listeners['spychanged']?.(id);  // map
    }

    // ----------------------------------------------------------------

    private initOptions(){
        // wpt fontsize
        this.opt_wpt_fontsize = Opt.waypoint.fontsize;
        this._opt_wpt_fontsize.onchange = e => {
            const fontsize = this.opt_wpt_fontsize;
            if(!fontsize)
                return this.opt_wpt_fontsize = Opt.waypoint.fontsize; //restore
            Opt.update({fontsize}, 'waypoint');  // coockie
            this._listeners['wptchanged']?.();   // map
        };

        // wpt display
        this._opt_wpt_displays.forEach(disp => {
            disp.checked = (disp.value == Opt.waypoint.display);
            disp.onchange = () => {   //checked
                const conf = {display: disp.value};
                if(disp.value == 'auto')
                    conf['display_auto_zoom'] = Opt.zoom;
                Opt.update(conf, 'waypoint');            // coockie
                this._listeners['wptchanged']?.();       // map
            }
        });
    }

    // ----------------------------------------------------------------

    public apply(){
        this.updateLayers(false);
        this.updateSpy(Opt.spy.layer, false);  // !! init spy after configurated layers
        return this;
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggle(){
        this._toggle_btn.click();
        return this;
    }
}