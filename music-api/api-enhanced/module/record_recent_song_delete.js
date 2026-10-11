const createOption = require('../util/option.js')

const readRecent = async (query, request) => {
  const response = await request(
    '/api/play-record/song/list',
    { limit: 100 },
    createOption(query, 'weapi'),
  )
  const rows = Array.isArray(response.body?.data?.list)
    ? response.body.data.list
    : Array.isArray(response.body?.data)
      ? response.body.data
      : []
  return { response, rows }
}

const songId = (row) => Number(row?.data?.id ?? row?.song?.id ?? row?.id)

module.exports = async (query, request) => {
  const requested = [
    ...new Set(
      String(query.ids || '')
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    ),
  ]
  if (!requested.length || requested.length > 100) {
    return {
      status: 400,
      body: { code: 400, message: '请选择 1 到 100 首歌曲' },
    }
  }

  const before = await readRecent(query, request)
  const currentIds = new Set(before.rows.map(songId))
  const removable = requested.filter((id) => currentIds.has(id))
  if (removable.length) {
    const last = before.rows[before.rows.length - 1]
    await request(
      '/api/play-record/batch/delete',
      {
        resourceIds: removable,
        type: 'SONG',
        lastPlayTime: last?.playtime || 0,
        lastResourceId: songId(last) || 0,
      },
      createOption(query, 'weapi'),
    )
  }

  const after = await readRecent(query, request)
  const remainingIds = new Set(after.rows.map(songId))
  after.response.body.deletedTrackIds = requested
    .filter((id) => !remainingIds.has(id))
    .map(String)
  return after.response
}
