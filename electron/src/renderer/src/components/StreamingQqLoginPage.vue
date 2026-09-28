<script setup lang="ts">
import { ArrowRight, Headphones, UserRound } from "lucide-vue-next";

const emit = defineEmits<{
  login: [];
}>();
</script>

<template>
  <section class="qq-login-page" aria-label="QQ 音乐未登录">
    <article class="qq-discovery-panel">
      <div class="qq-discovery-copy">
        <div class="qq-discovery-meta">
          <span>DAILY DISCOVERY</span>
          <span>01 / 03</span>
        </div>
        <h2>每日推荐</h2>
        <p>来自 QQ 音乐的每日 30 首，把适合你的旋律放进今天。</p>
        <button type="button" @click="emit('login')">
          <UserRound :size="16" :stroke-width="1.8" aria-hidden="true" />
          登录查看每日推荐
        </button>
        <small>登录后，加载属于你的每日推荐</small>
      </div>

      <div class="qq-discovery-visual" aria-hidden="true">
        <span class="qq-orbit orbit-one"></span>
        <span class="qq-orbit orbit-two"></span>
        <span class="qq-orbit orbit-three"></span>
        <span class="qq-record">
          <span class="qq-record-label">
            <Headphones :size="26" :stroke-width="1.8" />
          </span>
        </span>
        <small>PRESS PLAY · FEEL MORE.</small>
      </div>
    </article>

    <footer class="qq-login-footer">
      <span>先发现喜欢的音乐，登录后开始收听。</span>
      <button type="button" @click="emit('login')">
        登录 QQ 音乐
        <ArrowRight :size="16" :stroke-width="1.7" aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>

<style scoped>
.qq-login-page { display: grid; width: min(1420px, 100%); gap: 20px; margin-inline: auto; }
.qq-discovery-panel {
  display: grid;
  min-height: 370px;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr);
  overflow: hidden;
  border-radius: 18px;
  background: linear-gradient(115deg, #283247 0%, #324d56 54%, #397b6b 100%);
  color: #fff;
  box-shadow: 0 22px 54px rgba(26, 40, 52, .16);
}
.qq-discovery-copy { display: flex; min-width: 0; flex-direction: column; justify-content: center; padding: 42px 56px; }
.qq-discovery-meta { display: flex; max-width: 650px; align-items: center; justify-content: space-between; color: #8fe0c5; font-size: 10px; font-weight: 800; letter-spacing: 2px; }
.qq-discovery-meta span:last-child { color: rgba(221, 238, 235, .55); }
.qq-discovery-copy h2 { margin: 35px 0 20px; color: #fff; font-size: 52px; font-weight: 900; letter-spacing: 0; line-height: 1; }
.qq-discovery-copy p { margin: 0; color: rgba(240, 246, 246, .88); font-size: 13px; line-height: 1.8; }
.qq-discovery-copy > button {
  display: inline-flex;
  width: fit-content;
  height: 46px;
  align-items: center;
  gap: 9px;
  margin-top: 32px;
  border: 0;
  border-radius: 23px;
  padding: 0 24px;
  background: #fff;
  color: #172033;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: box-shadow 180ms ease, transform 180ms ease;
}
.qq-discovery-copy > button:hover { box-shadow: 0 14px 30px rgba(13, 25, 37, .24); transform: translateY(-2px); }
.qq-discovery-copy > small { margin-top: 24px; color: rgba(225, 236, 236, .66); font-size: 10px; }
.qq-discovery-visual { position: relative; display: grid; min-height: 370px; place-items: center; overflow: hidden; }
.qq-orbit { position: absolute; border: 1px solid rgba(218, 242, 234, .17); border-radius: 50%; }
.orbit-one { width: 470px; height: 470px; }
.orbit-two { width: 350px; height: 350px; }
.orbit-three { width: 250px; height: 250px; }
.qq-record {
  position: relative;
  display: grid;
  width: 190px;
  height: 190px;
  place-items: center;
  border: 4px solid rgba(17, 25, 43, .78);
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #242d43 0 4px, #647087 5px 6px, #242d43 7px 10px);
  box-shadow: 0 18px 34px rgba(14, 24, 35, .22);
}
.qq-record-label { display: grid; width: 66px; height: 66px; place-items: center; border: 4px solid #263247; border-radius: 50%; background: #31c98a; color: #fff; }
.qq-discovery-visual > small { position: absolute; bottom: 32px; color: rgba(224, 239, 235, .62); font-size: 9px; font-weight: 700; letter-spacing: 3px; }
.qq-login-footer { display: flex; min-height: 42px; align-items: center; justify-content: space-between; gap: 20px; color: #718095; font-size: 11px; }
.qq-login-footer button { display: inline-flex; align-items: center; gap: 8px; border: 0; padding: 8px 0; background: transparent; color: #52627a; cursor: pointer; font-size: 11px; font-weight: 700; }
.qq-login-footer button:hover { color: #178866; }
@media (max-width: 860px) {
  .qq-discovery-panel { min-height: 0; grid-template-columns: 1fr; }
  .qq-discovery-copy { padding: 38px 30px 20px; }
  .qq-discovery-meta { max-width: none; }
  .qq-discovery-copy h2 { margin-top: 28px; font-size: 40px; }
  .qq-discovery-visual { min-height: 270px; }
  .orbit-one { width: 360px; height: 360px; }
  .orbit-two { width: 280px; height: 280px; }
  .orbit-three { width: 220px; height: 220px; }
  .qq-record { width: 160px; height: 160px; }
}
@media (max-width: 560px) {
  .qq-discovery-copy { padding-inline: 22px; }
  .qq-login-footer { align-items: flex-start; flex-direction: column; gap: 4px; }
}
@media (prefers-reduced-motion: reduce) { .qq-discovery-copy > button { transition: none; } }
</style>
