import Opt from './opt';

export class Sidebar{

    _base: HTMLElement;
    _btn_spy: HTMLButtonElement;
    _click_listener: CallableFunction;

    set onclick(listener){ this._click_listener = listener; }

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
            if(this._click_listener) this._click_listener();
        });
    }

    public toggleSpy(){
        this._btn_spy.click();
    }
}
