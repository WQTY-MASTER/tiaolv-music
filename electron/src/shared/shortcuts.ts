export const SHORTCUT_DEFINITIONS = [
  { id: "toggle", label: "播放 / 暂停", group: "播放控制", accelerator: "Control+Alt+Space" },
  { id: "previous", label: "上一曲", group: "播放控制", accelerator: "Control+Alt+Left" },
  { id: "next", label: "下一曲", group: "播放控制", accelerator: "Control+Alt+Right" },
  { id: "volume-up", label: "音量增加", group: "播放控制", accelerator: "Control+Alt+Up" },
  { id: "volume-down", label: "音量减小", group: "播放控制", accelerator: "Control+Alt+Down" },
  { id: "cycle-mode", label: "切换循环模式", group: "播放控制", accelerator: "Control+Alt+R" },
  { id: "favorite", label: "收藏当前歌曲", group: "播放控制", accelerator: "Control+Alt+S" },
  { id: "main-window", label: "显示 / 隐藏主播放器", group: "窗口", accelerator: "Control+Alt+M" },
  { id: "desktop-lyrics", label: "显示 / 隐藏桌面歌词", group: "桌面歌词", accelerator: "Control+Alt+D" },
  { id: "unlock-lyrics", label: "解锁桌面歌词", group: "桌面歌词", accelerator: "Control+Alt+L" },
  { id: "translation", label: "歌词翻译开关", group: "桌面歌词", accelerator: "Control+Alt+T" },
  { id: "lyrics-on-top", label: "桌面歌词置顶开关", group: "桌面歌词", accelerator: "Control+Alt+P" }
] as const;

export type ShortcutAction = typeof SHORTCUT_DEFINITIONS[number]["id"];
export interface ShortcutConfig {
  enabled: boolean;
  bindings: Record<ShortcutAction, string>;
}
export interface ShortcutSnapshot {
  config: ShortcutConfig;
  conflicts: Partial<Record<ShortcutAction, string>>;
  recording: boolean;
}
export interface ShortcutPatch {
  enabled?: boolean;
  bindings?: Partial<Record<ShortcutAction, string>>;
}

export function defaultShortcutConfig(): ShortcutConfig {
  return {
    enabled: true,
    bindings: Object.fromEntries(SHORTCUT_DEFINITIONS.map((item) => [item.id, item.accelerator])) as ShortcutConfig["bindings"]
  };
}

const modifiers = ["Control", "Alt", "Shift", "Super"];
const aliases: Record<string, string> = {
  ctrl: "Control", control: "Control", alt: "Alt", shift: "Shift", meta: "Super", super: "Super",
  command: "Super", cmd: "Super", space: "Space", arrowleft: "Left", left: "Left",
  arrowright: "Right", right: "Right", arrowup: "Up", up: "Up", arrowdown: "Down", down: "Down",
  enter: "Enter", return: "Enter", home: "Home", end: "End", pageup: "PageUp", pagedown: "PageDown",
  tab: "Tab", backspace: "Backspace", delete: "Delete", insert: "Insert", escape: "Escape",
  minus: "Minus", equal: "Plus", plus: "Plus", comma: "Comma", period: "Period"
};

export function normalizeAccelerator(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.trim()) return "";
  const parts = value.split("+").map((part) => {
    const key = part.trim();
    return aliases[key.toLowerCase()] ?? (/^(?:[a-z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/i.test(key) ? key.toUpperCase() : "");
  });
  if (parts.some((part) => !part) || new Set(parts).size !== parts.length) return null;
  const keys = parts.filter((part) => !modifiers.includes(part));
  if (keys.length !== 1) return null;
  if (!parts.some((part) => ["Control", "Alt", "Super"].includes(part)) && !/^F\d+$/.test(keys[0])) return null;
  return [...modifiers.filter((part) => parts.includes(part)), keys[0]].join("+");
}

export function normalizeShortcutConfig(value: unknown): ShortcutConfig {
  const defaults = defaultShortcutConfig();
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Partial<ShortcutConfig>;
  if (typeof stored.enabled === "boolean") defaults.enabled = stored.enabled;
  for (const item of SHORTCUT_DEFINITIONS) {
    const binding = normalizeAccelerator(stored.bindings?.[item.id]);
    if (binding !== null) defaults.bindings[item.id] = binding;
  }
  return defaults;
}

export function shortcutConflict(config: ShortcutConfig, action: ShortcutAction): string | undefined {
  const binding = config.bindings[action];
  if (!binding) return;
  const duplicate = SHORTCUT_DEFINITIONS.find((item) => item.id !== action && config.bindings[item.id] === binding);
  return duplicate ? `与「${duplicate.label}」重复，请使用其他组合键。` : undefined;
}

export function formatAccelerator(value: string): string {
  const labels: Record<string, string> = { Control: "Ctrl", Super: "Win", Left: "←", Right: "→", Up: "↑", Down: "↓" };
  return value.split("+").map((part) => labels[part] ?? part).join(" + ");
}

export interface ShortcutKeyInput {
  key: string;
  code?: string;
  control: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export function acceleratorFromInput(input: ShortcutKeyInput): string | null {
  let key = input.key === " " ? "Space" : input.key;
  if (/^Key[A-Z]$/.test(input.code ?? "")) key = input.code!.slice(3);
  if (/^Digit[0-9]$/.test(input.code ?? "")) key = input.code!.slice(5);
  if (["Minus", "Equal", "Comma", "Period"].includes(input.code ?? "")) key = input.code!;
  return normalizeAccelerator([
    input.control ? "Control" : "", input.alt ? "Alt" : "", input.shift ? "Shift" : "",
    input.meta ? "Super" : "", key
  ].filter(Boolean).join("+"));
}
