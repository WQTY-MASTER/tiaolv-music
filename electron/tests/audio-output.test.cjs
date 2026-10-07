const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(path.resolve(__dirname, "../src/renderer/src/services/audioOutput.ts")).href;

test("audio requests opt into CORS before entering the loudness graph", () => {
  const app = require("node:fs").readFileSync(path.resolve(__dirname, "../src/renderer/src/App.vue"), "utf8");
  assert.match(app, /<audio\s[^>]*crossorigin="anonymous"/);
});

test("disabling matching resumes an already connected suspended graph", async () => {
  const { AudioOutputController } = await import(moduleUrl);
  let resumes = 0;
  const controller = new AudioOutputController({});
  controller.context = { state: "suspended", resume: async () => { resumes++; } };
  await controller.setLoudnessMatching(false);
  assert.equal(resumes, 1);
});

test("an existing loudness graph routes the context and releases an explicitly selected headphone sink", async () => {
  const { AudioOutputController } = await import(moduleUrl);
  const calls = [];
  const controller = new AudioOutputController({ setSinkId: () => assert.fail("must route the graph destination") });
  controller.context = { setSinkId: async id => calls.push(id) };
  await controller.setDevice("usb-headphones");
  await controller.setDevice("default");
  assert.deepEqual(calls, ["usb-headphones", ""]);
});

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("audio output preferences preserve the existing default playback path", async () => {
  const {
    AUDIO_OUTPUT_STORAGE_KEY,
    readAudioOutputPreferences,
    writeAudioOutputPreferences
  } = await import(moduleUrl);
  const storage = memoryStorage();

  assert.deepEqual(readAudioOutputPreferences(storage), {
    deviceId: "default",
    loudnessMatching: false
  });

  writeAudioOutputPreferences(storage, { deviceId: "speaker-2", loudnessMatching: true });
  assert.deepEqual(JSON.parse(storage.getItem(AUDIO_OUTPUT_STORAGE_KEY)), {
    deviceId: "speaker-2",
    loudnessMatching: true
  });
});

test("malformed audio output preferences fall back without changing playback", async () => {
  const { AUDIO_OUTPUT_STORAGE_KEY, readAudioOutputPreferences } = await import(moduleUrl);
  const storage = memoryStorage({
    [AUDIO_OUTPUT_STORAGE_KEY]: JSON.stringify({ deviceId: "", loudnessMatching: "yes" })
  });

  assert.deepEqual(readAudioOutputPreferences(storage), {
    deviceId: "default",
    loudnessMatching: false
  });
});

test("Windows default remains separate from its physical output", async () => {
  const { normalizeAudioOutputDevices } = await import(moduleUrl);
  const devices = normalizeAudioOutputDevices([
    { deviceId: "default", groupId: "realtek", label: "Default - 扬声器 (Realtek(R) Audio)" },
    { deviceId: "communications", groupId: "realtek", label: "Communications - 扬声器 (Realtek(R) Audio)" },
    { deviceId: "realtek-speakers", groupId: "realtek", label: "扬声器 (Realtek(R) Audio)" },
    { deviceId: "tanchjim-headphones", groupId: "tanchjim", label: "扬声器 (TANCHJIM-ONE DSP) (31b2:0111)" }
  ]);

  assert.deepEqual(devices, [
    {
      deviceId: "default",
      label: "系统默认",
      isDefault: true
    },
    {
      deviceId: "realtek-speakers",
      label: "扬声器 (Realtek(R) Audio)",
      isDefault: false,
      isSystemDefaultEndpoint: true,
      aliases: ["communications"]
    },
    {
      deviceId: "tanchjim-headphones",
      label: "扬声器 (TANCHJIM-ONE DSP)",
      isDefault: false,
      isSystemDefaultEndpoint: false
    }
  ]);
});

test("communications alias follows its own physical endpoint when it differs from default", async () => {
  const { normalizeAudioOutputDevices } = await import(moduleUrl);
  const devices = normalizeAudioOutputDevices([
    { deviceId: "default", groupId: "realtek", label: "Default - 扬声器 (Realtek(R) Audio)" },
    { deviceId: "communications", groupId: "headset", label: "Communications - 耳机 (USB Headset)" },
    { deviceId: "realtek-speakers", groupId: "realtek", label: "扬声器 (Realtek(R) Audio)" },
    { deviceId: "usb-headset", groupId: "headset", label: "耳机 (USB Headset)" }
  ]);

  assert.equal(devices.length, 3);
  assert.equal(devices[1].isSystemDefaultEndpoint, true);
  assert.deepEqual(devices[2].aliases, ["communications"]);
});

test("system default remains on the operating system routing endpoint", async () => {
  const { resolveAudioOutputDeviceId } = await import(moduleUrl);
  const devices = [
    { deviceId: "default", label: "系统默认", isDefault: true },
    { deviceId: "realtek-speakers", label: "扬声器", isDefault: false, isSystemDefaultEndpoint: false },
    { deviceId: "usb-headphones", label: "耳机", isDefault: false, isSystemDefaultEndpoint: true }
  ];

  assert.equal(resolveAudioOutputDeviceId("default", devices), "default");
  assert.equal(resolveAudioOutputDeviceId("realtek-speakers", devices), "realtek-speakers");
  assert.equal(resolveAudioOutputDeviceId("default", devices.slice(0, 1)), "default");
});

test("applying system default clears a previously pinned physical sink", async () => {
  const { applyAudioOutputDevice } = await import(moduleUrl);
  const calls = [];
  const audio = {
    setSinkId: async (sinkId) => { calls.push(sinkId); }
  };

  await applyAudioOutputDevice(audio, "default");

  assert.deepEqual(calls, [""]);
});

test("loudness gain calculation is bounded and leaves silence unchanged", async () => {
  const { loudnessGainForRms } = await import(moduleUrl);

  assert.equal(loudnessGainForRms(0), 1);
  assert.equal(loudnessGainForRms(Number.NaN), 1);
  assert.ok(loudnessGainForRms(0.03) > 1, "quiet audio should receive positive gain");
  assert.ok(loudnessGainForRms(0.7) < 1, "loud audio should be attenuated");
  assert.ok(loudnessGainForRms(0.0001) <= 2.5, "gain must remain bounded");
});
