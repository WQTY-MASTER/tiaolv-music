const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const values = new Map();
  global.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };

  const moduleUrl = pathToFileURL(
    path.resolve(__dirname, "../src/renderer/src/services/playlistSubscriptionOverrides.ts")
  ).href;
  const {
    mergePlaylistSubscriptionOverrides,
    savePlaylistSubscriptionOverride
  } = await import(moduleUrl);

  const created = {
    id: "qq:created",
    title: "我创建的",
    subtitle: "QQ 音乐歌单",
    count: 1,
    createdByAccount: true
  };
  const collected = {
    id: "qq:collected",
    title: "想收藏的歌单",
    subtitle: "QQ 音乐歌单",
    count: 20,
    createdByAccount: false
  };

  savePlaylistSubscriptionOverride("qq", "account-a", collected, true);
  assert.deepEqual(
    mergePlaylistSubscriptionOverrides("qq", "account-a", [created]).map((playlist) => playlist.id),
    ["qq:created", "qq:collected"],
    "平台未及时返回时，本地收藏仍应合并到账号歌单"
  );
  assert.deepEqual(
    mergePlaylistSubscriptionOverrides("qq", "account-b", [created]).map((playlist) => playlist.id),
    ["qq:created"],
    "不同账号的本地收藏不能串用"
  );
  assert.deepEqual(
    mergePlaylistSubscriptionOverrides("netease", "account-a", []).map((playlist) => playlist.id),
    [],
    "QQ 音乐收藏不能出现在网易云音乐库"
  );

  savePlaylistSubscriptionOverride("qq", "account-a", collected, false);
  assert.deepEqual(
    mergePlaylistSubscriptionOverrides("qq", "account-a", [created, collected]).map((playlist) => playlist.id),
    ["qq:created"],
    "取消收藏应覆盖平台尚未刷新的旧数据"
  );

  console.log("歌单收藏本地兜底逻辑通过");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
