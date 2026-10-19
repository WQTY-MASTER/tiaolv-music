const { app, session, ipcMain } = require("electron");
const path = require("node:path");

if (!process.env.SHORTCUT_SMOKE_DATA) throw new Error("Isolated user data is required");
app.setPath("userData", process.env.SHORTCUT_SMOKE_DATA);
app.setPath("appData", process.env.SHORTCUT_SMOKE_DATA);
if (process.env.MINI_SMOKE_SOFTWARE_RENDERING === '1') app.disableHardwareAcceleration();
if (process.env.MINI_SMOKE_HOLD_READY === "1") {
  const handle = ipcMain.handle.bind(ipcMain);
  global.miniSmokeReadiness = [];
  ipcMain.handle = (channel, listener) => handle(channel, (event, ...args) => {
    if (channel === "mini-window-command" && args[0]?.type === "ready") {
      return new Promise(resolve => global.miniSmokeReadiness.push(() => resolve(listener(event, ...args))));
    }
    return listener(event, ...args);
  });
}
app.whenReady().then(() => {
  // UI checks must never write to a user's running music backend.
  const healthPort = Number(process.env.DIAGNOSTICS_SMOKE_HEALTH_PORT);
  const playlistPort = Number(process.env.PLAYLIST_SMOKE_BACKEND_PORT);
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://127.0.0.1:17890/*"] }, (details, callback) => {
    if (Number.isInteger(playlistPort) && playlistPort > 0 && playlistPort <= 65535) {
      const url = new URL(details.url);
      callback({ redirectURL: `http://127.0.0.1:${playlistPort}${url.pathname}${url.search}` });
    } else if (details.url === "http://127.0.0.1:17890/health" && Number.isInteger(healthPort) && healthPort > 0 && healthPort <= 65535) {
      callback({ redirectURL: `http://127.0.0.1:${healthPort}/health` });
    } else callback({ cancel: true });
  });
});
require(process.env.SHORTCUT_SMOKE_MAIN_FILE || path.resolve(__dirname, "../../out/main/main.js"));
