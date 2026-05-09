const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electron', {
  // Store API
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key),
    clear: () => ipcRenderer.invoke('store-clear')
  },

  // Notification API
  notification: {
    show: (title, body) => ipcRenderer.send('show-notification', { title, body }),
    onReceive: (callback) => ipcRenderer.on('desktop-notification', (event, data) => callback(data))
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('minimize-to-tray'),
    quit: () => ipcRenderer.send('quit-app')
  },

  // Menu events
  menu: {
    onNewChat: (callback) => ipcRenderer.on('menu-new-chat', callback),
    onSettings: (callback) => ipcRenderer.on('menu-settings', callback),
    onAbout: (callback) => ipcRenderer.on('menu-about', callback)
  }
});
