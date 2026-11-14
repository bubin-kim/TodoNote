const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = () => app.getPath('userData');
const todosFile = () => path.join(dataDir(), 'todos.json');
const stateFile = () => path.join(dataDir(), 'window.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let win;
let saveState = () => {};
let collapsed = false;
let expandedH = 380;
let headerH = 36;
const MIN_W = 220, MIN_H = 200;

function applyFold() {
  if (collapsed) {
    win.setMinimumSize(MIN_W, headerH);
    win.setMaximumSize(10000, headerH);   // 가로 크기만 조절 가능
    win.setSize(win.getSize()[0], headerH);
  } else {
    win.setMaximumSize(0, 0);             // 제한 해제
    win.setMinimumSize(MIN_W, MIN_H);
    win.setSize(win.getSize()[0], expandedH);
  }
}

function createWindow() {
  const st = readJSON(stateFile(), { width: 300, height: 380 });
  collapsed = !!st.collapsed;
  expandedH = st.height || 380;
  headerH = st.headerH || 36;
  win = new BrowserWindow({
    width: st.width, height: collapsed ? headerH : expandedH, x: st.x, y: st.y,
    minWidth: MIN_W, minHeight: collapsed ? headerH : MIN_H,
    frame: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'index.html'));
  if (collapsed) applyFold();
  const saveBounds = () => {
    const b = win.getBounds();
    if (!collapsed) expandedH = b.height;
    writeJSON(stateFile(), { ...b, height: expandedH, collapsed, headerH });
  };
  saveState = saveBounds;
  win.on('moved', saveBounds);
  win.on('resized', saveBounds);
}

ipcMain.handle('todos:load', () => readJSON(todosFile(), []));
ipcMain.handle('todos:save', (_e, todos) => { writeJSON(todosFile(), todos); });
ipcMain.handle('pin:set', (_e, on) => { win.setAlwaysOnTop(on); return on; });
ipcMain.handle('fold:get', () => collapsed);
ipcMain.handle('fold:toggle', (_e, hh) => {
  if (hh) headerH = Math.round(hh);
  if (!collapsed) expandedH = win.getBounds().height;
  collapsed = !collapsed;
  applyFold();
  saveState();
  return collapsed;
});
ipcMain.handle('win:getBounds', () => win.getBounds());
let saveTimer = null;
ipcMain.on('win:setBounds', (_e, b) => {
  const h = collapsed ? headerH : Math.max(MIN_H, Math.round(b.height));
  win.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_W, Math.round(b.width)), height: h });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 200);
});
ipcMain.handle('win:close', () => app.quit());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
