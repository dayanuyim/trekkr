// fu(element) => fn(event)
export const listenify = (fn, selector?) => {
    return (e) => {
        let el = e.currentTarget;
        if(selector)
            el = el.closest(selector);
        return fn(el);
    }
};

// check a checkbox, and fire the 'change' event
export function checkAndFire(el: HTMLInputElement, checked: boolean){
    el.checked = checked;
    el.dispatchEvent(new Event('change'));
}

// Binding the 3 events for Hightlight/Unhighlight/Execution of an operation
// This let a user can "peek" the op will apply to which targets by mouse hover.
export const addPeekOpEvents = (el: Element, listeners)=>{
    el.addEventListener('mouseenter', listeners.over);
    el.addEventListener('mouseleave', listeners.gone);
    el.addEventListener('click', listeners.exec);
};

const fetchJson = async (method, url, data=null) => {
    try {
        // Default options are marked with *
        const option: RequestInit = {
            method, // *GET, POST, PUT, DELETE, etc.
            headers: {
                'user-agent': 'Mozilla/4.0 TRK MEMO',
                'content-type': 'application/json'
            },
            //body: JSON.stringify(data), // must match 'Content-Type' header
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, same-origin, *omit
            mode: 'cors', // no-cors, cors, *same-origin
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // *client, no-referrer
        };
        if(data)
            option['body'] = JSON.stringify(data);

        const resp = await fetch(url, option);
        return resp.json();
    }
    catch (error) {
        return { error };
    }
}

export const fetcher = {
    get: (url) => fetchJson('GET', url),
    post: (url, data) => fetchJson('POST', url, data),
    put: (url, data) => fetchJson('PUT', url, data),
    delete: (url) => fetchJson('DELETE', url),
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
/*
CSS to Show/Hide
div.hidden{
	display: none;
}
*/

// A special usage of tag()
export const hide = (el, cls='hidden') => tag(el, cls);
export const show = (el, cls='hidden') => untag(el, cls);
export const isHidden = (el, cls='hidden') => isTagged(el, cls);
export const showIf = (cond, el, cls='hidden') => { cond? show(el, cls): hide(el, cls) };
export const showToggle = (el, cls='hidden') => showIf(isHidden(el, cls), el, cls);

/*
CSS to Animate to Show/Hide
============================================================================
div{
    max-height: 5em;
    transition: max-height 150ms ease-in-out;
}

div.erased {
	max-height: 0;
	overflow: hidden;
    transition: max-height 350ms ease-in-out;
}
----------------------------------------------------------------------------
*/
export const disappear = (elem) => { if(elem) elem.classList.add("erased"); }
export const appear = (elem) => { if(elem) elem.classList.remove("erased"); }
export const isDisappear = (elem) => { return elem && elem.classList.contains("erased"); }
export const isAppear = (elem) => { return !isDisappear(elem);}

/*
____________________________________________________________________________
div{
    display: block;
	height: auto;
}

div.hide {
    display: none;
	height: 0;
	overflow: hidden;
	transition: height 400ms ease-in-out;
}
----------------------------------------------------------------------------
// Show an element
export const show = function (elem) {

	// Get the natural height of the element
	var getHeight = function () {
		elem.style.display = 'block'; // Make it visible
		var height = elem.scrollHeight + 'px'; // Get it's height
		elem.style.display = ''; //  Hide it again
		return height;
	};

	var height = getHeight(); // Get the natural height
	elem.classList.remove('hide'); // Make the element visible
	elem.style.height = height; // Update the max-height

	// Once the transition is complete, remove the inline max-height so the content can scale responsively
	window.setTimeout(function () {
		elem.style.height = '';
	}, 350);

};

// Hide an element
export const hide = function (elem) {

	// Give the element a height to change from
	elem.style.height = elem.scrollHeight + 'px';

	// Set the height back to 0
	window.setTimeout(function () {
		elem.style.height = '0';
	}, 1);

	// When the transition is complete, hide it
	window.setTimeout(function () {
		elem.classList.add('hide');
	}, 350);
};
export const isHidden = function (elem) {
    return elem.classList.contains('hide'); 
}

// Toggle element visibility
export const toggle = function (elem, timing)
{
	if (isHidden) 
        show(elem);
    else
		hide(elem);
};
*/

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


/**
 * @param {String} HTML representing any number of sibling elements
 * @return {NodeList} 
 */
export function htmlToElements(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.childNodes;
}

export const prevSibling = (elem: Element, selector) => {
	if(elem){
		while((elem = elem. previousElementSibling)){
			if(elem.matches(selector))
				return elem;
		}
	}
	return undefined;
}

export const nextSibling = (elem, selector) => {
	if(elem){
		while((elem = elem.nextElementSibling)){
			if(elem.matches(selector))
				return elem;
		}
	}
	return undefined;
}

export const tuneTextAreaRows = function() {
	let conf;
	return function (el: HTMLTextAreaElement, to_recheck_conf = false) {
		if (to_recheck_conf || !conf) {
			conf = detectTextAreaConf(el);
			console.log('text area conf: ', conf);
		}

		const min = Number(el.getAttribute('data-min-rows')) | 1;
		el.rows = min;
		const inc = Math.ceil((el.scrollHeight - conf.baseScrollHeight) / conf.rowHeight);
		//console.log(`row min: ${min}, inc: ${inc}`);
		el.rows += inc;
	}
}();

function detectTextAreaConf(el: HTMLTextAreaElement)
{
    const saved = el.value;

    el.value = '';
    const baseScrollHeight = el.scrollHeight;
    el.value = '\n';
    const rowHeight = el.scrollHeight - baseScrollHeight;

    el.value = saved;

    return {
        baseScrollHeight,
        rowHeight,
    };
}

/*
    @tips: ["show-when-normal", "show-when-toggled"]
*/
export function toggleButton(btn: Element, tips=undefined, toggled?, callback?)
{
    // undefind means toggle
    if(toggled === undefined || toggled === null)
        toggled = !isTagged(btn, 'istoggled'); 

    if(tips){
        const [tip_on_normal, tip_on_toggled] = tips;
        btn.setAttribute('data-tooltip', toggled ? tip_on_toggled : tip_on_normal);
    }

    tagIf(toggled, btn, 'istoggled');
    if(callback) callback(toggled);
}

export function getOffset(el: Element) {
	const rect = el.getBoundingClientRect();
	return {
		left: window.scrollX + rect.left,
		top: window.scrollY + rect.top,
		height: rect.height,
		width: rect.width,
	}
}
