const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../package.json'));
const ts = local('typescript');
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  assert.ok(fs.existsSync(filename), 'Mini lyric model must exist');
  const module = { exports: {} }; modules.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : local(name);
  vm.runInNewContext(source, { module, exports: module.exports, require, Intl });
  return module.exports;
}
const { projectMiniLyricTime, getMiniLyricLineCount, getMiniLyricSlots, getMiniLyricProgress, getMiniLyricCharacterFill, getMiniLyricOffset, getMiniLyricMetrics, getMiniPlayerLayout, shouldAnimateMiniLyricStep } = load(path.resolve(__dirname, '../src/renderer/src/services/miniPlayerLyrics.ts'));
assert.equal(typeof projectMiniLyricTime, 'function', 'Mini fill needs a bounded frame clock');
const frameTimes = Array.from({ length: 6 }, (_, index) => projectMiniLyricTime(10, 1000, 1000 + index * 16, true, 20));
assert.ok(frameTimes.every((time, index) => index === 0 || time > frameTimes[index - 1]), 'Fill must advance between 100 ms IPC samples');
assert.equal(projectMiniLyricTime(10, 1000, 2000, true, 20), 10.15, 'Missing updates must stop projection instead of drifting');
assert.equal(projectMiniLyricTime(10, 1000, 1100, false, 20), 10, 'Paused lyrics do not project');
assert.equal(projectMiniLyricTime(19.95, 1000, 1100, true, 20), 20, 'Projection cannot pass track end');
assert.equal(projectMiniLyricTime(3, 1200, 1200, true, 20), 3, 'A seek reanchors immediately');
assert.equal(projectMiniLyricTime(NaN, 1000, 1100, false, 20), 0);
const componentScript = fs.readFileSync(path.resolve(__dirname, '../src/renderer/src/components/MiniPlayerLyrics.vue'), 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0];
const tree = ts.createSourceFile('MiniPlayerLyrics.ts', componentScript, ts.ScriptTarget.Latest, true);
const clockFunctions = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ['syncClock', 'stopClock'].includes(node.name?.text)).map(node => node.getText(tree)).join('\n');
let now = 1000, callback;
const clock = vm.createContext({ props: { currentTime: 10, isPlaying: true, duration: 20 }, renderTime: { value: 10 },
  animate: { value: false }, synchronizedTime: 10, anchorTime: 10, anchorTimestamp: now, clockFrame: undefined,
  projectMiniLyricTime, performance: { now: () => now }, requestAnimationFrame: next => { callback = next; return 1; },
  cancelAnimationFrame: () => { callback = undefined; } });
vm.runInContext(ts.transpileModule(clockFunctions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, clock);
clock.syncClock(true);
for (let sample = 1; sample <= 20; sample++) {
  now += 200;
  callback(now);
  clock.props.currentTime = 10 + sample * .02;
  clock.syncClock();
  assert.ok(clock.renderTime.value - clock.props.currentTime <= .150001, 'Slow or stalled media samples cannot accumulate projection drift');
}
clock.props.isPlaying = false; clock.props.currentTime = 8; clock.syncClock();
assert.equal(clock.renderTime.value, 8, 'Pause/seek must reanchor immediately');
assert.equal(callback, undefined, 'Paused component cancels its animation frame');
clock.props.isPlaying = true; clock.props.currentTime = 2; clock.syncClock(true);
assert.equal(clock.renderTime.value, 2, 'New track resets projected time');
clock.stopClock(); assert.equal(callback, undefined, 'Unmount cleanup cancels the local clock');
assert.equal(getMiniLyricLineCount(40), 1);
assert.equal(getMiniLyricLineCount(110), 3);
assert.equal(getMiniLyricLineCount(180), 5);
assert.equal(getMiniLyricLineCount(NaN), 1);
const lines = [{ time: 10, text: 'abcd' }, { time: 14, text: 'efgh' }, { time: 18, text: 'ijkl' }];
const slots = getMiniLyricSlots(lines, 0, 3);
assert.equal(slots[0].line, null);
assert.equal(slots[1].line.text, 'abcd');
assert.equal(slots[1].active, true);
assert.equal(slots[2].line.text, 'efgh');
assert.equal(getMiniLyricSlots(lines, 2, 5)[2].line.text, 'ijkl');
assert.equal(getMiniLyricSlots(lines, 2, 5)[4].line, null);
assert.equal(getMiniLyricProgress(lines, 9, 30).activeIndex, -1);
assert.equal(getMiniLyricProgress(lines, 12, 30).progress, 0.5);
assert.equal(getMiniLyricProgress(lines, 12, 30).wordTimed, false);
assert.equal(getMiniLyricProgress(lines, 10, 30).progress, 0);
assert.equal(getMiniLyricProgress(lines, 15, 30).activeIndex, 1);
assert.equal(getMiniLyricProgress(lines, 10.5, 30).activeIndex, 0, 'Seeking back must reset active line');
const timed = [{ time: 10, duration: 4, text: 'ab', characters: [
  { text: 'a', start: 10, duration: 2 }, { text: 'b', start: 12, duration: 2 }
] }];
const state = getMiniLyricProgress(timed, 11, 20, 'qq', 'QRC');
assert.equal(state.wordTimed, true);
assert.equal(state.characterProgress, 0.5);
assert.equal(state.progress, 0.25);
assert.equal(getMiniLyricProgress(timed, 11, 20, 'netease', 'YRC').wordTimed, false, 'NetEase must use whole-line highlighting even with word timing');
assert.equal(getMiniLyricProgress(timed, 11, 20, 'qq', 'LRC').wordTimed, false);
assert.equal(getMiniLyricProgress(timed, 11, 20, 'local', 'YRC').wordTimed, true);
assert.equal(getMiniLyricProgress(timed, 11, 20, 'cloud', 'YRC').wordTimed, false, 'NetEase cloud tracks use line highlighting');
assert.equal(getMiniLyricProgress(timed, 11, 20, 'local', 'YRC', 'netease').wordTimed, false, 'Matched NetEase lyrics must not become word highlighted on local tracks');
assert.equal(getMiniLyricProgress(timed, 11, 20, 'local', 'QRC', 'qq').wordTimed, true);
assert.equal(getMiniLyricProgress(timed, 11, 20, 'local', 'YRC', 'online-netease').wordTimed, false, 'Use the actual backend online-provider source marker');
assert.equal(getMiniLyricCharacterFill(state.characterProgress, 0), 0.5);
assert.equal(getMiniLyricCharacterFill(state.characterProgress, 1), 0);
assert.equal(getMiniLyricCharacterFill(4, 1), 1);
assert.equal(getMiniLyricOffset(100, 200, 0.5), 0, 'Short lines must never move');
assert.equal(getMiniLyricOffset(400, 200, 0), 0);
assert.ok(Math.abs(getMiniLyricOffset(400, 200, 0.5) + 100) < 1e-8);
assert.equal(getMiniLyricOffset(400, 200, 1), -200);
assert.equal(getMiniLyricOffset(NaN, 200, 1), 0);
assert.equal(getMiniLyricOffset(400, 0, 1), 0);
assert.equal(typeof getMiniLyricMetrics, 'function', 'Responsive lyrics need fixed metric tiers');
assert.equal(getMiniLyricMetrics(60).fontSize, 14);
assert.equal(getMiniLyricMetrics(110).fontSize, 15);
assert.equal(getMiniLyricMetrics(200).fontSize, 18);
assert.equal(getMiniLyricLineCount(175, 36), 3, 'All five enlarged rows must actually fit');
assert.equal(getMiniLyricLineCount(180, 36), 5);
assert.equal(getMiniLyricMetrics(230, true).rowHeight, 64);
assert.equal(getMiniLyricMetrics(60, true).rowHeight, 54);
for (const height of [60, 130, 230]) {
  const metrics = getMiniLyricMetrics(height, true);
  assert.ok(metrics.rowHeight >= metrics.lineHeight + 2 * metrics.translationLineHeight, 'Two translation lines must fit below the original even in short windows');
}
assert.equal(getMiniLyricLineCount(230, 64, true), 3);
assert.equal(getMiniLyricLineCount(500, 64, true), 3, 'Translations must never show five groups');
assert.equal(getMiniLyricLineCount(130, 58, true), 1);
assert.equal(getMiniLyricLineCount(192, 64, true), 3);
const small = getMiniPlayerLayout(340, 78);
const large = getMiniPlayerLayout(720, 230);
assert.equal(small.coverSize, 72);
assert.equal(large.coverSize, 180);
assert.ok(large.columnWidth >= large.coverSize);
assert.ok(getMiniPlayerLayout(680, 170).coverSize <= 164, 'Cover respects vertical space');
assert.ok(large.columnWidth > small.columnWidth);
assert.equal(getMiniPlayerLayout(720, 78).coverSize, 72, 'Wide but short windows must not grow the cover past available height');
assert.equal(getMiniPlayerLayout(NaN, NaN).coverSize, 72);
assert.equal(shouldAnimateMiniLyricStep(3.95, 4.05, 0, 1), true);
assert.equal(shouldAnimateMiniLyricStep(3, 4.05, 0, 1), false, 'Seek to adjacent line must snap');
assert.equal(shouldAnimateMiniLyricStep(4.05, 3.95, 1, 0), false);
assert.equal(shouldAnimateMiniLyricStep(3.95, 4.05, 0, 3), false);
assert.equal(shouldAnimateMiniLyricStep(NaN, 4.05, 0, 1), false);
console.log('Mini lyric model passed: adaptive slots, timed fill, LRC fill, seek and overflow-only movement');
