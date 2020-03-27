
'use strict';
import {setLayers} from './map';
import Layers from './layer-grp';
import Cookie from './cookie';

const settings_listenify = (fn) => { return (e) => fn((e.target.closest('.settings')), e.currentTarget, e); }

let _btn_toggle: HTMLButtonElement;
let _layer_grp: HTMLElement;
let _layers: HTMLInputElement[];

function initElements() {
    _btn_toggle = document.querySelector<HTMLButtonElement>('.settings button.btn-toggle');
    _layer_grp = document.querySelector<HTMLElement>('.settings .layer-grp');
    _layers = Array.from(_layer_grp.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
}

function getLayersSetting() {
    return _layers.map(el => {
        const id = el.getAttribute('data-layer-id');
        return {
            id,
            enabled: el.checked,
            opacity: 1.00,
        }
    }).reverse();  //align the order of OL: [0]button -> [n-1]top
}

export function init(map) {
    initElements();

    _btn_toggle.onclick = settings_listenify(el => el.classList.toggle('collapsed'));

    _layers.forEach(el => {
        // layer changed
        el.onchange = (e) => {
            const s = getLayersSetting();
            setLayers(map, s);
            Cookie.update({ layers: s })
        }

        // init settings by cookie
        const id = el.getAttribute('data-layer-id');
        const layer = Cookie.layers.find(l => l.id === id);
        el.checked = layer && layer.enabled;
    });

    // init layer
    setLayers(map, getLayersSetting())
}