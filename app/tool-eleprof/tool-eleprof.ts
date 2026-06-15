import * as Handlebars from 'handlebars/dist/handlebars';
import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';

import './tool-eleprof.css';
import EleprofCanvas from './eleprof-canvas';

import Opt from '../opt';

const toolHTML = Handlebars.compile(`
    <details class="">
        <summary><i class="fa-solid fa-chart-area ctrl-btn"></i></summary>
        <canvas></canvas>
    </details>
`);

export default class ToolEleprof{
    _base: HTMLElement;
    _canvas: HTMLCanvasElement;
    _details: HTMLDetailsElement;

    open_once = false;
    canvas: EleprofCanvas;

    _listeners = {};

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base = el;
        this._base.classList.add('tool-eleprof');
        this._base.insertAdjacentHTML('beforeend', toolHTML());

        this._details = this._base.querySelector('details');
        this._details.addEventListener('toggle', (e) => {
            if(this._details.open)
                this._listeners['open']?.();
            else
                this._listeners['closed']?.();
        });

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

    p
    public draw(points, hover_idx=-1){
        this._canvas.classList.add('active');  //enable pointer-events by css
        this.canvas.draw(points, hover_idx);
    }

    // try to open the canvas by config, 
    // and return the final status
    public tryOpening(): boolean {
        let open = this._details.open

        // already open
        if (open) {
            this.open_once = true;
            return open;
        }

        // open or not by config
        open = (() => {
            switch (Opt.eleprof_auto) {
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