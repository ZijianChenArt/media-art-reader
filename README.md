# Media Art Radar

网站入口：index.html。小组件脚本：Media-Art-Radar.js，Edition 13。

小组件全部使用苹果系统字体，用大数字、细描边卡片、黑色日期块和红色点缀建立层次。小号单卡；中号两张卡；大号最多四张卡；超大号六格。主网站排版不变。

完整替换 Scriptable 中的脚本并运行一次。默认预览大号；可修改 PREVIEW_FAMILY，或把 Parameter 设置为 small / medium / large / extraLarge。主屏幕以系统选定尺寸为准。Mac 使用同一脚本，可选 Parameter=mac 校准尺寸；JSON width/height 可覆盖实际点数。

内置中文用 Unicode 转义保存，避免下载或复制时的字符编码歧义；运行后仍显示中文。网络失败时读取本机缓存。

验证：node tests/widget-layout.cjs；node --check site-v15.js。测试验证布局边界、系统字体选择、中文解码、点击链接和缓存；不能代替 iPhone 原生渲染验证。
