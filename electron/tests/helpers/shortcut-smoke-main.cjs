const { app, session } = require("electron");
const path = require("node:path");

if (!process.env.SHORTCUT_SMOKE_DATA) throw new Error("Isolated user data is required");
app.setPath("userData", process.env.SHORTCUT_SMOKE_DATA);
app.whenReady().then(() => {
  // UI checks must never write to a user's running music backend.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://127.0.0.1:17890/*"] }, (_details, callback) => callback({ cancel: true }));
});
require(path.resolve(__dirname, "../../out/main/main.js"));
