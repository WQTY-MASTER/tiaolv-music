<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  pollQrLogin,
  startQrLogin,
  type AccountView,
  type QrLoginStatus,
  type QrLoginStatusResponse
} from "../services/api";

const props = defineProps<{
  visible: boolean;
  provider: "netease" | "qq";
  account?: AccountView | null;
}>();

const emit = defineEmits<{
  close: [];
  authenticated: [account: AccountView];
  logout: [];
}>();

type PanelState = "idle" | "loading" | QrLoginStatus | "error";

const state = ref<PanelState>("idle");
const errorMessage = ref("");
const qrImage = ref("");
const qrUrl = ref("");
const sessionId = ref("");
const secondsLeft = ref(0);
let pollTimer: number | undefined;
let requestVersion = 0;

const stateLabel: Record<PanelState, string> = {
  idle: "准备登录",
  loading: "加载二维码",
  WAITING: "等待扫码",
  CONFIRMING: "待确认",
  SUCCESS: "登录成功",
  EXPIRED: "二维码已过期",
  error: "加载失败"
};

const providerName = computed(() => props.provider === "qq" ? "QQ 音乐" : "网易云音乐");
const isQq = computed(() => props.provider === "qq");

function stopPolling() {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

function resetPanel() {
  stopPolling();
  sessionId.value = "";
  qrImage.value = "";
  qrUrl.value = "";
  secondsLeft.value = 0;
  errorMessage.value = "";
  state.value = "idle";
}

async function checkStatus(version: number) {
  if (!sessionId.value || version !== requestVersion) {
    return;
  }
  try {
    const response = await pollQrLogin(sessionId.value, props.provider);
    if (version !== requestVersion) {
      return;
    }
    applyStatus(response);
  } catch (error) {
    if (version !== requestVersion) {
      return;
    }
    stopPolling();
    state.value = "error";
    errorMessage.value = error instanceof Error ? error.message : "二维码状态检查失败";
  }
}

function applyStatus(response: QrLoginStatusResponse) {
  state.value = response.status;
  if (response.status === "SUCCESS") {
    stopPolling();
    if (response.userId && response.nickname) {
      emit("authenticated", {
        provider: response.provider,
        userId: response.userId,
        nickname: response.nickname,
        avatarUrl: response.avatarUrl
      });
    }
    return;
  }
  if (response.status === "EXPIRED") {
    stopPolling();
    errorMessage.value = response.message || "二维码已过期，请刷新后重试";
  }
}

async function startLogin() {
  const version = ++requestVersion;
  stopPolling();
  if (props.account) {
    state.value = "SUCCESS";
    errorMessage.value = "";
    return;
  }
  state.value = "loading";
  errorMessage.value = "";
  qrImage.value = "";
  qrUrl.value = "";
  try {
    const response = await startQrLogin(props.provider);
    if (version !== requestVersion || !props.visible) {
      return;
    }
    sessionId.value = response.sessionId;
    qrImage.value = response.qrimg || "";
    qrUrl.value = response.qrurl || "";
    secondsLeft.value = response.expiresInSeconds;
    state.value = response.status;
    pollTimer = window.setInterval(() => {
      secondsLeft.value = Math.max(0, secondsLeft.value - 3);
      if (secondsLeft.value === 0) {
        stopPolling();
        state.value = "EXPIRED";
        errorMessage.value = "二维码已过期，请刷新后重试";
        return;
      }
      void checkStatus(version);
    }, 3000);
  } catch (error) {
    if (version !== requestVersion) {
      return;
    }
    state.value = "error";
    errorMessage.value = error instanceof Error
      ? error.message
      : `二维码加载失败，请确认 Java 后端和${providerName.value} API 已启动`;
  }
}

function close() {
  requestVersion += 1;
  resetPanel();
  emit("close");
}

watch([() => props.visible, () => props.account, () => props.provider], ([visible, nextAccount]) => {
  if (!visible) {
    requestVersion += 1;
    resetPanel();
    return;
  }
  if (nextAccount) {
    requestVersion += 1;
    stopPolling();
    state.value = "SUCCESS";
    errorMessage.value = "";
    return;
  }
  void startLogin();
});

onMounted(() => {
  if (props.visible) {
    void startLogin();
  }
});

onBeforeUnmount(() => {
  requestVersion += 1;
  stopPolling();
});
</script>

<template>
  <Transition name="auth-panel">
    <section v-if="props.visible" class="auth-panel" :aria-label="`${providerName}登录`">
      <div class="auth-panel-backdrop" aria-hidden="true" @click="close"></div>
      <article class="auth-card">
        <button class="auth-close" type="button" title="关闭登录" aria-label="关闭登录" @click="close">×</button>
        <div class="auth-brand-mark" aria-hidden="true">听</div>
        <p class="auth-kicker">调律音乐账号</p>
        <h2>登录{{ providerName }}</h2>
        <p class="auth-description">
          {{ isQq ? "请使用手机 QQ 扫码，登录凭据仅加密保存在本机。" : "扫码登录后，可以查看你喜欢的歌曲、歌单和每日推荐。" }}
        </p>

        <div v-if="props.account" class="auth-account">
          <img v-if="props.account.avatarUrl" class="auth-avatar auth-avatar-image" :src="props.account.avatarUrl" :alt="`${props.account.nickname}头像`" />
          <div v-else class="auth-avatar">{{ props.account.nickname.slice(0, 1) }}</div>
          <div class="auth-account-copy"><strong>{{ props.account.nickname }}</strong><span>{{ providerName }}</span></div>
          <button class="auth-logout" type="button" @click="emit('logout')">退出登录</button>
        </div>

        <div v-else class="qr-login-content">
          <div class="qr-frame">
            <img v-if="qrImage" :src="qrImage" :alt="`${providerName}登录二维码`" />
            <div v-else-if="qrUrl" class="qr-url-fallback">
              <strong>请使用{{ providerName }}扫码</strong>
              <span>{{ qrUrl }}</span>
            </div>
            <div v-else class="qr-loading" :class="{ error: state === 'error' }">
              <span>{{ state === 'error' ? '!' : '...' }}</span>
            </div>
          </div>
          <strong class="auth-state">{{ stateLabel[state] }}</strong>
          <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>
          <p v-else-if="state === 'WAITING' || state === 'CONFIRMING'" class="auth-hint">二维码将在 {{ secondsLeft }} 秒后失效</p>
          <button v-if="state === 'EXPIRED' || state === 'error'" class="auth-retry" type="button" @click="startLogin">重新获取二维码</button>
        </div>
      </article>
    </section>
  </Transition>
</template>

<style scoped>
.auth-panel { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; }
.auth-panel-backdrop { position: absolute; inset: 0; background: rgba(23,33,32,.28); backdrop-filter: blur(5px); }
.auth-card { position: relative; z-index: 1; display: grid; width: min(390px, calc(100vw - 32px)); justify-items: center; padding: 34px 34px 30px; border: 1px solid #e0eae7; border-radius: 14px; background: #fff; box-shadow: 0 24px 70px rgba(25,47,42,.24); text-align: center; }
.auth-close { position: absolute; top: 13px; right: 15px; display: grid; width: 30px; height: 30px; place-items: center; border: 0; background: transparent; color: #8b9693; cursor: pointer; font-size: 23px; line-height: 1; }
.auth-close:hover { color: #168ec6; }
.auth-brand-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 12px; background: #20d57a; color: #fff; font-size: 21px; font-weight: 800; box-shadow: 0 8px 17px rgba(25,198,105,.2); }
.auth-kicker { margin: 16px 0 5px; color: #1fbd70; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; }
.auth-card h2 { margin: 0; color: #273432; font-size: 21px; }
.auth-description { max-width: 275px; margin: 9px 0 20px; color: #899692; font-size: 11px; line-height: 1.65; }
.qr-login-content { display: grid; width: 100%; justify-items: center; gap: 9px; }
.qr-frame { display: grid; width: 214px; height: 214px; place-items: center; padding: 9px; border: 1px solid #e1e9e6; border-radius: 9px; background: #fafdfc; }
.qr-frame img { width: 194px; height: 194px; object-fit: contain; }
.qr-loading { display: grid; width: 100%; height: 100%; place-items: center; color: #8fa09b; font-size: 28px; }
.qr-loading.error { color: #df6d74; }
.qr-url-fallback { display: grid; gap: 10px; max-width: 175px; color: #6d7d78; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.qr-url-fallback strong { color: #334440; font-size: 13px; }
.auth-state { color: #344a45; font-size: 13px; }
.auth-hint,.auth-error { margin: 0; color: #9aa6a2; font-size: 10px; line-height: 1.5; }
.auth-error { max-width: 280px; color: #c66b72; }
.auth-retry { margin-top: 4px; border: 1px solid #cfe4dc; border-radius: 7px; padding: 8px 14px; background: #f5fcf9; color: #21885f; cursor: pointer; font-size: 11px; }
.auth-retry:hover { border-color: #168ec6; color: #168ec6; }
.auth-account { display: flex; align-items: center; gap: 11px; width: 100%; padding: 15px; border: 1px solid #e2ece8; border-radius: 9px; text-align: left; }
.auth-avatar { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 50%; background: #202628; color: #fff; font-size: 14px; font-weight: 700; }
.auth-avatar-image { display: block; object-fit: cover; }
.auth-account-copy { display: grid; min-width: 0; flex: 1; gap: 4px; }.auth-account strong { color: #344541; font-size: 13px; }.auth-account span { color: #9aa7a2; font-size: 10px; }
.auth-logout { flex: 0 0 auto; border: 1px solid #e1e9e6; border-radius: 7px; padding: 7px 9px; background: #fff; color: #778b87; cursor: pointer; font-size: 10px; }.auth-logout:hover { border-color: #df8585; color: #c86f72; }
.auth-panel-enter-active,.auth-panel-leave-active { transition: opacity 180ms ease; }.auth-panel-enter-from,.auth-panel-leave-to { opacity: 0; }
</style>
