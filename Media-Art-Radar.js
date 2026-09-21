// MEDIA ART RADAR · Edition 10（黑白 + 一个红）
// 与网站 site-v15 同一套语言：黑白为底 · 分类靠符号（● 展览 ○ 驻留 ◆ 奖项 ▲ 会议）
// 整体黑白、白为主，只有一个红：倒计时 T-n、关键数字、总数 · 每个机会是一张独立的黑描边卡 · 总数用大号数字写明 · 不标记「最近」
// 圆角等角、同心，边距与间距等距（见下面「圆角与间距」）
// Scriptable Home Screen widgets：small / medium / large / extraLarge（Mac、iPad）
// 更新已有组件：将本文件完整替换进原 Scriptable 脚本，保存并运行一次。

const DATA_URL = "https://zijianchenart.github.io/media-art-reader/latest.json"
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const CACHE_NAME = "media-art-radar-latest.json"
const REFRESH_MINUTES = 60
// 在 Scriptable 内预览时改为 small / medium / large / extraLarge；桌面会自动识别尺寸。
const PREVIEW_FAMILY = "large"

// 与网站 site-v15.css 的变量一一对应。改这里之前先改网站，保持两边一致。
// 只有一个红（Nothing 那种），只上在几个关键数字的字上，不铺色块；分类用符号表示，不用颜色。
const C = {
  paper: "#FFFFFF", card: "#FFFFFF", ink: "#040404", sub: "#2B2B2B",
  dim: "#6D6D6D", faint: "#A3A3A3", hair: "#ECECEC", mute: "#B9B9BF",
  red: "#D71921",
  soon: "#DE2410"          // 只用于「数据过期」的警示字
}

// ============================================================
// 圆角与间距：一套「等角、等距」的规则，四个尺寸共用
//   · 等角：每个形状的四个角是同一个半径（iOS 原生就是这样；不再画异形圆角）
//   · 同心：卡片圆角 = 组件外框半径 − 内边距（贴着组件边角的卡片与外框同心；卡内不再嵌套带描边的块）
//   · 等距：组件四边的内边距相同，所有相邻块的间距相同（横竖一样），块内文字与块边缘的距离相同（超大号格子里也是 INSET）
// 注意：这些 const 必须写在下面的执行入口之前——const 不会提升，
// 放在入口之后会在中号、大号里触发 "before initialization" 而整块空白。
// ============================================================
const WIDGET_R = 26                    // iOS 组件外框圆角（实测：iPhone 17 Pro Max 真机截图量得 25.8–26.3pt）
const INSET = 12                       // 组件内边距（四边相同）
const GAP = 6                          // 相邻块的间距（横竖相同）
const CARD_R = WIDGET_R - INSET        // 14：卡片圆角，与外框同心
const PAD_IN = 10                      // 块内文字与块边缘的距离
const BW = 1.2                         // 线宽：卡内竖分隔线（一块 1.2pt 宽的实心黑条）与卡片外框的有效线宽，两者一样粗
// iOS 画 borderWidth 时，外侧那半圈会被圆角裁掉，只剩里面一半（真机实测：写 1.2 只剩约 0.6pt，比竖线细一半）。
// 所以外框的 borderWidth 要写成 2 倍，有效线宽才等于 BW，与竖线一样粗。
const OUTLINE_W = BW * 2

// 组件既可能显示在 iPhone 主屏，也可能显示在 Mac 桌面上（macOS Tahoe 的「来自 iPhone 的小组件」）。
// 两种情况下脚本都是在 iPhone 上运行的，Device 里读到的永远是 iPhone，脚本看不出自己被放在哪里；
// 而 Mac 桌面上的组件比 iPhone 上的矮（实测 ≈1.80 像素/pt）：小 162×162，中 341×162，大 342×342，超大 701×342。
// 所以排版不去猜宿主：小、中、大号的宽与高都不写死，卡片靠弹性空白撑满整个组件；
// 只按「已知宿主里最矮的高度」算「放几张」，保证任何宿主里都放得下。超大号只会出现在 Mac 桌面上，面积用实测值。
const MIN_HEIGHT = { small: 162, medium: 162, large: 342 }     // Mac 桌面上的高度（所有已知宿主里最矮）
const XL_AREA = { w: 701, h: 342 }

// 表来自 Apple 的 iPhone 组件规格，按屏幕高度（pt）查。
const WIDGET_SIZES = {
  956: { small: 176, mw: 378, lh: 393 },   // iPhone 17 Pro Max（440×956）：真机截图实测 377.9×176.3 / 377.9×393.2。其余机型仍是 Apple 旧规格，尺寸不准时内容也会自适应撑满宽度
  932: { small: 170, mw: 364, lh: 382 },
  926: { small: 170, mw: 364, lh: 382 },
  896: { small: 169, mw: 360, lh: 379 },
  852: { small: 158, mw: 338, lh: 354 },
  844: { small: 158, mw: 338, lh: 354 },
  812: { small: 155, mw: 329, lh: 345 },
  736: { small: 159, mw: 348, lh: 357 },
  667: { small: 148, mw: 321, lh: 324 },
  568: { small: 141, mw: 292, lh: 311 }
}
const CATEGORY = {
  exhibition: { short: "展览", full: "展览征集", glyph: "●" },
  residency:  { short: "驻留", full: "驻留",     glyph: "○" },
  prize:      { short: "奖项", full: "奖项",     glyph: "◆" },
  conference: { short: "会议", full: "学术会议", glyph: "▲" }
}

// ============================================================
// 取数：优先联网，失败回落本机缓存，再失败给空态
// ============================================================
const fm = FileManager.local()
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_NAME)
let payload, source = "LIVE"
try {
  const request = new Request(DATA_URL)
  request.timeoutInterval = 15
  request.headers = { Accept: "application/json" }
  payload = await request.loadJSON()
  validate(payload)
  // 本地写入失败不应该丢掉刚拿到的有效数据
  try { fm.writeString(cachePath, JSON.stringify(payload)) } catch (_) {}
} catch (error) {
  try {
    if (!fm.fileExists(cachePath)) throw error
    payload = JSON.parse(fm.readString(cachePath))
    validate(payload)
    source = "CACHE"
  } catch (_) {
    payload = emptyPayload(error)
    source = "OFFLINE"
  }
}

const family = config.runsInWidget ? config.widgetFamily : PREVIEW_FAMILY
const widget = family === "small" ? buildSmall(payload, source)
  : family === "large" ? buildLarge(payload, source)
  : family === "extraLarge" ? buildExtraLarge(payload, source)
  : buildMedium(payload, source)
widget.url = SITE_URL
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60000)
if (config.runsInWidget) Script.setWidget(widget)
else if (family === "small") await widget.presentSmall()
else if (family === "large") await widget.presentLarge()
else if (family === "extraLarge") {
  // presentExtraLarge 只在较新的 Scriptable 里有；没有就退回大号预览
  if (typeof widget.presentExtraLarge === "function") await widget.presentExtraLarge()
  else await widget.presentLarge()
}
else await widget.presentMedium()
Script.complete()

// ============================================================
// 尺寸
// ============================================================
function widgetMetrics() {
  let h = 852
  try { const s = Device.screenSize(); h = Math.max(s.width, s.height) } catch (_) {}
  const keys = Object.keys(WIDGET_SIZES).map(Number)
  // 不在表里的机型取最接近的；并列时取较小的，宁可留白也不溢出
  const near = keys.reduce((best, k) => {
    const d = Math.abs(k - h), bd = Math.abs(best - h)
    return d < bd || (d === bd && k < best) ? k : best
  }, keys[0])
  const t = WIDGET_SIZES[near]
  return { small: { w: t.small, h: t.small }, medium: { w: t.mw, h: t.small }, large: { w: t.mw, h: t.lh } }
}

// ============================================================
// 基础件
// ============================================================
function baseWidget(padding) {
  const wd = new ListWidget()
  wd.backgroundColor = new Color(C.paper)   // 纯白，不叠任何底纹：桌面壁纸各不相同，底纹只会变脏
  wd.setPadding(padding, padding, padding, padding)
  return wd
}

// 字体三层，对应主页：Didot 斜体 ≈ Bodoni 斜体（日期、英文强调）/ 等宽（数据）/ 系统字（标题正文）
function didot(size) { return new Font("Didot-Italic", size) }
function mono(size)  { return Font.mediumMonospacedSystemFont(size) }
function monoBold(size) {
  return Font.boldMonospacedSystemFont ? Font.boldMonospacedSystemFont(size) : Font.mediumMonospacedSystemFont(size)
}

function text(parent, value, size, color = C.ink, weight = "regular", lines = 1) {
  const t = parent.addText(String(value))
  t.font = weight === "bold" ? Font.boldSystemFont(size)
    : weight === "semi" ? Font.semiboldSystemFont(size)
    : weight === "medium" ? Font.mediumSystemFont(size)
    : weight === "mono" ? mono(size)
    : weight === "monob" ? monoBold(size)
    : weight === "didot" ? didot(size)
    : Font.systemFont(size)
  t.textColor = new Color(color)
  t.lineLimit = lines
  t.minimumScaleFactor = 0.8
  return t
}

function rule(parent, color = C.hair) {
  const line = parent.addStack()
  line.size = new Size(0, 1)
  line.backgroundColor = new Color(color)
  line.addSpacer()
}

// 一个等角圆角矩形（可填色、可描边）。用 Scriptable 原生的 cornerRadius / borderWidth，不再画背景图，
// 所以不依赖 DrawContext，也不必知道组件的真实点数就能画对形状。
function box(parent, w, h, r, o = {}) {
  const st = parent.addStack()
  st.layoutVertically()
  if (w || h) st.size = new Size(w || 0, h || 0)
  st.cornerRadius = r
  if (o.fill) st.backgroundColor = new Color(o.fill)
  if (o.stroke) { st.borderColor = new Color(o.stroke); st.borderWidth = OUTLINE_W }
  return st
}
// 卡：白底 + 墨黑描边 + 等角圆角
function card(parent, w, h, r = CARD_R) { return box(parent, w, h, r, { fill: C.card, stroke: C.ink }) }

// 胶囊：高度固定，宽度随文字。用在 T-n 上：日期块是黑底时反白，否则描边。
function pill(parent, label, size, o) {
  const st = parent.addStack()
  st.centerAlignContent()
  st.setPadding(0, o.px === undefined ? 6 : o.px, 0, o.px === undefined ? 6 : o.px)
  st.size = new Size(0, o.h)
  if (o.fill) st.backgroundColor = new Color(o.fill)
  if (o.stroke) { st.borderColor = new Color(o.stroke); st.borderWidth = o.bw || 1 }
  st.cornerRadius = o.h / 2
  text(st, label, size, o.color || C.ink, o.weight || "monob")
  return st
}
// 倒计时胶囊：红色描边红字，所有机会一视同仁，不再区分「最近」
function daysPill(parent, label, size, h) {
  return pill(parent, label, size, { h, stroke: C.red, color: C.red })
}
// 分类标签：符号 + 名字，不用颜色
function categoryTag(parent, item, size, color) {
  return text(parent, `${glyphOf(item)} ${categoryLabel(item, true)}`, size, color, "monob")
}

// ============================================================
// 数据 → 展示（规则与网站 site-v15.js / site-v15.css 一致）
// ============================================================
// 关键数字：与网站三档字号一致——短的最大，4 字符以上缩小，纯中文变灰
function highlightOf(item) {
  const v = item.highlight
  if (!v) return null
  return { value: String(v), label: String(item.highlight_label || "") }
}
function highlightSpec(value, base) {
  // 下限 9pt：再小就读不出来了（中号里 base 只有 12，按比例会缩到 6pt）
  if (!/\d/.test(value)) return { size: Math.max(base * 0.5, 9), weight: "medium", color: C.dim }
  // 5 个字符以上才缩小，与主页一致：€8,000 / $2,000 缩小，€500 不缩
  if (value.length >= 5) return { size: Math.max(base * 0.68, 9), weight: "didot", color: C.red }
  return { size: base, weight: "didot", color: C.red }
}
// ============================================================
// 日期柱 · 白底，日期墨黑，T-n 红字；只写两样。日期只是配角——名称才是主角
// 高度自适应：上下各有弹性空白，柱子跟着整张卡的高度走
// ============================================================
function pillar(parent, item, w, dateSize, tnSize) {
  const st = parent.addStack()
  st.layoutVertically()
  st.size = new Size(w, 0)
  st.addSpacer()
  const a = st.addStack()
  a.addSpacer(); text(a, deadlineLabel(item), dateSize, C.ink, "didot"); a.addSpacer()
  st.addSpacer(2)
  const d = daysRemaining(item)
  const b = st.addStack()
  b.addSpacer(); text(b, d === null ? "TBA" : `T-${d}`, tnSize, C.red, "monob"); b.addSpacer()
  st.addSpacer()
  return st
}

// 关键数字列：数字（斜体）+ 一行小字说明，靠右
function keyColumn(parent, item, w, base, labelSize) {
  const hl = highlightOf(item)
  const col = parent.addStack()
  col.layoutVertically()
  col.size = new Size(w, 0)
  if (!hl) return col
  const spec = highlightSpec(hl.value, base)
  const a = col.addStack()
  a.addSpacer(); text(a, hl.value, spec.size, spec.color || C.ink, spec.weight)
  if (hl.label) {
    col.addSpacer(2)
    const b = col.addStack()
    b.addSpacer(); text(b, hl.label, labelSize, C.dim, "mono", 1)
  }
  return col
}

// 一个机会 = 一张独立的黑描边卡：[日期柱] | 名称 + 分类 | 关键数字。
// 名称是主角（粗体、比日期大一号）；日期与 T-n 收在窄柱里。
// 宽、高都不写死：宽度靠卡内弹性空白撑满，高度靠柱子里的弹性空白撑满——同一份脚本在 iPhone（高）与 Mac 桌面（矮）上都放得下。
function addOppCard(parent, item, s) {
  const c = card(parent, 0, 0)
  c.url = item.url || SITE_URL
  c.layoutHorizontally()
  c.centerAlignContent()
  pillar(c, item, s.pillarW, s.date, s.tn)
  const bar = c.addStack()                // 竖分隔线：一块 1.2pt 宽、随卡高伸缩的实心黑条
  bar.layoutVertically()
  bar.size = new Size(BW, 0)
  bar.backgroundColor = new Color(C.ink)
  bar.addSpacer()
  c.addSpacer(PAD_IN)
  const col = c.addStack()
  col.layoutVertically()
  text(col, splitTitle(item.title).title, s.title, C.ink, "bold", 1)
  col.addSpacer(3)
  text(col, `${glyphOf(item)} ${categoryLabel(item, true)}`, s.meta, C.dim, "monob", 1)
  c.addSpacer()
  keyColumn(c, item, s.keyW, s.hl, s.meta - 1)
  c.addSpacer(PAD_IN)
  return c
}

// 能放几张：按「已知宿主里最矮的那个」算（iPhone 与 Mac 桌面取矮者），保证任何一个宿主里都放得下；
// 每张卡至少 minH，放不下的机会写成一行小字「另有 n 项」，那一行（extra）先从高度里扣掉。
function rowsThatFit(avail, minH, total, extra = 0) {
  const most = a => Math.max(1, Math.floor((a + GAP) / (minH + GAP)))
  let n = Math.min(total, most(avail))
  if (n < total) n = Math.min(n, most(avail - extra))
  return n
}

// 放不下的机会压成一行小字：「另有 2 项 · 12.01 Wave Farm · 12.15 EMAF 40」
function restText(calls, shown, max = 3) {
  const hidden = calls.slice(shown)
  if (!hidden.length) return ""
  const names = hidden.slice(0, max).map(i => `${deadlineLabel(i)} ${splitTitle(i.title).title}`).join(" · ")
  return `另有 ${hidden.length} 项 · ${names}`
}

// ============================================================
// SMALL · 一张撑满的卡：分类 · 共 N 项 / 名称（大、粗，最多两行）/ 日期 + T-n / 关键数字
// ============================================================
function buildSmall(data, state) {
  const m = widgetMetrics().small
  const w = baseWidget(INSET)
  const calls = activeCalls(data.open_calls || [], "deadline")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state, true); w.addSpacer(); return w }

  const item = calls[0]
  // 字号按「最矮的宿主」定（Mac 桌面 162）；再矮的机型（iPhone SE 等）按内容高等比缩小
  const sc = Math.min(1, (Math.min(m.h, MIN_HEIGHT.small) - INSET * 2 - 1 - PAD_IN * 2) / 117)
  const c = card(w, 0, 0)                                // 宽、高都自适应，撑满组件；上边两角贴组件边角：圆角 = 外框 − 内边距（同心）
  c.url = item.url || SITE_URL
  c.setPadding(PAD_IN, PAD_IN, PAD_IN, PAD_IN)

  const top = c.addStack()
  top.centerAlignContent()
  categoryTag(top, item, 7.5, C.ink)
  top.addSpacer()
  text(top, `共 ${two(calls.length)} 项`, 7.5, C.dim, "monob")

  c.addSpacer(4)
  text(c, splitTitle(item.title).title, Math.round(16 * sc * 10) / 10, C.ink, "bold", 2)     // 名称：主角

  c.addSpacer()
  const fig = c.addStack()
  fig.bottomAlignContent()
  text(fig, deadlineLabel(item), Math.round(28 * sc), C.ink, "didot")
  fig.addSpacer()
  const d = daysRemaining(item)
  daysPill(fig, d === null ? "TBA" : `T-${d}`, 8, 14)

  c.addSpacer(4)
  rule(c)
  c.addSpacer(4)
  const meta = c.addStack()
  meta.centerAlignContent()
  const fresh = state === "LIVE" && !isStale(data)
  text(meta, fresh ? "申请截止" : statusText(state, data), 8, fresh ? C.dim : C.soon, "mono")
  meta.addSpacer()
  const hl = highlightOf(item)
  if (hl) {
    const spec = highlightSpec(hl.value, Math.round(16 * sc))
    text(meta, hl.value, spec.size, spec.color || C.ink, spec.weight)
  }
  return w
}

// ============================================================
// MEDIUM · 左边一块「总数」，右边三个机会，每个是一张独立的卡；块与块的间距一律 GAP
// 总数：一共几项开放机会（大号数字）；放不下的写「另有 n 项」。
// 高度不写死：左边总数卡与右边三张卡都靠弹性空白撑到同一高度。
// ============================================================
function buildMedium(data, state) {
  const m = widgetMetrics().medium
  const w = baseWidget(INSET)
  const calls = activeCalls(data.open_calls || [], "deadline")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); return w }

  const panelW = 74
  const availMin = Math.min(m.h, MIN_HEIGHT.medium) - INSET * 2 - 1           // 已知宿主里最矮的可用高度
  const rows = availMin >= 3 * 38 + 2 * GAP ? 3 : 2
  // 列宽按 Mac 桌面上最窄的宿主（341）算：日期柱与数字列收窄，把宽度让给名称
  const s = { pillarW: 44, date: 14, tn: 7, keyW: 44, title: 12.5, meta: 7.5, hl: 14 }
  const n = Math.min(calls.length, rows)

  const outer = w.addStack()
  outer.layoutHorizontally()

  const panel = card(outer, panelW, 0)
  panel.setPadding(PAD_IN, PAD_IN, PAD_IN, PAD_IN)
  text(panel, compactIssue(data.issue_id) || "—", 7, C.ink, "monob")
  panel.addSpacer()
  text(panel, two(calls.length), 46, C.red, "didot")
  text(panel, "项机会", 7.5, C.dim, "mono")
  panel.addSpacer(6)
  const fresh = state === "LIVE" && !isStale(data)
  const hidden = calls.length - n
  if (hidden > 0) text(panel, `另有 ${hidden} 项`, 7, C.ink, "monob")
  else text(panel, statusText(state, data), 7, fresh ? C.dim : C.soon, "mono")

  outer.addSpacer(GAP)
  const list = outer.addStack()
  list.layoutVertically()
  for (let i = 0; i < n; i++) {
    addOppCard(list, calls[i], s)
    if (i < n - 1) list.addSpacer(GAP)
  }
  return w
}

// ============================================================
// LARGE · 刊头写明总数，下面五张同样的卡；卡与卡、刊头、页脚之间的间距一律 GAP
// 卡片高度不写死：刊头、线、页脚是固定高度，其余全部平分给卡片。
// ============================================================
function addMasthead(parent, data, calls) {
  const top = parent.addStack()
  top.bottomAlignContent()
  text(top, "MEDIA ART", 10, C.ink, "bold")
  top.addSpacer(6)
  text(top, "Radar", 18, C.ink, "didot")
  top.addSpacer()
  text(top, two(calls.length), 26, C.red, "didot")
  top.addSpacer(4)
  const unit = top.addStack()
  unit.layoutVertically()
  text(unit, "项机会", 8.5, C.ink, "monob")
  text(unit, compactIssue(data.issue_id) || "—", 7.5, C.dim, "mono")
  unit.addSpacer(2)
  parent.addSpacer(GAP)
}

function buildLarge(data, state) {
  const m = widgetMetrics().large
  const w = baseWidget(INSET)
  const calls = activeCalls(data.open_calls || [], "deadline")

  addMasthead(w, data, calls)
  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); footer(w, data, state); return w }

  const MAST = 32, FOOT = 10           // 刊头（26pt 数字）与页脚一行字的高度
  const availMin = Math.min(m.h, MIN_HEIGHT.large) - INSET * 2 - 1           // 已知宿主里最矮的可用高度
  const area = availMin - MAST - GAP - GAP - 1 - GAP - FOOT                  // 刊头 | 卡片区 | 间距 | 线 | 间距 | 页脚
  const n = rowsThatFit(area, 46, calls.length, GAP + 10)
  // 列宽按 Mac 桌面上最窄的宿主（342）算
  const s = { pillarW: 62, date: 18, tn: 8, keyW: 64, title: 14, meta: 8, hl: 15 }
  for (let i = 0; i < n; i++) {
    addOppCard(w, calls[i], s)
    if (i < n - 1) w.addSpacer(GAP)
  }

  const rest = restText(calls, n)
  if (rest) { w.addSpacer(GAP); text(w, rest, 8, C.faint, "mono", 1) }

  if (n < 5 && !rest) w.addSpacer()    // 机会不足五个时，弹性空白把页脚推到底；满五个时卡片自己撑满，不需要
  w.addSpacer(GAP)
  rule(w)
  w.addSpacer(GAP)
  footer(w, data, state)
  return w
}

// ============================================================
// EXTRA LARGE · 3×2 网格，五个机会各占一格，第六格是刊头（写明总数）。XL 只会出现在 Mac 桌面上
// ============================================================
// 面积用 Mac 桌面上的实测值 701×342（横向）。
function extraLargeArea() {
  return { w: XL_AREA.w, h: XL_AREA.h }
}

// 一条自适应宽度的发丝线（放在横排里，把两端的字隔开）
function hairLine(parent) {
  const l = parent.addStack()
  l.size = new Size(0, 1)
  l.backgroundColor = new Color(C.hair)
  l.addSpacer()
}

// 超大号的一格：顶行「01/05 ── ● 展览」，然后是名称（大、粗）与副标题，日期 + T-n，一条线，底行关键数字。
// 名称与日期同等重要：名称 16pt 粗体、日期 32pt 斜体；不铺色块，只有红字。
function addGridCard(parent, item, cw, ch, idx, total) {
  const c = card(parent, cw, ch)       // 六个格子都是同一个等角圆角；文字距格边一律 INSET
  c.url = item.url || SITE_URL
  c.setPadding(INSET, INSET, INSET, INSET)
  const sc = Math.min(1, (ch - INSET * 2) / 130)

  const top = c.addStack()
  top.centerAlignContent()
  text(top, `${two(idx)}/${two(total)}`, 7.5, C.ink, "monob")
  top.addSpacer(6)
  hairLine(top)
  top.addSpacer(6)
  categoryTag(top, item, 7.5, C.ink)

  c.addSpacer(4)
  const parts = splitTitle(item.title)
  text(c, parts.title, Math.round(16 * sc), C.ink, "bold", 1)
  if (parts.subtitle) { c.addSpacer(1); text(c, parts.subtitle, 7.5, C.dim, "regular", 1) }

  c.addSpacer()
  const fig = c.addStack()
  fig.bottomAlignContent()
  text(fig, deadlineLabel(item), Math.round(32 * sc), C.ink, "didot")
  fig.addSpacer()
  const d = daysRemaining(item)
  daysPill(fig, d === null ? "TBA" : `T-${d} DAYS`, 7, 13)

  c.addSpacer(4)
  rule(c)
  c.addSpacer(4)
  const row = c.addStack()
  row.centerAlignContent()
  row.size = new Size(0, Math.round(1.22 * 18))          // 固定行高：各格底行才在同一条线上
  const hl = highlightOf(item)
  if (hl) {
    const spec = highlightSpec(hl.value, 18)
    text(row, hl.value, spec.size, spec.color || C.ink, spec.weight)
    if (hl.label) { row.addSpacer(6); text(row, hl.label, 7.5, C.dim, "mono", 1) }
  }
  row.addSpacer()
}

// 第六格：刊头。同一套骨架，红色超大总数写明一共几项
function addMastheadCell(parent, data, state, calls, hidden, cw, ch) {
  const cell = card(parent, cw, ch)
  cell.setPadding(INSET, INSET, INSET, INSET)
  const sc = Math.min(1, (ch - INSET * 2) / 130)
  const top = cell.addStack()
  top.centerAlignContent()
  text(top, "MEDIA ART", 7.5, C.ink, "monob")
  top.addSpacer(6)
  hairLine(top)
  top.addSpacer(6)
  text(top, "Radar", 11, C.ink, "didot")

  cell.addSpacer()
  text(cell, two(calls.length), Math.round(64 * sc), C.red, "didot")
  text(cell, "项机会 · OPEN CALLS", 8, C.dim, "mono")
  cell.addSpacer(4)
  rule(cell)
  cell.addSpacer(5)
  const foot = cell.addStack()
  foot.centerAlignContent()
  const fresh = state === "LIVE" && !isStale(data)
  text(foot, `${compactIssue(data.issue_id) || "—"} · ${statusText(state, data)}`, 7.5, fresh ? C.dim : C.soon, "mono")
  foot.addSpacer()
  if (hidden > 0) text(foot, `另有 ${hidden} 项`, 7.5, C.ink, "monob")
}

function buildExtraLarge(data, state) {
  const area = extraLargeArea()
  const iw = area.w - INSET * 2
  const ih = area.h - INSET * 2 - 1
  const cw = Math.floor((iw - GAP * 2) / 3)
  const ch = Math.floor((ih - GAP) / 2)
  const w = baseWidget(INSET)
  const calls = activeCalls(data.open_calls || [], "deadline")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); return w }

  const shown = calls.slice(0, 5)
  const hidden = calls.length - shown.length

  w.addSpacer()                      // 上下各一个弹性空白：组件比假定面积更大时，网格居中
  for (let r = 0; r < 2; r++) {
    const wrap = w.addStack()        // 居中：两侧弹性空白
    wrap.addSpacer()
    const line = wrap.addStack()
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c          // 0 是刊头，1–5 是五个机会
      if (c > 0) line.addSpacer(GAP)
      if (idx === 0) addMastheadCell(line, data, state, calls, hidden, cw, ch)
      else if (shown[idx - 1]) addGridCard(line, shown[idx - 1], cw, ch, idx, calls.length)
      else { const blank = line.addStack(); blank.size = new Size(cw, ch) }   // 不足五项时占位，保持对齐
    }
    wrap.addSpacer()
    if (r === 0) w.addSpacer(GAP)
  }
  w.addSpacer()
  return w
}

// ============================================================
// 公共件
// ============================================================
function footer(parent, data, state) {
  const row = parent.addStack()
  row.centerAlignContent()
  text(row, state === "OFFLINE" ? "等待首次同步" : `核验 ${numericDate(data.generated_at)}`, 8, C.faint, "mono")
  row.addSpacer()
  text(row, statusText(state, data), 8, state === "LIVE" && !isStale(data) ? C.faint : C.soon, "mono")
}

function addEmptyState(parent, state, compact = false) {
  text(parent, state === "OFFLINE" ? "等待首次同步" : "暂无开放机会", compact ? 13 : 16, C.ink, "semi")
  parent.addSpacer(4)
  text(parent, state === "OFFLINE" ? "联网后运行脚本" : "点击查看本期周刊", 9, C.dim, "mono", 2)
}

function isStale(data) {
  const updated = Date.parse(data.generated_at)
  return !Number.isFinite(updated) || Date.now() - updated > 8 * 86400000
}
function statusText(state, data) {
  if (state === "OFFLINE") return "离线"
  if (isStale(data)) return state === "CACHE" ? "缓存·待更新" : "待更新"
  return state === "CACHE" ? "离线缓存" : "已同步"
}
function numericDate(value) {
  const d = new Date(value)
  return isNaN(d) ? "—" : `${two(d.getMonth() + 1)}.${two(d.getDate())}`
}
function deadlineLabel(item) {
  // 保留发布方的日历日期，不因手机处在别的时区而整体挪动一天
  const raw = String(item.deadline_date || item.deadline_at || "")
  const match = raw.match(/^\d{4}-(\d{2})-(\d{2})/)
  return match ? `${match[1]}.${match[2]}` : "待定"
}
function compactPlace(value) {
  if (!value) return ""
  // 在分号、间隔号、逗号处截断，只留第一段：「西班牙 Bilbao，Palacio Euskalduna」→「西班牙 Bilbao」
  return String(value).split(/[；;·，,]/)[0].trim().slice(0, 22)
}
function validate(data) {
  if (!data || data.schema_version !== 1) throw new Error("Unsupported data format")
  if (!Array.isArray(data.open_calls)) throw new Error("Incomplete data")
}
function emptyPayload(error) {
  return { schema_version: 1, issue_id: "WAITING", generated_at: new Date(0).toISOString(),
    open_calls: [], radar: [], reminders: [], error: String(error) }
}

function activeCalls(items, order) {
  const now = Date.now()
  const active = items.filter(item => {
    const deadline = parseDeadline(item)
    if (!deadline) return true
    return deadline.getTime() > now
  })
  if (order !== "deadline") return active
  return active.sort((a, b) => {
    const da = parseDeadline(a), db = parseDeadline(b)
    return (da ? da.getTime() : Number.MAX_SAFE_INTEGER) - (db ? db.getTime() : Number.MAX_SAFE_INTEGER)
  })
}

function normalizedCategory(item) {
  const explicit = String(item.category || "").toLowerCase()
  if (CATEGORY[explicit]) return explicit
  // 兼容旧缓存：没有 category 时按标题和类型推断
  const t = `${item.title || ""} ${item.type || ""}`.toLowerCase()
  if (/residen|驻留|驻村/.test(t)) return "residency"
  if (/conference|symposium|cfp|paper|会议|论文/.test(t)) return "conference"
  if (/prize|award|奖项|大奖/.test(t)) return "prize"
  return "exhibition"
}
function categoryLabel(item, short) {
  const meta = CATEGORY[normalizedCategory(item)]
  return short ? meta.short : meta.full
}
function glyphOf(item) {
  return CATEGORY[normalizedCategory(item)].glyph
}

function parseDeadline(item) {
  const raw = item.deadline_at || item.deadline_date
  if (!raw) return null
  const simple = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (simple) return new Date(Number(simple[1]), Number(simple[2]) - 1, Number(simple[3]), 23, 59, 59)
  const d = new Date(raw)
  return isNaN(d) ? null : d
}
function daysRemaining(item) {
  const deadline = parseDeadline(item)
  if (!deadline) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000))
}

function splitTitle(value) {
  const original = value || "Untitled"
  const sep = original.indexOf("/")
  if (sep !== -1) return { title: original.slice(0, sep).trim(), subtitle: original.slice(sep + 1).trim() }
  return { title: original, subtitle: "" }
}
function compactIssue(value) {
  if (!value) return ""
  const m = String(value).match(/W\d+/i)
  return m ? m[0].toUpperCase() : String(value)
}
function two(value) { return String(value).padStart(2, "0") }
