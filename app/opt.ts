'use strict';
import layer_conf from './data/layer-conf';

class Opt{
    static instance = undefined;
    static get() {
        if (!Opt.instance)
            Opt.instance = new Opt();
        return Opt.instance;
    }

    //cookie options
    version = 5;
    xy = [13461784.981041275, 2699338.9447048027];    //xy = fromLonLat([120.929272, 23.555519]);
    zoom = 15;
    coordsys = 'twd67';
    layers = layer_conf;
    spy = {
        enabled: false,
        radius: 75,
        layer: "NLSC_PHOTO_MIX",
    };

    //runtime options
    googleMapKey = 'AIzaSyDoRAou_pmXgeqexPAUlX3Xkg0eKJ_FMhg';
    mousepos = null;

    private constructor(){
        const orig = this.load();
        if(orig && orig.version && orig.version === this.version)
            Object.assign(this, this.recover(orig));

        //reset properties
        this.spy.enabled = false;
        //console.log('opt', JSON.stringify(this, null, 2));
    }

    private load() {
        if (document.cookie) {
            try {
                return JSON.parse(document.cookie);
            }
            catch (err) {
                console.error(`Parse Cookie Error: ${err}`);
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
        const obj = Object.assign({}, this, {
            layers: this.layers.map(({id, checked, opacity}) => ({id, checked, opacity}))
        })
        delete obj.mousepos;
        delete obj.googleMapKey;
        return obj;
    }

    public recover(orig){
        const defs = this.layers.slice();
        const getDef = id => {
            const idx = defs.findIndex((layer) => layer.id === id);
            return idx >= 0? defs.splice(idx, 1)[0]: undefined;
        }
        const fill = layer => {
            const def = getDef(layer.id);
            return def? Object.assign(def, layer): undefined;   //discard the layer if its default not found
        }

        orig.layers = orig.layers.map(fill)         //recover by def
                                 .filter(ly => ly)  //discard unfilled 
                                 .concat(defs);     //append the rest
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

export default Opt.get();