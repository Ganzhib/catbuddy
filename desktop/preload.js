const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('nanobot', {
  platform: process.platform,
});
