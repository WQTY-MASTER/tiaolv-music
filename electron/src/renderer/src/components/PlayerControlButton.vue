<script setup lang="ts">
const props = withDefaults(defineProps<{
  kind: "like" | "previous" | "toggle" | "next" | "queue";
  isPlaying?: boolean;
  liked?: boolean;
  compact?: boolean;
}>(), {
  isPlaying: false,
  liked: false,
  compact: false
});

const emit = defineEmits<{
  activate: [];
}>();
</script>

<template>
  <button
    v-if="props.kind === 'like'"
    class="player-control-button player-like-button tool-button"
    :class="{ liked: props.liked, compact: props.compact }"
    type="button"
    :title="props.liked ? '取消喜欢' : '喜欢这首歌'"
    :aria-label="props.liked ? '取消喜欢' : '喜欢这首歌'"
    :aria-pressed="props.liked"
    @click="emit('activate')"
  ><span class="player-like-icon" aria-hidden="true">{{ props.liked ? "♥" : "♡" }}</span></button>

  <button
    v-else-if="props.kind === 'previous'"
    class="player-control-button"
    :class="{ compact: props.compact }"
    type="button"
    title="上一首"
    aria-label="上一首"
    @click="emit('activate')"
  ><span class="transport-icon transport-icon-previous" aria-hidden="true"></span></button>

  <button
    v-else-if="props.kind === 'toggle'"
    class="player-control-button play-button"
    :class="{ compact: props.compact }"
    type="button"
    :title="props.isPlaying ? '暂停' : '播放'"
    :aria-label="props.isPlaying ? '暂停' : '播放'"
    @click="emit('activate')"
  >
    <span v-if="props.isPlaying" class="pause-icon" aria-hidden="true"></span>
    <span v-else class="play-icon" aria-hidden="true"></span>
  </button>

  <button
    v-else-if="props.kind === 'next'"
    class="player-control-button"
    :class="{ compact: props.compact }"
    type="button"
    title="下一首"
    aria-label="下一首"
    @click="emit('activate')"
  ><span class="transport-icon transport-icon-next" aria-hidden="true"></span></button>

  <button
    v-else
    class="player-control-button player-queue-button tool-button"
    :class="{ compact: props.compact }"
    type="button"
    title="播放列表"
    aria-label="播放列表"
    @click="emit('activate')"
  ><span class="player-queue-icon" aria-hidden="true"></span></button>
</template>

<style scoped>
.player-control-button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid #d7dddf;
  border-radius: 10px;
  padding: 0;
  background: #fff;
  color: #697174;
  cursor: pointer;
  font: inherit;
  transition: border-color 160ms ease, color 160ms ease, background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}
.player-control-button:hover { border-color: #c2cacc; background: #f3f5f6; color: #1f6cff; transform: translateY(-1px); }
.player-control-button.compact { width: 30px; height: 30px; border-radius: 8px; }
.player-control-button.play-button { width: 48px; height: 48px; border-color: #8f1d2e; border-radius: 50%; background: #8f1d2e; color: #fff; box-shadow: 0 8px 18px rgba(143,29,46,.27); }
.player-control-button.play-button.compact { width: 36px; height: 36px; }
.player-control-button.play-button:hover { border-color: #711827; background: #711827; color: #fff; box-shadow: 0 9px 20px rgba(113,24,39,.3); }
.player-like-button { line-height: 1; }
.player-like-icon { display: grid; width: 20px; height: 20px; place-items: center; font-size: 21px; line-height: 1; }
.player-like-button.liked { color: #ff6570; }
.transport-icon,.player-queue-icon { display: block; width: 20px; height: 20px; background: currentColor; -webkit-mask: center / contain no-repeat; mask: center / contain no-repeat; }
.transport-icon-previous { -webkit-mask-image: url("../assets/icons/previous.svg"); mask-image: url("../assets/icons/previous.svg"); }
.transport-icon-next { -webkit-mask-image: url("../assets/icons/next.svg"); mask-image: url("../assets/icons/next.svg"); }
.player-queue-icon { -webkit-mask-image: url("../assets/icons/play-list-2-fill.svg"); mask-image: url("../assets/icons/play-list-2-fill.svg"); }
.play-icon { width: 0; height: 0; margin-left: 3px; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 10px solid currentColor; }
.pause-icon { width: 10px; height: 14px; border-right: 3px solid currentColor; border-left: 3px solid currentColor; }
</style>
