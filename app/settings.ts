'use strict';
import sortable from 'html5sortable/dist/html5sortable.es.js'
import Map from 'ol/Map';
import * as templates from './templates';
import {setLayers} from './map';
import LayerGrp from './layer-grp';
import Cookie from './cookie';


function limit(n, low, up){
    return Math.max(low, Math.min(n, up));
}

class Layer {
    static of(el: HTMLElement){
        return new Layer(el);
    }

    _base: HTMLElement;
    get _checkbox(){ return this._base.querySelector<HTMLInputElement>('input[type=checkbox]');}
    get _desc(){ return this._base.querySelector('span');}
    get _opacity(){ return this._base.querySelector<HTMLInputElement>('input[type=number]');}

    get legend(){ return this._base.parentElement.classList.contains('layer-legend');}
    get id(){ return this._base.getAttribute('data-layer-id');}
    get type(){ return this._base.getAttribute('data-layer-type');}
    get url(){ return this._base.getAttribute('data-layer-url');}
    get desc(){ return this._desc.textContent.trim();}
    get opacity(){ return limit(Number(this._opacity.value)/100, 0, 1);}

    get ol_layer(){ return LayerGrp[this.id]; }

    set oncheck(value){ this._checkbox.onchange = value};
    set onopacity(value){ this._opacity.onchange = value};

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

// w3c tab
function tablink(tab_q, content_q, def_idx?)
{
    const cls = 'active';
    const rm_cls = el => el.classList.remove(cls);
    const add_cls = el => el.classList.add(cls);
    const mapping_content = tab => document.getElementById(tab.getAttribute('data-content'));

    const tabs = document.body.querySelectorAll<HTMLButtonElement>(tab_q);
    const contents = document.body.querySelectorAll(content_q);

    const activate = (tab) => {
        tabs.forEach(rm_cls)
        contents.forEach(rm_cls)
        add_cls(tab);
        add_cls(mapping_content(tab));
    }

    tabs.forEach(tab => tab.onclick = e => activate(e.currentTarget));
    if(def_idx !== undefined) tabs[def_idx].click();
}

class Settings{
    static of(el: HTMLElement){
        return new Settings(el);
    }
    //static listenify = (fn) => { return (e) => fn(Settings.of(e.target.closest('.settings')), e.currentTarget, e); }

    _base: HTMLElement;
    get _btn_toggle() { return this._base.querySelector<HTMLButtonElement>('button.btn-toggle'); }
    get _layers(){ return Array.from(this._base.querySelectorAll('#layer-grp li')); }

    get layers(){ return this._layers.map(Layer.of); }

    map: Map;

    constructor(el: HTMLElement){
        this._base = el;
        this._base.innerHTML = templates.settings({layers: Cookie.layers});
        this.init();
    }

    init(){
        tablink('.tablink', '.tabcontent', 0);

        ['.layer-legend', '.layer-base'].forEach(selector =>{
            sortable(selector, {
                forcePalceholderSize: true,
                placeholderClass: 'ly-placeholder',
                //placeholder: templates.layer(),
                placeholder: '<li></li>',
                /*hoverClass: 'ly-hover',*/
            });
            sortable(selector)[0].addEventListener('sortupdate', () => {
                this.update(this.at_map, this.at_cookie);
            });
        });

        this._btn_toggle.onclick = () => this._base.classList.toggle('collapsed');


        this.layers.forEach(layer => {
            layer.oncheck = (e) => {
                this.update(this.at_map, this.at_cookie);
            };

            layer.onopacity = (e) =>{
                this.update(this.at_cookie);
                layer.ol_layer.setOpacity(layer.opacity);
            }
        });


    }

    getLayersConf() {
        return this.layers.map(ly => ly.obj());
    }

    at_cookie = (conf) => Cookie.update({ layers: conf });
    at_map = (conf) => { if(this.map) setLayers(this.map, conf) };

    update(...at_targets){
        const conf = this.getLayersConf();
        at_targets.forEach(target => target(conf));
    }

    setMap(map: Map){
        this.map = map;
        this.update(this.at_map);  //for init
    }
}

export function init(map) {
    const s = Settings.of(document.body.querySelector('.settings'));
    s.setMap(map);
}