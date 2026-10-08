const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld(
  "pcMonitorDesktop",
  Object.freeze({
    isElectron: true,
    platform: process.platform,
  }),
);
