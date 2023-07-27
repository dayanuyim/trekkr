'use strict';
const {exec} = require('child_process');

const size = 32;
const img_dir = `./app/images/sym/${size}`;
const symbols = require('./app/data/symbols.json');
const inv = require('./app/data/symbol-inventory.json');

const files = inv.basics.concat(inv.extras)
                .map(id =>`"${symbols[id].filename}"`).join(" ");
const cmd = `cd ${img_dir} && magick ${files} +append sprite.png`

console.log(`run cmd[${cmd}]`);
exec(cmd, (error, stdout, stderr) => {
    if(error) console.error("error", error);
    if(stdout) console.log("stdout", stdout);
    if(stderr) console.error("stderr", stderr);
});
