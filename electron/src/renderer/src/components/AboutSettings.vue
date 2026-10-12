<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  AlertCircle, Check, Code2, Copy, Download, ExternalLink,
  FileArchive, Info, RefreshCw, Scale, ShieldCheck
} from "lucide-vue-next";
import { getDiagnosticContext } from "../services/diagnostics";
import {
  formatDiagnosticReport,
  type AboutSnapshot,
  type BackendHealth,
  type UpdateCheckResult
} from "../../../shared/about";

const REPOSITORY_URL = "https://github.com/WQTY-MASTER/tiaolv-music";
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;
const appIconUrl = new URL("../../../../resources/app-icon.png", import.meta.url).href;
const snapshot = ref<AboutSnapshot | null>(null);
const backend = ref<BackendHealth | null>(null);
const loading = ref(true);
const checking = ref(false);
const changingAutoCheck = ref(false);
const copied = ref(false);
const exportingDiagnostics = ref(false);
const diagnosticNotice = ref("");
const pageError = ref("");
const updateEvent = ref<UpdateCheckResult | null>(null);
const requestingDownload = ref(false);
const requestingInstall = ref(false);
let disposeUpdateListener: (() => void) | undefined;
let copiedTimer: number | undefined;

const system = computed(() => snapshot.value?.system);
const update = computed<UpdateCheckResult>(() => updateEvent.value ?? snapshot.value?.update ?? {
  status: "idle",
  currentVersion: "0.1.2"
});
const updateBusy = computed(() => checking.value || ["downloading", "downloaded", "installing"].includes(update.value.status));
const releaseVisible = computed(() => Boolean(update.value.latestVersion) && !["idle", "checking", "latest"].includes(update.value.status));
const downloadPercent = computed(() => Math.round(update.value.progress?.percent ?? 0));
const progressDetail = computed(() => {
  const progress = update.value.progress;
  if (!progress) return "";
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  return `${mb(progress.transferred)} / ${mb(progress.total)} MB`;
});
const diagnosticRows = computed(() => [
  ["操作系统", system.value ? `${system.value.osName} ${system.value.osVersion} (${system.value.osArch})` : "读取中…"],
  ["Electron", system.value?.electronVersion ?? "读取中…"],
  ["Chromium", system.value?.chromeVersion ?? "读取中…"],
  ["Node.js", system.value?.nodeVersion ?? "读取中…"],
  ["后端 API", backend.value?.ok ? backend.value.backendVersion : "未连接"],
  ["Spring Boot", backend.value?.ok ? backend.value.springBootVersion : "未连接"],
  ["Java", backend.value?.ok ? backend.value.javaVersion : "未连接"],
  ["数据库", backend.value?.ok
    ? `${backend.value.database.product} ${backend.value.database.version}`
    : "未连接"]
]);
const releaseDate = computed(() => {
  if (!update.value.publishedAt) return "";
  const value = new Date(update.value.publishedAt);
  return Number.isNaN(value.getTime()) ? "" : value.toLocaleDateString("zh-CN");
});

function acceptUpdate(next: UpdateCheckResult) {
  updateEvent.value = next;
  checking.value = next.status === "checking";
}

async function checkUpdate() {
  if (updateBusy.value) return;
  checking.value = true;
  pageError.value = "";
  acceptUpdate({ ...update.value, status: "checking", progress: undefined });
  try {
    const result = await window.listenMusic?.checkForUpdates();
    if (result) acceptUpdate(result);
  } catch {
    acceptUpdate({ ...update.value, status: "error", message: "检查更新失败，请稍后重试或使用浏览器手动下载。" });
  } finally {
    checking.value = false;
  }
}

async function downloadUpdate() {
  if (requestingDownload.value || !["available", "error"].includes(update.value.status)) return;
  requestingDownload.value = true;
  pageError.value = "";
  try {
    const result = await window.listenMusic?.downloadUpdate();
    if (result) acceptUpdate(result);
  } catch {
    acceptUpdate({ ...update.value, status: "error", progress: undefined, message: "更新下载失败，可前往 Release 页面手动下载。" });
  } finally {
    requestingDownload.value = false;
  }
}

async function installUpdate() {
  if (requestingInstall.value || update.value.status !== "downloaded") return;
  requestingInstall.value = true;
  pageError.value = "";
  try {
    if (!await window.listenMusic?.installUpdate()) pageError.value = "更新尚未准备好，或本地服务无法退出。请查看更新状态。";
  } catch {
    pageError.value = "无法启动更新安装，请前往 Release 页面手动下载。";
  } finally {
    requestingInstall.value = false;
  }
}

async function changeAutoCheck(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  if (!snapshot.value || changingAutoCheck.value) return;
  changingAutoCheck.value = true;
  pageError.value = "";
  try {
    const next = await window.listenMusic?.setAutoUpdateCheck(enabled);
    if (next) snapshot.value = next;
  } catch {
    pageError.value = "自动更新设置暂时无法保存。";
  } finally {
    changingAutoCheck.value = false;
  }
}

async function openExternal(url: string) {
  pageError.value = "";
  try {
    await window.listenMusic?.openExternalLink(url);
  } catch {
    pageError.value = "暂时无法打开链接。";
  }
}

async function copyDiagnostics() {
  if (!system.value) return;
  pageError.value = "";
  try {
    await window.listenMusic?.copyText(formatDiagnosticReport(system.value, backend.value));
    copied.value = true;
    if (copiedTimer) window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => { copied.value = false; }, 1800);
  } catch {
    pageError.value = "诊断信息复制失败。";
  }
}

async function exportDiagnostics() {
  if (exportingDiagnostics.value || !system.value) return;
  exportingDiagnostics.value = true;
  diagnosticNotice.value = "";
  pageError.value = "";
  try {
    const result = await window.listenMusic?.exportDiagnostics({ backend: backend.value, appearance: getDiagnosticContext() });
    if (result?.status === "saved") diagnosticNotice.value = "诊断包已导出。";
    else if (result?.status === "cancelled") diagnosticNotice.value = "已取消导出。";
    else pageError.value = result?.message || "诊断包导出失败，请稍后重试。";
  } catch {
    pageError.value = "诊断包导出失败，请稍后重试。";
  } finally {
    exportingDiagnostics.value = false;
  }
}

onMounted(async () => {
  const bridge = window.listenMusic;
  if (!bridge) {
    loading.value = false;
    pageError.value = "关于信息仅在桌面客户端中可用。";
    return;
  }
  disposeUpdateListener = bridge.onUpdateCheckResult(acceptUpdate);
  const [aboutResult, backendResult] = await Promise.allSettled([
    bridge.getAboutSnapshot(),
    bridge.ping()
  ]);
  if (aboutResult.status === "fulfilled") snapshot.value = aboutResult.value;
  else pageError.value = "无法读取应用版本信息。";
  if (backendResult.status === "fulfilled") backend.value = backendResult.value;
  loading.value = false;
});

onBeforeUnmount(() => {
  disposeUpdateListener?.();
  if (copiedTimer) window.clearTimeout(copiedTimer);
});
</script>

<template>
  <article class="settings-card about-settings-card" aria-labelledby="about-product-name">
    <header class="about-brand">
      <img :src="appIconUrl" alt="调律音乐应用图标" />
      <div class="about-brand-copy">
        <p class="about-kicker">LOCAL MUSIC DESKTOP</p>
        <h2 id="about-product-name">调律音乐 <span>Tiaolv Music</span></h2>
        <p>本地音乐播放器，支持网易云 / QQ 音乐歌词与元信息代理</p>
        <div class="about-tech" aria-label="技术栈">
          <span>Electron</span><i></i><span>Vue 3</span><i></i><span>Java Spring</span><i></i><span>SQLite</span>
        </div>
      </div>
      <span class="about-version">v{{ system?.appVersion ?? update.currentVersion }}</span>
    </header>

    <section class="about-section update-section" aria-labelledby="update-title">
      <div class="about-section-heading">
        <div>
          <p class="about-section-label">VERSION UPDATE</p>
          <h3 id="update-title">版本更新</h3>
        </div>
        <button class="about-action primary" type="button" :disabled="loading || updateBusy" @click="checkUpdate">
          <RefreshCw :size="16" :class="{ spinning: checking }" aria-hidden="true" />
          {{ checking ? "正在检查" : "检查更新" }}
        </button>
      </div>
      <div class="update-current">
        <div><span>当前版本</span><strong>v{{ system?.appVersion ?? update.currentVersion }}</strong></div>
        <label class="about-toggle-row">
          <span><strong>启动时自动检查更新</strong><small>仅检查版本，不会静默下载或安装。</small></span>
          <input
            type="checkbox" role="switch" aria-label="启动时自动检查更新"
            :checked="snapshot?.autoCheckUpdates ?? false"
            :disabled="loading || changingAutoCheck"
            @change="changeAutoCheck"
          />
        </label>
      </div>
      <div v-if="update.status !== 'idle' && update.status !== 'checking'" class="update-result" :class="update.status" role="status">
        <component :is="update.status === 'error' ? AlertCircle : Check" :size="17" aria-hidden="true" />
        <div>
          <strong>{{ update.message }}</strong>
          <span v-if="update.latestVersion">最新版本 v{{ update.latestVersion }}<template v-if="releaseDate"> · {{ releaseDate }}</template></span>
        </div>
      </div>
      <div v-if="releaseVisible" class="release-details">
        <div class="release-title">
          <strong>{{ update.releaseName || `调律音乐 v${update.latestVersion}` }}</strong>
          <button v-if="update.status === 'available' || update.status === 'error'" class="about-action" type="button" :disabled="requestingDownload" @click="downloadUpdate">
            <Download :size="16" aria-hidden="true" />下载更新
          </button>
          <button v-else-if="update.status === 'downloaded' || update.status === 'installing'" class="about-action primary" type="button" :disabled="requestingInstall || update.status === 'installing'" @click="installUpdate">
            <RefreshCw :size="16" aria-hidden="true" />{{ update.status === 'installing' ? "准备安装" : "重启安装" }}
          </button>
        </div>
        <div v-if="update.status === 'downloading'" class="update-progress">
          <div><span>下载进度 {{ downloadPercent }}%</span><span>{{ progressDetail }}</span></div>
          <progress :value="update.progress?.percent ?? 0" max="100" aria-label="更新下载进度"></progress>
        </div>
        <pre v-if="update.releaseNotes">{{ update.releaseNotes }}</pre>
      </div>
      <button v-if="update.status !== 'idle'" class="about-action manual-update" type="button" @click="openExternal(update.releaseUrl || `${REPOSITORY_URL}/releases/latest`)">
        <ExternalLink :size="16" aria-hidden="true" />浏览器手动下载
      </button>
    </section>

    <section class="about-section" aria-labelledby="open-source-title">
      <div class="about-section-heading compact">
        <div><p class="about-section-label">OPEN SOURCE</p><h3 id="open-source-title">开源信息</h3></div>
      </div>
      <div class="about-link-list">
        <button type="button" @click="openExternal(REPOSITORY_URL)">
          <Code2 :size="19" aria-hidden="true" /><span><strong>项目仓库</strong><small>github.com/WQTY-MASTER/tiaolv-music</small></span><ExternalLink :size="15" aria-hidden="true" />
        </button>
        <button type="button" @click="openExternal(LICENSE_URL)">
          <Scale :size="19" aria-hidden="true" /><span><strong>MIT License</strong><small>查看完整开源许可</small></span><ExternalLink :size="15" aria-hidden="true" />
        </button>
      </div>
      <p class="about-learning-note">本项目用于个人学习与开发，不作为商业音乐服务运营。</p>
    </section>

    <section class="about-section legal-section" aria-labelledby="legal-title">
      <ShieldCheck :size="21" aria-hidden="true" />
      <div>
        <h3 id="legal-title">第三方内容声明</h3>
        <p>调律音乐仅作为本地播放器。音乐元信息与歌词可能来自第三方平台公开接口，相关版权归原音乐平台及著作权人所有。本项目不托管、不分发第三方平台的版权音乐资源。</p>
      </div>
    </section>

    <section class="about-section diagnostics-section" aria-labelledby="diagnostics-title">
      <div class="about-section-heading">
        <div><p class="about-section-label">DIAGNOSTICS</p><h3 id="diagnostics-title">系统信息</h3></div>
        <div class="diagnostic-actions">
          <button class="about-action" type="button" :disabled="!system" @click="copyDiagnostics">
            <component :is="copied ? Check : Copy" :size="16" aria-hidden="true" />
            {{ copied ? "已复制" : "复制诊断信息" }}
          </button>
          <button class="about-action" type="button" :disabled="!system || exportingDiagnostics" @click="exportDiagnostics">
            <component :is="exportingDiagnostics ? RefreshCw : FileArchive" :size="16" :class="{ spinning: exportingDiagnostics }" aria-hidden="true" />
            {{ exportingDiagnostics ? "正在导出" : "导出诊断包" }}
          </button>
        </div>
      </div>
      <dl class="diagnostic-grid">
        <div v-for="row in diagnosticRows" :key="row[0]"><dt>{{ row[0] }}</dt><dd>{{ row[1] }}</dd></div>
      </dl>
      <p v-if="!backend?.ok" class="diagnostic-hint"><Info :size="15" aria-hidden="true" />后端未连接时，API 与数据库版本会在服务恢复后显示。</p>
      <p v-if="diagnosticNotice" class="diagnostic-notice" role="status">{{ diagnosticNotice }}</p>
    </section>

    <p v-if="pageError" class="about-error" role="alert">{{ pageError }}</p>
  </article>
</template>

<style scoped>
.about-settings-card { --about-ink: #11192b; --about-muted: #6f7c91; --about-line: #e6ebf2; --about-blue: #246bff; --about-secondary: #53627b; --about-soft: #f6f8fc; --about-success: #347052; --about-warning: #8a6d3b; overflow: hidden; }
:global(.theme-dark .about-settings-card) { --about-ink: #edf1f7; --about-muted: #aeb8c8; --about-line: #3c4350; --about-secondary: #bbc6d8; --about-soft: #252b35; --about-success: #7bd8ac; --about-warning: #e2bd7c; }
.about-brand { display: grid; grid-template-columns: 82px minmax(0, 1fr) auto; align-items: center; gap: 22px; padding-bottom: 30px; }
.about-brand img { width: 82px; height: 82px; border-radius: 8px; object-fit: cover; box-shadow: 0 12px 24px rgb(17 25 43 / 14%); }
.about-brand-copy { min-width: 0; }
.about-kicker,.about-section-label { margin: 0 0 7px; color: #8491a5; font-size: 9px; font-weight: 800; letter-spacing: 2px; }
.about-brand h2 { margin: 0; color: var(--about-ink); font-size: 25px; line-height: 1.2; letter-spacing: 0; }
.about-brand h2 span { margin-left: 6px; color: var(--about-secondary); font-size: 16px; font-weight: 600; }
.about-brand-copy > p:not(.about-kicker) { margin: 8px 0 0; color: var(--about-muted); font-size: 13px; }
.about-tech { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; color: var(--about-secondary); font-size: 11px; }
.about-tech i { width: 3px; height: 3px; border-radius: 50%; background: #b5bfcc; }
.about-version { align-self: start; padding: 7px 10px; border: 1px solid #dbe4f2; border-radius: 6px; background: #f7f9fc; color: #435473; font-size: 12px; font-weight: 700; }
.about-section { padding: 26px 0; border-top: 1px solid var(--about-line); }
.about-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.about-section-heading.compact { margin-bottom: 14px; }
.about-section h3 { margin: 0; color: var(--about-ink); font-size: 16px; letter-spacing: 0; }
.about-action { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 7px; padding: 0 12px; border: 1px solid #d9e2ef; border-radius: 6px; background: #fff; color: #40516f; cursor: pointer; font-size: 12px; font-weight: 700; }
.about-action:hover { border-color: #afc4ec; color: var(--about-blue); background: #f7faff; }
.about-action.primary { border-color: var(--about-blue); background: var(--about-blue); color: #fff; }
.about-action.primary:hover { background: #155ce8; color: #fff; }
.about-action:disabled { cursor: default; opacity: .55; }
.update-current { display: grid; grid-template-columns: minmax(160px, .7fr) minmax(300px, 1.3fr); align-items: center; gap: 24px; margin-top: 20px; padding: 16px 18px; border-left: 3px solid #91b0f7; background: var(--about-soft); }
.update-current > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.update-current span { color: var(--about-muted); font-size: 12px; }
.update-current strong { color: var(--about-ink); font-size: 13px; }
.about-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.about-toggle-row span { display: grid; gap: 3px; }
.about-toggle-row small { color: #8a96a7; font-size: 11px; }
.about-toggle-row input { appearance: none; position: relative; width: 36px; height: 20px; flex: 0 0 auto; border: 0; border-radius: 10px; background: #b8c2d1; cursor: pointer; }
.about-toggle-row input:checked { background: var(--about-blue); }
.about-toggle-row input::after { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; content: ""; transition: transform 140ms ease; }
.about-toggle-row input:checked::after { transform: translateX(16px); }
.update-result { display: flex; align-items: flex-start; gap: 10px; margin-top: 14px; padding: 12px 14px; border: 1px solid #dce7df; border-radius: 6px; background: #f5faf7; color: #347052; }
.update-result.error { border-color: #efd9dc; background: #fff7f7; color: #a3424b; }
.update-result.available { border-color: #d4e0fa; background: #f5f8ff; color: #285db6; }
.update-result div { display: grid; gap: 3px; }
.update-result strong { font-size: 12px; }
.update-result span { font-size: 11px; opacity: .78; }
.release-details { margin-top: 14px; padding: 16px 18px; border-left: 3px solid var(--about-blue); background: var(--about-soft); }
.release-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.release-title strong { color: var(--about-ink); font-size: 13px; }
.release-title strong { min-width: 0; overflow-wrap: anywhere; }
.release-title .about-action { flex: 0 0 auto; }
.manual-update { margin-top: 12px; }
.update-progress { margin-top: 14px; color: var(--about-muted); font-size: 12px; }
.update-progress > div { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.update-progress progress { display: block; width: 100%; height: 8px; accent-color: var(--about-blue); }
.release-details pre { max-height: 180px; margin: 14px 0 0; overflow: auto; color: var(--about-secondary); font: 12px/1.65 "Microsoft YaHei UI", sans-serif; white-space: pre-wrap; overflow-wrap: anywhere; }
.about-link-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--about-line); border-bottom: 1px solid var(--about-line); }
.about-link-list button { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 15px 16px; border: 0; background: transparent; color: var(--about-secondary); cursor: pointer; text-align: left; }
.about-link-list button + button { border-left: 1px solid var(--about-line); }
.about-link-list button:hover { background: var(--about-soft); color: var(--about-blue); }
.about-link-list span { display: grid; min-width: 0; gap: 4px; }
.about-link-list strong { color: var(--about-ink); font-size: 13px; }
.about-link-list small { overflow: hidden; color: #8490a2; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.about-learning-note { margin: 13px 0 0; color: #7b8799; font-size: 11px; }
.legal-section { display: flex; align-items: flex-start; gap: 14px; color: var(--about-muted); }
.legal-section > svg { flex: 0 0 auto; color: #6485c4; }
.legal-section h3 { margin-bottom: 7px; }
.legal-section p { max-width: 760px; margin: 0; font-size: 12px; line-height: 1.75; }
.diagnostic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 18px 0 0; border-top: 1px solid var(--about-line); }
.diagnostic-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.diagnostic-notice { margin: 12px 0 0; color: var(--about-success); font-size: 12px; }
.diagnostic-grid > div { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 14px; padding: 12px 8px; border-bottom: 1px solid var(--about-line); }
.diagnostic-grid > div:nth-child(odd) { padding-right: 24px; }
.diagnostic-grid > div:nth-child(even) { padding-left: 24px; border-left: 1px solid var(--about-line); }
.diagnostic-grid dt { color: #8894a5; font-size: 11px; }
.diagnostic-grid dd { min-width: 0; margin: 0; color: var(--about-secondary); font-size: 12px; overflow-wrap: anywhere; }
.diagnostic-hint { display: flex; align-items: center; gap: 7px; margin: 12px 0 0; color: var(--about-warning); font-size: 11px; }
.about-error { margin: 0; padding: 11px 13px; border: 1px solid #efd9dc; border-radius: 6px; background: #fff7f7; color: #a3424b; font-size: 12px; }
.spinning { animation: about-spin 850ms linear infinite; }
button:focus-visible,input:focus-visible { outline: 2px solid var(--about-blue); outline-offset: 3px; }
@keyframes about-spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) {
  .diagnostics-section .about-section-heading { flex-wrap: wrap; }
  .diagnostic-actions { justify-content: flex-start; }
  .about-brand { grid-template-columns: 64px minmax(0, 1fr); }
  .about-brand img { width: 64px; height: 64px; }
  .about-version { grid-column: 2; justify-self: start; }
  .update-current,.diagnostic-grid,.about-link-list { grid-template-columns: 1fr; }
  .about-link-list button + button { border-top: 1px solid var(--about-line); border-left: 0; }
  .diagnostic-grid > div:nth-child(n) { padding-right: 8px; padding-left: 8px; border-left: 0; }
}
</style>
