'use strict';
import sortable from 'html5sortable/dist/html5sortable.es.js'
import {tablink} from './lib/dom-utils';
import Map from 'ol/Map';
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
    _listeners = {};;

    get _btn_toggle() { return this._base.querySelector<HTMLButtonElement>('button.btn-toggle'); }
    get _layers(){ return Array.from(this._base.querySelectorAll('#layer-grp li')); }
    get layers(){ return this._layers.map(Layer.of); }

    constructor(el: HTMLElement){
        this._base = el;
        this._base.innerHTML = templates.settings({ layers: Opt.layers });
        this.init();
    }

    private init(){
        tablink('.tablink', '.tabcontent', 0);

        this._btn_toggle.onclick = () => this._base.classList.toggle('collapsed');
        this._btn_toggle.title = Opt.tooltip.btn_settings;

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
        this._btn_toggle.click();
        return this;
    }
}