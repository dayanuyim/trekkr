import Opt from './opt';

export class Sidebar{

    _base: HTMLElement;
    _btn_spy: HTMLButtonElement;
    _listeners = {}

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base    = el;
        this._btn_spy = el.querySelector<HTMLButtonElement>('button.btn-spy');
    }

    private init(){
        //init spy
        this._btn_spy.classList.toggle('active', Opt.spy.enabled);
        this._btn_spy.title = Opt.tooltip.btn_spy;
        this._btn_spy.addEventListener('click', e =>{
            const enabled = this._btn_spy.classList.toggle('active');
            Opt.update({enabled}, 'spy');
            this._listeners['click']?.();
        });
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggleSpy(){
        this._btn_spy.click();
        return this;
    }
}
