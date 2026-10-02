# Media Art Radar

媒体艺术资讯周刊站点，GitHub Pages 页面入口为 `index.html`。

## Site files

- `latest.json`：本期作品精选、开放机会与更新时间。
- `site-v15.js` / `site-v15.css`：首页交互与样式。
- `Media-Art-Radar.js`：Scriptable 小组件脚本。
- `assets/`：首页图片与字体。
- `install.html`：小组件安装入口；`404.html`：未找到页面。

内容更新后，将站点发布目录中的对应文件同步到仓库根目录。只更新周刊内容时至少同步 `latest.json`；修改界面或脚本时同步相关文件和资源。

## 媒体艺术档案

- 第二个侧栏入口 `02 / Archive`（`archive/`）是公开作品目录，使用相同的 Radar 字体、侧栏与黑白界面。
- 目录支持作品/作者/关键词搜索、拼音与首字母搜索、作品详情、图片放大，以及有第二张图片的作品轮播；不连接私人筛选 API，也不在 GitHub Pages 保存个人选择。
- 私人档案的账号保存、精选、移除与随机筛选继续在 [私人 Site](https://media-art-fieldnotes.mystic-dune-6472.chatgpt.site/archive/) 管理。
- 图片与作品版权归原权利人；每张卡保留署名、来源与授权说明。

### 更新公开目录

使用已核验、可公开的作品目录和图片目录：

    node tools/build-archive.mjs ./public-catalog.json --assets=./public-assets

可用 `--exclude=./excluded-ids.json` 传入不发布的作品 ID 数组；该输入文件不需要、也不应提交到公开仓库。使用 `--skip-assets` 时仅更新 HTML 与 JSON，保留已经处理好的图片。

构建采用公开字段白名单，排除个人筛选状态、个人推荐理由、用户标识与本地文件路径；仅复制记录引用的图片。请在发布前审阅文字字段，确保其中没有私人评语。`archive/catalog.json` 与 `archive/index.html` 是生成文件。图片路径为 `archive/assets/<原文件名>`；字体继续使用根目录 `assets/fonts/`，适用于 GitHub Pages 的 `/media-art-reader/` 子路径与独立站根目录。

`radar-shell.css`、`radar-shell.js` 与 `tools/radar-shell.mjs` 也可用于私人 Site 的统一外观，保存功能仍由私人 Site 自己提供。根目录 `latest.json` 与 Scriptable 小组件脚本的行为不变。

### 验证

    node --test tools/test-archive.mjs

测试涵盖公开字段白名单、HTML 转义、图片路径、GitHub Pages 子路径、私人控件保留及第二入口的普通链接导航。作品数量、图片数量和第二图覆盖率由构建命令输出；发布前须另做实际浏览器的桌面、平板与手机视觉检查。
