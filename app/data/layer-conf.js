/*
               |- layer-grp.ts
layer-conf.js -|
               |- cookie.ts  <-> settings.ts
*/

export default
[
    /*
    {
        id: 'COUNTRIES',
        legend: true,
        type: 'json',
        url: 'https://raw.githubusercontent.com/dayanuyim/trekkr/master/app/data/countries.json',
        desc: '全球國界',
        checked: false,
        opacity: 1.0,
    },
    */
    {
        id: 'TW_COUNTIES',
        legend: true,
        type: 'json',
        url: 'https://raw.githubusercontent.com/dayanuyim/trekkr/master/app/data/taiwan-counties.json',
        desc: '台灣縣界',
        checked: false,
        opacity: 1.0,
    },
    {
        id: 'GPX_SAMPLE',
        legend: true,
        type: 'gpx',
        url: 'https://raw.githubusercontent.com/dayanuyim/trekkr/master/app/data/sample.gpx',
        desc: '測試GPX',
        checked: false,
        opacity: 1.0,
    },
    {
        id: 'HAPPYMAN_GPX',
        legend: true,
        type: 'xyz',
        url: 'http://rs.happyman.idv.tw/map/gpxtrack/{z}/{x}/{y}.png',
        desc: '地圖產生器航跡',
        checked: false,
        opacity: 1.0,
    },
    {
        id: 'NLSC_LG',
        legend: true,
        type: 'xyz',
        url: 'http://wmts.nlsc.gov.tw/wmts/EMAP2/default/EPSG:3857/{z}/{y}/{x}',
        desc: '通用地圖(標誌)',
        checked: true,
        opacity: 1.0,
    },
    {
        id: 'RUDY',
        legend: false,
        type: 'xyz',
        url: 'http://rudy.tile.basecamp.tw/{z}/{x}/{y}.png',
        //url: 'http://rudy-daily.tile.basecamp.tw/{z}/{x}/{y}.png',
        //url: 'https://rs.happyman.idv.tw/map/rudy/{z}/{x}/{y}.png',
        desc: '魯地圖',
        checked: true,
        opacity: 1.0,
    },
    {
        id: 'NLSC',
        legend: false,
        type: 'xyz',
        url: 'http://wmts.nlsc.gov.tw/wmts/EMAP5/default/EPSG:3857/{z}/{y}/{x}',
        desc: '通用地圖',
        checked: false,
        opacity: 1.0,
    },
    {
        id: 'OSM',
        legend: false,
        type: 'osm',
        url: '',
        desc: 'OSM開放街圖',
        checked: false,
        opacity: 1.0,
    },
    /*
    {
        id: 'OSM_',
        legend: false,
        type: 'xyz',
        url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        desc: 'OSM開放街圖',
        checked: false,
        opacity: 1.0,
    },
    */
    {
        id: 'JP_GSI',
        legend: false,
        type: 'xyz',
        url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
        desc: '日本地理院',
        checked: false,
        opacity: 1.0,
    },
    /* template for copy
    {
        id: '',
        legend: false,
        type: 'xyz',
        url: '',
        desc: '',
        checked: false,
        opacity: 1.0,
    },
    */
];