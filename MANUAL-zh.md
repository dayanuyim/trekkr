資訊匯入
========

檔案匯入
--------

- 支援格式：Geotagged Photo, GPX, XML, GeoJson, TopoJson, IGC

- 匯入方式：

    - 右鍵選單

    - 檔案拖曳

    - URL參數

      - _data_: 檔案URL，注意server需支援cors且設定本站網址`https://dayanuyim.github.io`為allow名單。若為GPX格式會設定為預設檔名。

      - _filename_: 設定預設檔名之名稱，副檔名需為gpx

      - _title_: 設定頁面標題

    - 由Clipboard貼上：於地圖上使用系統貼上熱鍵( Ctrl+v / Cmd+v)。僅支援文字類型格式。

航點(Waypoints)新增
-------------------

1. 由**匯入功能**輸入

2. 由航跡點(trkpt)新增

3. 指定座標位置定位，並編輯此crosshair定位點之名稱

4. 由一般照片新增，需事先上傳航跡檔且照片時間位於航跡時間之內。


Popup視窗
=========

feature支援
-----------

  - wpt

  - trkpt

layout
------

### 航跡(track)

   - 功具列

     - 分割：可於航段之非端點使用

     - 合併：可於航段端點使用，合併位置上最接近且合於時序之航段。

     - 刪除：預設block一秒鐘後才可點擊，按住shift鍵可不需此block

   - 航跡名稱

   - 航跡描述：若有則顯示

   - 色彩選擇：支援Garmin Extension

   - 航段序號： 若航段數大於1時顯示

### 航跡點(trkpt)

   - 航點進度條

   - 航跡點(trkpt)轉航點(wpt)


### 航點(wpt) / 航點(trkpt)

   - 圖示(symbol)

   - 航點名稱

   - 航點描述

   - 座標位置: 可選擇座標系統

   - 高度: 若無則使用google map api取得估算值

   - 時間：若有依座標點時區顯示local時間

   - 圖示版權宣告

   - 底圖：顯示當為地理標記照片(geotagged)相片

   - 刪除鍵：預設block一秒鐘後才可點擊，按住shift鍵可不需此block


複製功能
--------

  1. 點選Popup視窗空白處，確認Focus至此視窗

  2. 使用系統複製熱鍵 (Ctrl+C 或 Cmd+C)

  3. 若視窗邊框閃爍，表示成功至複製clipboard

      - 若為 trkpt，則複製其track為GPX格式至clipboard

      - 若為 wpt，則複製其wpt為GPX格式至clipboard


功具列
======

- feature: 航點(wpt)、航跡(trk)、航跡點(trkpt)

過濾
----

- 上方功具列

    - 預設會以"包含子字串"方式過濾

    - 若啟用按鈕`[.*]`，則表示使用正規表示式(Regular Expression; Regex)過濾。

    - all layers:
        - 若不勾選，僅會對系統圖層做過濾，如「全國基石資料」。
        - 若勾選，則亦可對使用者上傳之features做過濾。

- 圖層列表

    - 圖層過濾：若圖層支援過濾功能，其名稱後會出現「過濾圖示」，點擊該圖示可開關過濾功能。

- 範例，只顯示三等以上三角點及森林三角點：

    - 啟用「全國基石資料」並啟用過濾功能
    - 啟用Waypoint之desc過濾，過濾字串「等三角點|森林」，並使用Regex方式過濾

- 註：過濾掉的features僅做圖示隱藏，若移至該點位，仍可用滑鼠點擊。


右鍵選單
========
