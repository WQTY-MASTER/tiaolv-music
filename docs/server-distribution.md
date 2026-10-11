# 宝塔静态分发

域名：`https://wqty.online`。此步骤只分发软件，不迁移音乐库、QQ/网易云
登录或播放器后端。用户选择手动上传，尚未代为修改服务器。

## 上传

1. 在宝塔「网站」中查看 `wqty.online` 的实际根目录，先备份原有
   `index.html`、`styles.css`、`script.js` 和 `assets/`。
2. 上传 `electron/release/server-distribution/网站及更新上传包-0.1.2.zip`，
   解压到该根目录。确认首页和 `updates/` 同级，不多套一层文件夹。
   合并已有 `assets/`，不删除旧文件、证书或站点配置。
3. 在网站配置的现有 HTTPS `server` 块中加入
   `deploy/wqty-static-updates.nginx.conf` 的两个 `location` 块。
   只添加片段，不用它替换整个 Nginx 配置。先通过配置检查再重载。
   不需要开放任何播放器后端端口。
4. 打开下面的地址确认返回真实文件，不能重写成首页 HTML。

- 首页下载区：`https://wqty.online/#download`
- 更新清单：`https://wqty.online/updates/windows/latest.yml`
- 安装包：`https://wqty.online/updates/windows/tiaolv-music-electron-setup-0.1.2.exe`
- 增量信息：`https://wqty.online/updates/windows/tiaolv-music-electron-setup-0.1.2.exe.blockmap`

Nginx 默认支持字节范围请求。不要关闭 Range 或给更新目录套登录、验证码、
HTML 重写。`latest.yml` 不缓存；带版本号的安装包和 blockmap 可以长期缓存。
网页原有备案信息与 HTTPS 配置保持不变。

## 客户端与后续发布

安装 0.1.2 后，检查优先访问本站；本站不可用时回退一次到 GitHub。
只有用户点击下载才获取安装包，通过主进程 SHA512 校验后才允许重启安装。
普通退出不安装，联网失败不影响本地播放。旧版先覆盖安装一次。

新版本的包、GitHub tag 和 `latest.yml` 必须具有相同版本号。先上传新的
EXE 与 blockmap，核对大小和哈希，再最后替换 `latest.yml` 和网页版本链接。
保留旧版 blockmap，避免破坏增量下载；增量不可用时库可回退完整安装包。
本次上传包附带 0.1.1 的 blockmap，供该版本升级使用。

GitHub 源码提交不等于软件发布。后续仍要发布对应 GitHub Release，
包含同一份安装包、blockmap 和清单，才有可用的备用更新源。
SHA512 不能替代发布者代码签名，不能防御清单和安装包同时被替换。

## 本次核对

0.1.2 安装包为 186,129,493 字节，SHA512 为：

```text
Qr19QdPLnJI9KxHe51aJRUitIS9Z8mIldaZAY6Q12fy7No2QfSQvzazUNLgjGvruzwn5vYdzQ1LgFlc2u1bJbg==
```

18 项更新相关检查、类型检查、生产构建通过。网页下载区通过电脑与手机
布局检查。安装包与构建产物一致，内置 Java 与三个服务入口已核对。
GitHub 与上传包使用相同文件。没有在全新 Windows 环境执行安装或
跨版本重启安装，服务器上传后的 HTTPS、Range 和更新检查仍需确认。
