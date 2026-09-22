<script setup lang="ts">
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crown, Headphones, LoaderCircle, Play, RotateCcw } from "lucide-vue-next";
import { computed, ref } from "vue";

interface DiscoveryPlaylist {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  playCount?: number;
  imageUrl?: string;
  primary: string;
  secondary: string;
  mark: string;
}

const props = defineProps<{
  mode: "all" | "highquality";
  order: "hot" | "new";
  category: string;
  playlists: DiscoveryPlaylist[];
  hotTags: string[];
  highQualityTags: string[];
  categoryGroups: Record<string, string[]>;
  total: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  select: [playlist: DiscoveryPlaylist];
  changeMode: [mode: "all" | "highquality"];
  changeOrder: [order: "hot" | "new"];
  changeCategory: [category: string];
  changePage: [page: number];
  retry: [];
}>();

const filtersOpen = ref(false);

const visibleTags = computed(() => props.mode === "highquality"
  ? props.highQualityTags.slice(0, 11)
  : props.hotTags.slice(0, 11));

function formatPlayCount(value = 0) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1)} 亿`;
  if (value >= 10_000) return `${Math.round(value / 10_000)} 万`;
  return String(value);
}

function choosePlaylist(playlist: DiscoveryPlaylist) {
  emit("select", playlist);
}

function scrollToTop() {
  document.querySelector<HTMLElement>(".main-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
}

function previousPage() {
  if (props.page <= 1 || props.loading) return;
  emit("changePage", props.page - 1);
}

function nextPage() {
  if (!props.hasMore || props.loading) return;
  emit("changePage", props.page + 1);
}
</script>

<template>
  <section class="playlist-discovery-page" aria-label="发现歌单">
    <header class="playlist-discovery-head">
      <div>
        <p class="playlist-discovery-kicker"><i></i>发现歌单 · PLAYLIST DISCOVERY</p>
        <h2>{{ mode === "highquality" ? "精品歌单" : "全部歌单" }}</h2>
        <p>{{ mode === "highquality" ? "网易云音乐精选" : `共 ${total} 张歌单 · ${order === 'hot' ? '按最热排列' : '按最新排列'}` }}</p>
      </div>
    </header>

    <div class="playlist-discovery-tags">
      <div class="playlist-discovery-tag-list">
        <button v-for="tag in visibleTags" :key="tag" type="button" :class="{ active: category === tag }" @click="emit('changeCategory', tag)">{{ tag }}</button>
      </div>
      <div class="playlist-discovery-actions">
        <div class="playlist-discovery-modes" aria-label="歌单类型与排序">
          <div class="playlist-discovery-sort">
            <button type="button" :class="{ active: order === 'hot' }" @click="emit('changeOrder', 'hot')">最热</button>
            <button type="button" :class="{ active: order === 'new' }" @click="emit('changeOrder', 'new')">最新</button>
          </div>
          <button class="playlist-discovery-quality" type="button" :class="{ active: mode === 'highquality' }" @click="emit('changeMode', 'highquality')">
            <Crown :size="15" aria-hidden="true" />精品
          </button>
        </div>
        <button class="playlist-discovery-all-tags" type="button" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
          全部分类 <ChevronUp v-if="filtersOpen" :size="14" /><ChevronDown v-else :size="14" />
        </button>
      </div>
    </div>

    <Transition name="filter-panel">
      <div v-if="filtersOpen" class="playlist-discovery-filter-shell">
        <div class="playlist-discovery-filter-panel">
          <div v-for="(tags, group) in categoryGroups" :key="group" class="playlist-discovery-filter-row">
            <strong>{{ group }}</strong>
            <div>
              <button v-for="tag in tags" :key="tag" type="button" :class="{ active: category === tag }" @click="emit('changeCategory', tag)">{{ tag }}</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="error && playlists.length === 0" class="playlist-discovery-state is-error">
      <p>{{ error }}</p><button type="button" @click="emit('retry')"><RotateCcw :size="16" />重新加载</button>
    </div>

    <div v-else class="playlist-discovery-list" :class="{ 'is-loading': loading }">
      <div class="playlist-discovery-grid">
        <button
          v-for="(playlist, index) in playlists"
          :key="playlist.id"
          class="playlist-discovery-card"
          :class="{ featured: index === 0 }"
          type="button"
          @click="choosePlaylist(playlist)"
        >
          <span class="playlist-discovery-cover" :style="{ background: `linear-gradient(135deg, ${playlist.primary}, ${playlist.secondary})` }">
            <img v-if="playlist.imageUrl" :src="playlist.imageUrl" :alt="`${playlist.title}封面`" />
            <b v-else aria-hidden="true">{{ playlist.mark }}</b>
            <span class="playlist-discovery-count"><Headphones :size="12" />{{ formatPlayCount(playlist.playCount) }}</span>
            <span class="playlist-discovery-play"><Play :size="18" fill="currentColor" /></span>
            <span v-if="index === 0" class="playlist-discovery-feature-copy"><small>本页主打 · FEATURED</small><strong>{{ playlist.title }}</strong><em>{{ playlist.subtitle }}</em></span>
          </span>
          <span v-if="index !== 0" class="playlist-discovery-card-copy"><strong>{{ playlist.title }}</strong><small>{{ playlist.count }} 首 · {{ playlist.subtitle }}</small></span>
        </button>
      </div>
    </div>

    <nav v-if="playlists.length > 0" class="playlist-discovery-pagination" aria-label="歌单分页">
      <button type="button" :disabled="page <= 1 || loading" @click="previousPage">
        <ChevronLeft :size="16" aria-hidden="true" />上一页
      </button>
      <span class="playlist-discovery-current-page" aria-current="page">
        <LoaderCircle v-if="loading" :size="17" class="spin" aria-label="正在加载" />
        <template v-else>{{ page }}</template>
      </span>
      <button type="button" :disabled="!hasMore || loading" @click="nextPage">
        下一页<ChevronRight :size="16" aria-hidden="true" />
      </button>
    </nav>
    <button class="playlist-discovery-to-top" type="button" title="回到顶部" aria-label="回到顶部" @click="scrollToTop"><ArrowUp :size="19" /></button>
  </section>
</template>

<style scoped>
.playlist-discovery-page{width:100%;padding:0 0 110px;color:#121a2d}.playlist-discovery-head{display:block;margin-bottom:14px}.playlist-discovery-kicker{display:flex;align-items:center;gap:8px;margin:0 0 6px;color:#65748d;font-size:11px;font-weight:800;letter-spacing:0}.playlist-discovery-kicker i{width:7px;height:7px;border-radius:50%;background:#2d7ce5}.playlist-discovery-head h2{margin:0;font-size:38px;line-height:1.1;letter-spacing:0}.playlist-discovery-head>div>p:last-child{margin:7px 0 0;color:#66748a;font-size:13px;font-weight:600}.playlist-discovery-tags{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;margin-bottom:20px}.playlist-discovery-tag-list{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:8px}.playlist-discovery-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px}.playlist-discovery-modes{display:flex;align-items:center;gap:10px}.playlist-discovery-sort{display:flex;align-items:center;border:1px solid #e4e7eb;border-radius:20px;background:#fff;padding:2px}.playlist-discovery-modes button,.playlist-discovery-tag-list button,.playlist-discovery-all-tags,.playlist-discovery-filter-row button{border:0;border-radius:17px;background:transparent;color:#566174;cursor:pointer;font-weight:700}.playlist-discovery-modes button{display:flex;align-items:center;gap:5px;padding:8px 16px}.playlist-discovery-modes button.active{background:#111827;color:#fff}.playlist-discovery-quality{border:1px solid #e5e7eb!important;background:#fff!important;color:#586273!important}.playlist-discovery-quality.active{border-color:#e9ad5e!important;background:#fff6e9!important;color:#9b5b12!important}.playlist-discovery-tag-list>button,.playlist-discovery-all-tags{min-height:32px;padding:0 16px;background:#fff;border:1px solid #e5e7eb}.playlist-discovery-tag-list>button.active{border-color:#111827;background:#111827;color:#fff}.playlist-discovery-all-tags{display:flex;align-items:center;gap:4px;white-space:nowrap}.playlist-discovery-filter-shell{display:grid;grid-template-rows:1fr;overflow:hidden}.playlist-discovery-filter-panel{min-height:0;display:grid;gap:12px;margin:-2px 0 22px;padding:18px 20px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;box-shadow:0 15px 35px rgba(24,34,51,.07)}.playlist-discovery-filter-row{display:grid;grid-template-columns:64px 1fr;gap:12px;align-items:start}.playlist-discovery-filter-row>strong{padding-top:7px;color:#657185;font-size:12px}.playlist-discovery-filter-row>div{display:flex;flex-wrap:wrap;gap:7px}.playlist-discovery-filter-row button{padding:7px 13px;background:#f5f6f8;font-size:12px}.playlist-discovery-filter-row button.active{background:#e8efff;color:#2365d5}.playlist-discovery-list{width:100%;transition:opacity 250ms ease}.playlist-discovery-list.is-loading{opacity:.42;pointer-events:none}.playlist-discovery-grid{display:grid;width:100%;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px 18px;align-items:start}.playlist-discovery-card{min-width:0;border:0;padding:0;background:transparent;color:inherit;cursor:pointer;text-align:left}.playlist-discovery-card.featured{grid-column:span 2;grid-row:span 2;align-self:stretch}.playlist-discovery-card.featured .playlist-discovery-cover{height:100%;aspect-ratio:auto}.playlist-discovery-cover{position:relative;display:block;aspect-ratio:1;overflow:hidden;border-radius:8px;background:#e8ebee;box-shadow:0 10px 24px rgba(22,30,45,.08);transition:transform 220ms ease,box-shadow 220ms ease}.playlist-discovery-card:hover .playlist-discovery-cover{transform:translateY(-4px);box-shadow:0 16px 32px rgba(22,30,45,.15)}.playlist-discovery-cover img{width:100%;height:100%;object-fit:cover}.playlist-discovery-cover>b{display:grid;width:100%;height:100%;place-items:center;color:#fff;font-size:42px}.playlist-discovery-count{position:absolute;left:9px;bottom:9px;display:flex;align-items:center;gap:4px;border-radius:12px;padding:4px 7px;background:rgba(17,24,39,.68);color:#fff;font-size:11px}.playlist-discovery-play{position:absolute;right:10px;bottom:10px;display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#fff;color:#202938;opacity:0;transform:translateY(5px);transition:opacity 180ms ease,transform 180ms ease}.playlist-discovery-card:hover .playlist-discovery-play{opacity:1;transform:none}.playlist-discovery-card-copy{display:block;min-height:56px;padding-top:9px}.playlist-discovery-card-copy strong{display:-webkit-box;min-height:38px;overflow:hidden;color:#151d2e;font-size:13px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}.playlist-discovery-card-copy small{display:block;overflow:hidden;margin-top:5px;color:#76849a;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.playlist-discovery-feature-copy{position:absolute;inset:auto 20px 20px;z-index:2;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.55)}.playlist-discovery-card.featured .playlist-discovery-cover:after{content:"";position:absolute;inset:35% 0 0;background:linear-gradient(transparent,rgba(5,10,20,.82))}.playlist-discovery-feature-copy small,.playlist-discovery-feature-copy strong,.playlist-discovery-feature-copy em{display:block;position:relative;z-index:1}.playlist-discovery-feature-copy small{font-size:10px;font-style:normal;font-weight:800}.playlist-discovery-feature-copy strong{margin-top:10px;font-size:24px;line-height:1.25}.playlist-discovery-feature-copy em{margin-top:7px;font-size:11px;font-style:normal}.playlist-discovery-state{display:grid;min-height:280px;place-items:center;color:#69758a}.playlist-discovery-state button{display:flex;align-items:center;gap:6px;border:1px solid #dfe3e8;border-radius:18px;padding:8px 14px;background:#fff;cursor:pointer}.playlist-discovery-pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:36px}.playlist-discovery-pagination button{display:flex;min-width:92px;height:38px;align-items:center;justify-content:center;gap:5px;border:1px solid #dfe4ea;border-radius:8px;background:#fff;color:#303b4f;font-weight:700;cursor:pointer;transition:background 180ms ease,border-color 180ms ease,color 180ms ease}.playlist-discovery-pagination button:hover:not(:disabled){border-color:#bdc7d4;background:#f7f9fb}.playlist-discovery-pagination button:active:not(:disabled){background:#eef1f5}.playlist-discovery-pagination button:disabled{cursor:not-allowed;opacity:.42}.playlist-discovery-current-page{display:grid;width:38px;height:38px;place-items:center;border-radius:8px;background:#111827;color:#fff;font-size:13px;font-weight:800}.playlist-discovery-to-top{position:fixed;right:24px;bottom:102px;z-index:20;display:grid;width:40px;height:40px;place-items:center;border:1px solid #e0e5eb;border-radius:50%;background:#fff;color:#2879e6;box-shadow:0 10px 28px rgba(27,39,58,.12);cursor:pointer}.spin{animation:spin .8s linear infinite}.filter-panel-enter-active,.filter-panel-leave-active{overflow:hidden;transition:grid-template-rows 250ms ease,opacity 250ms ease}.filter-panel-enter-from,.filter-panel-leave-to{grid-template-rows:0fr;opacity:0}.playlist-discovery-filter-shell.filter-panel-enter-to,.playlist-discovery-filter-shell.filter-panel-leave-from{grid-template-rows:1fr;opacity:1}@keyframes spin{to{transform:rotate(360deg)}}
.playlist-discovery-page{width:min(1420px,100%);margin-inline:auto}
.playlist-discovery-head,.playlist-discovery-tags,.playlist-discovery-filter-shell,.playlist-discovery-list{width:100%;margin-inline:0;padding-inline:0}
.playlist-discovery-grid{display:grid;width:100%;margin-inline:0;padding-inline:0;grid-template-columns:repeat(5,minmax(0,1fr))}
@media(max-width:1200px){.playlist-discovery-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.playlist-discovery-tags{grid-template-columns:1fr}.playlist-discovery-actions{justify-content:space-between}.playlist-discovery-modes{flex-shrink:0}}@media(max-width:720px){.playlist-discovery-head h2{font-size:31px}.playlist-discovery-actions{align-items:stretch;flex-direction:column}.playlist-discovery-modes{max-width:100%;justify-content:space-between}.playlist-discovery-all-tags{width:fit-content}.playlist-discovery-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 12px}.playlist-discovery-card.featured{grid-column:span 2;grid-row:span 1}.playlist-discovery-card.featured .playlist-discovery-cover{height:auto;aspect-ratio:16/9}.playlist-discovery-filter-row{grid-template-columns:1fr}.playlist-discovery-pagination button{min-width:82px}.playlist-discovery-to-top{right:12px}}
</style>
