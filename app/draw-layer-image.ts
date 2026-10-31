import type { Coordinate } from 'ol/coordinate';
import type { XYZ, WMTS } from 'ol/source';
import type { Extent } from 'ol/extent';
import type { Projection } from 'ol/proj';

import { getWidth as getExtentWidth, getHeight as getExtentHeight, boundingExtent, containsCoordinate } from 'ol/extent';
import { transform } from 'ol/proj';
import { offset } from 'ol/sphere';
import { WEB_MERCATOR, WGS84 } from './coord';

import { saveBlobAsFile, canvasToBlob } from './lib/dom-utils';

interface ExportOptions {
  lonlat: Coordinate;     // top-left coord
  xspan: number;          // 東西向地面距離
  yspan: number;          // 南北向地面距離
  zoom: number;
  grid_proj?: Projection;
  points?: Point[],
  lines?: Line[],
  filename?: string;
  filetypes: string[];
  pagesize?: string;  // jsPDF's format: a3, a4,...
}

export async function exportLayerImage(
  source: XYZ|WMTS,
  opt: ExportOptions,
  on_progress?,
  on_abort?,
): Promise<void> {
  try{
    on_progress?.("參數檢查", 0, "正在檢查參數設定…");

    let proj = source.getProjection();
    if (!proj) {
      console.warn('XYZ source has no projection defined');
      proj = WEB_MERCATOR;
    }

    // 以地面距離計算四角經緯度，封裝成 Extent
    const tl = opt.lonlat;
    const tr = offset(tl, opt.xspan, Math.PI / 2);
    const bl = offset(tl, opt.yspan, Math.PI);
    const br = offset(tr, opt.yspan, Math.PI);
    const corners = [tl, tr, bl, br].map(
      coord => transform(coord, WGS84, proj) //轉換成 XYZ source 的投影座標
    );
    const extent = boundingExtent(corners);

    // 建立輸出 Canvas
    on_progress?.("環境初始化", 1, "正在初始化畫布…");
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create Canvas');

    // 先畫地圖
    await drawImageMap(ctx, extent, proj, source, opt.zoom, (ratio, msg) => {
      on_progress?.("圖磚下載", 1 + 90*ratio, msg);    // 1~91
    },
    on_abort);

    // 畫格線
    if (opt.grid_proj) {
      on_progress?.("格線繪製", 91, `正在繪製${opt.grid_proj}座標格線與標註`);
      drawImageGrid(ctx, extent, proj, opt.grid_proj, {
        interval: 1000,  // every 1km
      });
    }

    // 畫航線
    if(opt.lines){
      on_progress?.("航跡繪製", 95, `正在繪製航點`);
      drawImageLines(ctx, extent, proj, opt.lines, {
        width: 2,
        dash: [6, 4],
      });
    }

    // 畫航點
    if(opt.points){
      on_progress?.("航跡繪製", 93, `正在繪製航點`);
      drawImagePoints(ctx, extent, proj, opt.points);
    }


    // 製作檔案
    const geo_scale = 25000;
    const filenames = opt.filetypes.map(filetype => `${opt.filename?? "map"}.${filetype.toLowerCase()}`);
    const file_prog = i => 96 + 3* (i+1) / opt.filetypes.length;  // 96~99

    await Promise.allSettled(opt.filetypes.map(async(filetype, i) => {
      on_progress?.("檔案製作", file_prog(i), `正在產生 ${filetype.toUpperCase()} 檔案`);

      // 1. 依 type 生出 blob 檔
      const blob = await canvasToBlob(canvas, filetype, {
        scale: opt.xspan * 1000 / geo_scale / canvas.width,    // mm/pixel
        pagesize: opt.pagesize,
      });

      // 2. 匯出檔案
      saveBlobAsFile(blob, filenames[i]);
    }));

    on_progress?.("匯出完成", 100, `匯出完成，請儲存檔案(${filenames.length}個)：${filenames.join(", ")}`);
  }
  catch(e){
      console.error(e);
      on_progress?.("執行錯誤", 0, e.toString());
  }
}

async function drawImageMap(
  ctx: CanvasRenderingContext2D,
  extent: Extent,  // web mercator
  proj: Projection,
  source: XYZ|WMTS,
  zoom: number,
  on_message?,
  on_abort?,
){
  const z = Math.max(1, Math.min(Math.round(zoom), 24));  // should be the integer between 1 ~ 24

  const grid = source.getTileGrid();
  if (!grid) {
    throw new Error('XYZ source has no tile grid');
  }

  const resolution = grid.getResolution(z);
  if (resolution === undefined) {
    throw new Error(`Invalid zoom level: ${z}`);
  }

  // 決定 canvas width/height
  ctx.canvas.width = Math.ceil(getExtentWidth(extent) / resolution);
  ctx.canvas.height = Math.ceil(getExtentHeight(extent) / resolution);

  // 先填白底，透明的部分才能正常顯示。
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 計算需要的 XYZ tiles
  const range = grid.getTileRangeForExtentAndZ(extent, z);
  const getTileUrl = source.getTileUrlFunction();

  const x_sn = (v) => v - range.minX + 1;
  const y_sn = (v) => v - range.minY + 1;
  const x_num = x_sn(range.maxX);
  const y_num = y_sn(range.maxY);
  const pad = (v) => v.toString().padStart(2, " ")

  for (let x = range.minX; x <= range.maxX; x++) {
    for (let y = range.minY; y <= range.maxY; y++) {
      if (on_abort?.()) 
        throw new Error("匯出工作已取消")

      //await sleep(200);  // @@! for testing
      on_message?.(
        ((x_sn(x) - 1) * y_num + y_sn(y)) / (x_num * y_num),
        `正在下載圖磚 ${pad(x_sn(x))} x ${pad(y_sn(y))} / ${x_num} x ${y_num}`,
      );

      const tileCoord: [number, number, number] = [z, x, y];

      const url = getTileUrl(tileCoord, 1, proj);
      if (!url) continue;

      // TODO: 改平行下載
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();

      const e = grid.getTileCoordExtent(tileCoord);

      // 5. 依照地圖座標計算瓦片在 Canvas 上的位置
      const px = Math.round((e[0] - extent[0]) / resolution);   // diff of minx //取整數 避免縫合縫細
      const py = Math.round((extent[3] - e[3]) / resolution);   // diff of maxy // webcoord y-axis 往上，canvas 反之往下，故用 maxy 而非 miny
      //const pw = Math.round(getExtentWidth(e) / resolution);  // img.width
      //const ph = Math.round(getExtentHeight(e) / resolution); // img.height

      ctx.drawImage(img, px, py, img.width, img.height);
      //ctx.drawImage(img, px, py, pw, ph);
      //ctx.drawImage(img, px-1, py-1, pw+2, ph+2); // extend 1px to overlayer
    }
  }

}

interface GridOptions {
  interval?: number;
  color?: string;
  lineWidth?: number;
}

function drawImageGrid(
  ctx: CanvasRenderingContext2D,
  extent: Extent,  // web mercator
  proj: Projection,
  grid_proj: Projection,
  opt: GridOptions,
): void {

  const {
    interval = 1000,
    color = 'rgba(0, 0, 0, 0.65)',
    lineWidth = 1,
  } = opt;

  const { width, height } = ctx.canvas;

  // 將輸出範圍的四角轉至 TWD 座標系統，
  // 用來估算需要繪製的格線範圍。
  const corners = [
    [extent[0], extent[1]],
    [extent[0], extent[3]],
    [extent[2], extent[1]],
    [extent[2], extent[3]],
  ].map((coord) =>
    transform(coord, proj, grid_proj),
  );

  // Projection Coord TWD67/TWD97 ->  Canvas Pixel  (by web coord interpolation)
  const toPixel = (coord: [number, number]): [number, number] => {
    const [x, y] = transform(coord, grid_proj, proj);
    return [
      (x - extent[0]) / getExtentWidth(extent) * width,
      (extent[3] - y) / getExtentHeight(extent) * height,
    ];
  };

  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // 每條格線取樣多個點，處理投影轉換後的彎曲。
  const samples = 32;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  // 垂直格線：固定 Easting，沿 Northing 方向取樣
  const startX = Math.floor(minX / interval) * interval;

  for (let x = startX; x <= maxX; x += interval) {
    for (let i = 0; i <= samples; i++) {
      const y = minY + (maxY - minY) * i / samples;
      const [px, py] = toPixel([x, y]);

      (i === 0)? ctx.moveTo(px, py):
                 ctx.lineTo(px, py);
    }
  }

  // 水平格線：固定 Northing，沿 Easting 方向取樣
  const startY = Math.floor(minY / interval) * interval;

  for (let y = startY; y <= maxY; y += interval) {
    for (let i = 0; i <= samples; i++) {
      const x = minX + (maxX - minX) * i / samples;
      const [px, py] = toPixel([x, y]);

      (i === 0)? ctx.moveTo(px, py):
                 ctx.lineTo(px, py);
    }
  }

  ctx.stroke();

  // 座標標籤設定 ======================================
  const sz = Math.max(12, Math.round(Math.min(width/58, height/58))); // for A4 (7x5), width 3241 x height 2315 is 40px
  ctx.font = `${sz}px sans-serif`;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // 白色描邊，讓文字在底圖上更容易辨識
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';

  const padding = 4;

  const drawLabel = (
    text: string,
    x: number,
    y: number,
    align: CanvasTextAlign,
    baseline: CanvasTextBaseline,
  ) => {
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };

  //TODO 如果要印非 TM2 格線，這段要拉出去變成 callback
  const to_label = (v) => ((v % 1000) < 50)? Math.round(v/1000).toString(): "";   //只印 TM2/KM 格線

  // 上、下：Easting
  for (let x = startX; x <= maxX; x += interval) {
    const top = toPixel([x, maxY]);
    const bottom = toPixel([x, minY]);
    const label = to_label(x);

    drawLabel(label, top[0], padding, 'center', 'top');
    drawLabel(label, bottom[0], height - padding, 'center', 'bottom');
  }

  // 左、右：Northing
  for (let y = startY; y <= maxY; y += interval) {
    const left = toPixel([minX, y]);
    const right = toPixel([maxX, y]);
    const label = to_label(y);

    drawLabel(label, padding, left[1], 'left', 'middle');
    drawLabel(label, width - padding, right[1], 'right', 'middle');
  }

  ctx.restore();
}

type Coord = number[]; // EPSG:3857

type Line = Coord[];

interface Point {
  coord: Coord;
  name: string;
}

interface PointOptions {
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;

  font?: string;
  fontColor?: string;
  fontSize?: number;

  textOffsetX?: number;
  textOffsetY?: number;

  showName?: boolean;
}

function drawImagePoints(
    ctx: CanvasRenderingContext2D,
    extent: Extent,
    proj: Projection,
    points: Point[],
    opt: PointOptions = {}
): void {

    const {
        radius = 5,
        color = '#ff3333',
        strokeColor = '#ffffff',
        strokeWidth = 2,

        font = 'sans-serif',
        fontColor = '#ffffff',
        fontSize = 14,

        textOffsetX = 9,
        textOffsetY = -9,

        showName = true
    } = opt;

    const [minX, minY, maxX, maxY] = extent;

    // Web Mercator → Canvas pixel
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    const toPixel = (coord: number[]): [number, number] => {
      const [x, y] = transform(coord, WEB_MERCATOR, proj);
      return [
        (x - minX) / (maxX - minX) * canvasWidth,
        (maxY - y) / (maxY - minY) * canvasHeight
      ];
    };

    ctx.save();

    //ctx.font = font;
    //ctx.textAlign = 'left';
    //ctx.textBaseline = 'middle';

    // 排除 extent 以外的點
    const pts = points.filter(({coord}) => containsCoordinate(extent, coord));
    
    for (const pt of pts) {
        const [px, py] = toPixel(pt.coord);

        // Draw waypoint marker
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);

        ctx.fillStyle = color;
        ctx.fill();

        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        // Draw waypoint name
        if (showName && pt.name) {

            const textX = px + textOffsetX;
            const textY = py + textOffsetY;

            ctx.font = `${fontSize}px ${font}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Text outline
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.strokeText(pt.name, textX, textY);

            // Text fill
            ctx.fillStyle = fontColor;
            ctx.fillText(pt.name, textX, textY);
        }
    }

    ctx.restore();
}

interface LineOptions {
    color?: string;
    width?: number;
    dash?: number[];
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
}

import { getTransform } from 'ol/proj';

function drawImageLines(
    ctx: CanvasRenderingContext2D,
    extent: Extent,
    proj: Projection,
    lines: Line[],
    opt: LineOptions = {}
): void {

    const {
        color = '#ff3333',
        width = 3,
        dash = [],
        lineCap = 'round',
        lineJoin = 'round'
    } = opt;

    const [minX, minY, maxX, maxY] = extent;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Web Mercator → Canvas pixel
    const toPixel = (coord: number[]): [number, number] => {
      const [x, y] = transform(coord, WEB_MERCATOR, proj);
      return [
        (x - minX) / (maxX - minX) * canvasWidth,
        (maxY - y) / (maxY - minY) * canvasHeight
      ];
    };

    ctx.save();

    ctx.beginPath();

    for (const line of lines) {

        if (line.length < 2)
            continue;

        const first = line[0];
        const start = toPixel(first);

        ctx.moveTo(start[0], start[1]);

        for (let i = 1; i < line.length; i++) {

            const pt = line[i];
            const pixel = toPixel(pt);

            ctx.lineTo(pixel[0], pixel[1]);
        }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = lineCap;
    ctx.lineJoin = lineJoin;
    ctx.setLineDash(dash);

    ctx.stroke();

    ctx.restore();
}
