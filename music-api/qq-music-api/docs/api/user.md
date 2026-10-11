# 用户接口

本页整理与用户信息、登录、头像、歌单获取相关的接口能力。

## QQ 登录票据续期

使用 `callUserMusicu` 的关注列表、粉丝列表、歌手关注状态／操作和喜欢歌曲接口，在上游明确返回登录失效码（`1000`、`104400`、`104401`）时，会尝试使用请求 Cookie 中的 QQ OAuth 凭据续期。需要同一账号的 `uin`、`qm_keyst`（或 `qqmusic_key`）、`psrf_qqopenid`、`psrf_qqaccess_token` 和 `psrf_qqrefresh_token`。成功后以新 Cookie、`authst` 和重新计算的签名重试一次；网络超时和其他业务错误不会触发写操作重试。

续期结果只在当前服务进程内按原凭据隔离缓存，最多保留 64 个会话；并发请求共用一次续期。不会修改调用方持久化的 Cookie，也不会借用全局账号凭据。服务重启后会按需重新续期；缺少续期凭据、OAuth 授权失效或续期失败时保留上游错误，需要调用方重新登录。此流程适用于 QQ OAuth 登录，不改变微信登录流程。

## 接口总览

- `GET /user/getUserPlaylists`
- `GET /user/getUserAvatar`
- `GET /user/getQQLoginQr`
- `POST /user/checkQQLoginQr`

## 获取用户歌单

### 接口

`GET /user/getUserPlaylists`

### 说明

获取指定用户的歌单列表。该接口通常与登录态配置配合使用。

### 参数

| 参数   | 类型   | 必填 | 默认值 | 说明        |
| ------ | ------ | ---- | ------ | ----------- |
| uin    | string | 是   | -      | QQ 用户号码 |
| offset | number | 否   | 0      | 偏移量      |
| limit  | number | 否   | 30     | 返回数量    |

### 请求示例

```bash
curl "http://localhost:3200/user/getUserPlaylists?uin=123456789&offset=0&limit=30"
```

### 响应示例

```json
{
	"code": 0,
	"data": {
		"playlists": [
			{
				"dissid": "123456",
				"dissname": "我的歌单"
			}
		]
	}
}
```

### 注意事项

- 部分场景依赖有效登录态
- 如果返回异常，优先检查 Cookie 是否过期
- 当前接口对外返回标准化后的 `playlists` 字段，不透出上游原始 payload
- 当前接口仍在持续验证与调整中，建议结合 [`docs/TEST_USER_PLAYLISTS.md`](../TEST_USER_PLAYLISTS.md) 一起阅读
- 建议结合 [认证与登录](/guide/authentication) 页面一起使用

## 获取用户头像

### 接口

`GET /user/getUserAvatar`

### 说明

获取 QQ 用户头像地址，支持通过 `uin` 或 `k` 参数生成头像 URL。

### 参数

| 参数 | 类型   | 必填 | 默认值 | 说明                                     |
| ---- | ------ | ---- | ------ | ---------------------------------------- |
| uin  | string | 否   | -      | QQ 号码                                  |
| k    | string | 否   | -      | QQ 头像 key                              |
| size | number | 否   | 140    | 头像尺寸，支持 `40`、`100`、`140`、`640` |

### 请求示例

```bash
curl "http://localhost:3200/user/getUserAvatar?uin=123456789&size=140"
```

### 响应示例

```json
{
	"response": {
		"code": 0,
		"data": {
			"avatarUrl": "https://q.qlogo.cn/headimg_dl?dst_uin=123456789&spec=140",
			"message": "获取头像成功"
		}
	}
}
```

### 错误示例

```json
{
	"error": "size 参数无效"
}
```

### 注意事项

- 如果同时提供 `k` 和 `uin`，优先使用 `k`
- 当传入重复 query 参数时，服务端只会读取第 1 个值
- `size` 必须为大于 0 的数字
- `640` 通常可获取高清头像
- 头像接口适合直接用于前端展示

## 获取登录二维码

### 接口

`GET /user/getQQLoginQr`

### 说明

获取 QQ 登录二维码，用于扫码登录流程。

### 参数

无。

### 请求示例

```bash
curl "http://localhost:3200/user/getQQLoginQr"
```

### 响应说明

成功时会返回二维码图片的 Base64 数据，以及后续轮询登录状态所需的关键字段，例如 `ptqrtoken` 与 `qrsig`。

### 注意事项

- 兼容公开入口 `GET /getQQLoginQr`
- 建议保存返回中的关键字段，用于后续轮询登录状态

## 检查扫码登录状态

### 接口

`POST /user/checkQQLoginQr`

### 说明

根据二维码登录流程中的关键字段，轮询扫码状态。

### 参数

| 参数      | 类型   | 必填 | 默认值 | 说明               |
| --------- | ------ | ---- | ------ | ------------------ |
| qrsig     | string | 是   | -      | 二维码签名         |
| ptqrtoken | string | 否   | -      | 登录状态轮询 token |

### 请求示例

```bash
curl -X POST "http://localhost:3200/user/checkQQLoginQr" \
  -H "Content-Type: application/json" \
  -d '{"qrsig":"你的 qrsig","ptqrtoken":"你的 ptqrtoken"}'
```

### 成功示例

```json
{
	"isOk": true,
	"message": "登录成功",
	"session": {
		"loginUin": "o123456789",
		"uin": "o123456789",
		"cookie": "uin=o123456789; qm_keyst=xxx",
		"cookieList": ["uin=o123456789", "qm_keyst=xxx"],
		"cookieObject": {
			"uin": "o123456789",
			"qm_keyst": "xxx"
		}
	}
}
```

### 失败示例

```json
{
	"error": "授权响应异常，未返回跳转地址"
}
```

### 注意事项

- 兼容公开入口 `POST /checkQQLoginQr`
- 建议与 [`/user/getQQLoginQr`](#获取登录二维码) 配合使用
- 当前实现已覆盖超时、二维码失效、缺少 `p_skey`、授权跳转缺少 `code` 等常见失败分支

## 删除自建歌单

`POST /user/deletePlaylist`，请求体为 `{ "id": "歌单 tid" }`，通过 Cookie 传入当前账号凭据。

服务先读取当前账号创建的歌单，将公开 `tid` 解析为该账号的 `dirid`，再调用
`music.musicasset.PlaylistBaseWrite/DelPlaylist`。不接受客户端直接指定 `dirid`。
“我喜欢”（201）、默认列表（1）、QZone 背景音乐（205）、本地上传（206）等系统目录禁止删除；
非本人歌单或归属读取失败时也不发送删除请求。成功与否须同时检查上游外层、`req_1.code` 和 `data.retCode`。

该操作同步删除 QQ 音乐中的歌单，调用方应先让用户确认。

## 歌单歌曲管理

两个接口均需要当前账号 Cookie，服务端通过歌单 `tid` 重新确认归属。

- `POST /user/removePlaylistTrack`：请求 `{ "id": "歌单 tid", "songId": "歌曲 MID 或导入歌曲的数字 ID" }`。仅移出普通自建歌单里的歌曲，不删除歌单本身。根据歌单原始数据保留歌曲类型，写入后回读确认歌曲已移出。“我喜欢”中的歌曲请使用取消喜欢接口。
- `POST /user/reorderPlaylistTracks`：请求 `{ "id": "歌单 tid", "trackIds": ["mid2", "mid1"], "previousTrackIds": ["mid1", "mid2"] }`。包含完整的新顺序和打开歌单时的原顺序。支持自己的普通歌单与“我喜欢”，禁止对收藏的他人歌单排序。

排序使用 `PlaylistDetailWrite.SeqSonglist`，参数为 `dirId`、`tid` 和按目标顺序排列的 `v_songPair`（`songId`、`songType`）；不采用删除再添加歌曲的方式。
写前读取完整歌单，拒绝缺失、重复及已被其他设备更改的顺序（409）；写后再次读取并比对完整顺序，一致后才成功。账号内禁止并发排序，完成后至少间隔 3 秒（429）；上游返回 HTTP 403/429 后至少冷却 60 秒，不自动重试写入。调用方应展示失败并保留原顺序，提示用户刷新。

## 歌曲喜欢状态写入

`POST /user/setSongFavorite`，请求体为 `{ "mid": "歌曲 MID", "liked": true }`，
通过 Cookie 传入当前账号凭据。`liked: false` 表示取消喜欢。

写入前使用私人只读接口 `SongFavRead.IsSongFanByMid` 校验登录；导入歌曲的数字 ID
使用 `IsSongFanById`。收藏校验和写入只使用扫码／网页登录保存的原始票据，不使用其他
读取接口缓存的刷新票据。遇到明确过期码时要求重新登录；校验失败或缺少收藏状态时
不发起写入。公开喜欢列表可被失效票据读取，不能用作登录验证。
已处于目标喜欢状态时不重复写入。

收藏请求使用 QQ 网页的 `u6.y.qq.com`、`musics.fcg`、`encoding=ag-1` 和 `text/plain`
传输，业务参数仍为目录 201 和真实的歌曲数字 ID/类型。只对收藏启用此传输，其他接口不变。
HTTP 成功或内层 `retCode: 0` 不能代替外层和 `req_1.code` 的检查。
`80105` 等未知业务拒绝不触发自动重试，不按登录过期推断。

## 相关文档

- [认证与登录](/guide/authentication)
- [其他接口](/api/other)
- [快速开始](/guide/quickstart)

## 最近播放上报

`POST /user/reportRecentPlay` requires the active account cookie and JSON fields:

```json
{
  "songMid": "0039MnYb0qxYhV",
  "sessionId": "cf3dac35-7a99-4706-9c69-11a4742486a1",
  "listenedSeconds": 30,
  "totalSeconds": 180
}
```

Only submit after at least 30 seconds of observed real playback. Pauses, buffering and seeking do not qualify. Do not backfill old history or manufacture playback durations. Numeric-only imported entries are not supported by this route.

The gateway resolves the numeric standard-song ID and uses `music.musicasset.PlayRecentlyWrite.ReportPlayRecentlyInfo` with `data: [{id, type: 2, lastTime, listenCnt: 1}]`. It validates the original login session and makes at most one write per account/session UUID while the process retains its bounded 24-hour attempt cache. The caller must also enforce one attempt; this is not a durable delivery queue across restarts.

Success returns `response: {code: 0, confirmed: true, songList: [...]}` only after fresh cloud read-back confirms the submitted song and timestamp. Failure remains a failure; propagation checks are read-only, never additional writes. The HTTP route reports invalid input as 400, UUID reuse for another song as 409 and unconfirmed synchronization as 502. QQ authentication/business codes are preserved for the caller. Credentials are never returned.
