export interface AudioOutputPreferences {
  deviceId: string;
  loudnessMatching: boolean;
}

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
  isSystemDefaultEndpoint?: boolean;
  aliases?: string[];
}

export interface AudioOutputCandidate {
  deviceId: string;
  label: string;
  groupId?: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type SinkRoutableAudio = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type SinkRoutableContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export const AUDIO_OUTPUT_STORAGE_KEY = "tiaolv-audio-output-preferences";
export const DEFAULT_AUDIO_OUTPUT_PREFERENCES: AudioOutputPreferences = {
  deviceId: "default",
  loudnessMatching: false
};

export function readAudioOutputPreferences(storage: StorageLike): AudioOutputPreferences {
  try {
    const parsed = JSON.parse(storage.getItem(AUDIO_OUTPUT_STORAGE_KEY) ?? "null") as Partial<AudioOutputPreferences> | null;
    return {
      deviceId: typeof parsed?.deviceId === "string" && parsed.deviceId.trim()
        ? parsed.deviceId
        : DEFAULT_AUDIO_OUTPUT_PREFERENCES.deviceId,
      loudnessMatching: typeof parsed?.loudnessMatching === "boolean"
        ? parsed.loudnessMatching
        : DEFAULT_AUDIO_OUTPUT_PREFERENCES.loudnessMatching
    };
  } catch {
    return { ...DEFAULT_AUDIO_OUTPUT_PREFERENCES };
  }
}

export function writeAudioOutputPreferences(storage: StorageLike, preferences: AudioOutputPreferences) {
  storage.setItem(AUDIO_OUTPUT_STORAGE_KEY, JSON.stringify({
    deviceId: preferences.deviceId.trim() || DEFAULT_AUDIO_OUTPUT_PREFERENCES.deviceId,
    loudnessMatching: preferences.loudnessMatching === true
  }));
}

export function supportsAudioOutputSelection(audio?: HTMLMediaElement | null) {
  return Boolean(audio && typeof (audio as SinkRoutableAudio).setSinkId === "function");
}

function outputLabelWithoutRole(label: string) {
  return label.replace(/^(?:default|communications)\s*-\s*/i, "").trim();
}

function displayOutputLabel(label: string) {
  return outputLabelWithoutRole(label).replace(/\s+\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, "").trim();
}

function sameOutputEndpoint(left: AudioOutputCandidate, right: AudioOutputCandidate) {
  if (left.groupId && right.groupId) return left.groupId === right.groupId;
  const leftLabel = outputLabelWithoutRole(left.label).toLocaleLowerCase();
  const rightLabel = outputLabelWithoutRole(right.label).toLocaleLowerCase();
  return Boolean(leftLabel && leftLabel === rightLabel);
}

export function normalizeAudioOutputDevices(candidates: readonly AudioOutputCandidate[]): AudioOutputDevice[] {
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.deviceId || "default", {
    ...candidate,
    deviceId: candidate.deviceId || "default"
  }])).values()];
  const roleCandidates = uniqueCandidates.filter(({ deviceId }) => deviceId === "default" || deviceId === "communications");
  const physicalCandidates = uniqueCandidates.filter(({ deviceId }) => deviceId !== "default" && deviceId !== "communications");
  const defaultCandidate = roleCandidates.find(({ deviceId }) => deviceId === "default");
  const defaultPhysical = defaultCandidate
    ? physicalCandidates.find((candidate) => sameOutputEndpoint(defaultCandidate, candidate))
    : undefined;
  const result: AudioOutputDevice[] = [{
    deviceId: "default",
    label: "系统默认",
    isDefault: true
  }];

  physicalCandidates.forEach((candidate, index) => {
    const aliases = roleCandidates
      .filter(({ deviceId }) => deviceId === "communications")
      .filter((role) => sameOutputEndpoint(role, candidate))
      .map(({ deviceId }) => deviceId);
    result.push({
      deviceId: candidate.deviceId,
      label: displayOutputLabel(candidate.label) || `音频输出 ${index + 1}`,
      isDefault: false,
      isSystemDefaultEndpoint: candidate.deviceId === defaultPhysical?.deviceId,
      ...(aliases.length ? { aliases } : {})
    });
  });

  return result;
}

export function resolveAudioOutputDeviceId(
  preferredDeviceId: string,
  _devices: readonly AudioOutputDevice[]
) {
  return preferredDeviceId || DEFAULT_AUDIO_OUTPUT_PREFERENCES.deviceId;
}

export async function enumerateAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [{ deviceId: "default", label: "系统默认", isDefault: true }];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  return normalizeAudioOutputDevices(outputs.map((device) => ({
    deviceId: device.deviceId,
    groupId: device.groupId,
    label: device.label
  })));
}

function sinkIdForDevice(deviceId: string) {
  return deviceId === "default" ? "" : deviceId;
}

export async function applyAudioOutputDevice(audio: HTMLMediaElement, deviceId: string) {
  const route = (audio as SinkRoutableAudio).setSinkId;
  if (typeof route !== "function") {
    if (deviceId === "default") return;
    throw new Error("当前音频引擎不支持切换输出设备。请使用系统默认设备。");
  }
  await route.call(audio, sinkIdForDevice(deviceId));
}

export function loudnessGainForRms(rms: number) {
  if (!Number.isFinite(rms) || rms < 0.002) return 1;
  const targetRms = 0.18;
  return Math.max(0.55, Math.min(2.5, targetRms / rms));
}

export class AudioOutputController {
  private readonly audio: HTMLMediaElement;
  private context?: SinkRoutableContext;
  private analyser?: AnalyserNode;
  private gain?: GainNode;
  private samples?: Float32Array<ArrayBuffer>;
  private sampleTimer?: number;
  private deviceId = DEFAULT_AUDIO_OUTPUT_PREFERENCES.deviceId;

  constructor(audio: HTMLMediaElement) {
    this.audio = audio;
  }

  async setDevice(deviceId: string) {
    this.deviceId = deviceId || DEFAULT_AUDIO_OUTPUT_PREFERENCES.deviceId;
    if (this.context && typeof this.context.setSinkId === "function") {
      await this.context.setSinkId(sinkIdForDevice(this.deviceId));
      return;
    }
    await applyAudioOutputDevice(this.audio, this.deviceId);
  }

  async setLoudnessMatching(enabled: boolean) {
    if (!enabled) {
      this.stopSampling();
      this.setGain(1);
      // A media element stays routed through the graph even after matching is disabled.
      if (this.context?.state === "suspended") await this.context.resume();
      return;
    }

    this.ensureGraph();
    if (this.context?.state === "suspended") await this.context.resume();
    if (this.context && typeof this.context.setSinkId === "function") {
      await this.context.setSinkId(sinkIdForDevice(this.deviceId));
    }
    this.startSampling();
  }

  dispose() {
    this.stopSampling();
    this.setGain(1);
  }

  private ensureGraph() {
    if (this.context) return;
    const context = new AudioContext({ latencyHint: "playback" }) as SinkRoutableContext;
    const source = context.createMediaElementSource(this.audio);
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
    this.context = context;
    this.analyser = analyser;
    this.gain = gain;
    this.samples = new Float32Array(analyser.fftSize);
  }

  private startSampling() {
    if (this.sampleTimer !== undefined) return;
    this.sampleTimer = window.setInterval(() => {
      if (!this.analyser || !this.samples || this.audio.paused) return;
      this.analyser.getFloatTimeDomainData(this.samples);
      let squareSum = 0;
      for (const sample of this.samples) squareSum += sample * sample;
      this.setGain(loudnessGainForRms(Math.sqrt(squareSum / this.samples.length)));
    }, 240);
  }

  private stopSampling() {
    if (this.sampleTimer !== undefined) window.clearInterval(this.sampleTimer);
    this.sampleTimer = undefined;
  }

  private setGain(value: number) {
    if (!this.context || !this.gain) return;
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.35);
  }
}
