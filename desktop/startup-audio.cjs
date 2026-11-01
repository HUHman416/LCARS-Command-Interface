const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/interface-audio-runtime.js'),'utf8');
const runtime=source.replace('export function installInterfaceAudio','function installInterfaceAudio');
if(runtime===source)throw new Error('Startup audio runtime export was not found');
module.exports.startupAudioBootstrap=`(()=>{${runtime};installInterfaceAudio(window);})()`;
