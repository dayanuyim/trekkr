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
export function tablink(tab_q, init_idx=0, base_el=document.body)
{
    const active = 'active';

    // get tabs
    const tabs = Array.from(base_el.querySelectorAll(tab_q));

    // get tab contents
    //const cons = base_el.querySelectorAll(content_q);
    const cons = tabs.map(tab => {
        const con = base_el.querySelectorAll(tab.dataset.content);  // query tabcontent by tab's data-content
        if(con.length == 0)
            return console.error(`No tabcontent '${tab.dataset.content}'`);
        if(con.length > 1)
            console.warn(`Multiple tabcontents found for '${tab.dataset.content}'`, {content: con});
        return con[0];
    });

    // tab click event
    tabs.forEach((tab, idx) => tab.addEventListener('click', e => {
        const choose = (el, i) => el.classList.toggle(active, i == idx);
        tabs.forEach(choose);
        cons.forEach(choose);
    }));

    // init click
    if(tabs.length){
        init_idx = Math.max(0, Math.min(init_idx, tabs.length-1));
        tabs[init_idx].click();
    }
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type: string, opt?){
    opt = Object.assign({
        quality: 0.85,
    }, opt);

    switch(type){
        case 'png':
            return await canvasToImgBlob(canvas, 'image/png', opt);
        case 'pdf':
            return await canvasToPdfBlob(canvas, opt);
        default: 
            throw new Error(`Unknown type ${type} for canvasToBlob to convert`);
    }
}

export function canvasToImgBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.85  ){
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed; check CORS or canvas size'));
    }, type, quality);
  });
}

//import { jsPDF } from 'jspdf';
export async function canvasToPdfBlob(canvas, opt?) {
    const { jsPDF } = await import('jspdf');  //dynamically loading

    const pdf = new jsPDF({
        orientation: (canvas.height >= canvas.width)? 'portrait': 'landscape',
        unit: 'mm',
        format: opt.pagesize?? 'a4',
        compress: true,
    });

    const imgData = canvas.toDataURL('image/png');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // 等比例縮放，完整放入 A4
    const scale =Math.min(          // mm/pixel
        pageWidth / canvas.width,
        pageHeight / canvas.height,
        opt.scale?? 1,
    );

    const width = canvas.width * scale;
    const height = canvas.height * scale;

    // 置中
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    pdf.addImage(imgData, 'PNG', x, y, width, height);
    return pdf.output('blob');
}

/*
function canvasBlobToPdf(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(reader.error);

        reader.onload = () => {
            try {
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // 取得圖片尺寸
                const img = new Image();

                img.onload = () => {
                    const scale = Math.min(
                        pageWidth / img.width,
                        pageHeight / img.height
                    );

                    const width = img.width * scale;
                    const height = img.height * scale;

                    pdf.addImage(
                        reader.result,
                        blob.type === 'image/jpeg' ? 'JPEG' : 'PNG',
                        (pageWidth - width) / 2,
                        (pageHeight - height) / 2,
                        width,
                        height
                    );

                    resolve(pdf.output('blob'));
                };

                img.onerror = reject;
                img.src = reader.result;
            } catch (error) {
                reject(error);
            }
        };

        reader.readAsDataURL(blob);
    });
}
*/

export function saveBlobAsFile(blob: Blob, filename: string) {
    const anchor = document.createElement('a');
    anchor.href = window.URL.createObjectURL(blob);
    anchor.download = filename
    anchor.click();
    setTimeout(()=>{
        window.URL.revokeObjectURL(anchor.href);
    }, 1000);
}

export function saveTextAsFile(text: string, filetype: string, filename: string) {
    const blob = new Blob([text], { type: filetype });
    saveBlobAsFile(blob, filename );
}

// Delay to enable button
// does it seem safe that elements share the same timer??
let __delay_enable_timer = null;
export function delayToEnable(el: HTMLButtonElement|HTMLInputElement, ms: number, escape?)
{
    el.addEventListener('mouseenter', e => {
        if(escape && escape())   // escape to dealy
            return;
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

const _key_enter_to_blur_listener = e => {
    if (e.key == "Enter") {
        e.preventDefault();
        e.target.blur();
    }
};

export function keyEnterToBlur(el: HTMLInputElement)
{
    el.addEventListener('keydown', _key_enter_to_blur_listener);
}

export function isEditableElement(el: EventTarget) {
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (el instanceof HTMLInputElement) {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types
    if (/text|email|number|password|search|tel|url/.test(el.type || '')) {
      return !(el.disabled || el.readOnly);
    }
  }
  if (el instanceof HTMLTextAreaElement) return !(el.disabled || el.readOnly);
  return false;
}

export function rafThrottle(callback) {
  let ticking = false;

  return function (...args) {
    // 如果瀏覽器還沒畫完上一幀，就直接攔截並跳過，不重複計算
    if (ticking) return;

    ticking = true;

    // 配合瀏覽器的重繪時間點（通常是 60Hz 或 120Hz）精準觸發
    window.requestAnimationFrame(() => {
      callback.apply(this, args);
      ticking = false; // 畫面更新完成，解鎖
    });
  };
}
