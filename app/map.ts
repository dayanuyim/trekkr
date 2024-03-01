import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control } from 'ol/control';
import { defaults as defaultInteractions, DragAndDrop, Modify, Select } from 'ol/interaction';
import { toSize } from 'ol/size';
import { Map, View, Overlay, Collection } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource, TileJSON, XYZ, OSM } from 'ol/source';
import { getRenderPixel } from 'ol/render';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { Geometry } from 'ol/geom';
import * as Extent from 'ol/extent';
import { GeoJSON, IGC, KML, TopoJSON } from 'ol/format';

import PhotoFormat from './ol/format/Photo';
import GPXLayer from './ol/layer/GPX';
import GPXFormat from './ol/format/GPX';
import GPXStyle from './ol/style/GPX';

import Opt from './opt';
import { splitn, mapFind } from './lib/utils';
import { saveTextAsFile } from './lib/dom-utils';
import { gmapUrl, setGpxFilename } from './common';
import { CtxMenu } from './ctx-menu';
import * as LayerRepo from './layer-repo';
import { PtPopupOverlay } from './pt-popup';
import { matchRules } from './sym'

/*
//TODO: better way to do this?
// NOTE: the function is called only with 'wpt' feature feed,
// so the index range should be in [ indexOfPseudoGpxLayer(), layers.getLength() ),
// so do the search by rever order.
function findLayerByFeature(map, feature){
  const layers = map.getLayers();
  for(let i = layers.getLength() -1; i >= 0; --i){
    const layer = layers.item(i);
    if(layer.getSource().hasFeature(feature))
      return layer;
  }
  return undefined;
}
*/

function unionExtents(extents){
  const empty = Extent.createEmpty();
  return extents.reduce((res, ext) => Extent.extend(res, ext), empty);
}

////////////////////////////////////////////////////////////////

export class AppMap{
  _map: Map
  _gpx_layer: GPXLayer;   //a gpx adapter for VectorLayer
  _ctxmenu_coord;
  _formats = [
    GPXFormat,
    new PhotoFormat()
      .setListener('featureexists', (time) => this._gpx_layer.findWaypoint(time))
      .setListener('lookupcoords',  (time) => this._gpx_layer.estimateCoord(time)),
    KML,
    GeoJSON,
    TopoJSON,
    IGC,
  ];
  _formats_types = [
    ".gpx",                // GPX                (application/gpx+xml)
    ".jpg", ".jpeg",       // Photo with EXIF    (image/jpeg)
    ".kml",                // KML                (application/vnd.google-earth.kml+xml)
    ".json", ".geojson",   // GeoJSON & TopoJSON (application/geo+json)
    ".igc",                // IGC
  ];

  public constructor(target){
    this.init(target);
    this.initEvents();
  }

  private init(target)
  {
    const drag_interaciton = new DragAndDrop({
      formatConstructors: this._formats,
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

    // pseudo gpx layer
    this._gpx_layer = new GPXLayer({
      style: new GPXStyle({
        trackArrowNum: Opt.track.arrow.max_num,
      }),
    });
    this._map.addLayer(this._gpx_layer);
    this.setInteraction(this._gpx_layer);

    //create layer from features, and add it to the map
    drag_interaciton.on('addfeatures', (e) => {
      this.addFileFeatures(e.file.name, e.features);
    });
  };

  // ----------------------------------------------------------------

  // for input file or http response
  public async readFileFeatures(filename, blob: Blob|File|Response){
    try{
      const arraybuf = await blob.arrayBuffer();
      const features = this.readFeatures(arraybuf);
      this.addFileFeatures(filename, features);
    }
    catch(e){
      console.error(`read '${filename}' array buffer error`, e);
    }
  }

  private addFileFeatures(filename, features){
    setGpxFilename(filename); // to rec the basename if a gpx is loaded
    this.addGpxFeatures(features);
  }

  private addGpxFeatures(features: FeatureLike[]): void {
    if(!features) return;
    const real_features = features.filter(f => f instanceof Feature)  // filter out RenderFeature
                                .map(f => f as Feature);
    //*
    // add to the gpx layer
    this._gpx_layer.getSource().addFeatures(real_features);                       // add only 'filtered' features
    const extent = unionExtents(features.map(f => f.getGeometry().getExtent()));  // extent of 'original' features
    this._map.getView().fit(extent, { maxZoom: 16 });
    /*/
    // create new layer
    const layer = olLayer({real_features});
    this._map.addLayer(layer);
    this.setInteraction(layer);
    this._map.getView().fit(layer.getSource().getExtent(), { maxZoom: 16 });
    //*/
  }

  // This function is much like the ability to read features from drag-and-drop files, but here the from file content.
  //    ref: ol/interaction/DragAndDrop.js
  private readFeatures(arrbuf: ArrayBuffer)
  {
    const try_to_read = (formatter, data, options) => {
      try {
        return formatter.readFeatures(data, options);
      }
      catch (e) {
        // the error is normal in the try-and-error process
        // console.debug(`'${formatter.constructor.name}' read features error: ${e.message}`);
        return null;
      }
    };

    const text = new TextDecoder().decode(arrbuf);

    return mapFind(this._formats, format => {
      const formatter = (typeof format === 'function') ? new format() : format;
      const data = (formatter.getType() == 'arraybuffer') ? arrbuf : text;
      return try_to_read(formatter, data, {
        featureProjection: this._map.getView().getProjection(),
      });
    }, features => {
      return features && features.length > 0;
    });
  }

  // ----------------------------------------------------------------

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

    const view = map.getView();
    view.on('change:center',     () => Opt.update('xy', view.getCenter()));
    view.on('change:resolution', () => Opt.update('zoom', view.getZoom()));

    // when pt-popup overlay make or remove a wpt feature
    (map.getOverlayById('pt-popup') as PtPopupOverlay)
      .setListener('mkwpt', (wpt) => this._gpx_layer.getSource().addFeature(wpt))
      .setListener('rmwpt', (wpt) => this._gpx_layer.removeWaypoint(wpt))
      .setListener('rmtrk', (trk) => this._gpx_layer.removeTrack(trk))
      .setListener('jointrk', (trk, coord) => this._gpx_layer.joinTrackAt(trk, coord))  //the return matters
      .setListener('splittrk', (trk, coord) => this._gpx_layer.splitTrack(trk, coord));

    // record the pixel position with every move
    document.addEventListener('mousemove', (e) =>{
      Opt.rt.mousepos = map.getEventPixel(e);
      map.render();
    });

    document.addEventListener('mouseout', () => {
      Opt.rt.mousepos = null;
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
      const radius = Math.max(25, Math.min(Opt.spy.radius + inc, 500));
      if(radius != Opt.spy.radus){
        Opt.update('spy.radius', radius);
        this._map.render();  //trigger prerender
        e.preventDefault();
      }
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
    const hasFeatures = (f, predicate) => {
      const features = f.get('features');
      return features && features.find(predicate);
    }
    const isTrk =      f => f.getGeometry().getType() == 'MultiLineString';
    const isPt =       f => f.getGeometry().getType() === 'Point';
    const isTrkpt =    f => isPt(f) && hasFeatures(f, isTrk);
    const isHiddenPt = f => isPt(f) && hasFeatures(f, isPt);    // when a wpt is not visible or covered by other wpts
    const hasWptProp = f => f.get('name') || f.get('desc') || f.get('sym');
    const isWpt      = f => isPt(f) && hasWptProp(f);
    const isRoWpt    = f => isWpt(f) && f.get('readonly');

    const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?

    // NOTE: not use forEach..., it is hard to point to Wpt if there are Trkpt in the same place. (Why?)
    //const hit = e.map.forEachFeatureAtPixel(pixel, handleFeature);
    //e.map.getTargetElement().style.cursor = hit? 'pointer': '';

    const features = e.map.getFeaturesAtPixel(pixel, { hitTolerance: 2 });
    if(features.length == 0)
      return features;

    const [h, r, w, t, _] = splitn(features, isHiddenPt, isRoWpt, isWpt, isTrkpt);
    return [w, t, r, h].find(pts => pts.length > 0) || [];   //priority: wpt > trkpt > ro_wpt > hidden_wpt > track;
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

  private setInteraction(layer) {
    if(!layer._interaction){
      layer._interaction = new Modify({    //let trkpt feature as 'Point', instead of 'MultiLineString'
        source: layer.getSource(),
        condition: platformModifierKeyOnly,
      });
      this._map.addInteraction(layer._interaction);
    }
  }

  private unsetInteraction(layer) {
    if(layer._interaction){
      this._map.removeInteraction(layer._interaction);
      layer._interaction = null;
    }
  }

  public initLayers(layers_conf, spy_conf){
    this.setLayers(layers_conf);
    this.setSpyLayer(spy_conf);  // !! init spy after configuring layers
  }

  //Note:
  // 1. OL is anti-order against @conf.
  //    OL:
  //     layers[0]     is the most bottom layer from conf;
  //     layers[n-1]   is the most top layer from conf
  //     layers[n]     is the spy layer
  //     layers[n+1]   is the pseudo gpx layer
  //     layers[n+1+m] is the mth user-provided gpx laeyr
  // 2. remove only the layers which are set disabled in @conf
  // 3. invoke getLayer only for those enalbed in @conf
  // 4. as mush as graceful to reorder the map's layers.
  public setLayers(conf)
  {
    const in_right_pos = (arr, idx, elem) => arr.getLength() > idx && arr.item(idx) === elem;

    const map_layers = this._map.getLayers();

    // remove map layers disabled in conf
    const disableds = new Set(conf.filter(({checked})=>!checked).map(({id})=>id));
    map_layers.getArray()                                         // do not manipulate the underly array directly!
      .filter((layer) => disableds.has(LayerRepo.getId(layer)))   // a copy of layers needed to remove
      .forEach((layer) => this.unsetInteraction(map_layers.remove(layer)));   //remove and then unset its interaction

    // add enabled layers in the same order of cnf
    conf.filter(cnf => cnf.checked)
        .reverse()
        .forEach((cnf, idx) => {
          const layer = LayerRepo.get(cnf.id);
          if (!in_right_pos(map_layers, idx, layer)) {
            map_layers.remove(layer); //in case the layer is added but in the wrong place
            map_layers.insertAt(idx, layer);
            layer.setOpacity(cnf.opacity);
            if(layer.interactable)
              this.setInteraction(layer);
          }
        });
  }

////////////////////////////////////////////////////////////////

  // if no layer id provided, means the user's gpx layer;
  private _getLayer(id)
  {
    const layer = id? LayerRepo.get(id): this._gpx_layer;
    if (!layer)
      console.error(`_getLayer() error: layer ${id} not found`);
    return layer;
  }


  public setLayerOpacity(id, opacity)
  {
    this._getLayer(id)?.setOpacity(opacity);
  }

  public setLayerFilterable(id, filterable)
  {
    const layer = this._getLayer(id);
    if(layer){
      layer.getStyle().filterable = filterable;
      layer.changed();
    }
  }

  public setLayerInvisible(id, invisible)
  {
    const layer = this._getLayer(id);
    if(layer){
      layer.getStyle().invisible = invisible;
      layer.changed();
    }
  }

  /*
  private _setLayerStyleOptions(id, options){
    const layer = id? LayerRepo.get(id): this._gpx_layer;
    if (!layer)
      return console.error(`setLayerStyleOption() error: layer ${id} not found`, options);

    for(const [key, value] of Object.entries(options))
      layer.getStyle()[key] = value;

    layer.changed();
  }
  */

////////////////////////////////////////////////////////////////

  // to eanble:             add the layer
  // to disable:            remove the origianl layer
  // changed when eanbled:  remove the original layer && add the layer
  // changed when disabled: do nothing
  public setSpyLayer(spy) {
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
    if(LayerRepo.getId(layers.item(idx)) == 'SPY')  // either disabled or changed, it is needed to remove the original if any
      layers.removeAt(idx);

    if(spy.enabled)
      layers.insertAt(idx, this.createSpyLayer(spy.id));
  }

  private createSpyLayer(layer_id) {
    const spy_conf = Object.assign({}, Opt.getLayer(layer_id), { id: 'SPY' });
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
      const mousepos = Opt.rt.mousepos;
      if (spy.enabled && mousepos) {
        // only show a circle around the mouse
        var [px, py] = getRenderPixel(event, mousepos);

        //@why the sample code so complexed ??
        //var offset = getRenderPixel(event, [mousepos[0] + spy.radius, mousepos[1]]);
        //var canvasRadius = Math.sqrt(Math.pow(offset[0] - px, 2) + Math.pow(offset[1] - py, 2));
        //ctx.arc(px, py, canvasRadius, 0, 2 * Math.PI);
        //ctx.lineWidth = 5 * canvasRadius / spy.radius;
        ctx.arc(px, py, spy.radius, 0, 2 * Math.PI);
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
    const openfiles = <HTMLInputElement> document.querySelector('input#open-files');
    openfiles.accept = this._formats_types.join(",");
    openfiles.addEventListener("change", (e: InputEvent) => {
      Array.from(openfiles.files).forEach(file => {
        this.readFileFeatures(file.name, file);
      });
    });
    ctx.setItem(".item-open-files", (el) => {
      openfiles.click();
    });

    ctx.setItem(".item-gmap", (el) => {
      el.href = gmapUrl(this._ctxmenu_coord);
    });

    ctx.setItem(".item-add-wpt", (el) => {
      this._gpx_layer.createWaypoint(this._ctxmenu_coord);
    });

    ctx.setItem(".item-apply-sym", (el) => {
      this._gpx_layer.getWaypoints().forEach(wpt => {
        const symbol = matchRules(wpt.get('name'));
        if (symbol) wpt.set('sym', symbol.name);
      });
    });

    ctx.setItem(".item-promote-trksegs", (el) => {
      this._gpx_layer.promoteTrksegs();
    });

    ctx.setItem(".item-save-gpx", (el) => {
      const xml = this._gpx_layer.genXml();
      saveTextAsFile(xml, Opt.rt.gpx_filename || 'my.gpx', 'application/gpx+xml');
    });
  }
}
