const assert = require('assert')
const deleteRecentSongs = require('../module/record_recent_song_delete')

describe('recent song batch delete', () => {
  it('uses the desktop client payload and verifies the refreshed cloud list', async () => {
    const calls = []
    let readCount = 0
    const initialList = [
      { data: { id: 11 }, playtime: 200 },
      { data: { id: 22 }, playtime: 100 },
    ]
    const verifiedList = [{ data: { id: 22 }, playtime: 100 }]
    const request = async (uri, data) => {
      calls.push({ uri, data })
      if (uri === '/api/play-record/song/list') {
        readCount += 1
        return {
          status: 200,
          body: {
            code: 200,
            data: {
              list: readCount === 1 ? initialList : verifiedList,
            },
          },
        }
      }
      return { status: 200, body: { code: 200 } }
    }

    const result = await deleteRecentSongs(
      { ids: '11', cookie: 'MUSIC_U=test' },
      request,
    )

    assert.deepStrictEqual(calls[1], {
      uri: '/api/play-record/batch/delete',
      data: {
        resourceIds: [11],
        type: 'SONG',
        lastPlayTime: 100,
        lastResourceId: 22,
      },
    })
    assert.deepStrictEqual(result.body.deletedTrackIds, ['11'])
    assert.strictEqual(readCount, 2)
  })
})
