let todos = [];
const $ = (id) => document.getElementById(id);
const list = $('list');

const persist = () => window.api.save(todos);
const localDate = () => new Date().toLocaleDateString('sv-SE');   // YYYY-MM-DD (로컬 시간대)
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

/* ---------- 완료 항목 정렬 ---------- */
// bottom: 체크하면 맨 아래로 / top: 체크하면 맨 위로 / keep: 제자리
const SORT_MODES = {
  bottom: { icon: '↓', title: '체크하면 맨 아래로 (클릭: 맨 위로)' },
  top:    { icon: '↑', title: '체크하면 맨 위로 (클릭: 제자리)' },
  keep:   { icon: '↕', title: '체크해도 제자리 (클릭: 맨 아래로)' },
};
const SORT_NEXT = { bottom: 'top', top: 'keep', keep: 'bottom' };
let sortMode = SORT_MODES[store.get('sort', 'bottom')] ? store.get('sort', 'bottom') : 'bottom';

// 마감일순: 마감일 빠른 순, 마감일 없는 항목은 뒤로. 같은 날은 수동 순서 유지(stable)
let dateSort = store.get('dsort', '0') === '1';
const byDue = (a, b) => (a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.due ? -1 : b.due ? 1 : 0);
const sortDue = (arr) => (dateSort ? [...arr].sort(byDue) : arr);

function ordered() {
  if (sortMode === 'keep') return sortDue(todos);
  const open = sortDue(todos.filter((t) => !t.done));
  const done = todos.filter((t) => t.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0));
  return sortMode === 'bottom' ? [...open, ...done] : [...done, ...open];
}

function setSort(mode) {
  sortMode = mode;
  store.set('sort', mode);
  $('sort').textContent = SORT_MODES[mode].icon;
  $('sort').title = SORT_MODES[mode].title;
  render();
}

/* ---------- 마감일 ---------- */
function dueInfo(due) {
  const d = Math.round((Date.parse(due) - Date.parse(localDate())) / 86400000);
  const [, m, day] = due.split('-');
  let text = `${Number(m)}/${Number(day)}`;
  if (d === 0) text = '오늘'; else if (d === 1) text = '내일'; else if (d === -1) text = '어제';
  return { text, cls: d < 0 ? 'late' : d === 0 ? 'today' : '' };
}

/* ---------- 목록 ---------- */
function render() {
  list.textContent = '';
  for (const t of ordered()) {
    const li = document.createElement('li');
    if (t.done) li.className = 'done';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = t.done;
    cb.onchange = () => {
      t.done = cb.checked;
      t.doneAt = t.done ? Date.now() : undefined;
      persist(); render();
    };

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = t.text;
    text.title = '더블클릭해서 수정';
    text.ondblclick = () => startEdit(t, li, text);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = '삭제';
    del.onclick = () => { todos = todos.filter((x) => x.id !== t.id); persist(); render(); };

    const grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⠿';
    grip.title = '드래그해서 순서 바꾸기';

    const due = document.createElement('span');
    due.className = 'due-wrap';
    const chip = document.createElement('button');
    const info = t.due ? dueInfo(t.due) : null;
    chip.className = 'due ' + (t.due ? info.cls : 'empty');
    chip.textContent = t.due ? info.text : '📅';
    chip.title = t.due ? `마감 ${t.due} (클릭: 변경, 우클릭: 지우기)` : '마감일 정하기';
    const dinput = document.createElement('input');
    dinput.type = 'date'; dinput.tabIndex = -1; dinput.value = t.due || '';
    chip.onclick = () => { try { dinput.showPicker(); } catch { dinput.focus(); dinput.click(); } };
    chip.oncontextmenu = (e) => { e.preventDefault(); if (t.due) { t.due = undefined; persist(); render(); } };
    dinput.onchange = () => { t.due = dinput.value || undefined; persist(); render(); };
    due.append(chip, dinput);

    li._t = t;
    attachDrag(grip, li, t);
    attachDrag(text, li, t);

    li.append(cb, text, due, grip, del);
    list.append(li);
  }
  const left = todos.filter((t) => !t.done).length;
  $('count').textContent = todos.length ? `${left}/${todos.length}` : '';
}

/* ---------- 순서 바꾸기 (드래그) ---------- */
// 정렬 모드가 keep이 아니면 완료/미완료 그룹 안에서만 이동한다.
function attachDrag(handle, li, t) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || dateSort || li.querySelector('.edit')) return;
    const y0 = e.clientY;
    let started = false;
    const sameGroup = (x) => sortMode === 'keep' || x.classList.contains('done') === t.done;

    const move = (ev) => {
      if (!started) {
        if (Math.abs(ev.clientY - y0) < 4) return;
        started = true;
        li.classList.add('dragging');
        document.body.classList.add('dragging-now');
      }
      const others = [...list.children].filter((x) => x !== li && sameGroup(x));
      let placed = false;
      for (const o of others) {
        const r = o.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          if (o.previousElementSibling !== li) list.insertBefore(li, o);
          placed = true;
          break;
        }
      }
      if (!placed && others.length) {
        const last = others[others.length - 1];
        if (last.nextElementSibling !== li) last.after(li);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging-now');
      if (!started) return;
      commitOrder(t);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

function commitOrder(t) {
  const inGroup = (x) => sortMode === 'keep' || x.done === t.done;
  const newGroup = [...list.children].map((x) => x._t).filter(inGroup);
  const positions = [];
  todos.forEach((x, i) => { if (inGroup(x)) positions.push(i); });
  positions.forEach((pos, i) => { todos[pos] = newGroup[i]; });
  if (sortMode !== 'keep' && t.done) {           // 완료 그룹은 doneAt 순서로 표시되므로 시각을 재배정
    const base = Math.min(Date.now(), ...newGroup.map((x) => x.doneAt).filter(Boolean));
    newGroup.forEach((x, i) => { x.doneAt = base + i; });
  }
  persist();
  render();
}

function startEdit(t, li, textEl) {
  const input = document.createElement('input');
  input.className = 'edit';
  input.value = t.text;
  li.replaceChild(input, textEl);
  input.focus();
  input.select();
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    if (save && v) t.text = v;
    persist(); render();
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
  input.onblur = () => finish(true);
}

$('add').onsubmit = (e) => {
  e.preventDefault();
  const v = $('new').value.trim();
  if (!v) return;
  todos.push({ id: Date.now() + Math.random(), text: v, done: false, due: $('new-due-input').value || undefined });
  $('new-due-input').value = ''; drawNewDue();
  $('new').value = '';
  persist(); render();
  list.scrollTop = list.scrollHeight;
};

function drawNewDue() {
  const v = $('new-due-input').value;
  $('new-due').textContent = v ? dueInfo(v).text : '📅';
  $('new-due').classList.toggle('on', !!v);
}
$('new-due').onclick = () => { try { $('new-due-input').showPicker(); } catch {} };
$('new-due').oncontextmenu = (e) => { e.preventDefault(); $('new-due-input').value = ''; drawNewDue(); };
$('new-due-input').onchange = drawNewDue;

function setDateSort(on) {
  dateSort = on;
  store.set('dsort', on ? '1' : '0');
  $('dsort').classList.toggle('on', on);
  $('dsort').title = on ? '마감일순 정렬 (켜짐 — 수동 순서는 꺼야 바꿀 수 있음)' : '마감일순 정렬 (끔)';
  document.body.classList.toggle('dsort', on);
  render();
}
$('dsort').onclick = () => setDateSort(!dateSort);

// 자정이 지나면 오늘/어제 표시를 갱신 (편집·드래그 중에는 건드리지 않음)
let lastDay = localDate();
setInterval(() => {
  if (localDate() !== lastDay && !document.querySelector('.edit, .dragging')) { lastDay = localDate(); render(); }
}, 60000);

$('clear').onclick = () => { todos = todos.filter((t) => !t.done); persist(); render(); };
$('close').onclick = () => window.api.quit();
$('sort').onclick = () => setSort(SORT_NEXT[sortMode]);
$('pin').onclick = async () => {
  const on = !$('pin').classList.contains('on');
  await window.api.setPin(on);
  $('pin').classList.toggle('on', on);
};

/* ---------- 색상 테마 (색 토큰의 단일 출처) ---------- */
// [이름, 종이, 헤더, 줄, 글자, 완료글자, 체크색, 세로줄]
const L = '#e88a8a';
const THEMES = {
  yellow:   ['노랑',     '#fff8b8', '#f5e97a', '#e3d77a', '#3b3a30', '#9a9580', '#d9534f', L],
  cream:    ['크림',     '#fff3e0', '#fbdcae', '#ecd0a8', '#4a3b28', '#a8977f', '#e07b39', L],
  orange:   ['주황',     '#ffe0c2', '#ffc491', '#f0b98a', '#4a2f1a', '#ab8d73', '#e5671b', L],
  peach:    ['복숭아',   '#ffe4dc', '#ffc4b3', '#f1b8a8', '#4a2d27', '#ad8d86', '#e0583f', '#d96a6a'],
  pink:     ['분홍',     '#ffe3ec', '#f8c2d3', '#f0b6c8', '#4a2b36', '#a58692', '#d9467a', '#d96a8c'],
  rose:     ['진분홍',   '#f9c6d9', '#f08cb2', '#e3a3bc', '#4a1f33', '#a8788c', '#c2185b', '#c2185b'],
  lavender: ['연보라',   '#ece4ff', '#d3c4f7', '#c5b6ea', '#33284f', '#9487b3', '#7a55d6', L],
  purple:   ['보라',     '#d9c8f5', '#b99aeb', '#c0aee2', '#2e1f4d', '#8c7fae', '#6a3fcf', '#8a5bd6'],
  blue:     ['하늘',     '#dff0ff', '#b9dcf8', '#a9cbe8', '#1f3350', '#7f96b3', '#3b82d6', L],
  indigo:   ['파랑',     '#c9dcf8', '#93b8f0', '#a2bde6', '#162b52', '#6f87b0', '#2455c3', '#c46a6a'],
  teal:     ['청록',     '#d2f3ef', '#9fe3da', '#9ed3cc', '#13413b', '#74a39d', '#12998a', L],
  mint:     ['민트',     '#dcf7e8', '#b4ebce', '#a9dcc0', '#1f3d2f', '#7fa591', '#2f9e6b', L],
  lime:     ['연두',     '#eef9c8', '#d7ee86', '#cfe08a', '#34411a', '#93a070', '#6d9c10', L],
  kraft:    ['크라프트', '#e7d3b4', '#cfb287', '#d2b98f', '#3f2e18', '#9a8666', '#a35a1b', '#b56a4a'],
  white:    ['화이트',   '#fdfdfb', '#ecece6', '#d8e2ee', '#2b2b2b', '#a0a0a0', '#444444', L],
  gray:     ['회색',     '#e4e5e8', '#c9cbd1', '#c7cad1', '#25262b', '#8d9099', '#4b5563', '#c46a6a'],
  dark:     ['다크',     '#2b2d33', '#1f2126', '#3d4048', '#e8e6df', '#7d7f87', '#e0a23a', '#b85c5c'],
  navy:     ['네이비',   '#1c2740', '#121a2c', '#2f3d5c', '#e4eaf7', '#7886a6', '#5aa2ff', '#b85c5c'],
  forest:   ['숲',       '#1f2f27', '#14211b', '#34493e', '#e1efe6', '#7a9585', '#6fcf97', '#b85c5c'],
  plum:     ['자두',     '#2f2234', '#201624', '#4a3550', '#f1e4f4', '#9a82a0', '#e27ad0', '#b85c5c'],
};
const VARS = ['--paper', '--paper-bar', '--line', '--ink', '--ink-done', '--accent', '--margin-line'];

function setVars(vals) {
  const root = document.documentElement.style;
  VARS.forEach((v, i) => root.setProperty(v, vals[i]));
}

/* 사용자 지정: 고른 색 하나(종이색)에서 나머지를 계산 */
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(max + min - 1)) : 0, (max + min) / 2];
}
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

function customVals(hex) {
  const [h, s, l] = hexToHsl(hex);
  const dark = l < 0.5;
  const dir = dark ? 1 : -1;               // 어두운 종이는 밝게, 밝은 종이는 어둡게 변주
  return [
    hex,
    hsl(h, s, Math.min(0.95, Math.max(0.05, l + dir * 0.07))),
    hsl(h, s * 0.8, Math.min(0.95, Math.max(0.05, l + dir * 0.12))),
    dark ? hsl(h, Math.min(s, 0.3), 0.93) : hsl(h, Math.min(s, 0.35), 0.16),
    hsl(h, Math.min(s, 0.2), dark ? 0.55 : 0.6),
    dark ? hsl(h, 0.7, 0.62) : hsl(h, 0.65, 0.42),
    '#e88a8a',
  ];
}

function mark(sel) {
  document.querySelectorAll('#swatches button').forEach((b) => b.classList.toggle('sel', b.dataset.theme === sel));
}

function applyTheme(name, customHex) {
  if (name === 'custom') {
    setVars(customVals(customHex));
    store.set('custom', customHex);
  } else {
    const [, ...vals] = THEMES[name];
    setVars([vals[0], vals[1], vals[2], vals[3], vals[4], vals[5], vals[6]]);
  }
  mark(name);
  store.set('theme', name);
}

function buildSwatches() {
  const box = $('swatches');
  for (const [key, t] of Object.entries(THEMES)) {
    const b = document.createElement('button');
    b.dataset.theme = key;
    b.title = t[0];
    b.style.setProperty('background', t[1]);
    b.onclick = () => applyTheme(key);
    box.append(b);
  }
  const pick = document.createElement('input');
  pick.type = 'color';
  pick.title = '직접 고르기';
  pick.value = store.get('custom', '#ffd6a5');
  pick.oninput = () => applyTheme('custom', pick.value);
  box.append(pick);

  const row = document.createElement('label');
  row.className = 'alpha-row';
  row.innerHTML = '<span>투명도</span><input type="range" min="30" max="100" step="5"><output></output>';
  const rng = row.querySelector('input'), out = row.querySelector('output');
  rng.value = store.get('alpha', 100);
  const setAlpha = () => {
    document.documentElement.style.setProperty('--alpha', rng.value + '%');
    out.textContent = rng.value + '%';
    store.set('alpha', rng.value);
  };
  rng.oninput = setAlpha;
  setAlpha();
  box.append(row);
}

$('palette').onclick = () => { $('swatches').hidden = !$('swatches').hidden; };

/* ---------- 집중 타이머 ---------- */
const DEFAULT_PRESETS = [5, 15, 30, 45, 50];      // 분
const clampMin = (v) => Math.min(60, Math.max(1, Math.round(Number(v) || 0)));
let presets = DEFAULT_PRESETS;
try {
  const p = JSON.parse(store.get('presets', 'null'));
  if (Array.isArray(p) && p.length === 5) presets = p.map(clampMin);
} catch {}
const today = localDate;
let tm = { mins: Number(store.get('t-mins', 25)), left: 0, endAt: 0, running: false };
if (!Number.isInteger(tm.mins) || tm.mins < 1 || tm.mins > 60) tm.mins = 25;
tm.left = tm.mins * 60000;
try { // 재시작해도 이어가기
  const s = JSON.parse(store.get('t-state', 'null'));
  if (s && s.mins === tm.mins) { tm.left = s.left; if (s.running) { tm.endAt = s.endAt; tm.running = true; } }
} catch {}
let tick = null;

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const focusToday = () => Number(store.get('focus-' + today(), 0));

function saveTimer() { store.set('t-state', JSON.stringify(tm)); store.set('t-mins', tm.mins); }

function drawTimer() {
  const left = tm.running ? tm.endAt - Date.now() : tm.left;
  $('t-time').textContent = fmt(left);
  $('t-go').textContent = tm.running ? '⏸' : '▶';
  $('timer').classList.toggle('running', tm.running);
  $('t-reset').hidden = !tm.running && tm.left === tm.mins * 60000;
  $('timer').title = `오늘 집중 ${focusToday()}분 (클릭: 시계 펼치기)`;
  drawClock(left);
}

/* ---------- 원형 시계 패널 ---------- */
const R = 44;
function drawClock(left) {
  const frac = Math.min(1, Math.max(0, left / 3600000));      // 한 바퀴 = 60분
  const slice = $('slice');
  if (frac >= 0.9999) {
    slice.setAttribute('d', `M0 ${-R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 ${-R} Z`);
  } else if (frac <= 0) {
    slice.setAttribute('d', '');
  } else {
    const th = frac * 2 * Math.PI;
    slice.setAttribute('d', `M0 0 L0 ${-R} A${R} ${R} 0 ${th > Math.PI ? 1 : 0} 1 ${(R * Math.sin(th)).toFixed(2)} ${(-R * Math.cos(th)).toFixed(2)} Z`);
  }
  $('c-time').textContent = fmt(left);
  $('c-go').textContent = tm.running ? '⏸' : '▶';
  $('clock').classList.toggle('locked', tm.running || tm.left !== tm.mins * 60000);
  document.querySelectorAll('#presets .pre').forEach((b) => b.classList.toggle('on', Number(b.dataset.m) === tm.mins));
}

(function buildTicks() {
  let s = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6, major = i % 3 === 0, r1 = major ? 36 : 39;
    s += `<line x1="${(r1 * Math.sin(a)).toFixed(2)}" y1="${(-r1 * Math.cos(a)).toFixed(2)}" x2="${(42 * Math.sin(a)).toFixed(2)}" y2="${(-42 * Math.cos(a)).toFixed(2)}"/>`;
  }
  $('ticks').innerHTML = s;
})();

const isIdle = () => !tm.running && tm.left === tm.mins * 60000;
function setMins(m) {
  tm.mins = clampMin(m);
  tm.left = tm.mins * 60000;
  saveTimer(); drawTimer();
}

// 시계를 끌어서 시간 설정 (대기 상태에서만, 1분 단위)
$('dial-svg').addEventListener('pointerdown', (e) => {
  if (!isIdle()) return;
  e.preventDefault();
  const rect = $('dial-svg').getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const set = (ev) => {
    const deg = ((Math.atan2(ev.clientX - cx, -(ev.clientY - cy)) * 180) / Math.PI + 360) % 360;
    const m = Math.round(deg / 6);
    setMins(m === 0 ? 60 : m);
  };
  set(e);
  const up = () => { window.removeEventListener('pointermove', set); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  window.addEventListener('pointermove', set);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});
$('c-go').onclick = () => $('t-go').onclick();

let editingPresets = false;
function renderPresets() {
  const box = $('presets');
  box.textContent = '';
  presets.forEach((m, i) => {
    if (editingPresets) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = 1; inp.max = 60; inp.value = m; inp.className = 'pre-edit';
      inp.onchange = () => { presets[i] = clampMin(inp.value); inp.value = presets[i]; store.set('presets', JSON.stringify(presets)); };
      box.append(inp);
    } else {
      const b = document.createElement('button');
      b.className = 'pre'; b.dataset.m = m; b.textContent = m;
      b.title = `${m}분`;
      b.onclick = () => { if (!tm.running) setMins(m); };
      box.append(b);
    }
  });
  $('p-edit').textContent = editingPresets ? '✓' : '✎';
  $('p-edit').title = editingPresets ? '편집 완료' : '프리셋 시간 편집 (1~60분)';
  drawClock(tm.running ? tm.endAt - Date.now() : tm.left);
}
$('p-edit').onclick = () => { editingPresets = !editingPresets; renderPresets(); };

function setClockOpen(on) {
  $('clock').hidden = !on;
  store.set('clock-open', on ? '1' : '0');
}

function beep() {
  try {
    const ac = new AudioContext();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.15, ac.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d + 0.2);
      o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.22);
    });
  } catch {}
}

function finish() {
  clearInterval(tick); tick = null;
  tm.running = false; tm.left = tm.mins * 60000;
  store.set('focus-' + today(), focusToday() + tm.mins);
  saveTimer(); drawTimer(); beep();
  const note = document.querySelector('.note');
  note.classList.add('alarm');                       // 창 전체가 빨갛게 깜박임
  setTimeout(() => note.classList.remove('alarm'), 4000);
  try { new Notification('집중 시간 끝 🎉', { body: `${tm.mins}분 완료! 오늘 총 ${focusToday()}분`, silent: true }); } catch {}
}

function loop() {
  if (tick) return;
  tick = setInterval(() => { if (tm.endAt - Date.now() <= 0) finish(); else drawTimer(); }, 250);
}

$('t-go').onclick = () => {
  if (tm.running) { tm.left = tm.endAt - Date.now(); tm.running = false; clearInterval(tick); tick = null; }
  else { tm.endAt = Date.now() + tm.left; tm.running = true; loop(); try { Notification.requestPermission(); } catch {} }
  saveTimer(); drawTimer();
};
$('t-time').onclick = () => setClockOpen($('clock').hidden);
$('t-reset').onclick = () => {
  clearInterval(tick); tick = null;
  tm.running = false; tm.left = tm.mins * 60000;
  saveTimer(); drawTimer();
};
if (tm.running) { if (tm.endAt - Date.now() <= 0) { tm.left = tm.mins * 60000; tm.running = false; } else loop(); }
renderPresets();
setClockOpen(store.get('clock-open', '0') === '1');
drawTimer();

/* ---------- 크기 조절 ---------- */
const MIN_W = 220, MIN_H = 200;
document.querySelectorAll('.rz').forEach((el) => {
  el.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch {}
    const dir = el.dataset.dir;
    const start = await window.api.getBounds();
    const mx = e.screenX, my = e.screenY;
    const move = (ev) => {
      const dx = ev.screenX - mx, dy = ev.screenY - my;
      let { x, y, width, height } = start;
      if (dir.includes('e')) width = start.width + dx;
      if (dir.includes('s')) height = start.height + dy;
      if (dir.includes('w')) { width = start.width - dx; x = start.x + dx; }
      if (dir.includes('n')) { height = start.height - dy; y = start.y + dy; }
      if (width < MIN_W) { if (dir.includes('w')) x = start.x + start.width - MIN_W; width = MIN_W; }
      if (height < MIN_H) { if (dir.includes('n')) y = start.y + start.height - MIN_H; height = MIN_H; }
      window.api.setBounds({ x, y, width, height });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
});

/* ---------- 접기 ---------- */
function drawFold(on) {
  document.querySelector('.note').classList.toggle('collapsed', on);
  $('fold').textContent = on ? '▾' : '▴';
  $('fold').title = on ? '펴기' : '접기';
}
$('fold').onclick = async () => drawFold(await window.api.toggleFold($('bar').offsetHeight));
window.api.getFold().then(drawFold);

buildSwatches();
const savedTheme = store.get('theme', 'yellow');
if (savedTheme === 'custom') applyTheme('custom', store.get('custom', '#ffd6a5'));
else applyTheme(THEMES[savedTheme] ? savedTheme : 'yellow');
setSort(sortMode);
setDateSort(dateSort);

window.api.load().then((data) => { todos = data; render(); });
