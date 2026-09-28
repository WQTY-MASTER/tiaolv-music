<script setup lang="ts">
import { Download, LoaderCircle, Music2, Play, RefreshCw, ShieldCheck, Upload, UserRound } from "lucide-vue-next";
import { resolveBackendUrl, type AccountView, type CloudTrackView } from "../services/api";

defineProps<{
  account: AccountView | null;
  providerName: string;
  tracks: CloudTrackView[];
  loading: boolean;
  uploading: boolean;
  error: string;
  currentTrackId: string;
  playing: boolean;
}>();

const emit = defineEmits<{
  (event: "upload"): void;
  (event: "refresh"): void;
  (event: "play-all"): void;
  (event: "play-track", track: CloudTrackView): void;
  (event: "download", track: CloudTrackView): void;
  (event: "context-menu", payload: { track: CloudTrackView; event: MouseEvent }): void;
  (event: "login"): void;
}>();

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes >= 10 ? megabytes.toFixed(1) : megabytes.toFixed(2)} MB`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date).replaceAll("/", "/");
}
</script>

<template>
  <section class="streaming-cloud-page" aria-label="音乐云盘">
    <div v-if="!account" class="cloud-login-state">
      <UserRound :size="48" :stroke-width="1.5" aria-hidden="true" />
      <h2>登录后使用音乐云盘</h2>
      <p>需要网易云音乐登录态，云盘内容来自你的网易云账号。</p>
      <button type="button" @click="emit('login')">登录 {{ providerName }}</button>
    </div>

    <div v-else class="cloud-surface">
      <header class="cloud-header">
        <div>
          <span>{{ providerName }}</span>
          <h2>我的音乐云盘</h2>
          <p>{{ tracks.length }} 首云盘歌曲 · 上传与下载均由主进程安全处理</p>
        </div>
        <div class="cloud-header-actions">
          <button type="button" :disabled="loading || uploading" @click="emit('refresh')">
            <RefreshCw :class="{ spinning: loading }" :size="16" :stroke-width="1.8" aria-hidden="true" />
            刷新
          </button>
          <button class="primary" type="button" :disabled="uploading" @click="emit('upload')">
            <LoaderCircle v-if="uploading" class="spinning" :size="16" aria-hidden="true" />
            <Upload v-else :size="16" :stroke-width="1.9" aria-hidden="true" />
            {{ uploading ? '正在上传' : '选择音频' }}
          </button>
        </div>
      </header>

      <div class="cloud-list-heading">
        <div>
          <h3>云盘歌曲</h3>
          <p>已加载 {{ tracks.length }} / {{ tracks.length }}</p>
        </div>
        <button class="play-all" type="button" :disabled="tracks.length === 0" @click="emit('play-all')">
          <Play :size="15" fill="currentColor" aria-hidden="true" />
          播放全部
        </button>
      </div>

      <p v-if="error" class="cloud-error" role="alert">{{ error }}</p>
      <div v-if="loading && tracks.length === 0" class="cloud-loading" role="status">
        <LoaderCircle class="spinning" :size="21" aria-hidden="true" />
        正在同步云盘歌曲...
      </div>
      <div v-else-if="tracks.length" class="cloud-track-list">
        <article
          v-for="track in tracks"
          :key="track.id"
          class="cloud-track-row"
          :class="{ active: track.id === currentTrackId }"
          tabindex="0"
          role="button"
          @click="emit('play-track', track)"
          @contextmenu.prevent="emit('context-menu', { track, event: $event })"
          @keydown.enter="emit('play-track', track)"
        >
          <span class="cloud-track-cover">
            <img v-if="track.coverUrl" :src="resolveBackendUrl(track.coverUrl)" :alt="`${track.title}封面`" />
            <Music2 v-else :size="22" :stroke-width="1.7" aria-hidden="true" />
          </span>
          <span class="cloud-track-copy">
            <strong>{{ track.title }}</strong>
            <span>{{ track.artist }}<template v-if="track.album"> · {{ track.album }}</template></span>
            <small>{{ track.originalFileName }}</small>
          </span>
          <span class="cloud-track-facts">
            <strong>{{ track.format }}</strong>
            <small>{{ formatSize(track.sizeBytes) }}</small>
          </span>
          <span class="cloud-track-facts cloud-track-timing">
            <strong>{{ formatDuration(track.duration) }}</strong>
            <small>{{ formatDate(track.uploadedAt) }}</small>
          </span>
          <span v-if="track.id === currentTrackId && playing" class="cloud-playing" aria-label="正在播放">♫</span>
          <button
            class="cloud-download"
            type="button"
            title="下载到本地"
            aria-label="下载到本地"
            :disabled="!track.audioUrl"
            @click.stop="emit('download', track)"
          >
            <Download :size="17" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </article>
      </div>
      <div v-else-if="!loading" class="cloud-empty">
        <Music2 :size="32" :stroke-width="1.4" aria-hidden="true" />
        <strong>云盘里还没有歌曲</strong>
        <p>选择电脑中的 MP3、FLAC、WAV、OGG、OPUS 或 M4A 文件上传。</p>
      </div>

      <footer class="cloud-security-note">
        <ShieldCheck :size="15" :stroke-width="1.8" aria-hidden="true" />
        本地模式只读取本机文件；这里连接网易云官方云盘，两者不会自动互通。
      </footer>
    </div>
  </section>
</template>

<style scoped>
.streaming-cloud-page {
  width: calc(100% - 112px);
  margin: 0 auto;
  padding-bottom: 112px;
}

.cloud-surface {
  padding: 34px 32px 26px;
  border: 1px solid rgba(255, 255, 255, .88);
  border-radius: 24px;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 18px 44px rgba(39, 48, 65, .065);
}

.cloud-header,
.cloud-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.cloud-header > div:first-child > span {
  color: #2f69ec;
  font-size: 12px;
  font-weight: 800;
}

.cloud-header h2 {
  margin: 7px 0 0;
  color: #1e2636;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: 0;
}

.cloud-header p,
.cloud-list-heading p {
  margin: 7px 0 0;
  color: #738198;
  font-size: 12px;
}

.cloud-header-actions {
  display: flex;
  gap: 9px;
}

.cloud-header-actions button,
.play-all,
.cloud-empty button,
.cloud-login-state button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  gap: 7px;
  padding: 0 16px;
  border: 1px solid #dfe4ed;
  border-radius: 8px;
  color: #40506a;
  background: #f9fbfd;
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.cloud-header-actions .primary,
.play-all,
.cloud-empty button,
.cloud-login-state button {
  border-color: #2d6bf2;
  color: #fff;
  background: #2d6bf2;
}

.cloud-header-actions button:disabled,
.play-all:disabled {
  opacity: .48;
  cursor: default;
}

.cloud-list-heading {
  margin-top: 34px;
}

.cloud-list-heading h3 {
  margin: 0;
  color: #273043;
  font-size: 17px;
  letter-spacing: 0;
}

.cloud-track-list {
  display: grid;
  gap: 9px;
  margin-top: 16px;
}

.cloud-track-row {
  display: grid;
  grid-template-columns: 52px minmax(260px, 1fr) 92px 98px 24px 38px;
  align-items: center;
  min-height: 78px;
  gap: 14px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f7f9fc;
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.cloud-track-row:hover,
.cloud-track-row:focus-visible {
  transform: translateY(-1px);
  border-color: #dce4f2;
  background: #f3f7fc;
  outline: none;
}

.cloud-track-row.active {
  border-color: #cbdcff;
  background: #f0f5ff;
}

.cloud-track-cover {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  color: #8a96a9;
  background: #e8edf4;
}

.cloud-track-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cloud-track-copy,
.cloud-track-facts {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.cloud-track-copy strong,
.cloud-track-copy span,
.cloud-track-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-track-copy strong {
  color: #202839;
  font-size: 14px;
  font-weight: 800;
}

.cloud-track-copy span {
  color: #5f708b;
  font-size: 11px;
}

.cloud-track-copy small,
.cloud-track-facts small {
  color: #8b98aa;
  font-size: 11px;
}

.cloud-track-facts strong {
  color: #64748c;
  font-size: 11px;
  font-weight: 650;
}

.cloud-playing {
  color: #2e68e9;
  font-size: 15px;
  text-align: center;
}

.cloud-download {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid #e0e5ec;
  border-radius: 8px;
  color: #526177;
  background: #fff;
  cursor: pointer;
}

.cloud-download:hover,
.cloud-download:focus-visible {
  border-color: #aac2fb;
  color: #2e68e9;
  outline: none;
}

.cloud-download:disabled {
  opacity: .4;
  cursor: default;
}

.cloud-loading,
.cloud-empty,
.cloud-login-state {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8793a5;
  text-align: center;
}

.cloud-empty strong,
.cloud-login-state h2 {
  margin: 0;
  color: #283144;
  font-size: 18px;
}

.cloud-empty p,
.cloud-login-state p {
  margin: 0 0 5px;
  color: #8793a5;
  font-size: 12px;
}

.cloud-login-state {
  min-height: 360px;
  padding: 32px;
  border: 1px solid rgba(255, 255, 255, .88);
  border-radius: 24px;
  background: rgba(255, 255, 255, .86);
}

.cloud-error {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 6px;
  color: #a94949;
  background: #fff1f1;
  font-size: 12px;
}

.cloud-security-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 20px;
  color: #8190a5;
  font-size: 11px;
}

.spinning {
  animation: cloud-spin 900ms linear infinite;
}

@keyframes cloud-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 980px) {
  .streaming-cloud-page { width: calc(100% - 40px); }
  .cloud-track-row { grid-template-columns: 52px minmax(0, 1fr) 82px 38px; }
  .cloud-track-timing, .cloud-playing { display: none; }
}

@media (max-width: 620px) {
  .streaming-cloud-page { width: 100%; }
  .cloud-surface { padding: 24px 18px; }
  .cloud-header { align-items: flex-start; flex-direction: column; }
  .cloud-header-actions { width: 100%; }
  .cloud-header-actions button { flex: 1; }
  .cloud-track-row { grid-template-columns: 48px minmax(0, 1fr) 36px; gap: 10px; }
  .cloud-track-cover { width: 48px; height: 48px; }
  .cloud-track-facts { display: none; }
  .cloud-security-note { align-items: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .cloud-track-row { transition: none; }
  .spinning { animation: none; }
}
</style>
