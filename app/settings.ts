'use strict';
import sortable from 'html5sortable/dist/html5sortable.es.js'
import {tablink} from './lib/dom-utils';
import Map from 'ol/Map';
import * as templates from './templates';
import {setLayers, setLayerOpacity} from './map';
import Opt from './opt';

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

    get layers(){ return this._layers.map(Layer.of); }

    map: Map;

    constructor(el: HTMLElement){
        this._base = el;
        this._base.innerHTML = templates.settings({layers: Opt.layers});
        this.init();
    }

    init(){
        tablink('.tablink', '.tabcontent', 0);

        this._btn_toggle.onclick = () => this._base.classList.toggle('collapsed');
        this._btn_toggle.title = "Settings (Ctrl+S)";

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
                this.update(this.at_map, this.at_opt);
            });
        });

        //layer events
        this.layers.forEach(layer => {
            layer.oncheck = (e) => {
                this.update(this.at_map, this.at_opt);
            };

            layer.onopacity = (e) =>{
                this.update(this.at_opt);
                setLayerOpacity(layer.id, layer.opacity);
            }
        });
    }

    getLayersConf() {
        return this.layers.map(ly => ly.obj());
    }

    at_opt = (conf) => Opt.update({ layers: conf });
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

class SideSettings{
    static of(el: HTMLElement){
        return new SideSettings(el);
    }

    _base: HTMLElement;
    _btn_spy: HTMLButtonElement;
    //get _btn_spy() { return this._base.querySelector<HTMLButtonElement>('button.btn-spy'); }

    map: Map;

    constructor(el: HTMLElement){
        this._base = el;
        this._btn_spy = this._base.querySelector<HTMLButtonElement>('button.btn-spy');
        this.init();
    }

    private init(){
        //init spy
        Opt.spy.enabled? this._btn_spy.classList.add('active'):
                            this._btn_spy.classList.remove('active');
        this._btn_spy.title = "Spy Mode (Ctrl+S)\n啟用後上下鍵調整大小";
        this._btn_spy.addEventListener('click', e =>{
            this._btn_spy.classList.toggle('active');
            const spyable = this._btn_spy.classList.contains('active');

            Opt.spy.enabled = spyable;
            Opt.update();

            if(this.map) this.map.render();
            return true;
        });
    }

    setMap(map: Map){
        this.map = map;
    }
}

export function init(root_el: HTMLElement, map) {
    const ctrl_panel = Settings.of(root_el.querySelector('.settings'));
    ctrl_panel.setMap(map);

    const ctrl_side = SideSettings.of(root_el.querySelector('.settings-side'));
    ctrl_side.setMap(map);

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