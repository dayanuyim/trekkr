import Opt from './opt';

export class Sidebar{

    _base: HTMLElement;
    _spy_btn: HTMLButtonElement;
    //_goto_btn: HTMLButtonElement;
    _listeners = {}

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base     = el;
        this._spy_btn  = el.querySelector<HTMLButtonElement>('button.spy-btn');
    }

    private init(){
        //init spy
        this._spy_btn.classList.toggle('active', Opt.spy.enabled);
        this._spy_btn.title = Opt.tooltip.btn_spy;
        this._spy_btn.addEventListener('click', e =>{
            const enabled = this._spy_btn.classList.toggle('active');
            Opt.update({enabled}, 'spy');
            this._listeners['click']?.();
        });

        //this._goto_btn.classList.add('active');
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggleSpy(){
        this._spy_btn.click();
        return this;
    }
}

export class Topbar{

    _base: HTMLElement;
    _goto_btn: HTMLButtonElement;
    _listeners = {}

    constructor(el: HTMLElement){
        this.initElements(el);
        this.init();
    }

    private initElements(el: HTMLElement){
        this._base     = el;
        this._goto_btn  = el.querySelector<HTMLButtonElement>('button.goto-btn');
    }

    private init(){
        this._goto_btn.onclick = e =>{
            this._goto_btn.classList.toggle('active');
        };
    }

    public setListener(event, listener){
        this._listeners[event] = listener;
        return this;
    }

    public toggleGoto(){
        this._goto_btn.click();
        return this;
    }
}
