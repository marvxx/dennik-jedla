  // ---------- Panel sa dá stiahnuť prstom ----------
  // Ide za prstom 1:1, nad horným okrajom pruží, po pustení rozhodne rýchlosť švihnutia.
  let drag = null;
  function dragBegin(target, x, y, mouse) {
    const el = target.closest && target.closest('.sheet');
    if (!el || el.id !== openSheets[openSheets.length - 1]) return;
    const head = !!target.closest('.sheet-head');
    if (mouse && !head) return;   // myšou sa ťahá len za hlavičku, inak by to rušilo označovanie textu
    drag = { el, id: el.id, x0: x, y0: y, head, mode: null, hist: [] };
  }
  function dragMove(x, y, ev) {
    if (!drag) return;
    const dx = x - drag.x0, dy = y - drag.y0;
    const atTop = drag.el.scrollTop <= 0;
    if (!drag.mode) {
      // pri vrchu panela potiahnutie nadol nemá čo posúvať, tak ho hneď zachytíme
      if (ev && ev.cancelable && dy > 0 && dy >= Math.abs(dx) && (drag.head || atTop)) ev.preventDefault();
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;   // malý pohyb ešte nie je ťahanie
      if (dy > 0 && Math.abs(dy) > Math.abs(dx) && (drag.head || atTop)) {
        const st = sheetSt(drag.id);
        cancelAnimationFrame(st.raf);   // chytený aj počas animácie: pokračuje z aktuálnej polohy
        drag.mode = 'sheet';
        drag.base = st.x;
        drag.ys = y;
        drag.H = sheetH(drag.el);
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      } else { drag = null; return; }
    }
    if (ev && ev.cancelable) ev.preventDefault();
    const st = sheetSt(drag.id);
    let ny = drag.base + (y - drag.ys);
    if (ny < 0) ny = -rubberband(-ny, drag.H);
    st.x = ny; st.v = 0; st.o = 1;
    paintSheet(drag.el, st);
    const now = performance.now();
    drag.hist.push({ y, t: now });
    while (drag.hist.length > 2 && now - drag.hist[0].t > 100) drag.hist.shift();
  }
  function dragEnd() {
    const d = drag;
    drag = null;
    if (!d || d.mode !== 'sheet') return;
    const h = d.hist, a = h[0], b = h[h.length - 1];
    const v = h.length > 1 && b.t > a.t ? (b.y - a.y) / ((b.t - a.t) / 1000) : 0;
    const st = sheetSt(d.id);
    // rozhoduje miesto, kam by panel dobehol, nie kde ho prst pustil
    if (st.x + project(v) > d.H * 0.5 && v > -200) dismissTop(v);
    else moveSheet(d.id, true, v, SPRING_BACK);
  }
  document.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1) { drag = null; return; }
    dragBegin(ev.target, ev.touches[0].clientX, ev.touches[0].clientY, false);
  }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (drag && ev.touches.length === 1) dragMove(ev.touches[0].clientX, ev.touches[0].clientY, ev);
  }, { passive: false });
  document.addEventListener('touchend', dragEnd);
  document.addEventListener('touchcancel', dragEnd);
  document.addEventListener('pointerdown', ev => { if (ev.pointerType === 'mouse' && ev.button === 0) dragBegin(ev.target, ev.clientX, ev.clientY, true); });
  document.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse' && drag) dragMove(ev.clientX, ev.clientY, ev); });
  document.addEventListener('pointerup', ev => {
    if (ev.pointerType !== 'mouse' || !drag) return;
    // po ťahaní myšou nesmie klik zavrieť panel cez tlačidlo pod kurzorom
    if (drag.mode === 'sheet') {
      const swallow = e => { e.stopPropagation(); e.preventDefault(); };
      addEventListener('click', swallow, true);
      setTimeout(() => removeEventListener('click', swallow, true), 0);
    }
    dragEnd();
  });

  function render() {
    const v = currentView;
    if (v === 'today') renderToday();
    if (v === 'list') renderList();
    if (v === 'insights') renderInsights();
    if (v === 'settings') renderSettings();
    syncNavbar();
  }

  // Pri posúvaní sa veľký nadpis schová a hore ostane úzka lišta s názvom
  function syncNavbar() {
    const bar = document.getElementById('navbar');
    if (!bar) return;
    const h1 = $('.view.active .lt h1');
    bar.firstElementChild.textContent = h1 ? h1.textContent : '';
    bar.classList.toggle('show', window.scrollY > 46);
  }

  let doneTimer;
  function showDone() {
    const d = document.getElementById('done');
    d.classList.remove('show');
    void d.offsetWidth;   // znovu spustí animáciu
    d.classList.add('show');
    buzz(12);   // v tom istom okamihu ako fajka
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => d.classList.remove('show'), 800);
  }

  function switchView(v) {
    currentView = v;
    $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    $$('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    render();
    window.scrollTo(0, 0);
  }

  // Obsah dňa prichádza zo strany, kde ten deň leží v pásiku
  let dayAnimTimer;
  function goDay(d) {
    const prev = selDay;
    selDay = d;
    followToday = d === todayStr();
    if (currentView !== 'today') { switchView('today'); return; }
    renderToday();
    syncNavbar();
    if (d === prev) return;
    const v = $('#view-today');
    v.classList.remove('go-next', 'go-prev');
    void v.offsetWidth;
    v.classList.add(d > prev ? 'go-next' : 'go-prev');
    clearTimeout(dayAnimTimer);
    dayAnimTimer = setTimeout(() => v.classList.remove('go-next', 'go-prev'), 400);
  }

  // ---------- Čipy (tlačidlá na výber) ----------
  function chipGroup(field, options, opts) {
    opts = opts || {};
    const cur = opts.value !== undefined ? opts.value : draft[field];
    const kind = opts.kind || 'str';
    const multi = !!opts.multi;
    const attrs = opts.day ? ` data-day="${opts.day}"` : '';
    return `<div class="chips ${opts.cls || ''}" data-field="${field}" data-kind="${kind}"${multi ? ' data-multi="1"' : ''}${attrs}>` +
      options.map(o => {
        const v = Array.isArray(o) ? o[0] : o;
        const label = Array.isArray(o) ? o[1] : o;
        const on = multi ? (cur || []).includes(v) : cur === v;
        const extra = opts.chipCls ? ' ' + opts.chipCls(v) : '';
        return `<button type="button" class="chip${on ? ' on' : ''}${extra}" data-v="${esc(String(v))}">${esc(label)}</button>`;
      }).join('') + '</div>';
  }

  function parseChip(group, raw) {
    const k = group.dataset.kind;
    if (k === 'num') return Number(raw);
    if (k === 'bool') return raw === 'true';
    return raw;
  }

  function refreshGroup(group, cur) {
    const multi = !!group.dataset.multi;
    $$('.chip', group).forEach(c => {
      const v = parseChip(group, c.dataset.v);
      c.classList.toggle('on', multi ? (cur || []).includes(v) : cur === v);
    });
  }

