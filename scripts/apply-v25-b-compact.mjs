import fs from "node:fs";

const path = new URL("../app/page.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

/* Version 25-B keeps each surface's natural/default opening size, but makes the
   CSS custom minimum authoritative once the user resizes it. That lets saved sizes
   remain below the old component minHeight props without changing the default size. */
const fitOriginal = /    const fitSize=\(width:number,height:number\)=>\{\r?\n      const \{maxWidth,maxHeight\}=bounds\(\);\r?\n      return \{width:Math\.min\(maxWidth,Math\.max\(Math\.min\(minWidth,maxWidth\),width\)\),height:Math\.min\(maxHeight,Math\.max\(Math\.min\(minHeight,maxHeight\),height\)\)\};\r?\n    \};/;
const fitPatched = [
  '    const fitSize=(width:number,height:number)=>{',
  '      const {maxWidth,maxHeight}=bounds();',
  '      const computedCssMinHeight=Number.parseFloat(getComputedStyle(element).getPropertyValue("--lcars-popup-min-height"));',
  '      const effectiveMinHeight=Number.isFinite(computedCssMinHeight)?computedCssMinHeight:minHeight;',
  '      return {width:Math.min(maxWidth,Math.max(Math.min(minWidth,maxWidth),width)),height:Math.min(maxHeight,Math.max(Math.min(effectiveMinHeight,maxHeight),height))};',
  '    };',
].join(source.includes("\r\n")?"\r\n":"\n");

if (!source.includes('Math.min(effectiveMinHeight,maxHeight),height')) {
  if (!fitOriginal.test(source)) throw new Error("V25-B fitSize layout was not found; refusing to patch an unknown source layout.");
  source = source.replace(fitOriginal, fitPatched);
}

const resizeOriginal = '    const effectiveMinHeight=Math.max(minHeight,cssMinHeight);';
const resizePatched = '    const effectiveMinHeight=Number.isFinite(computedCssMinHeight)?computedCssMinHeight:minHeight;';
if (source.includes(resizeOriginal)) source = source.replace(resizeOriginal, resizePatched);
else if (!source.includes(resizePatched)) throw new Error("V25-B resize minimum layout was not found; refusing to patch an unknown source layout.");

fs.writeFileSync(path, source);

/* Keep package.json on its existing valid semver for Electron/npm compatibility,
   while exposing the public release label exactly as Version 25-B at runtime. */
for (const relative of ["../local/lcars_bridge.py", "../windows/lcars_bridge_windows.py"]) {
  const bridgePath = new URL(relative, import.meta.url);
  let bridge = fs.readFileSync(bridgePath, "utf8");
  const oldVersion = 'LCARS_VERSION="25.2.0"';
  const releaseVersion = 'LCARS_VERSION="25-B"';
  if (bridge.includes(oldVersion)) bridge = bridge.replace(oldVersion, releaseVersion);
  else if (!bridge.includes(releaseVersion)) throw new Error(`V25-B runtime version marker was not found in ${relative}.`);
  fs.writeFileSync(bridgePath, bridge);
}

console.log("Applied Version 25-B below-default vertical popup sizing and runtime version label.");
