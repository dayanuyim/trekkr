## Patch Openlayer

1. 直接修改 node_modules/ol/...
    - 測試需重開 app `npm start`
2. 製作 patch `npx patch-package ol`
    - 若誤可刪除舊的 patch `trash patches/ol+X.Y.Z.patch`
3. 重新安裝測試：`rm -rf node_modules/ol && npm install`
