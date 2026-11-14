const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('todos:load'),
  save: (todos) => ipcRenderer.invoke('todos:save', todos),
  setPin: (on) => ipcRenderer.invoke('pin:set', on),
  getFold: () => ipcRenderer.invoke('fold:get'),
  toggleFold: (h) => ipcRenderer.invoke('fold:toggle', h),
  getBounds: () => ipcRenderer.invoke('win:getBounds'),
  setBounds: (b) => ipcRenderer.send('win:setBounds', b),
  quit: () => ipcRenderer.invoke('win:close'),
});
