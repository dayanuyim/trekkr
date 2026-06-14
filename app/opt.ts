'use strict';
import layer_conf from './data/layer-conf';
import Cookies from 'js-cookie';
//import { zlibSync, unzlibSync } from 'fflate';
import {isEqual} from 'lodash';
import { copyIfKeyDefined } from './lib/utils';

let _cookies_save_timers = {};

class Opt{
    static instance = undefined;
    static get() {
        if (!Opt.instance)
            Opt.instance = new Opt();
        return Opt.instance;
    }

    //cookie options
    _version = 9;
    xy = [13461784.981041275, 2699338.9447048027];    //xy = fromLonLat([120.929272, 23.555519]);
    zoom = 15;
    coordsys = 'twd67';
    layers = layer_conf;
    spy = {
        enabled: false,
        radius: 75,
        id: "NLSC_PHOTO_MIX",
    };
    eleprof_auto = 'once';  // once|always|none
    goto = {
        visible: false,
        coordsys: 'wgs84',
    };
    waypoint = {
        fontsize: 16,
        display: "auto",
        display_auto_zoom: 13.5
    };
    track = {
        arrow: {
            max_num: 8,
            interval: 20, //TODO: consider to deprecate
            radius: 8,    //TODO: consider to deprecate
        }
    }

    //const info
    data = {
        gmapkey: 'AIzaSyDoRAou_pmXgeqexPAUlX3Xkg0eKJ_FMhg',
        tooltip: {
            btn_settings: "Settings (Ctrl+S)",
            btn_spy:  "Spy Mode (Ctrl+X)\n啟用後上下鍵調整大小",
        }
    };

    //runtime info
    rt = {
        mousepos: null,
        shiftdown: false,
        gpx_filename: null,
    };

    private constructor(){
        const saved = this.load();
        //console.log('Loaded options from cookie:', saved);
        if(saved?._version === this._version)
            Object.assign(this, this.restore(saved));

        //reset properties
        this.spy.enabled = false;
        //console.log('opt', JSON.stringify(this, null, 2));
    }

    private load() {
        const saved: { [key: string]: any } = {};
        try {
            for(const key in this){
                const value = Cookies.get(key);
                if(value !== undefined)
                    saved[key] = JSON.parse(value);
            }
        }
        catch (err) {
            console.warn(`Parse cookie error: ${err}`);
        }
        return saved;
    }

    // ----------------------------------------------------------------

    public getLayer(id: string){
        return this.layers.find(layer => layer.id == id);
    }

    public updateLayer(id, keypath, value){
        const obj = this.getLayer(id);
        return this.update(keypath, value, obj, 'layers');
    }

    public updateLayersOrder(ids: Array<string>){
        const pos_idx = ids.reduce((dict, id, i) => (dict[id] = i, dict), {}); // id -> index

        const is_changed = !!this.layers.find(({id}, i) => pos_idx[id] != i);
        if(is_changed){
            this.layers.sort((a, b) => pos_idx[a.id] - pos_idx[b.id]);
            this.lazySave('layers');
        }
        return is_changed;
    }

    // ----------------------------------------------------------------

    // @obj is the object to be updated agaist the @keypath. The default is the opt itself if not specified.
    // @topkey is the name of the property of the opt. The default is the top level key of the keypath if not specified.
    // some examples:
    //  update('zoom', 10);
    //  update('spy.radius', 20);
    //  update('opacity', 0.5, opt.layers[0], 'layers');
    //  udpate('seefilter', {trk: {name: {enabled: true, type: 'contains', text: 'test'}}}, opt.layers[2], 'layers');
    public update(keypath: string, value: any, obj?: any, topkey?: string){
        if(!keypath?.length)
            return false;

        const keys = keypath.split('.');
        topkey = topkey || keys[0];   // use the top level key if not specified
        const key = keys.pop();
        obj = keys.reduce((obj, key) => obj[key], obj || this);  // drill down to the target object
        return this._update(key, value, obj, topkey);
    }

    private _update(key, value, obj, topkey){
        const is_changed = !isEqual(obj[key], value);
        if(is_changed){
            obj[key] = value;
            this.lazySave(topkey);
        }
        return is_changed;
    }

    private lazySave(topkey){

        const cookies_opt = {sameSite: 'strict'};
        const version_key = '_version';

        if(_cookies_save_timers[topkey])
            clearTimeout(_cookies_save_timers[topkey]);

        _cookies_save_timers[topkey] = setTimeout(() => {
            _cookies_save_timers[topkey] = null;

            const value = JSON.stringify(this.getStrippedValue(topkey));
            //console.log(`Saving ${topkey} to cookie:`, value);

            // after encodeURIComponent, cookie may exceed the limit 4096 bytes. we warn if the cookie seems too large.
            if(value.length >= 2600)
                console.warn(`The cookie size is too larger: ${value.length}`)

            Cookies.set(topkey, value, cookies_opt);
            Cookies.set(version_key, this[version_key], cookies_opt);  //for future compatibility check
        }, 2000);
    }

    public getStrippedValue(key){
        switch(key){
            case 'layers':
                return this.layers.map(layer => copyIfKeyDefined(layer, [
                    'id', 'checked', 'opacity', 'seeable', 'seefilter',
                ]));
                // TODO: strip the layers without alter
            //case 'zoom':
                //return this.zoom.toFixed(2);  // it is useless for being over precise
            case 'rt':
            case 'data':
                return {};    //not saving runtime or constant data  
            default:
                return this[key];
        }
    }

    private restore(orig){
        const defaults = this.layers.slice();
        const getDefault = id => {
            const idx = defaults.findIndex((layer) => layer.id === id);
            return idx >= 0? defaults.splice(idx, 1)[0]: undefined;
        }

        const fill = layer => {
            const def = getDefault(layer.id);
            return def? Object.assign(def, layer): undefined;   //discard the layer if its default not found
        }

        if(!Array.isArray(orig.layers))
            orig.layers = [];

        orig.layers = orig.layers.map(fill)         //restore by def
                                 .filter(ly => ly)  //discard unfilled 
                                 .concat(defaults); //append the rest
        return orig;
    }

    // TODO: need I use compress to reduce the cookie size? 
    /*
    private compress(obj){
        const str = JSON.stringify(obj);
        const bytes = new TextEncoder().encode(str);
        const compressed = zlibSync(bytes, {level: 9});
        //Buffer.from(compressed).toString('base64'); // tranditional way
        return compressed.toBase64();
    }

    private decompress(str){
        const compressed = Uint8Array.fromBase64(str);
        const bytes = unzlibSync(compressed);
        const json_str = new TextDecoder().decode(bytes);
        return JSON.parse(json_str);
    }
    */
}


/*
class SaveCookieControl extends Control{
  constructor(options = {}){
    var button = document.createElement('button');
    button.innerHTML = '📍';

    var element = document.createElement('div');
    element.title = "Save Location"
    element.className = 'save-cookie ol-unselectable ol-control';
    element.appendChild(button);

    super({
      element: element,
      target: options['target'],
    });

    button.addEventListener('click', this.saveCookie.bind(this), false);
  }

  saveCookie() {
    const view = super.getMap().getView();
    [Cookie.x, Cookie.y] = view.getCenter();
    Cookie.zoom = view.getZoom();
    writeCookie();
  }
}
*/

export default Opt.get();