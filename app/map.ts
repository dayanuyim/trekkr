import { Feature } from 'ol';
import { defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control } from 'ol/control';
import { defaults as defaultInteractions, DragAndDrop, Modify, Select } from 'ol/interaction';
import { toSize } from 'ol/size';
import { Map, View, Overlay, Collection } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource, TileJSON, XYZ, OSM } from 'ol/source';
import { getRenderPixel } from 'ol/render';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { Geometry } from 'ol/geom';

import { GeoJSON, IGC, KML, TopoJSON } from 'ol/format';
import PhotoFormat from './format/Photo';

import { olGpxLayer, GpxLayer, GPXFormat, setSymByRules, splitTrack} from './gpx';
import PtPopupOverlay from './pt-popup';
import Opt from './opt';
import * as LayerRepo from './layer-repo';
import { gmapUrl} from './common';
import { CtxMenu } from './ctx-menu';
import { saveTextAsFile } from './lib/dom-utils';

/*
//TODO: better way to do this?
// NOTE: the function is called only with 'wpt' feature feed,
// so the index range should be in [ indexOfPseudoGpxLayer(), layers.getLength() ),
// so do the search by rever order.
function findLayerByFeature(map, feature){
  const layers = map.getLayers();
  for(let i = layers.getLength() -1; i >= 0; --i){
    const layer = layers.item(i);
    if(layer.getSource().getFeatures().includes(feature))
      return layer;
  }
  return undefined;
}
*/

////////////////////////////////////////////////////////////////

export class AppMap{
  _map: Map
  _gpx_layer: GpxLayer;   //a gpx adapter for VectorLayer
  _ctxmenu_coord;

  public constructor(target){
    this.init(target);
    this.initEvents();
  }

  private init(target)
  {
    const photo_format = new PhotoFormat();
    const drag_interaciton = new DragAndDrop({
      formatConstructors: [GPXFormat, photo_format, GeoJSON, IGC, KML, TopoJSON]
    });

    this._map = new Map({
      target,
      controls: defaultControls().extend([
        new ScaleLine(),
        new OverviewMap({
          layers: [new TileLayer({ source: new OSM() })]
        }),
        new ZoomSlider(),
        //new SaveCookieControl(),
      ]),
      interactions: defaultInteractions().extend([
        drag_interaciton,
        //new Select(),
      ]),
      //layers: [
      //],
      view: new View({
        center: Opt.xy,
        zoom: Opt.zoom,
        minZoom: 1,
        maxZoom: 23,
      }),
      overlays: [
        new PtPopupOverlay(document.getElementById('pt-popup')),
      ],
    });

    photo_format
      .setListener('featureexists', (time) => this._gpx_layer.findWaypoint(time))
      .setListener('lookupcoords', (time) => this._gpx_layer.estimateCoords(time));

    // pseudo gpx layer
    const layer = olGpxLayer();
    this._gpx_layer = new GpxLayer(layer);
    this.addLayerWithInteraction(layer)

    //create layer from features, and add it to the map
    drag_interaciton.on('addfeatures', (e) => {
      const features = e.features.filter(f => f instanceof Feature).map(f => f as Feature); //filter out RenderFeature, what is that?
      this._gpx_layer.getSource().addFeatures(features);
      this._map.getView().fit(this._gpx_layer.getSource().getExtent(), { maxZoom: 16 });
      //const layer = olLayer({features: e.features});
      //addLayerWithInteraction(map, layer);
      //map.getView().fit(layer.getSource().getExtent(), { maxZoom: 16 });
    });
  };

/*
function getQueryParameters()
{
  const query = window.location.search.substring(1);
  return query.split('&')
    .reduce((all, param) => {
      const [key, value] = param.split('=');
      all[key] = value;
      return all;
    }, {});
}
*/

  private initEvents() {
    const map = this._map;
    map.on('pointermove', (e) =>{
      if (e.dragging)
        return;
      this.hoverFeatures(e);
    });

    map.on('click', (e) => {
      this.showFeatures(e);
    });

    map.on('singleclick', (e) => {
    });

    //map.on('moveend', (e) => {   //invoked only when view is locked down
    map.on('postrender', () => this.saveViewConf());

    // when pt-popup overlay make or remove a wpt feature
    const pt_popup = (map.getOverlayById('pt-popup') as PtPopupOverlay)
      .setListener('mkwpt', (wpt) => this._gpx_layer.getSource().addFeature(wpt))
      .setListener('rmwpt', (wpt) => {
        this._gpx_layer.removeWaypoint(wpt);
        pt_popup.hide(); //close popup
      })
      .setListener('rmtrk', (trk) => {
        this._gpx_layer.removeTrack(trk);
        pt_popup.hide(); //close popup
      })
      .setListener('splittrk', (trk, coords) => {
        const trk2 = splitTrack(trk, coords);
        if(trk2)
          this._gpx_layer.addTrack(trk2);
      });

    // record the pixel position with every move
    document.addEventListener('mousemove', (e) =>{
      Opt.mousepos = map.getEventPixel(e);
      map.render();
    });

    document.addEventListener('mouseout', () => {
      Opt.mousepos = null;
      map.render();
    });

    //document events
    document.addEventListener('keydown', (e) =>{
      if (Opt.spy.enabled && e.key === 'ArrowUp')
        this.handleSpyRadiusChange(e, 5);
      else if (Opt.spy.enabled && e.key === 'ArrowDown')
        this.handleSpyRadiusChange(e, -5);
    });
  }

  private handleSpyRadiusChange(e, inc){
      const radius = Math.max(25, Math.min(Opt.spy.radius + inc, 250));
      if(radius != Opt.spy.radus){
        Opt.update({radius}, 'spy');
        this._map.render();  //trigger prerender
        e.preventDefault();
      }
  }

  private saveViewConf()
  {
    const view = this._map.getView();
    Opt.update({
      xy: view.getCenter(),
      zoom: view.getZoom(),
    });
  }

  private hoverFeatures(e) {
    const features = this._getFeatures(e);
    e.map.getTargetElement().style.cursor = features.length? 'pointer': '';
  };

  private showFeatures(e) {
    let has_popup_shown = false;
    const popup_overlay = () => e.map.getOverlayById('pt-popup');

    const features = this._getFeatures(e);
    features.forEach(feature => {
      switch (feature.getGeometry().getType()) {
        case 'Point': {   // Waypoint or Track point
          has_popup_shown = true;
          popup_overlay().popContent(feature);
          break;
        }
        case 'LineString': {  //grid line
          const name = feature.get('name');
          if(name) console.log(name);
          break;
        }
        case 'MultiLineString': {  //track
          const name = feature.get('name');
          console.log(`track name: ${name}`);
          break;
        }
      }
      return true;
    });

    //no popup in this run, but hide the old popup if any
    if(!has_popup_shown) popup_overlay().hide();
  };

  private _getFeatures(e) {
    const isTrk = f => f.getGeometry().getType() == 'MultiLineString';
    const isPt = f => f.getGeometry().getType() === 'Point';
    const hasWptProp = f => f.get('name') || f.get('desc') || f.get('sym');
    const isWpt = f => isPt(f) && hasWptProp(f);
    const isTrkpt = f => isPt(f) && !hasWptProp(f);

    const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?

    // NOTE: not use forEach..., it is hard to point to Wpt if there are Trkpt in the same place. (Why?)
    //const hit = e.map.forEachFeatureAtPixel(pixel, handleFeature);
    //e.map.getTargetElement().style.cursor = hit? 'pointer': '';

    const features = e.map.getFeaturesAtPixel(pixel, { hitTolerance: 2 });
    //return features.some(isWpt)? features.filter(f => !isTrkpt(f)): features;  //filter out trkpts if wpt exists
    return features.some(isWpt) ? features.filter(isWpt) : features.filter(isTrkpt);  //either wpt or trk/trkpt
  };

////////////////////////////////////////////////////////////////
//relay functions

  public render() { this._map.render();}
  public renderSync() { this._map.renderSync();}
  public redrawText() { this._map.redrawText(); }
  public getView() { return this._map.getView(); }

////////////////////////////////////////////////////////////////

  private indexOfSpyLayer(){
    return Opt.layers.filter(ly => ly.checked).length;   // after all enabled layers
  }

  private indexOfPseudoGpxLayer(){
    return this.indexOfSpyLayer() + 1;  //after spy layer
  }

  private getGpxLayer() {
    return this._map.getLayers().item(this.indexOfPseudoGpxLayer()) as VectorLayer<VectorSource<Geometry>>;
  }

  /*
  function getGpxLayers(map){
      return map.getLayers().getArray().slice(indexOfPseudoGpxLayer());
  }
  */

  private addLayerWithInteraction(layer) {
    this._map.addLayer(layer);
    this._map.addInteraction(new Modify({    //let trkpt feature as 'Point', instead of 'MultiLineString'
      source: layer.getSource(),
      condition: platformModifierKeyOnly,
    }));
  }


  //Note:
  // 1. OL is anti-order against @conf.
  //    OL:
  //     layers[0]     is the most bottom layer from conf;
  //     layers[n-1]   is the most top layer from conf
  //     layers[n]     is the spy layer
  //     layers[n+1]   is the pseudo gpx layer
  //     layers[n+1+m] is the mth user-provided gpx laeyr
  // 2. remove only the layers whith are set disabled in @conf
  // 3. invoke getLayer only for those enalbed in @conf
  // 4. as mush as graceful to reorder the map's layers.
  public setLayers(conf)
  {
    const in_right_pos = (arr, idx, elem) => arr.getLength() > idx && arr.item(idx) === elem;

    const id_conf = {};
    conf.forEach(cnf => id_conf[cnf.id] = cnf)

    const map_layers = this._map.getLayers();

    // remove map layers, which disable in conf
    const rm_idx = [];
    map_layers.forEach((layer, idx) => {
      const id = LayerRepo.getId(layer);
      const cnf = id? id_conf[id]: undefined;
      if(cnf && !cnf.checked)
        rm_idx.unshift(idx);  //insert to first
    });
    rm_idx.forEach(idx => map_layers.removeAt(idx));

    // add enabled layers in the same order of cnf
    conf.filter(cnf => cnf.checked)
        .reverse()
        .forEach((cnf, idx) => {
          const layer = LayerRepo.get(cnf.id);
          if (!in_right_pos(map_layers, idx, layer)) {
            map_layers.remove(layer); //in case the layer is added but in the wrong place
            map_layers.insertAt(idx, layer);
            layer.setOpacity(cnf.opacity);
          }
        });
  }

////////////////////////////////////////////////////////////////

  public setLayerOpacity(id, opacity)
  {
    const layer = LayerRepo.get(id);
    if (layer)
      layer.setOpacity(opacity);
    else
      console.error(`Set layer opacity error: layer ${id} not found`);
  }

////////////////////////////////////////////////////////////////

  //TODO: are there beter ways than creating spy layer everytime?
  //      Or creating spy layer everytime really hurt the performance?
  public setSpyLayer(id) {
    const layers = this._map.getLayers();
    const idx = this.indexOfSpyLayer();  // !! the index is correct only if the configurated layers are set; otherwise do the following search to find out the proper index.
    /*
      let has_old_spy = false;
      let idx = 0;
      for(; idx < layers.getLength(); ++idx){
        const layer = layers.item(idx);
        const id = LayerRepo.getId(layer);
        if(!id) break;    //beyond normal layers, e.g., gpx layer
        if(id === 'SPY'){
          has_old_spy = true;
          break;
        }
      }
      if(has_old_spy)*/
    if (LayerRepo.getId(layers.item(idx)) == 'SPY')  //remove the original if any
      layers.removeAt(idx);
    layers.insertAt(idx, this.createSpyLayer(id));
  }

  private createSpyLayer(id) {
    const spy_conf = Object.assign({}, LayerRepo.getConf(id), { id: 'SPY' });
    const layer = LayerRepo.createByConf(spy_conf);
    this.setSpyEvents(layer);
    return layer;
  }

  private setSpyEvents(layer)
  {
    // before rendering the layer, do some clipping
    layer.on('prerender', (event) => {
      const ctx = event.context;
      ctx.save();
      ctx.beginPath();
      
      const spy = Opt.spy;
      const mousepos = Opt.mousepos;
      if (spy.enabled && mousepos) {
        // only show a circle around the mouse
        var pixel = getRenderPixel(event, mousepos);

        //@why the sample code so complexed ??
        //var offset = getRenderPixel(event, [mousepos[0] + spy.radius, mousepos[1]]);
        //var canvasRadius = Math.sqrt(Math.pow(offset[0] - pixel[0], 2) + Math.pow(offset[1] - pixel[1], 2));
        //ctx.arc(pixel[0], pixel[1], canvasRadius, 0, 2 * Math.PI);
        //ctx.lineWidth = 5 * canvasRadius / spy.radius;
        ctx.arc(pixel[0], pixel[1], spy.radius, 0, 2 * Math.PI);
        ctx.lineWidth = 1;

        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.stroke();
      }
      ctx.clip();
    });

  // after rendering the layer, restore the canvas context
    layer.on('postrender', (event) => {
      const ctx = event.context;
      ctx.restore();
    });
  }

//----------------------------------------------------------------//

  public setCrosshairWpt(coord){
    const wpt = this._gpx_layer.setCrosshairWpt(coord);
    this._map.getView().fit(wpt.getGeometry(), {maxZoom: 16});
  }

/////////////////////// Context Menu ///////////////////////////

  public setCtxMenu(menu: HTMLElement) {
    // set map listeners ==========
    //const map_el = map.getTargetElement();
    const map_el = this._map.getViewport();

    const ctx = new CtxMenu(map_el, menu);
    map_el.addEventListener('contextmenu', e => {
      this._ctxmenu_coord = this._map.getEventCoordinate(e);
      ctx.show(e);
    });

    map_el.addEventListener("click", e => {
      ctx.hide(e);
    });

    // set menu listeners ========

    ctx.setItem(".item-gmap", (el) => {
      el.href = gmapUrl(this._ctxmenu_coord);
    });

    ctx.setItem(".item-add-wpt", (el) => {
      this._gpx_layer.createWaypoint(this._ctxmenu_coord);
    });

    ctx.setItem(".item-save-gpx", (el) => {
      const xml = this._gpx_layer.genText();
      saveTextAsFile(xml, 'your.gpx', 'application/gpx+xml');
      //console.log(xml);
    });
    ctx.setItem(".item-apply-sym", (el) => {
      this._gpx_layer.getWaypoints().forEach(setSymByRules);
    });
  }

}
