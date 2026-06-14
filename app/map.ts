import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { defaults as defaultControls, ScaleLine, OverviewMap, ZoomSlider, Control } from 'ol/control';
import { defaults as defaultInteractions, DragAndDrop, Modify, Select } from 'ol/interaction';
import { Map, View, } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer, Graticule } from 'ol/layer';
import { Vector as VectorSource, OSM } from 'ol/source';
import { getRenderPixel } from 'ol/render';
import { platformModifierKeyOnly } from 'ol/events/condition';
import { Geometry } from 'ol/geom';
import { createEmpty as createEmptyExtent, extend as extendExtent, containsCoordinate } from 'ol/extent';

import { GeoJSON, IGC, KML, TopoJSON } from 'ol/format';
import PhotoFormat from './ol/format/Photo';
import GPXFormat from './ol/format/GPX';
import GPXLayer from './ol/layer/GPX';
import GPXStyle from './ol/style/GPX';
import { fixGPXNamespace, isTrkFeature } from './ol/gpx-common';

import Opt from './opt';
import { splitn, mapFind } from './lib/utils';
import { saveTextAsFile } from './lib/dom-utils';
import { throttle } from 'lodash';
import { buildFeatureData, gmapUrl, setGpxFilename } from './common';
import { CtxMenu } from './ctx-menu';
import * as LayerRepo from './layer-repo';
import { PtPopupOverlay } from './pt-popup';
import { matchRules } from './sym'
import { EleProfileCanvas } from './lib/ele-profile-canvas';

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

const calcSpeedKm = (dd, dt) => (dt > 0)? (dd / dt)*3.6: 0;

// 運動類型     建議 windowSizeSec  說明
// 爬山 / 健行  15 ~ 30 秒          速度慢、容易受樹蔭/峽谷地形遮蔽，需要最長的視窗來平滑數據。
// 跑步 / 慢跑  8 ~ 12 秒           速度中等，10 秒左右通常是運動 App（如 Strava）的黃金平衡點。
// 公路單車     3 ~ 5 秒            速度極快，視窗如果太長，會反應不出轉彎或短衝刺的瞬間速度變化。

function calcSmoothedSpeed(points, win_size_sec = 0) {
  if (!points?.length) return [];

  // 1. set the seconds of window size
  if(!win_size_sec){
    const all_0 = points[0];
    const all_n = points.at(-1);
    const all_avg = calcSpeedKm(all_n.dist - all_0.dist, all_n.time - all_0.time);
    win_size_sec = (all_avg > 15)? 5:   // bike
                   (all_avg > 8)? 10:   // run
                                  20;   // walk
  }

 // 2. 計算平滑速度（時間視窗法）
  points.forEach((curr, idx) => {

    // 2.1 往前尋找符合時間視窗邊界的點（例如尋找 10 秒前的那個點作為起點）
    let win_idx;
    for(win_idx = idx; win_idx > 0; win_idx--) {
      if((curr.time - points[win_idx - 1].time) > win_size_sec)
        break; // 超過時間視窗了，停止往前找
    }

    // 2.2 用整個時間視窗的總距離與總時間，計算該點的平滑速度; 否則計算原始速度
    const start_idx = (win_idx < idx)? win_idx: idx -1;  // smoothed point (平滑速度) or previous point (原始速度)
    const start_pt = points.at(start_idx);
    const speed = start_pt?  calcSpeedKm(
        curr.dist - start_pt.dist,
        curr.time - start_pt.time
      ): 0;

    // 2.3 assign
    curr.speed = speed;
  });

  return points;
}

function unionExtents(extents){
  const empty = createEmptyExtent();
  return extents.reduce((res, ext) => extendExtent(res, ext), empty);
}

////////////////////////////////////////////////////////////////

export class AppMap{
  _map: Map
  _gpx_layer: GPXLayer;   //a gpx adapter for VectorLayer
  //TODO: wrapper the eleprof code
  _eleprof_details: HTMLDetailsElement;
  _eleprof_canvas: EleProfileCanvas;
  _eleprof_open_once = false;
  _ctxmenu_coord;
  _formats: any[] = [
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

  private _feature_at_pixel_opts = {
    hitTolerance: window.matchMedia("(pointer: coarse)")? 5: 2,   // more tolerant for touch screen
    layerFilter: (layer) => !(layer instanceof Graticule),  // ignore grid lines
  }

  public constructor(target: string){
    this.init(target);
    this.initEvents();
  }

  private init(target: string)
  {
    const drag_interaciton = new DragAndDrop({
      formatConstructors: this._formats,
    });

    this._map = new Map({
      target,
      controls: defaultControls().extend([
        new ScaleLine({
          //bar: true,
          //text: true,
          maxWidth: 100,
        }),
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

    // TODO: 之後移到 Opt const data
    const move_animate_sec = 500; //ms
    const move_threshold = 0.75;
    const jump_threshold = 3.00;

    // elevation profile canvas
    this._eleprof_details = document.querySelector('details.ele-profile');
    this._eleprof_canvas = new EleProfileCanvas(this._eleprof_details.querySelector('canvas'))
        .setListener('hover', (pt) => {
          this._gpx_layer.setPseudoWpt('trksegpt', pt.coord, {
            sym: 'Point',
            scale: 0.4,
          });

          // move to the coord if out of the view extent
          const view = this._map.getView();
          if(view.getAnimating())
            return;

          const size = this._map.getSize();
          const move_size = size.map(v => v * move_threshold);
          const jump_size = size.map(v => v * jump_threshold);

          if(!containsCoordinate(view.calculateExtent(jump_size), pt.coord))
            return view.setCenter(pt.coord);

          if(!containsCoordinate(view.calculateExtent(move_size), pt.coord))
            return view.animate({center: pt.coord, duration: move_animate_sec});
        })
        .setListener('unhover', () => {
          this._gpx_layer.rmPseudoWpt('trksegpt');
        });
    this._eleprof_canvas.draw([{  // if someone really want to see an empty chart, give a one.
      coord: this._map.getView().getCenter(),
      ele: 0,
      dist: 0,
      speed: 0,
    }]);

    //create layer from features, and add it to the map
    drag_interaciton.on('addfeatures', (e) => {
      setGpxFilename(e.file.name);
      this.addGpxFeatures(e.features);
    });
  };

  // ----------------------------------------------------------------

  // for input file or http response
  public async readFeatures(blob: Blob|File|Response){
    try{
      const arraybuf = await blob.arrayBuffer();
      const features = this._readFeatures(arraybuf);
      this.addGpxFeatures(features);
    }
    catch(e){
      console.error('read features error', e);
    }
  }

  public readTextFeatures(text: string){
    try{
      const features = this._readFeatures(undefined, text);
      this.addGpxFeatures(features);
    }
    catch(e){
      console.error('read text featuers error', e);
    }
  }

  // This function is much like the ability to read features from drag-and-drop files, but here the from file content.
  //    ref: ol/interaction/DragAndDrop.js
  private _readFeatures(arrbuf?: ArrayBuffer, text?: string)
  {
    text = text || new TextDecoder().decode(arrbuf);
    text = fixGPXNamespace(text);   // NOTE: a workaroud for the dirty GPX files with 'https' namespace

    return mapFind(this._formats, format => {
      const formatter = (typeof format === 'function') ? new format() : format;
      const data = (formatter.getType() == 'arraybuffer') ? arrbuf : text;
      if(!data) return null;   // if arraybuffer is required but only text provided
      try {
        return formatter.readFeatures(data, {
          featureProjection: this._map.getView().getProjection(),
        });
      }
      catch (e) {
        // the error is normal in the try-and-error process
        // console.debug(`'${formatter.constructor.name}' read features error: ${e.message}`);
        return null;
      }
    }, features => {
      return features && features.length > 0;
    });
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

  // ----------------------------------------------------------------

  private initEvents() {
    const map = this._map;

    map.on('pointermove', throttle((e) =>{
      if (e.dragging)
        return;
      this.hoverFeatures(e);
    }, 150));

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
    //e.map.getTargetElement().style.cursor = this._getFeatures(e).length? 'pointer': '';  // NOTE: too heavy to use
    e.map.getTargetElement().style.cursor = this._existsFeature(e)? 'pointer': '';
  }

  private showFeatures(e) {
    const pt_popup = e.map.getOverlayById('pt-popup') as PtPopupOverlay;

    //hide the overlay anyway
    pt_popup.hide();

    const features = this._getFeatures(e);
    features.forEach(feature => {
      switch (feature.getGeometry().getType()) {
        case 'Point': {   // Waypoint or Track point
          const { feature: feat, data } = buildFeatureData(feature);

          let eleprof_open;
          const show_eleprof_only =
            data.trk &&
            (eleprof_open = this.openEleprofCanvas()) &&  // eleprof is visible (this can open canvas, so do it only if trk is true.)
            !this._gpx_layer.hasPseudoWpt('trksegpt');    // but not yet to show

          // wpt/trkpt popup
          if(!show_eleprof_only)
            pt_popup.popContent(feat, data);

          // ele profile
          const { trkseg } = data;
          if(eleprof_open && trkseg?.pt_idx >= 0){
            trkseg.points = calcSmoothedSpeed(trkseg.points);   //calculate speed
            this._eleprof_canvas.draw(trkseg.points, trkseg.pt_idx);
          }

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
  };

  // check if auto to open eleprof canvas or not
  // and return the final status
  private openEleprofCanvas(): boolean{
    let open = this._eleprof_details.open

    // already open
    if(open){
      this._eleprof_open_once = true; 
      return open;
    }

    // auto open by opt
    open = (() => {
      switch (Opt.eleprof_auto) {
        case 'none': return false;
        case 'always': return true;
        case 'once':
          if (!this._eleprof_open_once) {
            this._eleprof_open_once = true;
            return true;
          }
          return false;
        default:
          return false;
      }
    })();

    // to open
    if(open)
      this._eleprof_details.open = open;
    return open;
  }

  // the function is a lightweight version of _getFeatures(),
  // it is used only to determine whether there is any feature at the pixel
  private _existsFeature(e){
    return e.map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
      //console.log("get feature: ", {feature, layer});
      return true;   // stop after find the first feature found
    }, this._feature_at_pixel_opts);
  };

  private _getFeatures(e) {
    const featuresHas = (f, predicate) => f.get('features')?.some(predicate);

    const isTrk       = f => f.getGeometry().getType() == 'MultiLineString';
    const isPt        = f => f.getGeometry().getType() === 'Point';
    const isTrkpt     = f => isPt(f) && featuresHas(f, isTrk);
    const isHiddenPt  = f => isPt(f) && featuresHas(f, isPt);    // when a wpt is not visible or covered by other wpts
    const hasWptProp  = f => f.get('name') || f.get('desc') || f.get('sym');
    const isWpt       = f => isPt(f) && hasWptProp(f);
    const isRoWpt     = f => isWpt(f) && f.get('readonly');
    const isPseudoWpt = f => isWpt(f) && f.get('pseudo') || featuresHas(f, isPseudoWpt);  // recursively check: the feature is NOT A WPT itself, but its 'features' HAS a pseudo-wpt. (why?)


    // NOTE: not use forEach..., it is hard to point to Wpt if there are Trkpt in the same place. (Why?)
    //const pixel = e.map.getEventPixel(e.originalEvent); // TODO: what is the diff between 'originalevent' and 'event'?
    //const hit = e.map.forEachFeatureAtPixel(pixel, handleFeature);
    //e.map.getTargetElement().style.cursor = hit? 'pointer': '';

    const features = e.map.getFeaturesAtPixel(e.pixel, this._feature_at_pixel_opts);
    if(features.length == 0)
      return features;

    const [p, h, r, w, t, _] = splitn(features, isPseudoWpt, isHiddenPt, isRoWpt, isWpt, isTrkpt);
    //console.debug({w, t, r, h, p});
    return [w, t, r, h, p].find(pts => pts.length > 0) || [];   //priority: wpt > trkpt > ro_wpt > hidden_wpt > pseudo_wpt > track;
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
    return this._map.getLayers().item(this.indexOfPseudoGpxLayer()) as VectorLayer<VectorSource<Feature<Geometry>>>;
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

  public setLayerSeeable(id, seeable, seefilter?)
  {
    if(seeable === undefined && seefilter === undefined) return;

    const layer = this._getLayer(id);
    if(layer){
      if(seeable !== undefined) layer.getStyle().seeable = seeable;
      if(seefilter !== undefined) layer.getStyle().seefilter = seefilter;
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
    const wpt = this._gpx_layer.setPseudoWpt('crosshair', coord);
    this._map.getView().fit(wpt.getGeometry(), {maxZoom: 16});
  }

  public setPreviewWpt(coord){
    // not bothered if not in the view
    const extent = this._map.getView().calculateExtent();
    if(!containsCoordinate(extent, coord))
      return;

    //console.debug('set preview wpt', coord);
    this._gpx_layer.setPseudoWpt('preview', coord, {
      sym: 'Star',
      scale: 0.6,
    });
  }

  public rmPreviewWpt(){
    //console.debug('rm preview wpt');
    this._gpx_layer.rmPseudoWpt('preview');
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
    openfiles.addEventListener("change", (e) => {
      Array.from(openfiles.files).forEach(file => {
        setGpxFilename(file.name);
        this.readFeatures(file);
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

    ctx.setItem(".item-split-tracks-days", (el) => {
      this._gpx_layer.splitTracksDays();
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
