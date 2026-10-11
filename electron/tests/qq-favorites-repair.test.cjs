const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const app = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/App.vue'), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0];
const tree = ts.createSourceFile('App.ts', app, ts.ScriptTarget.Latest, true);
const ref = value => ({ value });
function extract(names, context, variables = []) {
  const nodes = tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)
    || ts.isVariableStatement(node) && node.declarationList.declarations.some(d => variables.includes(d.name.getText(tree))));
  vm.runInContext(ts.transpileModule(nodes.map(n => n.getText(tree)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
}
test('QQ library exposes the real favorites route when directory 201 is omitted, without duplicating it', () => {
  const context = vm.createContext({ computed: fn => ({ get value() { return fn(); } }), streamingSource: ref('qq'),
    selectedStreamingAccount: ref({ userId: 'account' }), accountPlaylists: ref([{ id: 'qq:normal' }]),
    accountFavoritePlaylist: ref({ id: 'account-favorites', count: 3, favorite: true }), accountFavoriteTracks: ref([{ coverUrl: 'cover' }]) });
  extract([], context, ['accountLibraryPlaylists']);
  assert.equal(vm.runInContext('accountLibraryPlaylists.value[0].id', context), 'account-favorites');
  assert.equal(vm.runInContext('accountLibraryPlaylists.value[0].deletable', context), false);
  context.accountPlaylists.value.push({ id: 'qq:real', favorite: true });
  assert.equal(vm.runInContext('accountLibraryPlaylists.value.length', context), 2);
  context.streamingSource.value = 'netease';
  assert.equal(vm.runInContext('accountLibraryPlaylists.value.length', context), 2);
  context.accountPlaylists.value = [];
  context.streamingSource.value = 'qq';
  context.selectedStreamingAccount.value = null;
  assert.equal(vm.runInContext('accountLibraryPlaylists.value.length', context), 0);
});
test('failed favorites show a real error and overlapping clicks issue only one write', async () => {
  let rejectWrite;
  let writes = 0;
  let removals = 0;
  const notices = [];
  const track = { id: 'qq:mid', source: 'qq', liked: false };
  const context = vm.createContext({ Error, playlistMutationPending: ref(false), favoriteMutationPending: new Set(), DEFAULT_TRACK_ID: 'default',
    accounts: ref([{ provider: 'qq' }]), accountFavoriteTracks: ref([]), favoriteTracks: ref([]), scanError: ref(''),
    syncAccountFavoriteFlag(id, liked) { track.liked = liked; }, syncFavoriteFlag() {}, toPersistedTrack: x => x,
    saveAccountFavorite() { writes++; return new Promise((resolve, reject) => { rejectWrite = reject; }); },
    removeAccountFavorite() { removals++; throw new Error('must not remove'); }, openProviderAuthPanel() {},
    accountContentErrorMessage: (error, fallback) => error?.message || fallback, showSearchToast: message => notices.push(message) });
  extract(['toggleTrackLiked'], context);
  const saving = context.toggleTrackLiked(track);
  await context.toggleTrackLiked(track);
  assert.equal(writes, 1);
  assert.equal(removals, 0);
  rejectWrite(new Error('QQ 音乐接口返回错误: 80105'));
  await saving;
  assert.equal(track.liked, false);
  assert.equal(context.accountFavoriteTracks.value.length, 0);
  assert.match(notices[0], /80105/);
  assert.equal(context.favoriteMutationPending.size, 0);
});
