const { app, session, ipcMain } = require("electron");
const path = require("node:path");

if (!process.env.SHORTCUT_SMOKE_DATA) throw new Error("Isolated user data is required");
app.setPath("userData", process.env.SHORTCUT_SMOKE_DATA);
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
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://127.0.0.1:17890/*"] }, (_details, callback) => callback({ cancel: true }));
});
require(process.env.SHORTCUT_SMOKE_MAIN_FILE || path.resolve(__dirname, "../../out/main/main.js"));
