# media-art-reader

网站入口：`index.html`。Scriptable 小组件：`Media-Art-Radar.js`（Edition 12.2）。

12 采用选定的「克制刊物」设计：刊头为花体 `Media Art Radar`，日期为黑色
Georgia 常规斜体配红色小数点；小号展示下一个截止，中号三列，大号细线台账。
名称使用系统粗体，金额使用 Georgia 斜体，期号和倒计时使用等宽字体。
日期在独立画布中绘制，避免堆叠布局挤压；原有各条目的点击链接、缓存与刷新保留。

11.1 根据 iPhone 截图修复日期贴边、金额和页脚未靠右的问题：
stack 内用水平弹性间距实现对齐，不使用在 stack 内无效的 WidgetText 对齐方法。

## 更新小组件

把 `Media-Art-Radar.js` 的完整内容替换进原 Scriptable 脚本，保存并运行一次。
iPhone 默认按机型尺寸排版。Mac 使用同一份脚本，不需要单独安装一个版本。
如需对齐网页的 Mac 参考尺寸，可选在该组件的 Parameter 中填写 `mac`。
这是手动尺寸校准，脚本不会自动判断 iPhone 小组件是否正被 Mac 镜像。

在 Scriptable 应用内运行时默认预览大号，可修改顶部的 `PREVIEW_FAMILY`。
主屏幕上始终以实际选择的组件尺寸为准。
iPad、显示缩放或未收录机型可用 JSON 参数覆盖实际组件宽高（单位 pt），
例如中号参考尺寸：`{"width":378,"height":176}`。

## 验证

运行 `node tests/widget-layout.cjs` 检查各尺寸的卡片边界、间距、长文本区域、
条目数量、点击链接、离线缓存和参数处理。运行 `node --check site-v15.js` 检查网页脚本。
测试使用 Scriptable API 替身，不能代替 iOS 原生字体、组件截图和 Mac 镜像验证。
实际验收时应在 iPhone 的小、中、大号组件分别检查标题截断、日期、金额和边距，
再检查 Mac 镜像效果。小组件预览与 iOS 均指定 Georgia；不同渲染环境仍需真机核验。

11.2 加强小组件可读性：日期和金额改用粗体等宽字体，分类、倒计时、金额说明和页脚加大，辅助文字加深。刊头和总数保留 Didot 斜体。

12.1 根据 iPhone 截图重新以原生字体排版：Georgia-Italic 刊头（22/24pt），Georgia-BoldItalic 日期（常规24pt），系统粗体名称，系统等宽元数据；中号长标题拆成独立的两行文字槽，避免原生单段文字提前省略。

12.2 修复日期缺字：改用逐字 Point 绘制，移除窄矩形内的分段排版，留足斜体边缘。日期使用 Georgia-Italic；大号日期 25.5pt、名称 15pt、分类和倒计时 10pt；中号名称 13pt（紧凑模式 12pt），小号名称 17pt。较矮的大号组件减少条目以保留可读字号。
