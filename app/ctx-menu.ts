
export class CtxMenu {
  _base: HTMLElement;
  _menu: HTMLElement;

  constructor(base: HTMLElement, menu: HTMLElement){
    this._base = base;
    this._menu = menu;
  }

  public show(evt: MouseEvent): void {
    evt.preventDefault();

    const {right: baseRight, bottom: baseBottom} = this._base.getBoundingClientRect();
    const x = Math.min(mouseX(evt), baseRight  - this._menu.clientWidth);   //limit x
    const y = Math.min(mouseY(evt), baseBottom - this._menu.clientHeight);  //limit y
    this._menu.style.left = `${x}px`;
    this._menu.style.top = `${y}px`;

    //this._menu.classList.add("visible");
    this._menu.classList.remove("visible");
    setTimeout(()=> this._menu.classList.add("visible"));
  }

  public hide(evt: MouseEvent) {
    if ((evt.target as HTMLElement).offsetParent != this._menu)
      this._menu.classList.remove('visible');
  }
}


function mouseX(e){
  if(e.pageX) return e.pageX;
  if(e.clientX) return e.clientX + getScrollLeft();
  return 0;
}

function mouseY(e){
  if(e.pageY) return e.pageY;
  if(e.clientY) return e.clientY + getScrollTop();;
  return 0;
}

function getScrollLeft(){
  return document.documentElement.scrollLeft?
         document.documentElement.scrollLeft:
         document.body.scrollLeft;
}

function getScrollTop(){
  return document.documentElement.scrollTop ?
         document.documentElement.scrollTop :
         document.body.scrollTop;
}