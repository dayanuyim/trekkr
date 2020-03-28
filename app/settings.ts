
'use strict';
import * as templates from './templates';
import {setLayers} from './map';
import Layers from './layer-grp';
import Cookie from './cookie';
import {partition} from './lib/utils';

class Layer {
    static of(el: HTMLElement){
        return new Layer(el);
    }

    _base: HTMLElement;
    get _checkbox(){ return this._base.querySelector('input');}

    get legend(){ return this._base.parentElement.classList.contains('layer-legend');}
    get id(){ return this._base.getAttribute('data-layer-id');}
    get type(){ return this._base.getAttribute('data-layer-type');}
    get url(){ return this._base.getAttribute('data-layer-url');}
    get desc(){ return this._base.textContent.trim();}

    set onchange(value){ this._checkbox.onchange = value};

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
            opacity: 1.00,
        };
    }
}

class Settings{
    static of(el: HTMLElement){
        return new Settings(el);
    }
    //static listenify = (fn) => { return (e) => fn(Settings.of(e.target.closest('.settings')), e.currentTarget, e); }

    _base: HTMLElement;
    get _btn_toggle() { return this._base.querySelector<HTMLButtonElement>('button.btn-toggle'); }
    get _layers(){ return Array.from(this._base.querySelectorAll('.layer-grp li')); }

    get layers(){ return this._layers.map(Layer.of); }

    map;

    constructor(el: HTMLElement){
        this._base = el;
        this._base.innerHTML = templates.settings({layers: Cookie.layers});
        this.init();
    }

    init(){
        this._btn_toggle.onclick = () => this._base.classList.toggle('collapsed');

        this.layers.forEach(ly => {
            ly.onchange = (e) => {
                const conf = this.getLayersConf();
                if(this.map) setLayers(this.map, conf);
                Cookie.update({ layers: conf })
            };
        });
    }

    getLayersConf() {
        return this.layers.map(ly => ly.obj());
    }

    setMap(map){
        this.map = map;
        setLayers(map, this.getLayersConf());  //for init
    }
}

export function init(map) {
    const s = Settings.of(document.body.querySelector('.settings'));
    s.setMap(map);
}