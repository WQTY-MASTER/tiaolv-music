<script setup lang="ts">
import { computed } from "vue";
import { LogIn, LogOut } from "lucide-vue-next";
import type { AccountView } from "../services/api";

type AccountProvider = "netease" | "qq";

const props = defineProps<{
  visible: boolean;
  accounts: AccountView[];
}>();

const emit = defineEmits<{
  close: [];
  login: [provider: AccountProvider];
  logout: [provider: AccountProvider];
}>();

const providers: Array<{
  id: AccountProvider;
  name: string;
  shortName: string;
  description: string;
}> = [
  { id: "netease", name: "网易云音乐", shortName: "易", description: "扫码登录" },
  { id: "qq", name: "QQ 音乐", shortName: "Q", description: "Cookie 登录" }
];

function accountFor(provider: AccountProvider) {
  return props.accounts.find((account) => account.provider === provider) ?? null;
}

const providerRows = computed(() => providers.map((provider) => ({
  ...provider,
  account: accountFor(provider.id)
})));
</script>

<template>
  <Transition name="account-menu">
    <div v-if="props.visible" class="account-menu-layer">
      <button
        class="account-menu-backdrop"
        type="button"
        aria-label="关闭账号管理"
        @click="emit('close')"
      ></button>
      <section class="account-menu-panel" aria-label="账号管理面板" @click.stop>
        <header>
          <div>
            <strong>账号管理</strong>
            <span>两个平台可同时保持登录</span>
          </div>
          <span class="account-count">{{ props.accounts.length }}/2</span>
        </header>

        <div class="provider-list">
          <article v-for="provider in providerRows" :key="provider.id" class="provider-row">
            <template v-if="provider.account">
              <img
                v-if="provider.account.avatarUrl"
                class="provider-avatar"
                :src="provider.account.avatarUrl"
                :alt="`${provider.account.nickname}头像`"
              />
              <span v-else class="provider-avatar provider-avatar-fallback" aria-hidden="true">
                {{ provider.account.nickname.slice(0, 1) }}
              </span>
              <div class="provider-copy">
                <strong>{{ provider.account.nickname }}</strong>
                <span><i aria-hidden="true"></i>{{ provider.name }} · 已登录</span>
              </div>
              <button
                class="provider-action logout"
                type="button"
                :title="`退出${provider.name}`"
                :aria-label="`退出${provider.name}`"
                @click="emit('logout', provider.id)"
              >
                <LogOut :size="16" :stroke-width="1.7" aria-hidden="true" />
                <span>退出登录</span>
              </button>
            </template>
            <template v-else>
              <span class="provider-avatar provider-logo" :class="`is-${provider.id}`" aria-hidden="true">
                {{ provider.shortName }}
              </span>
              <div class="provider-copy">
                <strong>{{ provider.name }}</strong>
                <span>{{ provider.description }} · 未登录</span>
              </div>
              <button
                class="provider-action"
                type="button"
                :title="`登录${provider.name}`"
                :aria-label="`登录${provider.name}`"
                @click="emit('login', provider.id)"
              >
                <LogIn :size="16" :stroke-width="1.7" aria-hidden="true" />
                <span>登录</span>
              </button>
            </template>
          </article>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.account-menu-layer { position: relative; z-index: 95; }
.account-menu-backdrop { position: fixed; inset: 0; z-index: 0; border: 0; padding: 0; background: transparent; cursor: default; }
.account-menu-panel {
  position: fixed;
  z-index: 1;
  top: 62px;
  left: clamp(12px, 5vw, 80px);
  width: min(330px, calc(100vw - 24px));
  overflow: hidden;
  border: 1px solid #dfe5e7;
  border-radius: 8px;
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 18px 45px rgba(27, 36, 43, .16);
  backdrop-filter: blur(18px);
}
.account-menu-panel header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 17px 13px; border-bottom: 1px solid #edf0f1; }
.account-menu-panel header div { display: grid; gap: 3px; }
.account-menu-panel header strong { color: #182126; font-size: 14px; }
.account-menu-panel header span { color: #8b959a; font-size: 10px; }
.account-count { display: grid; min-width: 34px; min-height: 24px; place-items: center; border-radius: 7px; background: #f0f3f4; color: #667279 !important; font-weight: 700; }
.provider-list { display: grid; padding: 6px; }
.provider-row { display: grid; min-height: 66px; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 7px; }
.provider-row + .provider-row { border-top: 1px solid #f0f2f3; }
.provider-row:hover { background: #f7f9f9; }
.provider-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.provider-avatar-fallback,.provider-logo { display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 800; }
.provider-logo.is-netease { background: #d84949; }
.provider-logo.is-qq { background: #f1bd31; color: #273137; }
.provider-copy { display: grid; min-width: 0; gap: 5px; }
.provider-copy strong,.provider-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.provider-copy strong { color: #20292e; font-size: 12px; }
.provider-copy span { color: #929ca1; font-size: 10px; }
.provider-copy i { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: #20b876; vertical-align: 1px; }
.provider-action { display: inline-flex; min-width: 58px; height: 32px; align-items: center; justify-content: center; gap: 5px; border: 1px solid #dce2e4; border-radius: 7px; padding: 0 9px; background: #fff; color: #58656b; cursor: pointer; font-size: 10px; white-space: nowrap; transition: border-color 160ms ease, background 160ms ease, color 160ms ease; }
.provider-action:hover { border-color: #a9bbb6; background: #f2f7f5; color: #1d7658; }
.provider-action.logout:hover { border-color: #e5b7ba; background: #fff5f5; color: #b84950; }
.account-menu-enter-active,.account-menu-leave-active { transition: opacity 170ms ease; }
.account-menu-enter-active .account-menu-panel,.account-menu-leave-active .account-menu-panel { transition: opacity 170ms ease, transform 170ms ease; transform-origin: top left; }
.account-menu-enter-from,.account-menu-leave-to { opacity: 0; }
.account-menu-enter-from .account-menu-panel,.account-menu-leave-to .account-menu-panel { opacity: 0; transform: translateY(-5px) scale(.985); }
@media (prefers-reduced-motion: reduce) { .account-menu-enter-active,.account-menu-leave-active,.account-menu-enter-active .account-menu-panel,.account-menu-leave-active .account-menu-panel { transition: none; } }
</style>
