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
        toggled = !btn.classList.contains('istoggled');

    if(tips){
        const [tip_on_normal, tip_on_toggled] = tips;
        btn.setAttribute('data-tooltip', toggled ? tip_on_toggled : tip_on_normal);
    }

    btn.classList.toggle('istoggled', toggled);
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

// w3c tab
export function tablink(tab_q, content_q, init_idx=0)
{
    const cls = 'active';

    const tabs = document.body.querySelectorAll<HTMLButtonElement>(tab_q);
    const contents = document.body.querySelectorAll(content_q);

    tabs.forEach(tab => tab.addEventListener('click', e => {
        const content = document.getElementById(tab.getAttribute('data-content'));  // link tabcontent by id
        tabs.forEach(el => el.classList.toggle(cls, el == tab));
        contents.forEach(el => el.classList.toggle(cls, el == content));
    }));

    if(tabs.length > init_idx)
        tabs[init_idx].click();
}

export function saveTextAsFile(textToWrite, fileNameToSaveAs, fileType) {
    let textFileAsBlob = new Blob([textToWrite], { type: fileType });
    let downloadLink = document.createElement('a');
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = 'Download File';

    if (window.webkitURL != null) {
        downloadLink.href = window.webkitURL.createObjectURL(
            textFileAsBlob
        );
    } else {
        downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
    }

    downloadLink.click();
}

// Delay to enable button
// does it seem safe that elements share the same timer??
let __delay_enable_timer = null;
export function delayToEnable(el: HTMLButtonElement|HTMLInputElement, ms: number)
{
    el.addEventListener('mouseenter', e => {
        el.disabled = true;
        el.style.cursor = 'wait';
        if(__delay_enable_timer) clearTimeout(__delay_enable_timer);
        __delay_enable_timer = setTimeout(()=>{
            __delay_enable_timer = null;
            el.disabled = false;
            el.style.cursor = 'pointer';
        }, ms);
    });
}
