//import * as Handlebars from 'handlebars/dist/handlebars';
//import '@fortawesome/fontawesome-free/js/fontawesome';
//import '@fortawesome/fontawesome-free/js/solid';

import './tool-eleprof.css';
import EleprofCanvas from './eleprof-canvas';

const toolHTML = /*Handlebars.compile(*/`
    <details class="open-upward-x">
        <summary>
            <!--<i class="fa-solid fa-chart-area ctrl-btn"></i>-->
            <!--!Font Awesome Free v5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.-->
            <svg class="ctrl-btn" role="img" viewBox="0 0 512 512"><path fill="currentColor" d="M32 32c17.7 0 32 14.3 32 32l0 336c0 8.8 7.2 16 16 16l400 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L80 480c-44.2 0-80-35.8-80-80L0 64C0 46.3 14.3 32 32 32zM240 96c6.7 0 13.1 2.8 17.7 7.8L328.8 181.3 375 135c9.4-9.4 24.6-9.4 33.9 0l64 64c4.5 4.5 7 10.6 7 17l0 112c0 13.3-10.7 24-24 24l-304 0c-13.3 0-24-10.7-24-24l0-112c0-6 2.3-11.8 6.3-16.2l88-96c4.5-5 11-7.8 17.7-7.8z"></path></svg>
        </summary>
        <header>
            <span class="title"></span>
            <span class="subtitle"></span>
        </header>
        <canvas></canvas>
    </details>
`;//);

type OpenPolicy = 'none'|'always'|'once';

export default class ToolEleprof{
    _base: HTMLElement;
    _title: HTMLElement;
    _subtitle: HTMLElement;
    _canvas: HTMLCanvasElement;
    _details: HTMLDetailsElement;

    open_once = false;
    canvas: EleprofCanvas;

    _listeners = {};

    get open(): boolean { return this._details.open; }

    get title(): string { return this._title.textContent; }
    set title(val: string) { this._title.textContent = val; }

    get subtitle(): string { return this._subtitle.textContent; }
    set subtitle(val: string) { this._subtitle.textContent = val; }

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base = el;
        this._base.classList.add('tool-eleprof');
        this._base.insertAdjacentHTML('beforeend', toolHTML);

        this._details = this._base.querySelector('details');
        this._details.addEventListener('toggle', (e) => {
            if(this._details.open)
                this._listeners['open']?.();
            else
                this._listeners['closed']?.();
        });

        this._title = this._base.querySelector('header .title');
        this._subtitle = this._base.querySelector('header .subtitle');

        this._canvas = this._base.querySelector('canvas');
        this.canvas = new EleprofCanvas(this._canvas)
            .setListener('hover',   (pt) => this._listeners['hover']?.(pt))
            .setListener('unhover', (pt) => this._listeners['unhover']?.(pt));
    }

    private init(){
        this.canvas.draw([{  // if someone really want to see an empty chart, give a one.
            coord: [0, 0, 0, 0],
            ele: 0,
            dist: 0,
            speed: 0,
        }]);
    }

    public draw(points, hover_idx=-1){
        this._canvas.classList.add('active');  //enable pointer-events by css
        this.canvas.draw(points, hover_idx);
    }

    // try to open the canvas by config, 
    // and return the final status
    public tryOpening(policy: OpenPolicy): boolean {
        let open = this._details.open

        // already open
        if (open) {
            this.open_once = true;
            return open;
        }

        // open or not by config
        open = (() => {
            switch (policy) {
                case 'none': return false;
                case 'always': return true;
                case 'once':
                    if (!this.open_once) {
                        this.open_once = true;
                        return true;
                    }
                    return false;
                default:
                    return false;
            }
        })();

        // to open
        if (open)
            this._details.open = open;
        return open;
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }
}