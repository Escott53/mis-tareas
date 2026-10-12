/* Mis Tareas — PWA personal sin servidor. Datos en localStorage. */
(() => {
  'use strict';

  const STORE_KEY = 'mis-tareas-v1';

  // ---------- Constantes ----------
  const GRADIENTS = {
    violeta:  ['#8b5cf6', '#ec4899'],
    amanecer: ['#fb923c', '#f43f5e'],
    oceano:   ['#06b6d4', '#3b82f6'],
    noche:    ['#4338ca', '#7c3aed'],
    bosque:   ['#10b981', '#0ea5e9'],
    lima:     ['#84cc16', '#10b981'],
    sol:      ['#f59e0b', '#ef4444'],
    rosa:     ['#f472b6', '#a855f7'],
    cielo:    ['#38bdf8', '#818cf8'],
    grafito:  ['#475569', '#1e293b'],
    coral:    ['#fb7185', '#f97316'],
    menta:    ['#2dd4bf', '#22c55e'],
  };
  const TYPES = {
    normal: { label: 'Lista normal', desc: 'Tareas, notas y enlaces', icon: '☑️' },
    compra: { label: 'Lista de compra', desc: 'Añadir rápido y tachar', icon: '🛒' },
    rutina: { label: 'Rutina diaria', desc: 'Se reinicia cada día', icon: '🔁' },
    notas:  { label: 'Notas y vídeos', desc: 'Ideas, textos y YouTube', icon: '🎬' },
    cargos: { label: 'Cargos domiciliados', desc: 'Recibos y próximos cargos', icon: '💳' },
  };
  const PERIODS = { mensual: [1, 'Mensual'], bimestral: [2, 'Bimestral'], trimestral: [3, 'Trimestral'], semestral: [6, 'Semestral'], anual: [12, 'Anual'] };
  const WARN_DAYS = 15, ALERT_DAYS = 7;
  const EMOJIS = ['✨','🙏','🕊️','📿','🛒','🥦','🍎','🥖','🌅','☀️','☕','🌙','⭐','😴','💪','🏃',
    '🧘','📚','📝','💡','🎯','💼','🏠','🧹','❤️','👨‍👩‍👧','🎁','✈️','🎬','🎵','💰','🌱','🐶','🔧','🎨','📌'];
  const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const vibrate = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  function isUrl(s) {
    const t = s.trim();
    if (/\s/.test(t)) return false;
    return /^(https?:\/\/)[^\s.]+\.[^\s]{2,}/i.test(t) || /^(www\.|youtu\.be\/|(m\.)?youtube\.com\/)/i.test(t);
  }
  function normUrl(s) { const t = s.trim(); return /^https?:\/\//i.test(t) ? t : 'https://' + t; }
  function youtubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(normUrl(url));
      const h = u.hostname.replace(/^www\.|^m\.|^music\./, '');
      if (h === 'youtu.be') return clean(u.pathname.slice(1).split('/')[0]);
      if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
        if (u.searchParams.get('v')) return clean(u.searchParams.get('v'));
        const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        if (m) return clean(m[2]);
      }
    } catch (_) {}
    return null;
    function clean(id) { return /^[\w-]{6,20}$/.test(id) ? id : null; }
  }
  function hostOf(url) { try { return new URL(normUrl(url)).hostname.replace(/^www\./, ''); } catch (_) { return url; } }

  // ---------- Estado ----------
  function defaultState() {
    const t = dayKey();
    const f = (name, emoji, color, type) => ({ id: uid(), name, emoji, color, type, items: [], completedDays: [], lastReset: t, created: Date.now() });
    return {
      version: 1,
      folders: [
        f('Espiritualidad', '✨', 'violeta', 'notas'),
        f('Compra', '🛒', 'bosque', 'compra'),
        f('Al despertar', '🌅', 'amanecer', 'rutina'),
        f('Por la noche', '🌙', 'noche', 'rutina'),
        f('Cargos', '💳', 'coral', 'cargos'),
      ],
      cargosAdded: true,
    };
  }
  let state;
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      state = raw ? JSON.parse(raw) : defaultState();
      if (!state || !Array.isArray(state.folders)) state = defaultState();
    } catch (_) { state = defaultState(); }
    state.folders.forEach((f) => { f.items ||= []; f.completedDays ||= []; f.type ||= 'normal'; f.color ||= 'violeta'; });
    // Migración: añadir una vez la carpeta «Cargos» a los datos existentes (si se borra, no vuelve).
    if (!state.cargosAdded) {
      if (!state.folders.some((f) => f.type === 'cargos'))
        state.folders.push({ id: uid(), name: 'Cargos', emoji: '💳', color: 'coral', type: 'cargos', items: [], completedDays: [], lastReset: dayKey(), created: Date.now() });
      state.cargosAdded = true;
    }
    dailyReset(false);
    save();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('No se pudo guardar (almacenamiento lleno)'); }
  }
  const folderById = (id) => state.folders.find((f) => f.id === id);

  // Rutinas: reinicio diario de las casillas.
  function dailyReset(rerender = true) {
    const t = dayKey();
    let changed = false;
    state.folders.forEach((f) => {
      if (f.type === 'rutina' && f.lastReset !== t) {
        f.items.forEach((i) => { i.done = false; });
        f.lastReset = t; changed = true;
      }
    });
    if (changed) { save(); if (rerender) render(); }
  }
  function checks(f) { return f.items.filter((i) => i.kind === 'check'); }
  function progress(f) { const c = checks(f); return { done: c.filter((i) => i.done).length, total: c.length }; }
  function updateCompletion(f) {
    if (f.type !== 'rutina') return false;
    const t = dayKey(); const p = progress(f);
    const had = f.completedDays.includes(t);
    const full = p.total > 0 && p.done === p.total;
    if (full && !had) f.completedDays.push(t);
    if (!full && had) f.completedDays = f.completedDays.filter((d) => d !== t);
    if (f.completedDays.length > 400) f.completedDays = f.completedDays.slice(-400);
    return full && !had;
  }
  function streak(f) {
    const set = new Set(f.completedDays);
    let d = new Date();
    if (!set.has(dayKey(d))) d = addDays(d, -1);
    let n = 0;
    while (set.has(dayKey(d))) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak(f) {
    const days = [...new Set(f.completedDays)].sort();
    let best = 0, cur = 0, prev = null;
    days.forEach((k) => {
      const d = new Date(k + 'T12:00:00');
      cur = prev && dayKey(addDays(prev, 1)) === k ? cur + 1 : 1;
      best = Math.max(best, cur); prev = d;
    });
    return best;
  }

  // ---------- Cargos domiciliados ----------
  const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  // Fecha con día «deseado» ajustado a meses cortos (31 → 30/28/29).
  const clampDate = (y, m, day) => { const d = new Date(y, m, 1); return new Date(d.getFullYear(), d.getMonth(), Math.min(day, daysInMonth(d.getFullYear(), d.getMonth()))); };
  const today0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  function nextCharge(c, from = today0()) {
    const step = (PERIODS[c.period] || PERIODS.mensual)[0];
    const s = parseDay(c.start);
    const day = c.day || s.getDate();
    let k = 0, d = clampDate(s.getFullYear(), s.getMonth(), day);
    while (d < from && k < 2400) { k += step; d = clampDate(s.getFullYear(), s.getMonth() + k, day); }
    return d;
  }
  // Primera fecha a partir de hoy para «día del mes».
  function firstForDay(day) {
    const t = today0(); let d = clampDate(t.getFullYear(), t.getMonth(), day);
    if (d < t) d = clampDate(t.getFullYear(), t.getMonth() + 1, day);
    return d;
  }
  const daysUntil = (d) => Math.round((d - today0()) / 86400000);
  const countdown = (n) => n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`;
  const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const fmtDate = (d) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  const cargosOf = (f) => f.items.filter((i) => i.kind === 'cargo');
  const monthlyTotal = (list) => list.reduce((n, c) => n + (Number(c.amount) || 0) / (PERIODS[c.period] || PERIODS.mensual)[0], 0);
  const urgency = (n) => n <= ALERT_DAYS ? 'red' : n <= WARN_DAYS ? 'orange' : '';
  function upcomingCharges() {
    return state.folders.filter((f) => f.type === 'cargos').flatMap((f) => cargosOf(f).map((c) => ({ f, c, d: nextCharge(c) })))
      .map((x) => ({ ...x, n: daysUntil(x.d) })).filter((x) => x.n <= WARN_DAYS).sort((a, b) => a.d - b.d);
  }
  // Previsión: total por mes de los próximos 12 meses, colocando cada periodicidad en su mes.
  function forecast(cs, months = 12) {
    const t = today0(), out = [];
    for (let i = 1; i <= months; i++) {
      const a = new Date(t.getFullYear(), t.getMonth() + i, 1), b = new Date(t.getFullYear(), t.getMonth() + i + 1, 1);
      let sum = 0, n = 0;
      cs.forEach((c) => { let d = nextCharge(c, a), k = 0; while (d < b && k++ < 40) { sum += Number(c.amount) || 0; n++; d = nextCharge(c, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); } });
      out.push({ m: a, sum, n });
    }
    return out;
  }
  function forecastHtml(cs) {
    if (!cs.length) return '';
    const fc = forecast(cs), max = Math.max(...fc.map((x) => x.sum), 1), tot = fc.reduce((n, x) => n + x.sum, 0);
    return `<section class="forecast"><div class="fc-head"><b>📊 Previsión</b><span>próx. 12 meses: ${eur(tot)}</span></div>
      ${fc.map((x) => `<div class="fc-row"><span class="fc-m">${x.m.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</span><div class="fc-bar"><i style="width:${(x.sum / max * 100).toFixed(1)}%"></i></div><b>${eur(x.sum)}</b></div>`).join('')}</section>`;
  }
  // Importa cargos desde JSON ({cargos:[...]} o [...]) y los fusiona sin duplicar (nombre+importe).
  // Acepta texto con BOM/basura alrededor, {cargos}, [...], o la copia completa de la app ({folders}).
  function parseCargos(t) {
    t = String(t).replace(/^\uFEFF/, '').trim();
    const i = t.search(/[[{]/), d = JSON.parse(i > 0 ? t.slice(i) : t);
    if (Array.isArray(d?.folders)) return d.folders.filter((x) => x.type === 'cargos').flatMap((x) => (x.items || []).filter((c) => c.kind === 'cargo'));
    return d;
  }
  // Fila compacta del enlace: [nombre, importe, día, cuenta, periodo]
  const unpack = (r) => Array.isArray(r) ? { name: r[0], amount: r[1], day: r[2], account: r[3], period: r[4] } : r;
  function importCargos(f, data) {
    let list = Array.isArray(data) ? data : data && Array.isArray(data.cargos) ? data.cargos : null;
    if (!list) throw new Error();
    list = list.map(unpack);
    if (!list) throw new Error();
    if (f === null) f = state.folders.find((x) => x.type === 'cargos') || (state.folders.push({ id: uid(), name: 'Cargos', emoji: '💳', color: 'coral', type: 'cargos', items: [], completedDays: [], lastReset: dayKey(), created: Date.now() }), state.folders.at(-1));
    const key = (n, a) => String(n).trim().toLowerCase() + '|' + (Math.round(Number(a) * 100) / 100);
    const have = new Set(state.folders.filter((x) => x.type === 'cargos').flatMap((x) => cargosOf(x).map((c) => key(c.name, c.amount))));
    let added = 0;
    list.forEach((r) => {
      const name = String(r.name || r.nombre || '').trim().slice(0, 80), amount = Math.round(Number(r.amount ?? r.importe) * 100) / 100;
      const period = PERIODS[r.period || r.periodicidad] ? (r.period || r.periodicidad) : 'mensual';
      let day = parseInt(r.day ?? r.dia, 10), start = /^\d{4}-\d{2}-\d{2}$/.test(r.start || '') ? r.start : null;
      if (!name || !isFinite(amount) || amount < 0 || (!start && !(day >= 1 && day <= 31))) return;
      if (have.has(key(name, amount))) return;
      if (!start) start = dayKey(firstForDay(day)); else day = parseDay(start).getDate();
      f.items.push({ id: uid(), kind: 'cargo', created: Date.now(), name, amount, account: String(r.account || r.cuenta || '').slice(0, 40), period, mode: start && r.start ? 'date' : 'day', start, day });
      have.add(key(name, amount)); added++;
    });
    return added;
  }
  function doImp(f, txt, err) {
    try { const n = importCargos(f, parseCargos(txt)); closeSheet(true); save(); render(); toast(n ? `${plural(n, 'cargo importado', 'cargos importados')} ✓` : 'Sin cargos nuevos (ya estaban)'); }
    catch (_) { toast(err); }
  }
  // Enlace #importar-cargos=<base64url JSON>: el fragmento nunca llega al servidor.
  function linkImport() {
    const m = location.hash.match(/^#importar-cargos=([\w-]+)/); if (!m) return;
    history.replaceState(null, '', location.pathname + location.search + '#/');
    let list;
    try { const b = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')); list = parseCargos(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)))); list = Array.isArray(list) ? list : list.cargos; if (!Array.isArray(list)) throw 0; }
    catch (_) { toast('Enlace no válido'); return; }
    confirmSheet('Importar cargos', `Se van a añadir ${plural(list.length, 'cargo', 'cargos')} a la carpeta Cargos (los repetidos se omiten).`, 'Añadir', () => {
      const n = importCargos(null, list); save(); render(); toast(n ? `${plural(n, 'cargo importado', 'cargos importados')} ✓` : 'Sin cargos nuevos (ya estaban)');
    });
  }
  function cargoHtml(c) {
    const d = nextCharge(c), n = daysUntil(d), u = urgency(n);
    return `<div class="item cargo ${u}" data-id="${c.id}" data-cedit="${c.id}" tabindex="0">
      <div class="cargo-ico">💳</div>
      <div class="body"><div class="txt">${esc(c.name)}</div>
        <div class="sub">${esc(fmtDate(d))} · ${PERIODS[c.period]?.[1] || 'Mensual'}${c.account ? ' · ' + esc(c.account) : ''}</div></div>
      <div class="cargo-side"><b>${eur(c.amount)}</b><span class="cd">${countdown(n)}</span></div>
      <button class="menu" data-menu="${c.id}" aria-label="Opciones">⋯</button></div>`;
  }
  function cargoForm(f, c) {
    const editing = !!c;
    const d = c ? { ...c } : { name: '', amount: '', account: '', period: 'mensual', mode: 'date', start: dayKey(), day: new Date().getDate() };
    const nd = c ? nextCharge(c) : null;
    const sheet = openSheet(`<h3>${editing ? 'Editar cargo' : 'Nuevo cargo'}</h3>
      <label class="lbl" for="cn">Nombre</label>
      <input class="field" id="cn" maxlength="60" placeholder="Ej. Luz, Netflix, Seguro coche…" value="${esc(d.name)}">
      <label class="lbl" for="ca">Importe (€)</label>
      <input class="field" id="ca" inputmode="decimal" placeholder="0,00" value="${d.amount !== '' ? esc(String(d.amount).replace('.', ',')) : ''}">
      <label class="lbl" for="cc">Cuenta / tarjeta</label>
      <input class="field" id="cc" maxlength="60" placeholder="Ej. BBVA ··1234, Visa" value="${esc(d.account || '')}">
      <label class="lbl">Periodicidad</label>
      <div class="seg" id="cp">${Object.entries(PERIODS).map(([k, [, l]]) => `<button type="button" data-p="${k}">${l}</button>`).join('')}</div>
      <label class="lbl">¿Cuándo se cobra?</label>
      <div class="type-grid">
        <button type="button" data-m="date"><b>📅 Fecha</b><small>Próximo cargo</small></button>
        <button type="button" data-m="day"><b>🗓️ Día del mes</b><small>Ej. el día 5</small></button></div>
      <div id="m-date"><label class="lbl" for="cd">Fecha del próximo cargo</label><input class="field" id="cd" type="date" value="${nd ? dayKey(nd) : esc(d.start)}"></div>
      <div id="m-day"><label class="lbl" for="cdy">Día del mes (1–31)</label><input class="field" id="cdy" type="number" min="1" max="31" inputmode="numeric" value="${d.day || ''}"></div>
      <div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button><button class="btn primary" data-x="ok">${editing ? 'Guardar' : 'Añadir cargo'}</button></div>`);
    const paint = () => {
      sheet.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('on', b.dataset.p === d.period));
      sheet.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === d.mode));
      $('#m-date', sheet).hidden = d.mode !== 'date'; $('#m-day', sheet).hidden = d.mode !== 'day';
    };
    paint();
    sheet.onclick = (e) => {
      const pb = e.target.closest('[data-p]'); if (pb) { d.period = pb.dataset.p; paint(); return; }
      const mb = e.target.closest('[data-m]'); if (mb) { d.mode = mb.dataset.m; paint(); return; }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'no') closeSheet();
      if (x !== 'ok') return;
      const bad = (el) => { el.focus(); el.style.borderColor = 'var(--danger)'; };
      const name = $('#cn', sheet).value.trim(); if (!name) return bad($('#cn', sheet));
      const amount = parseFloat($('#ca', sheet).value.replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      if (!isFinite(amount) || amount < 0) return bad($('#ca', sheet));
      let start, day;
      if (d.mode === 'day') {
        day = parseInt($('#cdy', sheet).value, 10); if (!(day >= 1 && day <= 31)) return bad($('#cdy', sheet));
        start = dayKey(firstForDay(day));
      } else {
        const v = $('#cd', sheet).value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return bad($('#cd', sheet));
        start = v; day = parseDay(v).getDate();
      }
      const data = { name, amount: Math.round(amount * 100) / 100, account: $('#cc', sheet).value.trim(), period: d.period, mode: d.mode, start, day };
      if (editing) Object.assign(c, data); else f.items.push({ id: uid(), kind: 'cargo', created: Date.now(), ...data });
      vibrate(10); save(); closeSheet(); render();
    };
    if (!editing) setTimeout(() => $('#cn', sheet)?.focus(), 350);
  }
  function cargoMenu(f, c) {
    openSheet(`<h3>💳 ${esc(c.name)}</h3><div class="menu-list">
      <button data-x="edit"><span class="mi">✏️</span>Editar cargo</button>
      <button data-x="del" class="danger"><span class="mi">🗑️</span>Eliminar cargo</button></div>`, (s) => {
      s.onclick = (e) => {
        const x = e.target.closest('[data-x]')?.dataset.x;
        if (x === 'edit') cargoForm(f, c);
        if (x === 'del') {
          const i = f.items.indexOf(c); f.items.splice(i, 1); save(); closeSheet(); render(); vibrate(15);
          toast('Cargo eliminado', 'Deshacer', () => { f.items.splice(i, 0, c); save(); render(); });
        }
      };
    });
  }

  // ---------- Router ----------
  let lastRoute = '';
  function route() {
    const m = location.hash.match(/^#\/f\/([\w-]+)/);
    return m ? { view: 'folder', id: m[1] } : { view: 'home' };
  }
  function go(hash) { if (location.hash !== hash) location.hash = hash; else render(); }
  window.addEventListener('hashchange', () => { closeSheet(true); render(); });

  function render() {
    const r = route();
    const app = $('#app');
    const key = r.view + (r.id || '');
    const back = lastRoute.startsWith('folder') && r.view === 'home';
    const anim = key !== lastRoute;
    lastRoute = key;
    if (r.view === 'folder') {
      const f = folderById(r.id);
      if (!f) { location.replace('#/'); return; }
      app.innerHTML = folderView(f);
      bindFolder(f);
    } else {
      app.innerHTML = homeView();
      bindHome();
    }
    const v = $('.view', app);
    if (v && !anim) v.style.animation = 'none';
    if (v && back) v.classList.add('back-anim');
    if (anim) window.scrollTo(0, 0);
  }

  function folderStyle(f) {
    const [a, b] = GRADIENTS[f.color] || GRADIENTS.violeta;
    return `--f-grad: linear-gradient(135deg, ${a}, ${b}); --f1: ${a}; --f-shadow: ${a}aa;`;
  }

  // ---------- Inicio ----------
  function greeting() {
    const h = new Date().getHours();
    return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  }
  function folderMeta(f) {
    if (f.type === 'rutina') {
      const p = progress(f), s = streak(f);
      if (!p.total) return { text: 'Sin pasos aún' };
      return { text: `${p.done}/${p.total} hoy${s ? ` · 🔥 ${s}` : ''}`, bar: Math.round((p.done / p.total) * 100) };
    }
    if (f.type === 'compra') {
      const pend = f.items.filter((i) => i.kind === 'check' && !i.done).length;
      return { text: f.items.length ? (pend ? plural(pend, 'por comprar', 'por comprar') : 'Todo comprado ✓') : 'Lista vacía' };
    }
    if (f.type === 'cargos') {
      const cs = cargosOf(f);
      if (!cs.length) return { text: 'Sin cargos' };
      const n = Math.min(...cs.map((c) => daysUntil(nextCharge(c))));
      return { text: `${eur(monthlyTotal(cs))}/mes · próximo ${countdown(n)}` };
    }
    if (f.type === 'notas') {
      const v = f.items.filter((i) => i.kind === 'link' && youtubeId(i.url)).length;
      const n = f.items.length - v;
      if (!f.items.length) return { text: 'Vacía' };
      return { text: [v ? plural(v, 'vídeo', 'vídeos') : '', n ? plural(n, 'nota', 'notas') : ''].filter(Boolean).join(' · ') };
    }
    const pend = f.items.filter((i) => i.kind === 'check' && !i.done).length;
    return { text: f.items.length ? (pend ? plural(pend, 'pendiente', 'pendientes') : plural(f.items.length, 'elemento', 'elementos')) : 'Vacía' };
  }
  function homeView() {
    const now = new Date();
    let date = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    date = date.charAt(0).toUpperCase() + date.slice(1);
    const routines = state.folders.filter((f) => f.type === 'rutina' && checks(f).length);
    const doneR = routines.filter((f) => { const p = progress(f); return p.done === p.total; }).length;
    const shop = state.folders.filter((f) => f.type === 'compra').reduce((n, f) => n + f.items.filter((i) => i.kind === 'check' && !i.done).length, 0);
    const bestS = Math.max(0, ...state.folders.filter((f) => f.type === 'rutina').map(streak));
    const pills = [];
    if (routines.length) pills.push(`<div class="pill">🔁 Rutinas hoy <b>${doneR}/${routines.length}</b></div>`);
    if (bestS) pills.push(`<div class="pill">🔥 Racha <b>${plural(bestS, 'día', 'días')}</b></div>`);
    if (shop) pills.push(`<div class="pill">🛒 <b>${shop}</b> por comprar</div>`);
    return `<main class="view">
      <header class="home-head">
        <div><div class="date">${esc(date)}</div><h1>${greeting()},<br><span>Iñaki</span></h1></div>
        <button class="icon-btn" data-act="settings" aria-label="Ajustes">⚙️</button>
      </header>
      ${pills.length ? `<div class="summary">${pills.join('')}</div>` : ''}
      ${dueBanner()}
      <section class="grid">
        ${state.folders.map((f, i) => {
          const m = folderMeta(f);
          return `<div class="folder" role="button" tabindex="0" style="${folderStyle(f)} --i:${i}" data-open="${f.id}" aria-label="Abrir ${esc(f.name)}">
            <button class="more" data-more="${f.id}" aria-label="Opciones de ${esc(f.name)}">⋯</button>
            <div class="emoji">${esc(f.emoji)}</div>
            <div><div class="name">${esc(f.name)}</div><div class="meta">${esc(m.text)}</div>
            ${m.bar !== undefined ? `<div class="mini-bar"><i style="width:${m.bar}%"></i></div>` : ''}</div>
          </div>`;
        }).join('')}
        <button class="folder new" data-act="new-folder" style="--i:${state.folders.length}"><div class="plus">+</div><div class="name">Nueva carpeta</div></button>
      </section>
    </main>`;
  }
  let bannerHidden = false;
  function dueBanner() {
    const up = upcomingCharges();
    if (!up.length || bannerHidden) return '';
    return `<section class="due-banner ${up.some((x) => x.n <= ALERT_DAYS) ? 'red' : 'orange'}">
      <div class="due-head"><b>💳 Próximos cargos</b><span>en ${WARN_DAYS} días: ${up.length}</span><button data-act="hide-banner" aria-label="Ocultar">✕</button></div>
      ${up.map((x) => `<button class="due-row ${urgency(x.n)}" data-open="${x.f.id}"><span>${esc(x.c.name)}</span><small>${countdown(x.n)}</small><b>${eur(x.c.amount)}</b></button>`).join('')}
    </section>`;
  }
  function bindHome() {
    const app = $('#app');
    app.onclick = (e) => {
      const more = e.target.closest('[data-more]');
      if (more) { e.stopPropagation(); folderMenu(folderById(more.dataset.more)); return; }
      const open = e.target.closest('[data-open]');
      if (open) { vibrate(); go('#/f/' + open.dataset.open); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new-folder') folderForm();
      if (act === 'settings') settingsMenu();
      if (act === 'hide-banner') { bannerHidden = true; render(); }
    };
    app.onkeydown = (e) => { const o = e.target.closest('[data-open]'); if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go('#/f/' + o.dataset.open); } };
    bindLongPress(app, '.folder[data-open]', (el) => folderMenu(folderById(el.dataset.open)));
  }

  // ---------- Vista carpeta ----------
  const kindState = {}; // tipo de elemento seleccionado por carpeta
  function kindsFor(f) {
    if (f.type === 'compra') return [];
    if (f.type === 'rutina') return [['check', '☑️ Paso'], ['note', '📝 Nota']];
    if (f.type === 'notas') return [['note', '📝 Nota'], ['link', '▶️ Vídeo'], ['check', '☑️ Tarea']];
    return [['check', '☑️ Tarea'], ['note', '📝 Nota'], ['link', '🔗 Enlace']];
  }
  function defaultKind(f) { return f.type === 'notas' ? 'note' : 'check'; }
  function placeholder(f, k) {
    if (f.type === 'compra') return 'Añadir producto… (ej. leche)';
    if (k === 'link') return 'Pega un enlace (YouTube o web)…';
    if (k === 'note') return 'Escribe una nota…';
    if (f.type === 'rutina') return 'Nuevo paso de la rutina…';
    return 'Nueva tarea…';
  }

  function itemHtml(f, it) {
    const menu = `<button class="menu" data-menu="${it.id}" aria-label="Opciones">⋯</button>`;
    if (it.kind === 'check') {
      return `<div class="item check-item ${it.done ? 'done' : ''}" data-id="${it.id}" data-toggle="${it.id}" role="checkbox" aria-checked="${!!it.done}" tabindex="0">
        <div class="check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="body"><div class="txt">${esc(it.text)}</div></div>${menu}</div>`;
    }
    if (it.kind === 'link') {
      const yt = youtubeId(it.url);
      if (yt) {
        const title = it.title || 'Vídeo de YouTube';
        return `<div class="item video" data-id="${it.id}">
          <div class="vid-slot" data-slot="${it.id}"><button class="thumb" data-play="${it.id}" style="background-image:url('https://i.ytimg.com/vi/${yt}/hqdefault.jpg')" aria-label="Reproducir ${esc(title)}"><span class="play"></span><span class="badge">▶ YouTube</span></button></div>
          <div class="row"><div class="body"><div class="txt"><b>${esc(title)}</b></div>${it.text ? `<div class="sub" style="white-space:normal">${esc(it.text)}</div>` : ''}</div>${menu}</div></div>`;
      }
      return `<div class="item link" data-id="${it.id}" data-link="${it.id}">
        <div class="link-ico">🔗</div><div class="body"><div class="txt">${esc(it.title || it.text || hostOf(it.url))}</div><div class="sub">${esc(hostOf(it.url))}</div></div>${menu}</div>`;
    }
    return `<div class="item note" data-id="${it.id}" data-edit="${it.id}">
      <div class="note-ico">📝</div><div class="body"><div class="txt">${esc(it.text)}</div></div>${menu}</div>`;
  }

  function folderView(f) {
    const t = TYPES[f.type] || TYPES.normal;
    let hero = '';
    if (f.type === 'rutina') {
      const p = progress(f), s = streak(f), pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      const set = new Set(f.completedDays);
      const week = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6)).map((d, i) =>
        `<div>${DAYS_SHORT[d.getDay()]}<i class="${set.has(dayKey(d)) ? 'on' : ''} ${i === 6 ? 'today' : ''}">${set.has(dayKey(d)) ? '✓' : d.getDate()}</i></div>`).join('');
      hero = `<div class="progress-wrap">
          <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
          <div class="progress-text"><b>${p.done}/${p.total}</b><small>${p.total ? (p.done === p.total ? '¡Rutina completada hoy! 🎉' : 'completados hoy') : 'Añade los pasos de tu rutina'}</small></div>
          <div class="streak ${s ? 'hot' : ''}"><span class="fire">🔥</span><b>${s}</b><small>${s === 1 ? 'día seguido' : 'días seguidos'}</small></div>
        </div>
        <div class="week">${week}</div>`;
    } else if (f.type === 'cargos') {
      const cs = cargosOf(f), soon = cs.filter((c) => daysUntil(nextCharge(c)) <= WARN_DAYS);
      hero = `<div class="progress-wrap"><div class="progress-text"><b>${eur(monthlyTotal(cs))}</b><small>estimado al mes · ${plural(cs.length, 'cargo', 'cargos')}${soon.length ? ` · ${soon.length} en ${WARN_DAYS} días` : ''}</small></div></div>`;
    } else if (f.type === 'compra') {
      const pend = f.items.filter((i) => i.kind === 'check' && !i.done).length;
      const bought = f.items.filter((i) => i.kind === 'check' && i.done).length;
      hero = `<div class="progress-wrap"><div class="progress-text"><b>${plural(pend, 'producto', 'productos')}</b><small>por comprar${bought ? ` · ${bought} en el carro` : ''}</small></div></div>`;
    }

    let body;
    if (f.type === 'cargos') {
      const cs = cargosOf(f).map((c) => [c, nextCharge(c)]).sort((a, b) => a[1] - b[1]);
      body = cs.length ? `<div class="list">${cs.map(([c]) => cargoHtml(c)).join('')}</div>${forecastHtml(cargosOf(f))}`
        : `<div class="empty"><span class="big">💳</span><b>Sin cargos todavía</b>Añade tus recibos domiciliados y te avisaremos antes de cada cargo.</div>`;
    } else if (!f.items.length) {
      const msg = {
        compra: ['🛒', 'Tu lista está vacía', 'Escribe abajo lo que necesitas comprar.'],
        rutina: ['🌱', 'Crea tu rutina', 'Añade pasos abajo. Cada día se desmarcan solos.'],
        notas: ['🎬', 'Nada guardado todavía', 'Pega un enlace de YouTube o escribe una nota.'],
        normal: ['📝', 'Carpeta vacía', 'Añade tareas, notas o enlaces abajo.'],
      }[f.type] || ['📝', 'Carpeta vacía', ''];
      body = `<div class="empty"><span class="big">${msg[0]}</span><b>${msg[1]}</b>${msg[2]}</div>`;
    } else if (f.type === 'compra') {
      const pend = f.items.filter((i) => !(i.kind === 'check' && i.done));
      const done = f.items.filter((i) => i.kind === 'check' && i.done);
      body = `<div class="list">${pend.map((i) => itemHtml(f, i)).join('')}</div>
        ${done.length ? `<div class="section-title"><span>En el carro (${done.length})</span><button data-act="clear-bought">🗑️ Borrar comprados</button></div>
        <div class="list">${done.map((i) => itemHtml(f, i)).join('')}</div>` : ''}`;
    } else if (f.type === 'normal') {
      const pend = f.items.filter((i) => !(i.kind === 'check' && i.done));
      const done = f.items.filter((i) => i.kind === 'check' && i.done);
      body = `<div class="list">${pend.map((i) => itemHtml(f, i)).join('')}</div>
        ${done.length ? `<div class="section-title"><span>Hechas (${done.length})</span><button data-act="clear-bought">🗑️ Borrar hechas</button></div>
        <div class="list">${done.map((i) => itemHtml(f, i)).join('')}</div>` : ''}`;
    } else {
      body = `<div class="list">${f.items.map((i) => itemHtml(f, i)).join('')}</div>`;
    }

    const kinds = kindsFor(f);
    const k = kindState[f.id] && kinds.some(([x]) => x === kindState[f.id]) ? kindState[f.id] : defaultKind(f);
    return `<main class="view ${f.type === 'rutina' ? 'routine' : ''}" style="${folderStyle(f)}">
      <section class="f-hero">
        <div class="f-top">
          <button class="icon-btn" data-act="back" aria-label="Volver">←</button>
          <button class="icon-btn" data-act="folder-menu" aria-label="Opciones de carpeta">⋯</button>
        </div>
        <div class="f-title"><div class="emoji">${esc(f.emoji)}</div><div><h2>${esc(f.name)}</h2><div class="type">${t.icon} ${t.label}</div></div></div>
        ${hero}
      </section>
      ${body}
      ${f.type === 'cargos' ? `<div class="addbar"><div class="addbar-inner"><button class="btn imp-cargos" data-act="imp-cargos" aria-label="Importar cargos desde archivo JSON">📥 Importar</button><button class="btn primary add-cargo" data-act="add-cargo">+ Añadir cargo</button><input type="file" id="impc" hidden></div></div>` : `<div class="addbar"><div class="addbar-inner">
        ${kinds.length ? `<div class="kinds">${kinds.map(([x, l]) => `<button data-kind="${x}" class="${x === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
        <form class="add-row" autocomplete="off">
          <textarea rows="1" id="add-input" placeholder="${esc(placeholder(f, k))}" enterkeyhint="${k === 'note' ? 'enter' : 'done'}" aria-label="Añadir"></textarea>
          <button class="send" type="submit" aria-label="Añadir">+</button>
        </form>
      </div></div>`}
    </main>`;
  }

  function bindFolder(f) {
    const app = $('#app');
    if (f.type === 'cargos') return bindCargos(f);
    const input = $('#add-input');
    const kinds = kindsFor(f);
    const curKind = () => (kinds.length ? ($('.kinds .on')?.dataset.kind || defaultKind(f)) : 'check');
    const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
    input.addEventListener('input', grow);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && curKind() !== 'note') { e.preventDefault(); submit(); }
    });
    $('.add-row').onsubmit = (e) => { e.preventDefault(); submit(); };

    function submit() {
      const raw = input.value.trim();
      if (!raw) { input.focus(); return; }
      let kind = curKind();
      const it = { id: uid(), created: Date.now(), done: false };
      if (kind === 'link' || (f.type !== 'compra' && isUrl(raw))) {
        const parts = raw.split(/\s+/);
        const url = parts.find(isUrl);
        if (!url) { toast('Eso no parece un enlace válido'); return; }
        Object.assign(it, { kind: 'link', url: normUrl(url), text: parts.filter((p) => p !== url).join(' ') });
        fetchTitle(f, it);
      } else if (kind === 'note') {
        Object.assign(it, { kind: 'note', text: raw });
      } else {
        // En compra y listas: varias líneas = varios elementos
        const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
        if (lines.length > 1) {
          lines.forEach((l) => f.items.push({ id: uid(), created: Date.now(), done: false, kind: 'check', text: l }));
          afterAdd(); return;
        }
        Object.assign(it, { kind: 'check', text: raw });
      }
      f.items.push(it);
      afterAdd();
    }
    function afterAdd() {
      vibrate(10);
      updateCompletion(f); save(); render();
      const inp = $('#add-input'); inp && inp.focus({ preventScroll: true });
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    }

    app.onclick = (e) => {
      const kb = e.target.closest('[data-kind]');
      if (kb) {
        kindState[f.id] = kb.dataset.kind;
        document.querySelectorAll('.kinds button').forEach((b) => b.classList.toggle('on', b === kb));
        input.placeholder = placeholder(f, kb.dataset.kind);
        input.setAttribute('enterkeyhint', kb.dataset.kind === 'note' ? 'enter' : 'done');
        input.focus(); return;
      }
      const menu = e.target.closest('[data-menu]');
      if (menu) { e.stopPropagation(); itemMenu(f, f.items.find((i) => i.id === menu.dataset.menu)); return; }
      const play = e.target.closest('[data-play]');
      if (play) { playVideo(f, play.dataset.play); return; }
      const tg = e.target.closest('[data-toggle]');
      if (tg) { toggle(f, tg.dataset.toggle, tg); return; }
      const ln = e.target.closest('[data-link]');
      if (ln) { const it = f.items.find((i) => i.id === ln.dataset.link); window.open(it.url, '_blank', 'noopener'); return; }
      const ed = e.target.closest('[data-edit]');
      if (ed) { itemForm(f, f.items.find((i) => i.id === ed.dataset.edit)); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'back') { history.length > 1 && lastWasHome ? history.back() : go('#/'); }
      if (act === 'folder-menu') folderMenu(f);
      if (act === 'clear-bought') clearDone(f);
    };
    app.onkeydown = (e) => {
      const tg = e.target.closest('[data-toggle]');
      if (tg && e.target === tg && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggle(f, tg.dataset.toggle, tg); }
    };
    bindLongPress(app, '.item', (el) => itemMenu(f, f.items.find((i) => i.id === el.dataset.id)));
    // Recuperar títulos de vídeos que no lo tengan (una vez por sesión)
    f.items.filter((i) => i.kind === 'link' && !i.title && youtubeId(i.url) && !titleTried.has(i.id))
      .forEach((i) => { titleTried.add(i.id); fetchTitle(f, i); });
  }
  function bindCargos(f) {
    const app = $('#app');
    const find = (id) => f.items.find((i) => i.id === id);
    app.onclick = (e) => {
      const menu = e.target.closest('[data-menu]');
      if (menu) { e.stopPropagation(); cargoMenu(f, find(menu.dataset.menu)); return; }
      const ed = e.target.closest('[data-cedit]');
      if (ed) { cargoForm(f, find(ed.dataset.cedit)); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'back') { history.length > 1 && lastWasHome ? history.back() : go('#/'); }
      if (act === 'folder-menu') folderMenu(f);
      if (act === 'add-cargo') cargoForm(f);
      if (act === 'imp-cargos') openSheet(`<h3>📥 Importar cargos</h3><div class="menu-list"><button data-x="file"><span class="mi">📄</span>Elegir archivo</button></div>
        <textarea id="impt" rows="5" placeholder="…o pega aquí el texto JSON" style="width:100%;box-sizing:border-box;margin-top:12px;font:13px monospace;padding:10px;border-radius:12px"></textarea>
        <div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button><button class="btn primary" data-x="paste">Pegar texto</button></div>`, (s) => {
        s.onclick = (e) => { const x = e.target.closest('[data-x]')?.dataset.x;
          if (x === 'no') closeSheet(); if (x === 'file') { closeSheet(true); $('#impc').click(); }
          if (x === 'paste') doImp(f, $('#impt', s).value, 'Texto no válido'); };
      });
    };
    $('#impc').onchange = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (file) doImp(f, await file.text(), 'Archivo no válido'); };
    app.onkeydown = (e) => { const ed = e.target.closest('[data-cedit]'); if (ed && e.target === ed && e.key === 'Enter') cargoForm(f, find(ed.dataset.cedit)); };
    bindLongPress(app, '.item', (el) => cargoMenu(f, find(el.dataset.id)));
  }
  const titleTried = new Set();
  let lastWasHome = false;
  window.addEventListener('hashchange', (e) => { lastWasHome = !/#\/f\//.test(e.oldURL) && /#\/f\//.test(e.newURL); });

  function toggle(f, id, el) {
    const it = f.items.find((i) => i.id === id);
    if (!it) return;
    it.done = !it.done;
    vibrate(it.done ? 12 : 6);
    const completedNow = updateCompletion(f);
    save();
    el.classList.toggle('done', it.done);
    // pequeña pausa para ver la animación antes de reordenar
    setTimeout(() => {
      render();
      if (completedNow) { celebrate(); toast(`¡${f.name} completada! Racha: ${plural(streak(f), 'día', 'días')} 🔥`); }
    }, f.type === 'compra' || f.type === 'normal' ? 280 : 120);
  }

  function clearDone(f) {
    const removed = f.items.filter((i) => i.kind === 'check' && i.done);
    if (!removed.length) return;
    const before = f.items.slice();
    f.items = f.items.filter((i) => !(i.kind === 'check' && i.done));
    save(); render(); vibrate(15);
    toast(`${plural(removed.length, 'elemento borrado', 'elementos borrados')}`, 'Deshacer', () => { f.items = before; save(); render(); });
  }

  function playVideo(f, id) {
    const it = f.items.find((i) => i.id === id);
    const yt = youtubeId(it?.url);
    if (!yt) return;
    // Solo un vídeo reproduciéndose a la vez
    document.querySelectorAll('.player').forEach((p) => { const s = p.parentElement; const other = f.items.find((i) => i.id === s.dataset.slot); if (other) s.innerHTML = thumbHtml(other); });
    const slot = document.querySelector(`[data-slot="${id}"]`);
    if (!navigator.onLine) { toast('Sin conexión: el vídeo necesita internet'); return; }
    let start = 0;
    try { const u = new URL(it.url); const t = u.searchParams.get('t') || u.searchParams.get('start'); if (t) start = parseInt(t, 10) || 0; } catch (_) {}
    slot.innerHTML = `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0&modestbranding=1${start ? '&start=' + start : ''}" title="${esc(it.title || 'Vídeo de YouTube')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }
  function thumbHtml(it) {
    const yt = youtubeId(it.url);
    return `<button class="thumb" data-play="${it.id}" style="background-image:url('https://i.ytimg.com/vi/${yt}/hqdefault.jpg')" aria-label="Reproducir"><span class="play"></span><span class="badge">▶ YouTube</span></button>`;
  }

  // Título del vídeo (si hay conexión) usando oEmbed.
  async function fetchTitle(f, it) {
    titleTried.add(it.id);
    if (!youtubeId(it.url) || !navigator.onLine) return;
    const urls = [
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(it.url)}`,
      `https://noembed.com/embed?url=${encodeURIComponent(it.url)}`,
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u); if (!r.ok) continue;
        const j = await r.json();
        if (j.title) { it.title = j.title; if (j.author_name) it.author = j.author_name; save(); if (route().id === f.id) render(); return; }
      } catch (_) {}
    }
  }

  // ---------- Pulsación larga ----------
  function bindLongPress(root, sel, cb) {
    let timer = null, startX = 0, startY = 0, fired = false;
    root.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(sel);
      if (!el || e.target.closest('button.menu, button.more, iframe')) return;
      fired = false; startX = e.clientX; startY = e.clientY;
      timer = setTimeout(() => { fired = true; vibrate(20); cb(el); }, 520);
    });
    const cancel = () => clearTimeout(timer);
    root.addEventListener('pointerup', cancel);
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 10) cancel(); });
    root.addEventListener('click', (e) => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
    root.addEventListener('contextmenu', (e) => { if (e.target.closest(sel)) e.preventDefault(); });
  }

  // ---------- Hojas ----------
  let sheetCleanup = null;
  function openSheet(html, mount) {
    closeSheet(true);
    const root = $('#sheet-root');
    root.innerHTML = `<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
    const sheet = $('.sheet', root);
    $('.backdrop', root).onclick = () => closeSheet();
    // Arrastrar hacia abajo para cerrar
    let y0 = null;
    $('.grabber', root).addEventListener('pointerdown', (e) => { y0 = e.clientY; });
    sheet.addEventListener('pointermove', (e) => { if (y0 !== null) { const dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; } });
    sheet.addEventListener('pointerup', (e) => { if (y0 !== null) { const dy = e.clientY - y0; y0 = null; sheet.style.transform = ''; if (dy > 80) closeSheet(); } });
    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    sheetCleanup = () => document.removeEventListener('keydown', onKey);
    mount && mount(sheet);
    return sheet;
  }
  function closeSheet(instant) {
    const root = $('#sheet-root');
    if (!root || !root.firstChild) return;
    sheetCleanup && sheetCleanup(); sheetCleanup = null;
    if (instant) { root.innerHTML = ''; return; }
    root.querySelectorAll('.sheet, .backdrop').forEach((el) => el.classList.add('closing'));
    setTimeout(() => { root.innerHTML = ''; }, 200);
  }
  function confirmSheet(title, text, okLabel, onOk) {
    openSheet(`<h3>${esc(title)}</h3><p style="color:var(--muted);margin:0;line-height:1.45">${esc(text)}</p>
      <div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button><button class="btn danger" data-x="ok">${esc(okLabel)}</button></div>`, (s) => {
      s.onclick = (e) => { const x = e.target.closest('[data-x]')?.dataset.x; if (x === 'no') closeSheet(); if (x === 'ok') { closeSheet(); onOk(); } };
    });
  }

  // ---------- Menús de carpeta ----------
  function folderMenu(f) {
    if (!f) return;
    const others = state.folders.filter((x) => x.id !== f.id);
    const isRut = f.type === 'rutina';
    const othersM = others.filter((x) => x.type !== 'cargos');
    openSheet(`<h3>${esc(f.emoji)} ${esc(f.name)}</h3><div class="menu-list">
      <button data-x="edit"><span class="mi">✏️</span>Editar carpeta</button>
      ${isRut ? `<button data-x="stats"><span class="mi">📊</span>Estadísticas de la rutina</button><button data-x="reset"><span class="mi">↺</span>Desmarcar todo hoy</button>` : ''}
      ${othersM.length && f.items.length && f.type !== 'cargos' ? `<button data-x="merge"><span class="mi">🔀</span>Combinar con otra carpeta…</button>` : ''}
      <button data-x="up"><span class="mi">⬆️</span>Mover antes</button>
      <button data-x="down"><span class="mi">⬇️</span>Mover después</button>
      <button data-x="del" class="danger"><span class="mi">🗑️</span>Eliminar carpeta</button>
    </div>`, (s) => {
      s.onclick = (e) => {
        const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
        const idx = state.folders.indexOf(f);
        if (x === 'edit') folderForm(f);
        if (x === 'stats') {
          const total = new Set(f.completedDays).size;
          openSheet(`<h3>📊 ${esc(f.name)}</h3><div class="menu-list">
            <button><span class="mi">🔥</span>Racha actual: <b>&nbsp;${plural(streak(f), 'día', 'días')}</b></button>
            <button><span class="mi">🏆</span>Mejor racha: <b>&nbsp;${plural(bestStreak(f), 'día', 'días')}</b></button>
            <button><span class="mi">✅</span>Días completados: <b>&nbsp;${total}</b></button></div>
            <div class="sheet-actions"><button class="btn primary" data-x="ok">Cerrar</button></div>`, (s2) => { s2.onclick = (ev) => { if (ev.target.closest('[data-x]')) closeSheet(); }; });
          return;
        }
        if (x === 'reset') { f.items.forEach((i) => { i.done = false; }); updateCompletion(f); save(); closeSheet(); render(); }
        if (x === 'merge') { mergeFolder(f); return; }
        if (x === 'up' && idx > 0) { state.folders.splice(idx, 1); state.folders.splice(idx - 1, 0, f); save(); closeSheet(); render(); }
        if (x === 'down' && idx < state.folders.length - 1) { state.folders.splice(idx, 1); state.folders.splice(idx + 1, 0, f); save(); closeSheet(); render(); }
        if ((x === 'up' && idx === 0) || (x === 'down' && idx === state.folders.length - 1)) closeSheet();
        if (x === 'del') {
          confirmSheet('¿Eliminar carpeta?', `Se borrará «${f.name}» y ${plural(f.items.length, 'elemento', 'elementos')}. Podrás deshacerlo unos segundos.`, 'Eliminar', () => {
            const i = state.folders.indexOf(f);
            state.folders.splice(i, 1); save();
            if (route().id === f.id) go('#/'); else render();
            toast(`Carpeta «${f.name}» eliminada`, 'Deshacer', () => { state.folders.splice(i, 0, f); save(); render(); });
          });
        }
      };
    });
  }

  function folderPicker(title, exclude, cb) {
    const others = state.folders.filter((x) => x.id !== exclude && x.type !== 'cargos');
    openSheet(`<h3>${esc(title)}</h3><div class="menu-list">
      ${others.map((o) => `<button data-to="${o.id}"><span class="fdot" style="background:linear-gradient(135deg,${(GRADIENTS[o.color] || GRADIENTS.violeta).join(',')})">${esc(o.emoji)}</span>${esc(o.name)}<small style="margin-left:auto;color:var(--muted)">${TYPES[o.type]?.label || ''}</small></button>`).join('')}
    </div><div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button></div>`, (s) => {
      s.onclick = (e) => {
        if (e.target.closest('[data-x]')) { closeSheet(); return; }
        const b = e.target.closest('[data-to]'); if (!b) return;
        closeSheet(); cb(folderById(b.dataset.to));
      };
    });
  }

  function adaptItem(it, target) {
    const c = { ...it };
    if (target.type === 'rutina' || target.type === 'compra') c.done = false;
    // En lista de compra/rutina, las notas se convierten en casillas
    if ((target.type === 'compra') && c.kind === 'note') c.kind = 'check';
    return c;
  }

  function mergeFolder(f) {
    folderPicker(`Combinar «${f.name}» con…`, f.id, (target) => {
      openSheet(`<h3>🔀 Combinar carpetas</h3><p style="color:var(--muted);margin:0 0 6px;line-height:1.45">Se pasarán ${plural(f.items.length, 'elemento', 'elementos')} de «${esc(f.name)}» a «${esc(target.name)}».</p>
        <div class="menu-list">
          <button data-x="copy"><span class="mi">📋</span>Copiar (mantener ambas)</button>
          <button data-x="move"><span class="mi">➡️</span>Mover y dejar esta vacía</button>
          <button data-x="movedel" class="danger"><span class="mi">🗑️</span>Mover y eliminar «${esc(f.name)}»</button>
        </div><div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button></div>`, (s) => {
        s.onclick = (e) => {
          const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
          closeSheet(); if (x === 'no') return;
          const items = f.items.map((it) => adaptItem(x === 'copy' ? { ...it, id: uid() } : it, target));
          target.items.push(...items);
          if (x !== 'copy') f.items = [];
          updateCompletion(target); updateCompletion(f);
          if (x === 'movedel') state.folders.splice(state.folders.indexOf(f), 1);
          save();
          toast(`${plural(items.length, 'elemento', 'elementos')} → ${target.name}`);
          if (x === 'movedel') go('#/f/' + target.id); else render();
        };
      });
    });
  }

  function folderForm(f) {
    const editing = !!f;
    const d = f ? { ...f } : { name: '', emoji: '📌', color: 'cielo', type: 'normal' };
    const sheet = openSheet(`<h3>${editing ? 'Editar carpeta' : 'Nueva carpeta'}</h3>
      <div class="preview"><div class="folder" id="pv"><div class="emoji"></div><div><div class="name"></div><div class="meta"></div></div></div></div>
      <label class="lbl" for="fn">Nombre</label>
      <input class="field" id="fn" maxlength="40" placeholder="Ej. Trabajo, Casa, Lecturas…" value="${esc(d.name)}">
      <label class="lbl">Icono</label>
      <div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}</div>
      <input class="field" id="fe" style="margin-top:8px" maxlength="8" placeholder="…o escribe cualquier emoji" value="">
      <label class="lbl">Color</label>
      <div class="color-grid">${Object.entries(GRADIENTS).map(([k, [a, b]]) => `<button type="button" data-color="${k}" aria-label="${k}" style="background:linear-gradient(135deg,${a},${b})"></button>`).join('')}</div>
      <label class="lbl">Tipo de carpeta</label>
      <div class="type-grid">${Object.entries(TYPES).map(([k, t]) => `<button type="button" data-type="${k}"><b>${t.icon} ${t.label}</b><small>${t.desc}</small></button>`).join('')}</div>
      <div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button><button class="btn primary" data-x="ok">${editing ? 'Guardar' : 'Crear carpeta'}</button></div>`);
    const pv = $('#pv', sheet), fn = $('#fn', sheet), fe = $('#fe', sheet);
    function paint() {
      pv.setAttribute('style', folderStyle(d));
      $('.emoji', pv).textContent = d.emoji || '📌';
      $('.name', pv).textContent = fn.value.trim() || 'Mi carpeta';
      $('.meta', pv).textContent = TYPES[d.type].label;
      sheet.querySelectorAll('[data-emoji]').forEach((b) => b.classList.toggle('on', b.dataset.emoji === d.emoji));
      sheet.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === d.color));
      sheet.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('on', b.dataset.type === d.type));
    }
    paint();
    fn.oninput = paint;
    fe.oninput = () => { const v = fe.value.trim(); if (v) { d.emoji = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(v)].map((s) => s.segment).pop(); paint(); } };
    sheet.onclick = (e) => {
      const em = e.target.closest('[data-emoji]'); if (em) { d.emoji = em.dataset.emoji; fe.value = ''; paint(); return; }
      const co = e.target.closest('[data-color]'); if (co) { d.color = co.dataset.color; paint(); return; }
      const ty = e.target.closest('[data-type]'); if (ty) { d.type = ty.dataset.type; paint(); return; }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'no') closeSheet();
      if (x === 'ok') {
        const name = fn.value.trim();
        if (!name) { fn.focus(); fn.style.borderColor = 'var(--danger)'; return; }
        if (editing) {
          const becameRoutine = f.type !== 'rutina' && d.type === 'rutina';
          Object.assign(f, { name, emoji: d.emoji, color: d.color, type: d.type });
          if (becameRoutine) f.lastReset = dayKey();
          updateCompletion(f);
        } else {
          const nf = { id: uid(), name, emoji: d.emoji, color: d.color, type: d.type, items: [], completedDays: [], lastReset: dayKey(), created: Date.now() };
          state.folders.push(nf);
          save(); closeSheet(); go('#/f/' + nf.id); return;
        }
        save(); closeSheet(); render();
      }
    };
    if (!editing) setTimeout(() => fn.focus(), 350);
  }

  // ---------- Menú de elemento ----------
  function itemMenu(f, it) {
    if (!it) return;
    if (it.kind === 'cargo') return cargoMenu(f, it);
    const others = state.folders.filter((x) => x.id !== f.id && x.type !== 'cargos');
    const label = it.kind === 'link' ? (it.title || hostOf(it.url)) : it.text;
    openSheet(`<h3 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</h3><div class="menu-list">
      <button data-x="edit"><span class="mi">✏️</span>Editar</button>
      ${it.kind === 'link' ? `<button data-x="open"><span class="mi">↗️</span>Abrir ${youtubeId(it.url) ? 'en YouTube' : 'enlace'}</button><button data-x="copyurl"><span class="mi">🔗</span>Copiar enlace</button>` : ''}
      ${others.length ? `<button data-x="move"><span class="mi">➡️</span>Mover a otra carpeta…</button><button data-x="copy"><span class="mi">📋</span>Copiar a otra carpeta…</button>` : ''}
      <button data-x="top"><span class="mi">⬆️</span>Subir arriba del todo</button>
      <button data-x="del" class="danger"><span class="mi">🗑️</span>Eliminar</button>
    </div>`, (s) => {
      s.onclick = (e) => {
        const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
        if (x === 'edit') { itemForm(f, it); return; }
        if (x === 'open') { closeSheet(); window.open(it.url, '_blank', 'noopener'); return; }
        if (x === 'copyurl') { navigator.clipboard?.writeText(it.url).then(() => toast('Enlace copiado'), () => toast(it.url)); closeSheet(); return; }
        if (x === 'top') { f.items.splice(f.items.indexOf(it), 1); f.items.unshift(it); save(); closeSheet(); render(); return; }
        if (x === 'move' || x === 'copy') {
          folderPicker(x === 'move' ? 'Mover a…' : 'Copiar a…', f.id, (target) => {
            const c = adaptItem(x === 'copy' ? { ...it, id: uid(), created: Date.now() } : it, target);
            if (x === 'move') f.items.splice(f.items.indexOf(it), 1);
            target.items.push(c);
            updateCompletion(f); updateCompletion(target); save(); render();
            toast(`${x === 'move' ? 'Movido' : 'Copiado'} a ${target.emoji} ${target.name}`, 'Ir', () => go('#/f/' + target.id));
          });
          return;
        }
        if (x === 'del') {
          const i = f.items.indexOf(it);
          f.items.splice(i, 1); updateCompletion(f); save(); closeSheet(); render(); vibrate(15);
          toast('Elemento eliminado', 'Deshacer', () => { f.items.splice(i, 0, it); updateCompletion(f); save(); render(); });
        }
      };
    });
  }

  function itemForm(f, it) {
    const isLink = it.kind === 'link';
    const sheet = openSheet(`<h3>${isLink ? 'Editar enlace' : it.kind === 'note' ? 'Editar nota' : 'Editar'}</h3>
      ${isLink ? `<label class="lbl" for="iu">Enlace</label><input class="field" id="iu" type="url" inputmode="url" value="${esc(it.url)}">
                 <label class="lbl" for="ititle">Título</label><input class="field" id="ititle" value="${esc(it.title || '')}" placeholder="Opcional">
                 <label class="lbl" for="it">Nota</label><textarea class="field" id="it" style="min-height:90px" placeholder="Opcional">${esc(it.text || '')}</textarea>`
               : it.kind === 'note' ? `<textarea class="field" id="it" style="min-height:220px">${esc(it.text)}</textarea>`
               : `<input class="field" id="it" value="${esc(it.text)}">`}
      ${!isLink && f.type !== 'compra' ? `<label class="lbl">Tipo</label><div class="type-grid">
        <button type="button" data-k="check" class="${it.kind === 'check' ? 'on' : ''}"><b>☑️ Casilla</b><small>Se puede marcar</small></button>
        <button type="button" data-k="note" class="${it.kind === 'note' ? 'on' : ''}"><b>📝 Nota</b><small>Texto libre</small></button></div>` : ''}
      <div class="sheet-actions"><button class="btn" data-x="no">Cancelar</button><button class="btn primary" data-x="ok">Guardar</button></div>`);
    let kind = it.kind;
    sheet.onclick = (e) => {
      const k = e.target.closest('[data-k]');
      if (k) { kind = k.dataset.k; sheet.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', b === k)); return; }
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x === 'no') closeSheet();
      if (x === 'ok') {
        const text = $('#it', sheet).value.trim();
        if (isLink) {
          const url = $('#iu', sheet).value.trim();
          if (!isUrl(url)) { toast('Enlace no válido'); return; }
          const changed = normUrl(url) !== it.url;
          it.url = normUrl(url); it.title = $('#ititle', sheet).value.trim(); it.text = text;
          if (changed && !it.title) fetchTitle(f, it);
        } else {
          if (!text) { toast('El texto no puede estar vacío'); return; }
          it.text = text; it.kind = kind;
        }
        updateCompletion(f); save(); closeSheet(); render();
      }
    };
  }

  // ---------- Ajustes / copia de seguridad ----------
  function settingsMenu() {
    openSheet(`<h3>⚙️ Ajustes</h3><div class="menu-list">
      <button data-x="export"><span class="mi">💾</span>Exportar copia de seguridad</button>
      <button data-x="import"><span class="mi">📥</span>Importar copia de seguridad</button>
      <button data-x="install"><span class="mi">📲</span>Cómo instalar en el móvil</button>
      <button data-x="reset" class="danger"><span class="mi">♻️</span>Borrar todo y empezar de cero</button>
    </div>
    <p style="color:var(--muted);font-size:13px;text-align:center;margin:16px 0 0">Tus datos se guardan solo en este dispositivo.<br>Mis Tareas · v3</p>
    <input type="file" id="imp" hidden>`, (s) => {
      s.onclick = (e) => {
        const x = e.target.closest('[data-x]')?.dataset.x; if (!x) return;
        if (x === 'export') {
          const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mis-tareas-${dayKey()}.json`;
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          toast('Copia exportada'); closeSheet();
        }
        if (x === 'import') $('#imp', s).click();
        if (x === 'install') {
          openSheet(`<h3>📲 Instalar en el móvil</h3><div style="line-height:1.55;color:var(--muted)">
            <p><b style="color:var(--text)">Android (Chrome):</b> menú ⋮ → <i>Añadir a pantalla de inicio</i> o <i>Instalar aplicación</i>.</p>
            <p><b style="color:var(--text)">iPhone (Safari):</b> botón Compartir ⬆️ → <i>Añadir a pantalla de inicio</i>.</p>
            <p>Una vez instalada funciona sin conexión (excepto los vídeos).</p></div>
            <div class="sheet-actions"><button class="btn primary" data-x="ok">Entendido</button></div>`, (s2) => { s2.onclick = (ev) => { if (ev.target.closest('[data-x]')) closeSheet(); }; });
        }
        if (x === 'reset') confirmSheet('¿Borrar todo?', 'Se eliminarán todas las carpetas y elementos y se volverá a las carpetas iniciales vacías. Esta acción no se puede deshacer.', 'Borrar todo', () => { state = defaultState(); save(); go('#/'); render(); toast('Datos reiniciados'); });
      };
      $('#imp', s).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (!data || !Array.isArray(data.folders)) throw new Error();
          confirmSheet('¿Importar copia?', `Se reemplazarán tus datos actuales por ${plural(data.folders.length, 'carpeta', 'carpetas')} del archivo.`, 'Importar', () => {
            state = data; save(); load(); render(); toast('Copia importada ✓');
          });
        } catch (_) { toast('Archivo no válido'); }
      };
    });
  }

  // ---------- Toast y confeti ----------
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const root = $('#toast-root');
    clearTimeout(toastTimer);
    root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}</div>`;
    if (actionLabel) $('button', root).onclick = () => { root.innerHTML = ''; action(); };
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, actionLabel ? 5000 : 2600);
  }
  function celebrate() {
    vibrate([20, 40, 30]);
    const items = ['🎉', '✨', '⭐', '🔥', '💜', '🌟'];
    const cx = innerWidth / 2, cy = innerHeight * 0.3;
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('div');
      s.className = 'burst'; s.textContent = items[i % items.length];
      const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 160;
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r + 120 + 'px');
      s.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg');
      document.body.appendChild(s); setTimeout(() => s.remove(), 1200);
    }
  }

  // ---------- Arranque ----------
  load();
  const pendingLink = /^#importar-cargos=/.test(location.hash);
  if (!location.hash || pendingLink) history.replaceState(null, '', location.pathname + location.search + (pendingLink ? location.hash : '#/'));
  if (pendingLink) { const h = location.hash; history.replaceState(null, '', location.pathname + location.search + '#/'); render(); history.replaceState(null, '', h); linkImport(); } else render();
  window.addEventListener('hashchange', () => { if (/^#importar-cargos=/.test(location.hash)) { linkImport(); render(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dailyReset(); } });
  setInterval(() => dailyReset(), 60 * 1000);
  window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { load(); render(); } });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
