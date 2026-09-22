<script setup lang="ts">
import { ArrowLeft, LoaderCircle, Search, UserRound, X } from "lucide-vue-next";
import type { AccountProfileView } from "../services/api";

defineProps<{
  profile: AccountProfileView | null;
  searchKeyword: string;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  (event: "back"): void;
  (event: "update:searchKeyword", value: string): void;
  (event: "search"): void;
}>();

function updateSearch(event: Event) {
  emit("update:searchKeyword", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <section class="streaming-user-profile-page" aria-label="用户主页">
    <header class="user-profile-toolbar">
      <button type="button" class="user-profile-back" @click="emit('back')">
        <ArrowLeft :size="17" :stroke-width="1.9" aria-hidden="true" />
        返回
      </button>
      <label class="user-profile-search">
        <Search :size="16" :stroke-width="1.7" aria-hidden="true" />
        <input
          :value="searchKeyword"
          type="search"
          placeholder="搜索歌曲、歌手、专辑或文件夹"
          aria-label="全局搜索"
          @input="updateSearch"
          @keydown.enter.prevent="emit('search')"
        />
        <button v-if="searchKeyword" type="button" title="清空搜索" aria-label="清空搜索" @click="emit('update:searchKeyword', '')">
          <X :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </label>
    </header>

    <div v-if="loading" class="user-profile-state" role="status">
      <LoaderCircle :size="24" class="user-profile-spinner" aria-hidden="true" />
      正在加载用户主页
    </div>
    <div v-else-if="error" class="user-profile-state error" role="status">{{ error }}</div>
    <div v-else-if="profile" class="user-profile-hero">
      <span class="user-profile-avatar">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="`${profile.nickname}头像`" />
        <UserRound v-else :size="54" :stroke-width="1.5" aria-hidden="true" />
      </span>
      <div class="user-profile-copy">
        <p><span aria-hidden="true"></span> 网易云音乐用户主页</p>
        <h1>{{ profile.nickname }}</h1>
        <div class="user-profile-stats">
          <span><strong>{{ profile.follows }}</strong> 关注</span>
          <span><strong>{{ profile.followers }}</strong> 粉丝</span>
        </div>
        <small>{{ profile.signature || "暂无个人简介" }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.streaming-user-profile-page {
  width: min(1420px, calc(100% - 112px));
  margin: 0 auto;
  padding: 88px 0 112px;
  color: #17191e;
}

.user-profile-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(192, 197, 205, .42);
}

.user-profile-back {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 7px;
  border: 1px solid rgba(218, 222, 229, .9);
  border-radius: 19px;
  padding: 0 15px;
  color: #2474e8;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 7px 18px rgba(33, 42, 57, .06);
  cursor: pointer;
}

.user-profile-search {
  display: flex;
  width: min(360px, 45vw);
  height: 38px;
  box-sizing: border-box;
  align-items: center;
  gap: 9px;
  border: 1px solid rgba(211, 215, 222, .8);
  border-radius: 19px;
  padding: 0 13px;
  color: #9aa2ad;
  background: rgba(255, 255, 255, .82);
  transition: border-color 200ms ease-out, color 200ms ease-out;
}

.user-profile-search:focus-within { border-color: #e86b3f; color: #e86b3f; }
.user-profile-search input { min-width: 0; flex: 1; border: 0; outline: 0; color: #2c3038; background: transparent; font: inherit; font-size: 12px; }
.user-profile-search button { display: grid; width: 24px; height: 24px; place-items: center; border: 0; border-radius: 50%; color: #959ca6; background: #f0f1f3; cursor: pointer; }

.user-profile-hero {
  display: flex;
  align-items: center;
  gap: 30px;
  padding: 34px 0;
}

.user-profile-avatar {
  display: grid;
  width: 176px;
  height: 176px;
  flex: 0 0 176px;
  place-items: center;
  overflow: hidden;
  border: 6px solid rgba(255, 255, 255, .76);
  border-radius: 50%;
  color: #aaa7a5;
  background: linear-gradient(145deg, rgba(255,255,255,.58), rgba(235,232,230,.72));
  box-shadow: 0 18px 38px rgba(48, 52, 61, .08);
}

.user-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.user-profile-copy > p { display: flex; align-items: center; gap: 9px; margin: 0; color: #bc3e22; font-size: 12px; font-weight: 800; }
.user-profile-copy > p span { width: 18px; height: 2px; background: #d74523; }
.user-profile-copy h1 { margin: 11px 0 0; font-size: 38px; font-weight: 750; letter-spacing: 0; }
.user-profile-copy small { display: block; margin-top: 14px; color: #8d95a2; font-size: 13px; }
.user-profile-stats { display: flex; gap: 20px; margin-top: 20px; color: #7d8491; font-size: 12px; }
.user-profile-stats span { display: flex; align-items: baseline; gap: 5px; }
.user-profile-stats strong { color: #202531; font-size: 18px; }
.user-profile-state { display: flex; min-height: 300px; align-items: center; justify-content: center; gap: 9px; color: #9299a5; font-size: 13px; }
.user-profile-state.error { color: #bd6658; }
.user-profile-spinner { animation: user-profile-spin 900ms linear infinite; }
@keyframes user-profile-spin { to { transform: rotate(360deg); } }

@media (max-width: 980px) { .streaming-user-profile-page { width: calc(100% - 40px); } }
@media (max-width: 620px) {
  .streaming-user-profile-page { width: 100%; }
  .user-profile-toolbar { align-items: stretch; flex-direction: column; }
  .user-profile-search { width: 100%; }
  .user-profile-avatar { width: 118px; height: 118px; flex-basis: 118px; }
  .user-profile-copy h1 { font-size: 30px; }
}
</style>
