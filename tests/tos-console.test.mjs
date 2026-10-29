import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {normalizeOperatorWorkspace} from '../app/v30-operator-core.ts';
import {interpretComputerCommand} from '../app/v30-core.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('app/page.tsx'),css=read('app/tos.css');
// Execute the real registry/normalizer, rather than a duplicated theme allowlist.
const registry=page.slice(page.indexOf('const themes = ['),page.indexOf('const fallback: App[]'))
 .replace('] as const;','];').replace('(value: unknown)','(value)');
const {themes,normalizeThemeId}=runInNewContext(registry+';({themes,normalizeThemeId})');
test('TOS and every existing family survive configuration serialization and normalization',()=>{
 for(const id of ['tos','classic','voyager','nemesis','picard','lower-decks','defiant']){
  const imported=JSON.parse(JSON.stringify({theme:id}));
  assert.equal(normalizeThemeId(imported.theme),id);
 }
 assert.equal(normalizeThemeId('padd'),'defiant');assert.equal(normalizeThemeId('unknown'),'classic');
 assert.equal(themes.length,7);
 assert.match(page,/const importedTheme=normalizeThemeId\(d.theme\)/);
});
test('operator backup retains TOS workstations and routines, and Computer can select it',()=>{
 const restored=normalizeOperatorWorkspace(JSON.parse(JSON.stringify({theme:'tos',workstations:[{id:'bridge',theme:'tos'}],routines:[{id:'watch',steps:[{kind:'theme',target:'tos'}]}]})));
 assert.equal(restored.theme,'tos');assert.equal(restored.workstations[0].theme,'tos');
 assert.equal(restored.routines[0].steps[0].target,'tos');
 const plan=interpretComputerCommand('set theme to Enterprise · The Original Series',{pages:[],apps:[],procedures:[],workstations:[],themes},'operator');
 assert.equal(plan.valid,true);assert.equal(plan.steps[0].target,'tos');
 assert.match(page,/restoredTheme=normalizeThemeId\(profile.theme\)/);
 assert.match(page,/kind==="theme"\?themes.map/);
});
test('both renderers include structural skin and all three local font faces',()=>{
 for(const path of ['app/layout.tsx','desktop/renderer.tsx'])assert.match(read(path),/import ["'].*\/tos.css["']/);
 for(const name of ['Roddenberry-DgLm.ttf','RoddenberryBold-AgG2.ttf','RoddenberryBoldItalic-q4ol.ttf']){
  assert.ok(css.includes(name));assert.ok(readFileSync(new URL('../public/assets/fonts/'+name,import.meta.url)).length>20000);
 }
 assert.match(css,/\.theme-tos \.shell\{grid-template-columns:192px minmax\(0,1fr\)/);
 assert.match(css,/\.theme-tos \.nav\{[^}]*border-radius:2px/);
 assert.match(css,/\.theme-tos \.content\{[^}]*border-radius:2px/);
 assert.match(css,/\.theme-preview-tos/);
});
test('decorative indicators, access modes, detached surfaces and alerts have explicit rules',()=>{
 assert.match(page,/className="tos-instrument-bank" aria-hidden="true"/);
 assert.match(css,/\.theme-tos.reduced-motion \.tos-instrument-bank i\{animation:none\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.theme-tos.accessibility-contrast/);assert.match(css,/\.theme-tos.color-safe/);
 assert.match(css,/:focus-visible\{outline:3px/);
 assert.match(css,/@media\(max-width:680px\)/);assert.match(css,/@media\(max-height:600px\)/);
 const detached=page.slice(page.indexOf('const detachedConsoleClass'),page.indexOf('  return (',page.indexOf('const detachedConsoleClass')));
 for(const token of ['access.highContrast','access.reducedMotion','access.colorSafe','alertCondition','fontScale'])assert.ok(detached.includes(token),token);
 assert.match(detached,/DocumentWorkspaceV31/);assert.match(detached,/SpeedDialPagePeek/);
 for(const alert of ['red','yellow'])assert.ok(css.includes('.lcars.theme-tos.alert-'+alert));
});

test('TOS load graphics show real bounded samples and task controls stay reachable',()=>{
 const instrument=read('app/tos-instruments.tsx');
 assert.match(instrument,/Math.max\(0,Math.min\(100,Number\(value\)\|\|0\)\)/);
 assert.match(instrument,/SYSTEM LOAD · CURRENT SAMPLE/);
 assert.match(instrument,/aria-label=\{/);
 assert.doesNotMatch(instrument,/Math.random|setInterval/);
 assert.match(page,/className="tos-navigation-bank"/);
 assert.match(page,/className="tos-tray-key" aria-label="Open system tray"/);
 assert.match(css,/\.theme-tos \.task-zone \.filler-codes\{display:none!important/);
 assert.match(css,/\.lcars.theme-tos\{background:#000;/);
});

test('TOS key sounds honor mute, volume, cancellation, reuse, and a single playback channel',async()=>{
 const {createTosKeyPlayer,isTosCancelKey,tosKeyAsset}=await import('../app/tos-audio.ts');
 const made=[];let plays=0,pauses=0;
 const player=createTosKeyPlayer(path=>{const clip={path,volume:0,currentTime:8,play:async()=>{plays++;},pause:()=>{pauses++;}};made.push(clip);return clip;});
 player.play(false,40);player.play(true,0);assert.equal(made.length,0);
 player.play(true,40);assert.equal(made[0].volume,.4);assert.equal(made[0].currentTime,0);
 player.play(true,150,true);assert.equal(made[1].volume,1);assert.match(made[1].path,/tos_cancel_keypress/);
 player.play(true,20);assert.equal(made.length,2);assert.equal(plays,3);assert.equal(pauses,2);
 player.stop();assert.equal(pauses,3);
 for(const label of ['CANCEL','Close STATUS Page Peek','LATER','×'])assert.equal(isTosCancelKey(label),true);
 assert.equal(isTosCancelKey('OPEN TASKS'),false);
 for(const cancel of [false,true])assert.ok(readFileSync(new URL('../public'+tosKeyAsset(cancel),import.meta.url)).length>1000);
 assert.match(page,/onClickCapture=\{tosConsoleKey\}/);
 assert.match(page,/if \(!sound \|\| theme === "tos"\) return/);
});

test('TOS updater and failure cues use supplied event recordings without polling chatter',async()=>{
 const {createTosEventPlayer,tosEventAsset}=await import('../app/tos-audio.ts');
 const made=[];let pauses=0;
 const player=createTosEventPlayer(path=>{const clip={path,currentTime:0,volume:0,play:async()=>{},pause:()=>{pauses++;}};made.push(clip);return clip;});
 player.play(false,50);assert.equal(made.length,0);
 player.play(true,35);assert.match(made[0].path,/tos_datareceived_ep/);assert.equal(made[0].volume,.35);
 player.play(true,35,true);assert.match(made[1].path,/tos_unabletocomply/);assert.equal(pauses,1);
 player.play(true,35,true);assert.equal(made.length,2);
 for(const failed of [false,true])assert.ok(readFileSync(new URL('../public'+tosEventAsset(failed),import.meta.url)).length>1000);
 assert.match(page,/onUpdateActivity=\{\(\)=>cue\("update-data"\)\}/);
 assert.match(page,/if\(operation!=="check"\)onUpdateActivity\(\)/);
 assert.match(page,/if\(operation==="check"&&result.available\)onUpdateActivity\(\)/);
 assert.match(page,/name === "error" \|\| name === "transfer-failed" \|\| name === "update-data"/);
});

test('production-console composition pairs live instruments and uses grouped station keys',()=>{
 const instrument=read('app/tos-instruments.tsx');
 assert.match(instrument,/className="tos-allocation-screen"/);
 assert.match(instrument,/memory=readings.find\(item=>item.label==="MEM"\)/);
 assert.match(instrument,/storage=readings.find\(item=>item.label==="DISK"\)/);
 assert.match(instrument,/strokeDasharray=\{`\$\{memory/);
 assert.match(css,/\.theme-tos \.tos-navigation-bank\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(page,/LIBRARY COMPUTER/);
});
