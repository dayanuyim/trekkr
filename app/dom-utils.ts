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