<script setup lang="ts">
import { computed } from "vue";
import { ArrowLeft, LoaderCircle, Search, UserRound, UsersRound, X } from "lucide-vue-next";
import type { AccountSocialUserView } from "../services/api";

const props = defineProps<{
  mode: "following" | "followers";
  users: AccountSocialUserView[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchKeyword: string;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  (event: "back"): void;
  (event: "update:searchKeyword", value: string): void;
  (event: "search"): void;
  (event: "change-page", page: number): void;
  (event: "open-user", user: AccountSocialUserView): void;
  (event: "open-artist", artist: AccountSocialUserView): void;
}>();

const title = computed(() => props.mode === "following" ? "关注" : "粉丝");
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

function updateSearch(event: Event) {
  emit("update:searchKeyword", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <section class="streaming-social-page" :aria-label="`${title}列表`">
    <header class="social-toolbar">
      <button type="button" class="social-back" @click="emit('back')">
        <ArrowLeft :size="17" :stroke-width="1.9" aria-hidden="true" />
        返回
      </button>
      <label class="social-search">
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

    <div class="social-hero">
      <span class="social-hero-icon" aria-hidden="true">
        <UsersRound :size="52" :stroke-width="1.5" />
      </span>
      <div>
        <p><span aria-hidden="true"></span> 社交 <b>·</b> 共 {{ total }} {{ mode === 'following' ? '个关注' : '人' }}</p>
        <h1>{{ title }}</h1>
      </div>
    </div>

    <div v-if="loading" class="social-state" role="status">
      <LoaderCircle :size="24" class="social-spinner" aria-hidden="true" />
      正在加载{{ title }}列表
    </div>
    <div v-else-if="error" class="social-state error" role="status">{{ error }}</div>
    <div v-else-if="users.length" class="social-grid">
      <button
        v-for="user in users"
        :key="`${user.provider}:${user.userId}`"
        class="social-user-card"
        type="button"
        @click="user.type === 'artist' ? emit('open-artist', user) : emit('open-user', user)"
      >
        <span class="social-avatar">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="`${user.nickname}头像`" />
          <UserRound v-else :size="30" :stroke-width="1.6" aria-hidden="true" />
        </span>
        <strong :title="user.nickname">{{ user.nickname }}</strong>
      </button>
    </div>
    <div v-else class="social-state">暂无{{ title }}</div>

    <nav v-if="!loading && !error && (page > 1 || hasMore || totalPages > 1)" class="social-pagination" aria-label="社交列表分页">
      <button type="button" :disabled="page <= 1" @click="emit('change-page', page - 1)">上一页</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button type="button" :disabled="!hasMore || page >= totalPages" @click="emit('change-page', page + 1)">下一页</button>
    </nav>
  </section>
</template>

<style scoped>
.streaming-social-page {
  width: min(1420px, calc(100% - 112px));
  margin: 0 auto;
  padding: 88px 0 112px;
  color: #17191e;
}

.social-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(192, 197, 205, .42);
}

.social-back {
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
  transition: transform 180ms ease-out, box-shadow 180ms ease-out;
}

.social-back:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(33, 42, 57, .09);
}

.social-search {
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

.social-search:focus-within {
  border-color: #e86b3f;
  color: #e86b3f;
}

.social-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #2c3038;
  background: transparent;
  font: inherit;
  font-size: 12px;
}

.social-search button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #959ca6;
  background: #f0f1f3;
  cursor: pointer;
}

.social-hero {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 0 20px;
}

.social-hero-icon {
  display: grid;
  width: 176px;
  height: 176px;
  flex: 0 0 176px;
  place-items: center;
  border: 1px solid rgba(220, 221, 224, .85);
  border-radius: 50%;
  color: #aaa7a5;
  background: linear-gradient(145deg, rgba(255,255,255,.58), rgba(235,232,230,.72));
  box-shadow: 0 18px 38px rgba(48, 52, 61, .07), inset 0 0 0 6px rgba(255,255,255,.28);
}

.social-hero p {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: #bc3e22;
  font-size: 12px;
  font-weight: 800;
}

.social-hero p > span {
  width: 18px;
  height: 2px;
  background: #d74523;
}

.social-hero p b {
  color: #b9b4b0;
  font-weight: 600;
}

.social-hero h1 {
  margin: 10px 0 0;
  font-size: 38px;
  font-weight: 750;
  letter-spacing: 0;
}

.social-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 118px);
  gap: 14px;
}

.social-user-card {
  display: flex;
  min-height: 148px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, .88);
  border-radius: 16px;
  padding: 14px 10px;
  background: rgba(255, 255, 255, .78);
  font: inherit;
  box-shadow: 0 13px 30px rgba(40, 47, 60, .07);
  transition: transform 250ms ease-out, box-shadow 250ms ease-out;
  cursor: pointer;
}

.social-user-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 17px 34px rgba(40, 47, 60, .1);
}

.social-avatar {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #9fa6b1;
  background: #eef0f3;
}

.social-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.social-user-card strong {
  width: 100%;
  overflow: hidden;
  color: #24272e;
  font-size: 12px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.social-state {
  display: flex;
  min-height: 148px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: #9299a5;
  font-size: 13px;
}

.social-state.error { color: #bd6658; }
.social-spinner { animation: social-spin 900ms linear infinite; }
@keyframes social-spin { to { transform: rotate(360deg); } }

.social-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 30px;
  color: #8a93a3;
  font-size: 12px;
}

.social-pagination button {
  min-width: 72px;
  height: 34px;
  border: 1px solid rgba(218, 222, 229, .9);
  border-radius: 17px;
  color: #344054;
  background: rgba(255, 255, 255, .88);
  cursor: pointer;
}

.social-pagination button:disabled {
  color: #b8bec8;
  background: rgba(245, 246, 248, .7);
  cursor: default;
}

@media (max-width: 980px) {
  .streaming-social-page { width: calc(100% - 40px); }
}

@media (max-width: 620px) {
  .streaming-social-page { width: 100%; }
  .social-toolbar { align-items: stretch; flex-direction: column; }
  .social-search { width: 100%; }
  .social-hero-icon { width: 118px; height: 118px; flex-basis: 118px; }
  .social-hero h1 { font-size: 30px; }
  .social-grid { grid-template-columns: repeat(auto-fill, minmax(106px, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .social-back,
  .social-user-card { transition: none; }
}
</style>
