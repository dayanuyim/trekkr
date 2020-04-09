'use strict';
import sortable from 'html5sortable/dist/html5sortable.es.js'
import {tablink} from './lib/dom-utils';
import Map from 'ol/Map';
import * as templates from './templates';
import {setLayers, setLayerOpacity, setSpyLayer} from './map';
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
    set spy(value){ value? this._spy.classList.add('active'):
                           this._spy.classList.remove('active');}

    set oncheck(value){ this._checkbox.onchange = Layer.listenify(value)};
    set onopacity(value){ this._opacity.onchange = Layer.listenify(value)};
    set onspy(value){ this._body.ondblclick = Layer.listenify(value);}

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

class Settings{
    static of(el: HTMLElement, map: Map){
        return new Settings(el, map);
    }
    //static listenify = (fn) => { return (e) => fn(Settings.of(e.target.closest('.settings')), e.currentTarget, e); }

    _base: HTMLElement;
    get _btn_toggle() { return this._base.querySelector<HTMLButtonElement>('button.btn-toggle'); }
    get _layers(){ return Array.from(this._base.querySelectorAll('#layer-grp li')); }

    get layers(){ return this._layers.map(Layer.of); }

    map: Map;

    constructor(el: HTMLElement, map: Map){
        this._base = el;
        this._base.innerHTML = templates.settings({ layers: Opt.layers });
        this.map = map;
        this.init();
    }

    init(){
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
                const conf = this.getLayersConf();
                this.updateLayers(conf);
                this.updateOptLayers(conf);
            });
        });

        //layer events
        this.layers.forEach(layer => {
            layer.oncheck = () => {
                const conf = this.getLayersConf();
                this.updateLayers(conf);
                this.updateOptLayers(conf);
            };

            layer.onopacity = () =>{
                setLayerOpacity(layer.id, layer.opacity);
                this.updateOptLayers(this.getLayersConf());
            }

            layer.onspy = () => {
                this.updateSpy(layer.id);
                this.updateOptSpy(layer.id);
            }
        });

        //map
        this.updateSpy(Opt.spy.layer);
        this.updateLayers(this.getLayersConf());  //for init
    }


    updateLayers = (layers_conf) => setLayers(this.map, layers_conf);
    updateOptLayers = (layers_conf) => Opt.update({ layers: layers_conf });

    updateSpy(layer_id){
        this.layers.forEach(layer => layer.spy = (layer.id === layer_id));  //ui
        setSpyLayer(this.map, layer_id);  //map
    }

    updateOptSpy = (layer_id) => {
        Opt.spy.layer = layer_id;
        Opt.update();
    }

    getLayersConf() {
        return this.layers.map(ly => ly.obj());
    }
}

class SideSettings{
    static of(el: HTMLElement, map: Map){
        return new SideSettings(el, map);
    }

    _base: HTMLElement;
    _btn_spy: HTMLButtonElement;
    //get _btn_spy() { return this._base.querySelector<HTMLButtonElement>('button.btn-spy'); }

    map: Map;

    constructor(el: HTMLElement, map: Map){
        this._base = el;
        this._btn_spy = this._base.querySelector<HTMLButtonElement>('button.btn-spy');
        this.map = map;
        this.init();
    }

    private init(){
        //init spy
        Opt.spy.enabled? this._btn_spy.classList.add('active'):
                            this._btn_spy.classList.remove('active');
        this._btn_spy.title = Opt.tooltip.btn_spy;
        this._btn_spy.addEventListener('click', e =>{
            this._btn_spy.classList.toggle('active');

            Opt.spy.enabled = this._btn_spy.classList.contains('active');
            Opt.update();

            this.map.render();
            return true;
        });
    }
}

export function init(root_el: HTMLElement, map) {
    const ctrl_panel = Settings.of(root_el.querySelector('.settings'), map);
    const ctrl_side = SideSettings.of(root_el.querySelector('.settings-side'), map);

    root_el.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 's') 
            ctrl_panel._btn_toggle.click();
        else if (e.ctrlKey && e.key === 'x') 
            ctrl_side._btn_spy.click();
        else if (e.ctrlKey && e.key === 'f') {
            root_el.requestFullscreen();
        }
    });
}