import { GPX as _GPX } from 'ol/format';
import {isTrkFeature} from '../gpx-common';

function _getNode(node, name){
  const children = node.childNodes;
  for(let i = 0; i < children.length; i++)
      if(children[i].nodeName == name)
        return children[i];
  return undefined;
}

function getNodeContent(node, ...names)
{
  for(let i = 1; i < arguments.length; i++){
    node = _getNode(node, arguments[i]);
    if(!node)
      break;
  }
  return node? node.textContent: undefined;
}

// GPX format which reads extensions node
class GPX extends _GPX {
  _readonly: boolean;
  constructor(options?){
    super(Object.assign({
      readExtensions: (feat, node) => {
        if(!node) return;
        if(isTrkFeature(feat)) {   //set color for track if any
          const color = getNodeContent(node, "gpxx:TrackExtension", "gpxx:DisplayColor");
          if(color) feat.set('color', color);
        }
      },
    }, options));
    this._readonly = !!(options && options.readonly);
  }

  readFeature(source, options?){
    const feature = super.readFeature(source, options)
    feature.set('readonly', this._readonly)
    return feature;
  }

  readFeatures(source, options?){
    const features = super.readFeatures(source, options)
    features.forEach(f => f.set('readonly', this._readonly))
    return features;
  }
}

export default GPX;