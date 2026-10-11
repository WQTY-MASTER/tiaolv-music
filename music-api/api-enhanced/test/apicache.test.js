const assert = require('assert')
const apicache = require('../util/apicache')

describe('cache performance reports', () => {
  it('returns empty hit rates without leaking the loop counter globally', () => {
    const previous = Object.getOwnPropertyDescriptor(global, 'j')
    const sentinel = Symbol('existing global value')
    global.j = sentinel
    try {
      const cache = apicache.newInstance({ trackPerformance: true })
      cache.middleware('1 minute')
      const [report] = cache.getPerformance()
      assert.strictEqual(report.callCount, 0)
      assert.strictEqual(report.hitCount, 0)
      assert.strictEqual(report.missCount, 0)
      assert.strictEqual(report.hitRate, null)
      assert.strictEqual(report.hitRateLast100, null)
      assert.strictEqual(report.hitRateLast1000, null)
      assert.strictEqual(report.hitRateLast10000, null)
      assert.strictEqual(report.hitRateLast100000, null)
      assert.strictEqual(global.j, sentinel)
    } finally {
      if (previous) Object.defineProperty(global, 'j', previous)
      else delete global.j
    }
  })
})
