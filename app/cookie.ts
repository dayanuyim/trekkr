'use strict';
//import {fromLonLat} from 'ol/proj';
//import {Control} from 'ol/control';
import layer_conf from './data/layer-conf';

class Cookie{
    static instance = undefined;
    static get() {
        if (!Cookie.instance)
            Cookie.instance = new Cookie();
        return Cookie.instance;
    }

    //default properties
    //xy = fromLonLat([120.929272, 23.555519]);
    version = 2;
    xy = [13461784.981041275, 2699338.9447048027];
    zoom = 15;
    coordsys = 'twd67';
    layers = layer_conf;

    private constructor(){
        const orig = this.load();
        if(orig && orig.version && orig.version === this.version)
            Object.assign(this, this.recover(orig));
        //console.log('cookie', JSON.stringify(this, null, 2));
    }

    private load() {
        if (document.cookie) {
            try {
                console.log(document.cookie.substring(1330));
                return JSON.parse(document.cookie);
            }
            catch (err) {
                console.log(`Parse Cookie Error: ${err}`);
            }
        }
        return undefined;
    }

    public update(modified?) {
        if(modified)
            Object.assign(this, modified)

        const value = JSON.stringify(this.strip());
        if(value.length >= 4096)
            console.warn(`The cookie size is larger 4096: ${value.length}`)
        document.cookie = value;
    }

    public strip(){
        return Object.assign({}, this, {
            layers: this.layers.map(({id, checked, opacity}) => ({id, checked, opacity}))
        })
    }

    public recover(orig){
        const def_layers = {};
        this.layers.forEach(ly => def_layers[ly.id] = ly);

        orig.layers.forEach(layer => {
            const {legend, type, url, desc} = def_layers[layer.id];
            Object.assign(layer, {legend, type, url, desc});
        });
        return orig;
    }
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

export default Cookie.get();