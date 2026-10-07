import {
  SHORTCUT_DEFINITIONS, normalizeAccelerator, normalizeShortcutConfig, shortcutConflict,
  type ShortcutAction, type ShortcutConfig, type ShortcutPatch, type ShortcutSnapshot
} from "../shared/shortcuts";

interface ShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}

export class ShortcutManager {
  private config: ShortcutConfig;
  private conflicts: ShortcutSnapshot["conflicts"] = {};
  private registered = new Set<ShortcutAction>();
  private recording = false;
  private registry: ShortcutRegistry;
  private dispatch: (action: ShortcutAction) => void;
  private save: (config: ShortcutConfig) => void;

  constructor(registry: ShortcutRegistry, stored: unknown, dispatch: (action: ShortcutAction) => void, save: (config: ShortcutConfig) => void) {
    this.registry = registry;
    this.config = normalizeShortcutConfig(stored);
    this.dispatch = dispatch;
    this.save = save;
    this.register();
  }

  snapshot(): ShortcutSnapshot {
    return { config: { ...this.config, bindings: { ...this.config.bindings } }, conflicts: { ...this.conflicts }, recording: this.recording };
  }

  dispose() {
    for (const action of this.registered) this.registry.unregister(this.config.bindings[action]);
    this.registered.clear();
  }

  private register() {
    this.conflicts = {};
    for (const item of SHORTCUT_DEFINITIONS) {
      const duplicate = shortcutConflict(this.config, item.id);
      if (duplicate) {
        this.conflicts[item.id] = duplicate;
        continue;
      }
      if (!this.config.enabled || this.recording || !this.config.bindings[item.id]) continue;
      try {
        if (this.registry.register(this.config.bindings[item.id], () => {
          if (!this.recording && this.config.enabled) this.dispatch(item.id);
        })) {
          this.registered.add(item.id);
          continue;
        }
      } catch { /* Unsupported accelerators are reported alongside occupied ones. */ }
      this.conflicts[item.id] = "全局注册失败：组合键可能已被系统或其他软件占用，或不受系统支持。";
    }
  }

  setRecording(recording: boolean) {
    if (this.recording === recording) return this.snapshot();
    this.dispose();
    this.recording = recording;
    this.register();
    return this.snapshot();
  }

  update(patch: ShortcutPatch, reset = false) {
    const next = normalizeShortcutConfig({ ...this.config, ...patch, bindings: { ...this.config.bindings, ...patch.bindings } });
    for (const item of SHORTCUT_DEFINITIONS) {
      if (patch.bindings && Object.hasOwn(patch.bindings, item.id) && normalizeAccelerator(patch.bindings[item.id]) === null) {
        throw new Error("请使用 Ctrl、Alt 或 Win 加其他按键，或 F1–F24。");
      }
      const duplicate = shortcutConflict(next, item.id);
      if (duplicate) throw new Error(duplicate);
    }
    const previous = this.config;
    this.dispose();
    this.config = next;
    this.recording = false;
    this.register();
    try {
      if (!reset && patch.bindings) {
        for (const item of SHORTCUT_DEFINITIONS) {
          if (next.bindings[item.id] !== previous.bindings[item.id] && this.conflicts[item.id]) {
            throw new Error(this.conflicts[item.id]);
          }
        }
      }
      this.save(next);
    } catch (error) {
      this.dispose();
      this.config = previous;
      this.register();
      throw error;
    }
    return this.snapshot();
  }

  handleLocal(accelerator: string, repeat: boolean): boolean {
    if (this.recording) return false;
    const item = SHORTCUT_DEFINITIONS.find((item) => this.config.bindings[item.id] === accelerator);
    if (!item || shortcutConflict(this.config, item.id)) return false;
    // Registered global shortcuts already dispatch through Electron, even in the focused window.
    if (!repeat && !this.registered.has(item.id)) this.dispatch(item.id);
    return true;
  }
}
