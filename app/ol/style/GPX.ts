import { Icon as IconStyle, Circle as CircleStyle, RegularShape, Fill, Stroke, Style, Text } from 'ol/style';
import { Point } from 'ol/geom';

import ArrowHead from './ArrowHead';
import { def_trk_color } from '../gpx-common';
import { def_symbol, getSymbol } from '../../sym'
import { colorCode, matchRule } from '../../common';

import Opt from '../../opt';

function lowercase(val){
  return val? val.toLowerCase(): val;
}

// Waypoint Style ----------------------------------------------------------------

function wpt_name_style(text)
{
  let {fontsize, display, display_auto_zoom} = Opt.waypoint;
  fontsize = fontsize || 16;

  if(display == "none" ||
    (display == "auto" && Opt.zoom <= display_auto_zoom))
    return null;

  return new Text({
    text,
    textAlign: 'left',
    offsetX: 8,
    offsetY: -8,
    font: `normal ${fontsize}px "Noto Sans TC", "Open Sans", "Arial Unicode MS", "sans-serif"`,
    placement: 'point',
    fill: new Fill({color: '#fff'}),
    stroke: new Stroke({color: '#000', width: 2}),
  });
}

const white_circle_style = new Style({
  image: new CircleStyle({
    fill: new Fill({
      color: 'rgba(255,255,255,0.4)'
    }),
    radius: 20,
    stroke: new Stroke({
      color: '#f0f0f0',
      width: 1
    })
  }),
  zIndex: 8,
});


function _wpt_style(name, sym, scale=1)
{
  if(!sym){
    return new Style({
      image: new CircleStyle({
        fill: new Fill({
          color: 'rgba(255,255,0,0.4)'
        }),
        radius: 5,
        stroke: new Stroke({
          color: '#ff0',
          width: 1
        })
      }),
      text: wpt_name_style(name),
      zIndex: 9,
    });
  }

  return new Style({
    image: new IconStyle({
      src: getSymbol(sym).path(64),
      //rotateWithView: true,
      //size: toSize([32, 32]),
      //opacity: 0.8,
      //anchor: sym.anchor,
      scale: 0.5 * scale,
    }),
    text: wpt_name_style(name),
    zIndex: 9,
  });
}

function filterWpt(feature){
  //not match if finding any rule does not match
  const notmatch = ['name', 'desc', 'sym'].find((kind)=>{
    const rule = Opt.filter.wpt[kind];
    return rule.enabled && !matchRule(rule, lowercase(feature.get(kind)));
  });
  return !notmatch;
}

const feat_prop = (feature, key, def_value?) => {
  const value = feature.get(key);
  if(!value && def_value){
    feature.set(key, def_value);
    return def_value;
  }
  return value;
}

const wpt_style = (feature, options?) => {
  options = options || {};
  if(!feature.get('pseudo')){  //normal wpt
    if(options.hidden) return null;
    if((Opt.filter.force || options.filterable) && !filterWpt(feature)) return null;
  }

  const name = feat_prop(feature, 'name');
  const sym =  feat_prop(feature, 'sym', def_symbol.name); // set default symbol name if none. Although 'sym' is not a mandatory node for wpt, having one helps ui display for edit.
  const scale = options.scale || 1;
  const style = _wpt_style(name, sym, scale);

  return feat_prop(feature, 'image')?
    [white_circle_style, style]:
    style;
}

// Track Style ----------------------------------------------------------------
const outline_color = (color) => {
  switch(color){
    case 'lightgray': return '#ededed';
    default: return 'lightgray';
  }
}

// the math from: https://openlayers.org/en/latest/examples/line-arrows.html
const arrow_head_rad = (start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const rotation = Math.atan2(dy, dx);
  return Math.PI/2 - rotation;
}

const arrow_head_style_gen = (color) => {
  const sqrt3 = 1.7320508075688772;
  const shaft_width = 3;                                 // this is the width of track line
  const radius = Math.max(1, Math.round(Opt.zoom/1.5));  // enlarge when zoom in

  const fill =  new Fill({
    color: colorCode(color),
  });

  const stroke = new Stroke({
    color: colorCode(outline_color(color)),
    width: 1,
    lineDash: [(sqrt3+1)*radius - (shaft_width/sqrt3), 2*sqrt3], // add outline, except the part to join the shaft
  });

  return (start, end) => new Style({
    geometry: new Point(end),
    image: new ArrowHead({    // like ➤ , head up
      points: 3,
      radius,
      fill,
      stroke,
      rotateWithView: true,
      rotation: arrow_head_rad(start, end),
    }),
    zIndex: 4,
  });
}

const track_line_style = color => {
  return new Style({
    stroke: new Stroke({
      color: colorCode(color),
      width: 3
    }),
    zIndex: 3,
  });
}

const track_styles = (feature, options?) => {
  const color = (feature.get('color') || def_trk_color).toLowerCase();
  const styles = [track_line_style(color)];

  //let { interval, max_num: arrow_num } = Opt.track.arrow;
  const arrow_num = Opt.track.arrow.max_num;
  const begin = 15;   // show arrows in the very ends seems useless, so skip it.
  const min_step = 20;
  if(arrow_num > 0){
    const arrow_head_style = arrow_head_style_gen(color);
    feature.getGeometry().getLineStrings().forEach(trkseg => {
      const coords = trkseg.getCoordinates();
      for(let i of genSequence(begin, coords.length, arrow_num, min_step))
        styles.push(arrow_head_style(coords[i-1], coords[i]));
    });
  }
  return styles;
}

// generate integer sequence from [first, end)
// if possible, pick the ends at first.
// @first, @end, @num should be integer
function genSequence(first, end, num, min_step)
{
  const last = end - 1;
  if(num <= 0) return [];
  if(num == 1) return [last];
  if(last < first) return [last];   // !! special case

  const seq = [];
  const step = Math.max(1, Math.max(min_step, (last - first) / (num - 1)));  // step >= 1
  for(let i = first; i < end; i += step)   // !! may have float number round-off error, use '< end', not '<= last'
    seq.push(Math.min(Math.round(i), last));

  // correct the last, may be caused by float number round-off error
  const diff = last - seq[seq.length - 1];
  if(diff > 0){
    if(diff <= 1 || seq.length >= num)
      seq[seq.length - 1] = last;
    else
      seq.push(last);
  }
  return seq;
}


// ----------------------------------------------------------------------------
// @not really use, just for in case
const route_style = (feature, options?) => {
  return new Style({
    stroke: new Stroke({
      color: '#f00',
      width: 3
    }),
    zIndex: 5,
  });
}

// ----------------------------------------------------------------------------
const empty_style = new Style({});

const gpx_style = (feature, options?) => {
  switch (feature.getGeometry().getType()) {
    case 'Point':           return wpt_style(feature, options);
    case 'MultiLineString': return track_styles(feature, options);
    case 'LineString':      return route_style(feature, options);
    default:                return empty_style;  //for fallback
  }
};

export function GPX(options?){
  // default options
  options = Object.assign({
    hidden: false,
    filterable: true,
    scale: 1,
  }, options)
  return (feature) => gpx_style(feature, options);
}
