<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArrowLeft, Cloud, Eye, EyeOff, KeyRound, MessageSquareText, Music2, QrCode, Smartphone } from "lucide-vue-next";
import {
  loginNeteaseWithPassword,
  loginNeteaseWithSms,
  pollQrLogin,
  sendNeteaseSmsCode,
  startQrLogin,
  type AccountView,
  type QrLoginStatus,
  type QrLoginStatusResponse
} from "../services/api";

const props = defineProps<{
  visible: boolean;
  provider: "netease" | "qq";
  account?: AccountView | null;
  accounts: AccountView[];
}>();

const emit = defineEmits<{
  close: [];
  authenticated: [account: AccountView];
  logout: [];
  "select-provider": [provider: "netease" | "qq"];
}>();

type LoginMethod = "qr" | "sms" | "password";
type PanelState = "idle" | "loading" | QrLoginStatus | "error";

const state = ref<PanelState>("idle");
const loginMethod = ref<LoginMethod>("qr");
const showPlatformPicker = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const qrImage = ref("");
const qrUrl = ref("");
const sessionId = ref("");
const secondsLeft = ref(0);
const phone = ref("");
const captcha = ref("");
const loginAccount = ref("");
const password = ref("");
const passwordVisible = ref(false);
const formPending = ref(false);
const smsSending = ref(false);
const smsCooldown = ref(0);
let pollTimer: number | undefined;
let countdownTimer: number | undefined;
let cooldownTimer: number | undefined;
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

const providerName = computed(() => props.provider === "qq" ? "QQ音乐" : "网易云音乐");
const isQq = computed(() => props.provider === "qq");
const isScanning = computed(() => Boolean(qrImage.value)
  && (state.value === "WAITING" || state.value === "CONFIRMING"));
const description = computed(() => {
  if (isQq.value) return "请使用手机 QQ 扫码，登录凭据仅加密保存在本机。";
  if (loginMethod.value === "sms") return "验证码仅用于本次登录，成功后不会在本机保存。";
  if (loginMethod.value === "password") return "支持网易云手机号或邮箱，密码不会在本机保存。";
  return "登录后，可以查看你喜欢的歌曲、歌单和每日推荐。";
});

function platformAccountFor(provider: "netease" | "qq") {
  return props.accounts.find((candidate) => candidate.provider === provider) ?? null;
}

function stopPolling() {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
  if (countdownTimer !== undefined) {
    window.clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
}

function stopCooldown() {
  if (cooldownTimer !== undefined) {
    window.clearInterval(cooldownTimer);
    cooldownTimer = undefined;
  }
}

function resetQrState() {
  stopPolling();
  sessionId.value = "";
  qrImage.value = "";
  qrUrl.value = "";
  secondsLeft.value = 0;
  state.value = "idle";
}

function resetPanel() {
  resetQrState();
  stopCooldown();
  loginMethod.value = "qr";
  errorMessage.value = "";
  successMessage.value = "";
  phone.value = "";
  captcha.value = "";
  loginAccount.value = "";
  password.value = "";
  passwordVisible.value = false;
  formPending.value = false;
  smsSending.value = false;
  smsCooldown.value = 0;
}

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

async function checkStatus(version: number) {
  if (!sessionId.value || version !== requestVersion) return;
  try {
    const response = await pollQrLogin(sessionId.value, props.provider);
    if (version !== requestVersion) return;
    applyStatus(response);
  } catch (error) {
    if (version !== requestVersion) return;
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
  resetQrState();
  if (props.account) {
    state.value = "SUCCESS";
    return;
  }
  if (!props.visible || loginMethod.value !== "qr") return;
  state.value = "loading";
  clearMessages();
  try {
    const response = await startQrLogin(props.provider);
    if (version !== requestVersion || !props.visible || loginMethod.value !== "qr") return;
    sessionId.value = response.sessionId;
    qrImage.value = response.qrimg || "";
    qrUrl.value = response.qrurl || "";
    secondsLeft.value = response.expiresInSeconds;
    state.value = response.status;
    countdownTimer = window.setInterval(() => {
      secondsLeft.value = Math.max(0, secondsLeft.value - 1);
      if (secondsLeft.value === 0) {
        stopPolling();
        state.value = "EXPIRED";
        errorMessage.value = "二维码已过期，请刷新后重试";
      }
    }, 1000);
    pollTimer = window.setInterval(() => {
      void checkStatus(version);
    }, 3000);
  } catch (error) {
    if (version !== requestVersion) return;
    state.value = "error";
    errorMessage.value = error instanceof Error
      ? error.message
      : `二维码加载失败，请确认 Java 后端和${providerName.value} API 已启动`;
  }
}

function selectMethod(method: LoginMethod) {
  if (props.provider === "qq") {
    loginMethod.value = "qr";
    return;
  }
  if (loginMethod.value === method) return;
  requestVersion += 1;
  resetQrState();
  clearMessages();
  loginMethod.value = method;
  if (method === "qr") void startLogin();
}

async function sendSms() {
  if (smsSending.value || smsCooldown.value > 0) return;
  clearMessages();
  if (!/^1\d{10}$/.test(phone.value.trim())) {
    errorMessage.value = "请输入正确的 11 位手机号";
    return;
  }
  smsSending.value = true;
  try {
    const response = await sendNeteaseSmsCode(phone.value.trim());
    successMessage.value = response.message || "验证码已发送";
    smsCooldown.value = 60;
    stopCooldown();
    cooldownTimer = window.setInterval(() => {
      smsCooldown.value = Math.max(0, smsCooldown.value - 1);
      if (smsCooldown.value === 0) stopCooldown();
    }, 1000);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "验证码发送失败，请稍后重试";
  } finally {
    smsSending.value = false;
  }
}

async function submitSms() {
  if (formPending.value) return;
  clearMessages();
  if (!/^1\d{10}$/.test(phone.value.trim())) {
    errorMessage.value = "请输入正确的 11 位手机号";
    return;
  }
  if (!/^\d{4,8}$/.test(captcha.value.trim())) {
    errorMessage.value = "请输入正确的短信验证码";
    return;
  }
  formPending.value = true;
  try {
    emit("authenticated", await loginNeteaseWithSms(phone.value.trim(), captcha.value.trim()));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "短信登录失败，请稍后重试";
  } finally {
    formPending.value = false;
  }
}

async function submitPassword() {
  if (formPending.value) return;
  clearMessages();
  if (!loginAccount.value.trim()) {
    errorMessage.value = "请输入网易云手机号或邮箱";
    return;
  }
  if (!password.value) {
    errorMessage.value = "请输入网易云账号密码";
    return;
  }
  formPending.value = true;
  try {
    emit("authenticated", await loginNeteaseWithPassword(loginAccount.value.trim(), password.value));
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "账号密码登录失败，请稍后重试";
  } finally {
    password.value = "";
    formPending.value = false;
  }
}

function selectProvider(provider: "netease" | "qq") {
  requestVersion += 1;
  resetPanel();
  showPlatformPicker.value = false;
  const existingAccount = platformAccountFor(provider);
  if (existingAccount) {
    emit("authenticated", existingAccount);
    return;
  }
  if (provider === props.provider) {
    void startLogin();
    return;
  }
  emit("select-provider", provider);
}

function openPlatformPicker() {
  requestVersion += 1;
  resetPanel();
  showPlatformPicker.value = true;
}

function goBack() {
  if (showPlatformPicker.value) {
    showPlatformPicker.value = false;
    if (props.account) state.value = "SUCCESS";
    else void startLogin();
    return;
  }
  requestVersion += 1;
  resetPanel();
  emit("close");
}

watch([() => props.visible, () => props.account, () => props.provider], ([visible, nextAccount]) => {
  requestVersion += 1;
  resetPanel();
  showPlatformPicker.value = false;
  if (!visible) return;
  if (props.provider === "qq") loginMethod.value = "qr";
  if (nextAccount) {
    state.value = "SUCCESS";
    return;
  }
  void startLogin();
});

onMounted(() => {
  if (props.visible) void startLogin();
});

onBeforeUnmount(() => {
  requestVersion += 1;
  stopPolling();
  stopCooldown();
});
</script>

<template>
  <Transition name="auth-panel">
    <section v-if="props.visible" class="auth-panel" :aria-label="`${providerName}登录`">
      <header class="auth-page-toolbar">
        <button type="button" title="返回" aria-label="返回" @click="goBack"><ArrowLeft :size="22" aria-hidden="true" /></button>
      </header>

      <main class="auth-page-main">
        <Transition name="auth-surface" mode="out-in">
          <article v-if="showPlatformPicker" key="platforms" class="auth-card auth-platform-picker">
            <div class="auth-picker-mark" aria-hidden="true"><Music2 :size="24" /></div>
            <p class="auth-picker-kicker">全部平台</p>
            <h2>选择登录平台</h2>
            <p class="auth-description">选择音乐服务后，将使用对应平台提供的真实登录方式。</p>
            <div class="auth-platform-list">
              <button type="button" @click="selectProvider('netease')">
                <img v-if="platformAccountFor('netease')?.avatarUrl" class="auth-provider-avatar" :src="platformAccountFor('netease')?.avatarUrl" :alt="`${platformAccountFor('netease')?.nickname}头像`" />
                <span v-else class="auth-provider-icon netease"><Cloud :size="22" aria-hidden="true" /></span>
                <span>
                  <strong>{{ platformAccountFor('netease')?.nickname || '网易云音乐' }}</strong>
                  <small>{{ platformAccountFor('netease') ? '网易云音乐 · 已登录' : '扫码、短信或账号密码登录' }}</small>
                </span>
                <span class="auth-platform-action" :class="{ authenticated: platformAccountFor('netease') }">{{ platformAccountFor('netease') ? '已登录' : '登录' }}</span>
              </button>
              <button type="button" @click="selectProvider('qq')">
                <img v-if="platformAccountFor('qq')?.avatarUrl" class="auth-provider-avatar" :src="platformAccountFor('qq')?.avatarUrl" :alt="`${platformAccountFor('qq')?.nickname}头像`" />
                <span v-else class="auth-provider-icon qq"><Music2 :size="22" aria-hidden="true" /></span>
                <span>
                  <strong>{{ platformAccountFor("qq")?.nickname || 'QQ音乐' }}</strong>
                  <small>{{ platformAccountFor('qq') ? 'QQ音乐 · 已登录' : '使用手机 QQ 扫码登录' }}</small>
                </span>
                <span class="auth-platform-action" :class="{ authenticated: platformAccountFor('qq') }">{{ platformAccountFor('qq') ? '已登录' : '登录' }}</span>
              </button>
            </div>
          </article>

          <article v-else key="login" class="auth-card">
            <button class="auth-all-platforms" type="button" @click="openPlatformPicker"><ArrowLeft :size="13" aria-hidden="true" />全部平台</button>
            <div class="auth-heading">
              <span class="auth-provider-icon" :class="isQq ? 'qq' : 'netease'">
                <Music2 v-if="isQq" :size="21" aria-hidden="true" />
                <Cloud v-else :size="21" aria-hidden="true" />
              </span>
              <h2>登录 {{ providerName }}</h2>
            </div>
            <p class="auth-description">{{ description }}</p>

            <div v-if="props.account" class="auth-account">
              <img v-if="props.account.avatarUrl" class="auth-avatar auth-avatar-image" :src="props.account.avatarUrl" :alt="`${props.account.nickname}头像`" />
              <div v-else class="auth-avatar">{{ props.account.nickname.slice(0, 1) }}</div>
              <div class="auth-account-copy"><strong>{{ props.account.nickname }}</strong><span>{{ providerName }}</span></div>
              <button class="auth-logout" type="button" @click="emit('logout')">退出登录</button>
            </div>

            <template v-else>
              <div v-if="!isQq" class="auth-methods" role="tablist" aria-label="网易云登录方式">
                <button type="button" role="tab" :aria-selected="loginMethod === 'qr'" :class="{ active: loginMethod === 'qr' }" @click="selectMethod('qr')"><QrCode :size="15" aria-hidden="true" />扫码登录</button>
                <button type="button" role="tab" :aria-selected="loginMethod === 'sms'" :class="{ active: loginMethod === 'sms' }" @click="selectMethod('sms')"><MessageSquareText :size="15" aria-hidden="true" />短信登录</button>
                <button type="button" role="tab" :aria-selected="loginMethod === 'password'" :class="{ active: loginMethod === 'password' }" @click="selectMethod('password')"><KeyRound :size="15" aria-hidden="true" />密码登录</button>
              </div>

              <Transition name="auth-method" mode="out-in">
                <div v-if="loginMethod === 'qr'" key="qr" class="qr-login-content">
                  <div class="qr-frame" :class="{ scanning: isScanning }">
                    <span class="qr-corner top-left" aria-hidden="true"></span>
                    <span class="qr-corner top-right" aria-hidden="true"></span>
                    <span class="qr-corner bottom-left" aria-hidden="true"></span>
                    <span class="qr-corner bottom-right" aria-hidden="true"></span>
                    <img v-if="qrImage" :src="qrImage" :alt="`${providerName}登录二维码`" />
                    <div v-else-if="qrUrl" class="qr-url-fallback"><strong>请使用{{ providerName }}扫码</strong><span>{{ qrUrl }}</span></div>
                    <div v-else class="qr-loading" :class="{ error: state === 'error' }"><span>{{ state === 'error' ? '!' : '...' }}</span></div>
                  </div>
                  <p class="auth-qr-instruction"><span aria-hidden="true"></span>{{ isQq ? "请使用手机 QQ 扫码登录" : "请使用网易云音乐 App 扫码登录" }}</p>
                  <strong class="auth-state">{{ stateLabel[state] }}</strong>
                  <p v-if="errorMessage" class="auth-message error" role="alert">{{ errorMessage }}</p>
                  <p v-else-if="state === 'WAITING' || state === 'CONFIRMING'" class="auth-message">二维码将在 {{ secondsLeft }} 秒后失效</p>
                  <button v-if="state === 'EXPIRED' || state === 'error'" class="auth-retry" type="button" @click="startLogin">重新获取二维码</button>
                </div>

                <form v-else-if="loginMethod === 'sms'" key="sms" class="auth-form" @submit.prevent="submitSms">
                  <label><span>手机号</span><span class="auth-input-wrap"><Smartphone :size="17" aria-hidden="true" /><input v-model="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="请输入 11 位手机号" /></span></label>
                  <label><span>短信验证码</span><span class="auth-code-row"><span class="auth-input-wrap"><MessageSquareText :size="17" aria-hidden="true" /><input v-model="captcha" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="请输入验证码" /></span><button type="button" :disabled="smsSending || smsCooldown > 0" @click="sendSms">{{ smsCooldown > 0 ? `${smsCooldown}s` : smsSending ? "发送中" : "获取验证码" }}</button></span></label>
                  <p v-if="errorMessage" class="auth-message error" role="alert">{{ errorMessage }}</p>
                  <p v-else-if="successMessage" class="auth-message success" role="status">{{ successMessage }}</p>
                  <button class="auth-submit" type="submit" :disabled="formPending">{{ formPending ? "登录中..." : "登录网易云音乐" }}</button>
                </form>

                <form v-else key="password" class="auth-form" @submit.prevent="submitPassword">
                  <label><span>账号</span><span class="auth-input-wrap"><Smartphone :size="17" aria-hidden="true" /><input v-model="loginAccount" type="text" autocomplete="username" placeholder="手机号或网易邮箱" /></span></label>
                  <label><span>密码</span><span class="auth-input-wrap"><KeyRound :size="17" aria-hidden="true" /><input v-model="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" /><button class="auth-password-toggle" type="button" :title="passwordVisible ? '隐藏密码' : '显示密码'" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" @click="passwordVisible = !passwordVisible"><EyeOff v-if="passwordVisible" :size="16" /><Eye v-else :size="16" /></button></span></label>
                  <p v-if="errorMessage" class="auth-message error" role="alert">{{ errorMessage }}</p>
                  <button class="auth-submit" type="submit" :disabled="formPending">{{ formPending ? "登录中..." : "登录网易云音乐" }}</button>
                </form>
              </Transition>
            </template>

          </article>
        </Transition>
      </main>
    </section>
  </Transition>
</template>

<style scoped>
.auth-panel { position: fixed; inset: 0; z-index: 100; display: grid; grid-template-rows: 58px minmax(0,1fr); overflow: hidden; background: radial-gradient(circle at 88% 12%,rgba(162,232,214,.38),transparent 29%),radial-gradient(circle at 3% 94%,rgba(183,235,222,.28),transparent 28%),#f3f7f7; color: #142034; }
.auth-page-toolbar { position: relative; z-index: 2; display: flex; align-items: center; padding: 10px 14px; -webkit-app-region: drag; }
.auth-page-toolbar button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #25343f; cursor: pointer; -webkit-app-region: no-drag; }
.auth-page-toolbar button:hover { background: rgba(255,255,255,.72); color: #0dbb82; }
.auth-page-main { display: grid; min-height: 0; place-items: center; overflow: auto; padding: 28px 24px 72px; }
.auth-card { position: relative; display: grid; width: min(496px,calc(100vw - 40px)); min-height: 520px; align-content: start; justify-items: center; padding: 39px 54px 34px; border: 1px solid rgba(222,233,231,.9); border-radius: 8px; background: rgba(255,255,255,.95); box-shadow: 0 22px 55px rgba(34,55,54,.14); text-align: center; }
.auth-all-platforms { display: inline-flex; min-height: 30px; align-items: center; gap: 4px; margin-bottom: 12px; border: 1px solid #dfe8e6; border-radius: 16px; padding: 0 12px; background: #fff; color: #3574d1; cursor: pointer; font-size: 12px; font-weight: 700; box-shadow: 0 3px 9px rgba(49,71,67,.08); }
.auth-all-platforms:hover { border-color: #65cdb0; color: #0cae78; }
.auth-heading { display: flex; align-items: center; justify-content: center; gap: 11px; }
.auth-provider-icon { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 8px; }
.auth-provider-icon.netease { background: #e7f7f1; color: #10b87d; }
.auth-provider-icon.qq { background: #fff3d8; color: #e39b14; }
.auth-card h2 { margin: 0; color: #152035; font-size: 25px; font-weight: 800; letter-spacing: 0; }
.auth-description { max-width: 370px; min-height: 20px; margin: 10px 0 20px; color: #7c898e; font-size: 12px; line-height: 1.65; }
.auth-methods { display: grid; width: 100%; grid-template-columns: repeat(3,1fr); padding: 4px; border-radius: 23px; background: #f4f7f8; }
.auth-methods button { display: inline-flex; min-width: 0; height: 38px; align-items: center; justify-content: center; gap: 5px; border: 0; border-radius: 19px; padding: 0 7px; background: transparent; color: #718087; cursor: pointer; font-size: 12px; font-weight: 700; }
.auth-methods button.active { background: #fff; color: #0db77d; box-shadow: 0 3px 11px rgba(38,73,63,.11); }
.qr-login-content { display: grid; width: 100%; justify-items: center; gap: 8px; padding-top: 24px; }
.qr-frame { position: relative; display: grid; width: 216px; height: 216px; place-items: center; overflow: hidden; padding: 13px; border: 1px solid #e1e9e6; border-radius: 8px; background: #fff; box-shadow: 0 12px 28px rgba(31,65,56,.08); }
.qr-corner { position: absolute; z-index: 3; width: 22px; height: 22px; border-color: #12ba81; border-style: solid; pointer-events: none; }
.qr-corner.top-left { top: 10px; left: 10px; border-width: 2px 0 0 2px; border-radius: 10px 0 0; }
.qr-corner.top-right { top: 10px; right: 10px; border-width: 2px 2px 0 0; border-radius: 0 10px 0 0; }
.qr-corner.bottom-left { bottom: 10px; left: 10px; border-width: 0 0 2px 2px; border-radius: 0 0 0 10px; }
.qr-corner.bottom-right { right: 10px; bottom: 10px; border-width: 0 2px 2px 0; border-radius: 0 0 10px; }
.qr-frame img { display: block; width: 180px; height: 180px; object-fit: contain; }
.qr-frame::after { position: absolute; z-index: 2; top: 14px; right: 14px; left: 14px; height: 2px; border-radius: 2px; background: linear-gradient(90deg,transparent,rgba(22,191,137,.4) 12%,#11bc82 50%,rgba(22,191,137,.4) 88%,transparent); box-shadow: 0 0 7px rgba(17,188,130,.75),0 7px 18px rgba(17,188,130,.2); content: ""; opacity: 0; pointer-events: none; transform: translateY(0); }
.qr-frame.scanning::after { opacity: 1; animation: qr-scan 2.4s cubic-bezier(.45,0,.55,1) infinite alternate; animation-direction: alternate; }
@keyframes qr-scan { from { transform: translateY(0); } to { transform: translateY(186px); } }
.qr-loading { display: grid; width: 100%; height: 100%; place-items: center; color: #8fa09b; font-size: 28px; }
.qr-loading.error { color: #df6d74; }
.qr-url-fallback { display: grid; gap: 10px; max-width: 170px; color: #6d7d78; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.qr-url-fallback strong { color: #334440; font-size: 13px; }
.auth-qr-instruction { display: flex; align-items: center; gap: 7px; margin: 8px 0 0; color: #39464e; font-size: 12px; }
.auth-qr-instruction span { width: 7px; height: 7px; border-radius: 50%; background: #14bc82; box-shadow: 0 0 0 4px rgba(20,188,130,.08); }
.auth-state { color: #344a45; font-size: 12px; }
.auth-message { min-height: 16px; margin: 0; color: #93a09d; font-size: 11px; line-height: 1.5; }
.auth-message.error { max-width: 340px; color: #c66b72; }
.auth-message.success { color: #159d68; }
.auth-retry { margin-top: 2px; border: 1px solid #cfe4dc; border-radius: 8px; padding: 8px 14px; background: #f5fcf9; color: #21885f; cursor: pointer; font-size: 11px; }
.auth-retry:hover { border-color: #168ec6; color: #168ec6; }
.auth-form { display: grid; width: 100%; gap: 16px; padding-top: 26px; text-align: left; }
.auth-form label { display: grid; gap: 7px; color: #35443f; font-size: 12px; font-weight: 700; }
.auth-input-wrap { display: flex; min-width: 0; height: 46px; align-items: center; gap: 9px; border: 1px solid #dce7e3; border-radius: 8px; padding: 0 13px; background: #fbfdfc; color: #7d8f89; transition: border-color 160ms ease,box-shadow 160ms ease; }
.auth-input-wrap:focus-within { border-color: #25bd83; box-shadow: 0 0 0 3px rgba(37,189,131,.1); }
.auth-input-wrap input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #24332f; font: inherit; font-weight: 500; }
.auth-input-wrap input::placeholder { color: #a6b2ae; }
.auth-code-row { display: grid; grid-template-columns: 1fr 104px; gap: 9px; }
.auth-code-row > button { border: 1px solid #cfe7de; border-radius: 8px; background: #eefaf6; color: #159d68; cursor: pointer; font-size: 11px; font-weight: 700; }
.auth-code-row > button:disabled { cursor: default; opacity: .55; }
.auth-password-toggle { display: grid; flex: 0 0 26px; height: 30px; place-items: center; border: 0; background: transparent; color: #86958f; cursor: pointer; }
.auth-submit { height: 44px; border: 0; border-radius: 8px; background: #18bb7c; color: #fff; cursor: pointer; font-size: 13px; font-weight: 800; box-shadow: 0 8px 18px rgba(24,187,124,.2); }
.auth-submit:hover { background: #13aa70; }
.auth-submit:disabled { cursor: wait; opacity: .65; }
.auth-account { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 20px; padding: 16px; border: 1px solid #e2ece8; border-radius: 8px; text-align: left; }
.auth-avatar { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 50%; background: #202628; color: #fff; font-size: 14px; font-weight: 700; }
.auth-avatar-image { display: block; object-fit: cover; }
.auth-account-copy { display: grid; min-width: 0; flex: 1; gap: 4px; }
.auth-account strong { color: #344541; font-size: 13px; }
.auth-account span { color: #9aa7a2; font-size: 11px; }
.auth-logout { flex: 0 0 auto; border: 1px solid #e1e9e6; border-radius: 7px; padding: 8px 10px; background: #fff; color: #778b87; cursor: pointer; font-size: 11px; }
.auth-logout:hover { border-color: #df8585; color: #c86f72; }
.auth-platform-picker { align-content: center; }
.auth-picker-mark { display: grid; width: 50px; height: 50px; place-items: center; border-radius: 8px; background: #e6f8f1; color: #13b77d; }
.auth-picker-kicker { margin: 13px 0 5px; color: #13ac77; font-size: 11px; font-weight: 800; }
.auth-platform-list { display: grid; width: 100%; gap: 10px; margin-top: 8px; }
.auth-platform-list > button { display: grid; grid-template-columns: 42px minmax(0,1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 72px; border: 1px solid #e1ebe8; border-radius: 8px; padding: 12px 14px; background: #fbfdfc; color: #283832; cursor: pointer; text-align: left; }
.auth-platform-list > button:hover { border-color: #43c59c; background: #f2fbf7; box-shadow: 0 6px 18px rgba(30,132,99,.08); }
.auth-platform-list > button > span:nth-child(2) { display: grid; gap: 4px; }
.auth-platform-list strong { font-size: 13px; }
.auth-platform-list small { color: #879590; font-size: 11px; }
.auth-provider-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
.auth-platform-action { border-radius: 13px; padding: 5px 9px; background: #e6f7f1; color: #0da774; font-size: 11px; font-weight: 700; }
.auth-platform-action.authenticated { background: #e8f1ef; color: #53716a; }
.auth-panel-enter-active,.auth-panel-leave-active { transition: opacity 440ms cubic-bezier(.22,.72,.28,1),transform 440ms cubic-bezier(.22,.72,.28,1); }
.auth-panel-enter-from { transform: translateX(14px); }
.auth-panel-leave-to { opacity: 0; transform: translateX(-10px); }
.auth-panel-enter-active .auth-card,.auth-panel-enter-active .auth-page-toolbar { transition: opacity 440ms cubic-bezier(.22,.72,.28,1),transform 440ms cubic-bezier(.22,.72,.28,1); }
.auth-panel-enter-from .auth-card { opacity: 0; transform: translateY(12px); }
.auth-panel-enter-from .auth-page-toolbar { opacity: 0; transform: translateX(-8px); }
.auth-surface-enter-active,.auth-surface-leave-active { transition: opacity 230ms ease,transform 230ms ease; }
.auth-surface-enter-from { opacity: 0; transform: translateX(10px); }
.auth-surface-leave-to { opacity: 0; transform: translateX(-8px); }
.auth-method-enter-active,.auth-method-leave-active { transition: opacity 180ms ease,transform 180ms ease; }
.auth-method-enter-from { opacity: 0; transform: translateY(5px); }
.auth-method-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-height: 720px) { .auth-page-main { place-items: start center; padding-top: 16px; } .auth-card { min-height: 500px; } }
@media (max-width: 560px) { .auth-page-main { padding-inline: 12px; } .auth-card { width: calc(100vw - 24px); min-height: 500px; padding: 32px 22px 28px; } .auth-card h2 { font-size: 22px; } .auth-methods button svg { display: none; } }
@media (prefers-reduced-motion: reduce) { .qr-frame.scanning::after { animation: none; opacity: .55; transform: translateY(93px); } .auth-panel-enter-active,.auth-panel-leave-active,.auth-surface-enter-active,.auth-surface-leave-active,.auth-method-enter-active,.auth-method-leave-active { transition: none; } }
</style>
