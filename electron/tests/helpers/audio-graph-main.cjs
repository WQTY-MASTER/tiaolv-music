const { app, BrowserWindow } = require("electron");
if (!process.env.AUDIO_TEST_DATA) throw new Error("Isolated audio test data is required");
app.setPath("userData", process.env.AUDIO_TEST_DATA);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.whenReady().then(() => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, backgroundThrottling: false } });
  void window.loadURL("about:blank");
});
