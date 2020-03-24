'use strict';

export function clearChildren(el: Element){
    while(el.firstChild)
        el.removeChild(el.lastChild);
}

// like innerHTML, but Element version
export function innerElement(parent: Element, child: Element){
    clearChildren(parent);
    parent.insertAdjacentElement('afterbegin', child);
}

/**
 * @param {String} HTML representing a single element
 * @return {Element}
 */
export function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return <Element>template.content.firstChild;
}

//////////////////////////////////////////////////////////////////////
const checkTag = (el, cls: string)=>{
	if(!el){
		//throw 'showing element not existed';
		console.error('showing element not existed')
		return false;
	}
	if(!cls || cls.startsWith(".")){
		console.error(`Invalid class '${cls}' to hide`);
		return false;
	}
	return true;
}
export const untag = (el, cls) => {
	if(checkTag(el, cls))
	 	el.classList.remove(cls);
}
export const tag = (el, cls) => {
	if(checkTag(el, cls))
		el.classList.add(cls);
}
export const isTagged = (el, cls) => {
	return checkTag(el, cls) &&
		el.classList.contains(cls);
}
export const tagIf = (cond, el, cls) => {
	cond? tag(el, cls): untag(el, cls);
}
export const taggle = (el, cls) => {   //toggle tag
	tagIf(!isTagged(el, cls), el, cls);
}

//////////////////////////////////////////////////////////////////////