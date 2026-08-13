const { app, BrowserWindow, protocol, net, shell, session } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
protocol.registerSchemesAsPrivileged([{scheme:"lcars",privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let mainWindow=null,bridgeProcess=null;
app.setName("LCARS Command Interface");
if(process.platform==="win32")app.setAppUserModelId("com.lcars.commandinterface");
if(process.platform==="linux")app.commandLine.appendSwitch("class","lcars-command-interface");
const root=()=>app.isPackaged?process.resourcesPath:path.resolve(__dirname,"..");
const bridge=()=>app.isPackaged?path.join(process.resourcesPath,"bridge",process.platform==="win32"?"lcars_bridge_windows.py":"lcars_bridge_linux.py"):path.join(root(),process.platform==="win32"?"windows/lcars_bridge_windows.py":"local/lcars_bridge.py");
const recovery=()=>app.isPackaged?path.join(process.resourcesPath,"recovery","lcars-recovery.sh"):path.join(root(),"local/lcars-recovery.sh");
function recover(){if(process.platform!=="linux"||!fs.existsSync(recovery()))return;try{const p=spawn("bash",[recovery()],{stdio:"ignore",detached:true,env:{...process.env,LCARS_RECOVERY_SILENT:"1"}});p.unref()}catch{}}
function startBridge(){let python="python3",args=[];if(process.platform==="win32"){python="py";args=["-3"]}bridgeProcess=spawn(python,[...args,bridge()],{cwd:root(),stdio:"ignore",windowsHide:true,env:{...process.env,LCARS_DESKTOP_APP:"1"}})}
function ready(attempts=80){return new Promise(resolve=>{const check=n=>{const req=http.get("http://127.0.0.1:8765/api/health-check",res=>{res.resume();resolve(true)});req.setTimeout(250,()=>req.destroy());req.on("error",()=>n<=0?resolve(false):setTimeout(()=>check(n-1),100))};check(attempts)})}
function createWindow(){const icon=app.isPackaged?path.join(process.resourcesPath,"icons",process.platform==="win32"?"lcars-command-interface.ico":"lcars-command-interface.png"):path.join(root(),"desktop/icons/512x512.png");mainWindow=new BrowserWindow({title:"LCARS Command Interface",backgroundColor:"#000",fullscreen:true,autoHideMenuBar:true,show:false,icon,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});mainWindow.removeMenu();mainWindow.once("ready-to-show",()=>mainWindow.show());mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/i.test(url))shell.openExternal(url);return{action:"deny"}});mainWindow.webContents.on("will-navigate",(e,url)=>{if(!url.startsWith("lcars://app/"))e.preventDefault()});mainWindow.webContents.on("before-input-event",(e,input)=>{if(input.key==="F11"&&input.type==="keyDown"){mainWindow.setFullScreen(!mainWindow.isFullScreen());e.preventDefault()}});mainWindow.webContents.on("render-process-gone",recover);mainWindow.on("closed",recover);mainWindow.loadURL("lcars://app/index.html")}
function protocolHandler(){const dir=path.join(app.getAppPath(),"desktop-dist");protocol.handle("lcars",request=>{const url=new URL(request.url),requested=decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname),resolved=path.resolve(dir,`.${requested}`),target=resolved.startsWith(dir)&&fs.existsSync(resolved)?resolved:path.join(dir,"index.html");return net.fetch(`file://${target}`)})}
const lock=app.requestSingleInstanceLock();if(!lock)app.quit();else{app.on("second-instance",()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()}});app.whenReady().then(async()=>{protocolHandler();await session.defaultSession.clearCache();recover();startBridge();await ready();createWindow()});app.on("before-quit",()=>{recover();if(bridgeProcess&&!bridgeProcess.killed)bridgeProcess.kill("SIGTERM")});app.on("window-all-closed",()=>app.quit())}
