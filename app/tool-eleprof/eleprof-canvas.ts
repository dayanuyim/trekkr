import { debounce } from 'lodash';
import { clamp, binsearchIndex } from '../lib/utils';
import { rafThrottle } from '../lib/dom-utils';
import { getLocalTimeByCoord } from '../common';

export default class EleprofCanvas {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _opts: any;

  private _points: any[];
  private _last_hover_idx = undefined;

  private _listeners = {};

  public setListener(event, listener){
      this._listeners[event] = listener;
      return this;
  }

  constructor(elem: HTMLCanvasElement, options=null){
    this._canvas = elem;
    this._ctx = elem.getContext('2d', { willReadFrequently: true });
    this._opts = Object.assign({
      slowIsDark: true,
      stopSpeed: 0.1,
      width: 0,
      height: 0,
      widthScale: 0.8,
      heightScale: 0.2,
      x_km_threshold: 2000,
      x_ticks: 6,
      y_ticks: 5,
      padding: {
        left: 60,
        right: 30,
        top: 40,
        bottom: 40
      }
    }, options)

    this.init();
  }

  private init(){
    this._canvas.addEventListener('mousemove', rafThrottle(event => {
      const rect = this._canvas.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;

      const hover_idx = this.findNearestPointIdx(offsetX);
      if(hover_idx >= 0)
        this.drawProfile(hover_idx);
    }));

    this._canvas.addEventListener('mouseleave', debounce(() => {
      this.drawProfile();
    }, 200));   //不能設太長，不然使用者馬上又回來，會出現hover消失的情況

    window.addEventListener('resize', debounce(() => {
      this.initState();
      this.drawProfile();
    }, 500));
  }

  private initState(){
    this._last_hover_idx = null;

    this._canvas.width  = this._opts.width  || this._opts.widthScale  * window.innerWidth;
    this._canvas.height = this._opts.height || this._opts.heightScale * window.innerHeight;
  }

  private findNearestPointIdx(offsetX) {
    if(!this._points?.length)
      return -1;

    const {padding} = this._opts;
    const plot_w = this._canvas.width - padding.left - padding.right;

    // 超出左右邊界，直接回傳第一或最後一個點
    if(offsetX < padding.left)
      return 0;

    if(offsetX > this._canvas.width - padding.right)
      return this._points.length - 1;

    // the target dist to find, mapped from mouse X position
    const max_dist = this._points.at(-1).dist;
    const dist = (offsetX - padding.left) / plot_w * max_dist;

    /*
    let nearest_idx = 0;
    let min_diff = Infinity;
    const points = this._points;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].dist - dist);

      if (diff < min_diff) {
        min_diff = diff;
        nearest_idx = i;
      }
    }
    */

    return binsearchIndex(this._points, (pt, idx, arr) => {
      return (dist >= pt.dist)? (dist - pt.dist) :  // return 0 if eql
             (dist > arr.at(idx -1)?.dist)? 0: -1; // return 0 if betwen idx-1 and idx
    });
  }

  public draw(points, idx=-1){
    this._points = points;   // set as the object property for later use in hover drawing
    this.initState();
    this.drawProfile(idx);
  }

  private drawProfile(hover_idx = -1) {
    if(!this._points?.length)
      return;

    // 避免重複繪製同一個 hover_idx, which can be null, -1, or a valid index
    if(this._last_hover_idx === hover_idx)
      return;

    this._last_hover_idx = hover_idx;

    const {width, height} = this._canvas;
    const {padding} = this._opts;

    const plot_w = width - padding.left - padding.right;
    const plot_y = height - padding.top - padding.bottom;
    const base_y = height - padding.bottom;

    const max_dist = this._points.at(-1).dist;
    const min_ele = Math.min(...this._points.map(p => p.ele)) || 0;
    const max_ele = Math.max(...this._points.map(p => p.ele)) || 10;

    const xScale = (dist) => padding.left + (dist / max_dist) * plot_w;
    const yScale = (ele) => padding.top + ((max_ele - ele) / (max_ele - min_ele || 1)) * plot_y;  // top is y-axis 0, thus (max_ele - ele), not (ele - min_ele)

    this.clearCanvas();
    this.drawGrid(xScale, yScale, min_ele, max_ele, max_dist, padding);
    //this.drawStopBands(xScale, padding);
    //this.drawElevationAreaBase(xScale, yScale, base_y);
    this.drawElevationArea(xScale, yScale, base_y);
    this.drawElevationLine(xScale, yScale);

    if (hover_idx != null && hover_idx >= 0) {
      const pt = this._points[hover_idx];
      this.drawHover(pt, xScale, yScale, padding);
      this._listeners['hover']?.(pt);
    }
    else{
      this._listeners['unhover']?.();
    }
  }

  private clearCanvas() {
    const { width, height } = this._canvas;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, width, height);
    //ctx.fillStyle = '#ffffff';
    ctx.fillStyle = 'rgba(255,255,255,.8)'
    ctx.fillRect(0, 0, width, height);
  }

  private drawGrid(xScale, yScale, min_ele, max_ele, max_dist, padding) {
    const ctx = this._ctx;
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';

    const {x_km_threshold, x_ticks, y_ticks,} = this._opts;

    ctx.textBaseline = 'alphabetic';  // 要設定，避免在其它地方被蓋掉

    // Y 軸高度格線
    for (let i = 0; i <= y_ticks; i++) {
      const ele = min_ele + ((max_ele - min_ele) * i) / y_ticks;
      const y = yScale(ele);

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(this._canvas.width - padding.right, y);

      ctx.stroke();

      ctx.fillText(`${Math.round(ele)} m`, 8, y + 4);
    }

    // X 軸距離格線
    const x_label = (d) => (max_dist > x_km_threshold)?
                            `${(d/1000).toFixed(1)} km`:
                            `${d.toFixed(0)} m`;

    for (let i = 0; i <= x_ticks; i++) {
      const dist = (max_dist * i) / x_ticks;
      const x = xScale(dist);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, this._canvas.height - padding.bottom);
      ctx.stroke();
      ctx.fillText(x_label(dist), x - 18, this._canvas.height - 15);
    }
  }

  private drawStopBands(xScale, padding) {
    const plotTop = padding.top;
    const plotBottom = this._canvas.height - padding.bottom;
    const plotHeight = plotBottom - plotTop;
    const ctx = this._ctx;
    const points = this._points;

    let begin_idx = null;

    for (let i = 0; i < points.length; i++) {
      const stopped = points[i].speed < this._opts.stopSpeed;

      if (stopped && begin_idx === null) {
        begin_idx = i;
      }

      if ((!stopped || i === points.length - 1) && begin_idx !== null) {
        const end_idx = stopped ? i : i - 1;

        const x0 = xScale(points[begin_idx].dist);
        const x1 = xScale(points[end_idx].dist);

        if (x1 - x0 > 2) {
          ctx.fillStyle = 'rgba(40, 40, 40, 0.18)';
          ctx.fillRect(x0, plotTop, x1 - x0, plotHeight);
        }

        begin_idx = null;
      }
    }
  }

  private drawElevationAreaBase(xScale, yScale, base_y) {
    const ctx = this._ctx;
    const points = this._points;
    ctx.beginPath();
    ctx.moveTo(xScale(points[0].dist), base_y);

    for (const p of points) {
      ctx.lineTo(xScale(p.dist), yScale(p.ele));
    }

    ctx.lineTo(xScale(points.at(-1).dist), base_y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(200, 200, 200, 0.12)';
    ctx.fill();
  }

  private drawElevationArea(xScale, yScale, base_y) {
    const ctx = this._ctx;
    const points = this._points;
    ctx.save();

    // 1. 建立完整高度區塊裁切區
    ctx.beginPath();
    ctx.moveTo(xScale(points[0].dist), base_y);

    for (const p of points) {
      ctx.lineTo(xScale(p.dist), yScale(p.ele));
    }

    ctx.lineTo(xScale(points.at(-1).dist), base_y);
    ctx.closePath();

    ctx.clip();

    // 2. 在裁切區內畫速度色帶
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      const x0 = xScale(prev.dist);
      const x1 = xScale(curr.dist);

      ctx.fillStyle = this.speedColor(curr.speed, 0.45);
      ctx.fillRect(x0, 0, x1 - x0 + 0.5, base_y);
    }

    ctx.restore();
  }

  private drawElevationLine(xScale, yScale) {
    const ctx = this._ctx;
    const points = this._points;
    ctx.lineWidth = 3;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      ctx.beginPath();
      ctx.moveTo(xScale(prev.dist), yScale(prev.ele));
      ctx.lineTo(xScale(curr.dist), yScale(curr.ele));

      ctx.strokeStyle = this.speedColor(curr.speed);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  private speedColor(speed, alpha = 1.00) {
    const min_speed = 0.2;
    const max_speed = 6.0;

    let t = clamp((speed - min_speed) / (max_speed - min_speed), 0, 1);
    if (!this._opts.slowIsDark) {
      t = 1 - t;
    }

    // 越慢越深，越快越淡 (20%~82%)
    const lightness = 20 + t * 62;

    //const hue = 145, saturation = 22; //green gray
    //const hue =  95, saturation = 20; //dark green
    const hue = 170, saturation = 22; //green
    //const hue = 210, saturation = 18; //blue gray
    //const hue = 300, saturation = 100; //darkmagenta

    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
  }

  private drawHover(point, xScale, yScale, padding) {
    const x = xScale(point.dist);
    const y = yScale(point.ele);

    const ctx = this._ctx;

    // 垂直線
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, this._canvas.height - padding.bottom);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 圓點
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // 四向防溢出、多行 tooltip
    const font_size = 12;
    const padding_x = 8;
    const padding_y = 8;
    const spacing = 6;
    const pos_offset_x = 10;
    const pos_offset_y = 10;

    const textLines = [
      `距離: ${point.dist.toFixed(0)} m`,
      `高度: ${point.ele?.toFixed(0)?? '-'} m`,
      `速度: ${point.speed.toFixed(1)} km/h`,
      `時間: ${getLocalTimeByCoord(point.coord)?.format('YYYY-MM-DD HH:mm:ss')?? '-'}`,
    ];

    ctx.font = `${font_size}px sans-serif`;   // set font before measureText

    const line_w = Math.max(...textLines.map(line => ctx.measureText(line).width));
    const line_h = font_size + spacing;

    const pane_w = line_w + (padding_x * 2);
    const pane_h = (textLines.length * line_h) - spacing + (padding_y * 2); // 扣掉最後一行的行距

    // set the position of tip
    let pos_x = x + pos_offset_x;
    if (pos_x + pane_w > ctx.canvas.width) {  // 預設往右長
      pos_x = x - pane_w - pos_offset_x;      // 改為往左長（-10 是避開滑鼠點的間距）
    }
    let pos_y = y - pane_h - pos_offset_y; // 預設往上長
    if (pos_y < 0) {
      pos_y = y + pos_offset_y;            // 改為往下長（在點的下方，+10 是避開滑鼠指針或黑點本身）
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
    ctx.fillRect(pos_x, pos_y, pane_w, pane_h);

    // loop to draw multiple liens
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top'; // 將基準線設為頂端，文字定位最精準

    textLines.forEach((line, idx) => {
      const text_x = pos_x + padding_x;
      const text_y = pos_y + padding_y + (idx * line_h);
      ctx.fillText(line, text_x, text_y);
    });
  }
}

//=========================================================

function generateDemoTrack() {
  const points = [];

  const startLat = 24.250000;
  const startLon = 121.180000;
  const startTime = new Date('2024-01-01T07:30:00+08:00');

  const totalPoints = 100;
  const totalDist = 20.0;

  let currentTime = new Date(startTime);
  let prevDist = 0;

  for (let i = 0; i < totalPoints; i++) {
    const ratio = i / (totalPoints - 1);
    const dist = ratio * totalDist;

    const ele = demoElevation(dist);
    const speed = demoSpeed(dist, i);

    if (i > 0) {
      const delta = dist - prevDist;
      const deltaHour = speed > 0.05 ? delta / speed : 0;
      const deltaMsec = deltaHour * 3600 * 1000;

      currentTime = new Date(currentTime.getTime() + deltaMsec);
    }

    // 產生一條略微彎曲的路線
    const lat = startLat + dist * 0.0065 + Math.sin(dist * 1.4) * 0.0012;
    const lon = startLon + dist * 0.0042 + Math.cos(dist * 1.1) * 0.0015;

    points.push({
      lat,
      lon,
      ele,
      time: new Date(currentTime),
      dist,
      speed
    });

    prevDist = dist;
  }

  return points;
}

function demoElevation(dist) {
  let ele;

  if (dist < 3.0) {
    // 緩上坡：2200 -> 2850
    ele = 2200 + dist * 215;
  } else if (dist < 5.0) {
    // 陡上坡：2850 -> 3550
    ele = 2850 + (dist - 3.0) * 350;
  } else if (dist < 7.0) {
    // 稜線起伏：3550 附近
    ele = 3550 + Math.sin((dist - 5.0) * Math.PI * 1.4) * 80;
  } else if (dist < 10.0) {
    // 下坡：3550 -> 2700
    ele = 3550 - (dist - 7.0) * 280;
  } else {
    // 續下坡：2700 -> 2300
    ele = 2700 - (dist - 10.0) * 200;
  }

  // 模擬 GPS elevation noise
  ele += Math.sin(dist * 8.5) * 12;
  ele += Math.cos(dist * 3.2) * 18;

  return Math.round(ele);
}

function demoSpeed(dist, index) {
  let speed;

  if (dist < 3.0) {
    // 緩上坡
    speed = 3.0 - dist * 0.25;
  } else if (dist < 5.0) {
    // 陡上坡，明顯變慢
    speed = 1.7 - (dist - 3.0) * 0.35;
  } else if (dist < 5.35) {
    // 停留，約 0
    speed = 0.08;
  } else if (dist < 7.0) {
    // 稜線緩行
    speed = 2.2 + Math.sin(dist * 2.0) * 0.25;
  } else if (dist < 10.0) {
    // 下坡較快
    speed = 4.4 + Math.sin(dist * 1.7) * 0.6;
  } else if (dist < 10.18) {
    // 短暫停留
    speed = 0.12;
  } else {
    // 續下坡，速度快但不完全穩定
    speed = 4.8 + Math.sin(dist * 2.4) * 0.7;
  }

  // 模擬人的步速波動
  speed += Math.sin(index * 0.55) * 0.18;
  speed += Math.cos(index * 0.19) * 0.12;

  return Math.max(0.05, Number(speed.toFixed(2)));
}
