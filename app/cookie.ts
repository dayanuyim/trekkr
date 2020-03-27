'use strict';
//import {fromLonLat} from 'ol/proj';
//import {Control} from 'ol/control';

class Cookie{
    static instance = undefined;
    static get() {
        if (!Cookie.instance)
            Cookie.instance = new Cookie();
        return Cookie.instance;
    }

    //default properties
    //xy = fromLonLat([120.929272, 23.555519]);
    xy = [13461784.981041275, 2699338.9447048027];
    zoom = 15;
    coordsys = 'twd67';
    layers = [
        //bottom
        { id: 'JP_GSI'     , enabled: false, opacity: 1.00, },
        { id: 'OSM'        , enabled:  true, opacity: 1.00, },
        { id: 'NLSC'       , enabled: false, opacity: 1.00, },
        { id: 'RUDY'       , enabled: false, opacity: 1.00, },
        { id: 'NLSC_LG'    , enabled:  true, opacity: 1.00, },
        { id: 'TW_COUNTIES', enabled: false, opacity: 1.00, },
        //{ id: 'COUNTRIES'  , enabled: false, opacity: 1.00, },
        { id: 'GPX_SAMPLE' , enabled: false, opacity: 1.00, },
        //top
    ];

    private constructor(){
        Object.assign(this, this.load())
    }

    private load() {
        if (document.cookie) {
            try {
                return JSON.parse(document.cookie);
            }
            catch (err) {
                console.log(`Parse Cookie Error: ${err}`);
            }
        }
        return undefined;
    }

    public update(modified) {
        if(modified)
            Object.assign(this, modified)
        document.cookie = JSON.stringify(this);
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