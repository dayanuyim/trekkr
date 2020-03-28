
'use strict';
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

class Settings{
    static of(el: HTMLElement){
        return new Settings(el);
    }
    //static listenify = (fn) => { return (e) => fn(Settings.of(e.target.closest('.settings')), e.currentTarget, e); }

    _base: HTMLElement;
    get _btn_toggle() { return this._base.querySelector<HTMLButtonElement>('button.btn-toggle'); }
    get _layers(){ return Array.from(this._base.querySelectorAll('#layer-grp li')); }
    get _tablinks(){ return Array.from(this._base.querySelectorAll<HTMLButtonElement>('.tablink')); }
    get _tabcontents(){ return Array.from(this._base.querySelectorAll<HTMLButtonElement>('.tabcontent')); }

    get layers(){ return this._layers.map(Layer.of); }

    map: Map;

    constructor(el: HTMLElement){
        this._base = el;
        this._base.innerHTML = templates.settings({layers: Cookie.layers});
        this.init();
    }

    init(){
        this._btn_toggle.onclick = () => this._base.classList.toggle('collapsed');

        this._tablinks.forEach(link => link.onclick = e => this.activateTab(e.currentTarget));
        this._tablinks[0].click();

        this.layers.forEach(layer => {
            layer.oncheck = (e) => {
                const conf = this.getLayersConf();
                //console.log('layers conf:', JSON.stringify(conf, null, 2));
                Cookie.update({ layers: conf })

                if(this.map) setLayers(this.map, conf);
                console.log(conf);
            };

            layer.onopacity = (e) =>{
                const conf = this.getLayersConf();
                //console.log('layers conf:', JSON.stringify(conf, null, 2));
                Cookie.update({ layers: conf })

                console.log(e.target.value);
                layer.ol_layer.setOpacity(layer.opacity);
            }
        });


    }

    activateTab(link){
        this._tablinks.forEach(el => el.classList.remove('active'))
        this._tabcontents.forEach(el => el.classList.remove('active'))
        link.classList.add('active');
        document.getElementById(link.getAttribute('data-content')).classList.add('active');
    }

    getLayersConf() {
        return this.layers.map(ly => ly.obj());
    }

    setMap(map: Map){
        this.map = map;
        setLayers(map, this.getLayersConf());  //for init
    }
}

export function init(map) {
    const s = Settings.of(document.body.querySelector('.settings'));
    s.setMap(map);
}