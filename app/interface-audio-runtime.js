/** Shared renderer/Electron audio owner. Keep this function self-contained for bootstrap serialization. */
export function installInterfaceAudio(win) {
  if (win.__lcarsInterfaceAudio) return win.__lcarsInterfaceAudio;
  const preference = 'lcars-tos-ambiance';
  const read = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const json = (key) => { try { const value=JSON.parse(read(key, '{}')); return value&&typeof value==='object'?value:{}; } catch { return {}; } };
  const address = new URL(win.location.href);
  const owner = !address.searchParams.has('tool') && address.searchParams.get('section') !== 'terminal';
  const safe = () => { let stored=false; try { stored=typeof sessionStorage!=='undefined'&&sessionStorage.getItem('lcars-safe-mode')==='1'; } catch {} return stored||address.searchParams.get('safe')==='1'||Boolean(win.document?.querySelector('.renderer-recovery')); };
  const theme = () => read('lcars-theme');
  const fullAsset = new URL('assets/sounds/tos-bridge-ambiance.mp3', win.location.href).href;
  const normalAsset = () => new URL(theme() === 'tos' ? 'assets/sounds/tos-startup-10s.mp3' : 'assets/sounds/power-up.mp3', win.location.href).href;
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  let enabled = ['true', '1'].includes(read(preference)), currentTheme = theme();
  let volume = clamp((json('lcars-accessibility').soundVolume ?? 40) / 100);
  let audio = null, asset = '', objectUrl = '', loading = null, abort = null;
  let loadVersion = 0, playVersion = 0, fadeVersion = 0, fadeTimer = null, phase = 'OFF', startupPending = null;
  const played = new Set();
  const status = () => ({enabled, owner, phase, playing: Boolean(enabled && asset === fullAsset && audio && !audio.paused), volume});
  const emit = next => { phase = next; win.dispatchEvent(new CustomEvent('lcars-ambiance-state', {detail: status()})); };
  const report = result => { win.dispatchEvent(new CustomEvent('lcars-startup-audio-result', {detail: result})); return result; };
  const cancelled = () => ({ok: true, status: 'CANCELLED'});
  function clearFade() { fadeVersion++; if (fadeTimer !== null) clearTimeout(fadeTimer); fadeTimer = null; }
  function resetAudio() {
    loadVersion++; clearFade(); abort?.abort(); abort = null; loading = null;
    audio?.pause(); audio?.remove?.(); audio = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = ''; asset = '';
  }
  function fade(target, milliseconds, complete) {
    clearFade(); const token = fadeVersion, track = audio, from = track?.volume || 0, start = Date.now();
    const tick = () => {
      if (token !== fadeVersion || !track || track !== audio) return;
      const progress = Math.min(1, (Date.now() - start) / milliseconds), smooth = progress * progress * (3 - 2 * progress);
      track.volume = clamp(from + ((typeof target === 'function' ? target() : target) - from) * smooth);
      if (progress < 1) fadeTimer = setTimeout(tick, 40);
      else { fadeTimer = null; complete?.(); }
    };
    tick();
  }
  async function load(wanted) {
    if (asset === wanted && audio) return audio;
    if (asset === wanted && loading) return loading;
    resetAudio(); asset = wanted; const token = loadVersion;
    abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const task = (async () => {
      const response = await fetch(wanted, {cache: 'no-store', ...(abort ? {signal: abort.signal} : {})});
      if (!response.ok) throw new Error('Audio asset returned HTTP ' + response.status);
      const blob = await response.blob();
      if (!blob.type.startsWith('audio/')) throw new Error('Audio asset returned ' + (blob.type || 'an unknown content type'));
      if (token !== loadVersion) throw new Error('Audio request superseded');
      objectUrl = URL.createObjectURL(blob); audio = new Audio(objectUrl); audio.preload = 'auto'; audio.loop = false; audio.hidden = true;
      if (audio.dataset) audio.dataset.lcarsInterfaceAudio = '';
      win.document?.body?.appendChild(audio);
      const track = audio;
      track.onerror = () => { if(track===audio&&asset===fullAsset&&enabled){playVersion++;clearFade();track.pause();emit('FAILED');} };
      track.onended = async () => {
        if (track !== audio || !enabled || currentTheme !== 'tos' || !owner || safe() || asset !== fullAsset) return;
        await start(fullAsset, 4, false, true);
      };
      return audio;
    })();
    loading = task;
    try { return await task; } finally { if (loading === task) { loading = null; abort = null; } }
  }
  async function seek(track, seconds) {
    if (seconds > 0 && track.readyState < 1 && track.addEventListener) {
      await new Promise((resolve, reject) => {
        const finish = () => { cleanup(); resolve(); }, fail = () => { cleanup(); reject(new Error('Audio metadata could not be loaded')); };
        const timer = setTimeout(fail, 10000);
        const cleanup = () => { clearTimeout(timer); track.removeEventListener('loadedmetadata', finish); track.removeEventListener('error', fail); };
        track.addEventListener('loadedmetadata', finish, {once: true}); track.addEventListener('error', fail, {once: true});
      });
    }
    track.currentTime = seconds;
  }
  async function start(wanted, seconds, fadeIn, ambient) {
    const token = ++playVersion; clearFade();
    if (ambient) emit('LOADING');
    try {
      const track = await load(wanted);
      if (token !== playVersion) return cancelled();
      track.pause(); await seek(track, seconds);
      if (token !== playVersion) return cancelled();
      track.volume = fadeIn ? 0 : ambient ? volume : .42;
      await track.play();
      if (token !== playVersion) return cancelled();
      if (ambient) { emit('PLAYING'); if (fadeIn) fade(() => volume, 1800); }
      return {ok: true, status: 'PLAYING', asset: wanted, output: track.sinkId || 'SYSTEM DEFAULT'};
    } catch (error) {
      if (token !== playVersion) return cancelled();
      if (ambient) emit(error?.name === 'NotAllowedError' ? 'BLOCKED' : 'FAILED');
      return {ok: false, status: error?.name === 'NotAllowedError' ? 'BLOCKED' : 'FAILED', error: String(error), asset: wanted, output: 'SYSTEM DEFAULT'};
    }
  }
  async function startup(force = false) {
    if (!owner || (!force && safe())) return report({ok: true, status: 'SKIPPED', output: 'MAIN CONSOLE ONLY'});
    if (!force && startupPending) return startupPending;
    currentTheme = safe() ? currentTheme : theme();
    const ambient = currentTheme === 'tos' && enabled && !safe(), wanted = ambient ? fullAsset : normalAsset();
    if (!force && played.has(wanted)) return report({ok: true, status: 'ALREADY PLAYED', asset: wanted, output: 'SYSTEM DEFAULT'});
    const startupEnabled = json('lcars-shell-prefs').startupSound !== false;
    if (!force && !startupEnabled && !ambient) return report({ok: true, status: 'DISABLED', output: 'SYSTEM DEFAULT'});
    const task = (async () => {
      const result = await start(wanted, ambient && !startupEnabled && !force ? 4 : 0, ambient && !startupEnabled && !force, ambient);
      if (result.ok && result.status === 'PLAYING') played.add(wanted);
      return report(result);
    })();
    startupPending = task;
    try { return await task; } finally { if (startupPending === task) startupPending = null; }
  }
  function suspend() { playVersion++; clearFade(); audio?.pause(); emit(enabled ? 'SUSPENDED' : 'OFF'); }
  async function setAmbiance(next) {
    enabled = Boolean(next);
    try { localStorage.setItem(preference, String(enabled)); } catch {}
    if (!enabled) {
      playVersion++;
      if (loading) resetAudio();
      if (audio && asset === fullAsset && !audio.paused) { emit('FADING OUT'); fade(0, 650, () => { audio?.pause(); emit('OFF'); }); }
      else emit('OFF');
      return {ok: true, status: 'OFF'};
    }
    if (!owner || currentTheme !== 'tos' || safe()) { emit('SUSPENDED'); return {ok: true, status: 'SUSPENDED'}; }
    return start(fullAsset, 4, true, true);
  }
  async function resume() {
    if (!enabled || !owner || currentTheme !== 'tos' || safe()) return {ok: true, status: 'SUSPENDED'};
    return start(fullAsset, audio && asset === fullAsset ? audio.currentTime : 4, true, true);
  }
  function setVolume(percent) { volume = clamp(percent / 100); if (audio && asset === fullAsset && fadeTimer === null) audio.volume = volume; }
  function sync(nextTheme, nextEnabled, percent) {
    const previousTheme = currentTheme; currentTheme = nextTheme; setVolume(percent);
    if (Boolean(nextEnabled) !== enabled) return setAmbiance(nextEnabled);
    if (nextTheme !== 'tos' || safe()) { if (asset === fullAsset && phase !== 'SUSPENDED') suspend(); return; }
    if (enabled && previousTheme !== 'tos') return start(fullAsset, 4, true, true);
  }
  const api = {owner, startup, setAmbiance, resume, setVolume, sync, status, suspend};
  win.__lcarsInterfaceAudio = api; win.__lcarsPlayStartupSound = startup;
  win.addEventListener('storage', event => {
    if (event.key !== preference) return;
    const next = ['true', '1'].includes(read(preference));
    if (next !== enabled) void setAmbiance(next);
  });
  win.addEventListener('unload', () => {playVersion++; resetAudio();}, {once: true});
  return api;
}
