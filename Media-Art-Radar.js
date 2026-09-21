// MEDIA ART RADAR · Edition 10（黑白 + 一个红）
// 与网站 site-v15 同一套语言：黑白为底 · 分类靠符号（● 展览 ○ 驻留 ◆ 奖项 ▲ 会议）
// 整体黑白、白为主，只有一个红：倒计时 T-n、关键数字、总数 · 每个机会是一张独立的黑描边卡 · 总数用大号数字写明 · 不标记「最近」
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

// 组件外框的圆角（iOS，估值 22pt）。贴着组件边角的形状，圆角取「外框半径 − 内边距」，与外框同心；
// 不贴边角的角，才用我们的异形圆角（tl / br 大，tr / bl 小）。内层圆角绝不大于外层，否则边角处会「鼓」出来。
const WIDGET_R = 22
function nest(pad) { return Math.max(WIDGET_R - pad, 4) }

// 异形圆角卡是一张固定尺寸的背景图，必须知道组件的真实点数。
// 表来自 Apple 的 iPhone 组件规格，按屏幕高度（pt）查。
// 注意：这个 const 必须写在下面的执行入口之前——const 不会提升，
// 放在入口之后会在中号、大号里触发 "before initialization" 而整块空白。
const WIDGET_SIZES = {
  956: { small: 170, mw: 364, lh: 382 },   // iPhone 16 / 17 Pro Max（440×956），按同档 6.9 英寸机型取值
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

// 圆角矩形，四个角半径各自指定 [左上, 右上, 右下, 左下]，可填色、可描边。
// 网站的卡片是「左上、右下大，右上、左下小」的异形圆角；日期块同样。
// Scriptable 的 stack 只支持四角等圆，所以画成固定尺寸的背景图——必须知道真实点数。
function shapeImage(w, h, r, fill, stroke, lw) {
  const k = 0.5523                      // 用三次贝塞尔逼近四分之一圆
  const inset = stroke ? lw / 2 : 0     // 内缩半个线宽，描边才不会被裁掉
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset
  const tl = r[0], tr = r[1], br = r[2], bl = r[3]
  const p = new Path()
  p.move(new Point(x0 + tl, y0))
  p.addLine(new Point(x1 - tr, y0))
  p.addCurve(new Point(x1, y0 + tr), new Point(x1 - tr + k * tr, y0), new Point(x1, y0 + tr - k * tr))
  p.addLine(new Point(x1, y1 - br))
  p.addCurve(new Point(x1 - br, y1), new Point(x1, y1 - br + k * br), new Point(x1 - br + k * br, y1))
  p.addLine(new Point(x0 + bl, y1))
  p.addCurve(new Point(x0, y1 - bl), new Point(x0 + bl - k * bl, y1), new Point(x0, y1 - bl + k * bl))
  p.addLine(new Point(x0, y0 + tl))
  p.addCurve(new Point(x0 + tl, y0), new Point(x0, y0 + tl - k * tl), new Point(x0 + tl - k * tl, y0))
  p.closeSubpath()

  const ctx = new DrawContext()
  ctx.size = new Size(w, h)
  ctx.opaque = false
  ctx.respectScreenScale = true
  if (fill) { ctx.setFillColor(new Color(fill)); ctx.addPath(p); ctx.fillPath() }
  if (stroke) { ctx.setStrokeColor(new Color(stroke)); ctx.setLineWidth(lw); ctx.addPath(p); ctx.strokePath() }
  return ctx.getImage()
}

// 一块固定尺寸的异形底；画图失败时退回等圆角，组件不会因此空白
function shapeStack(parent, w, h, r, fill, stroke, lw = 1.2) {
  const st = parent.addStack()
  st.layoutVertically()
  st.size = new Size(w, h)
  try {
    st.backgroundImage = shapeImage(w, h, r, fill, stroke, lw)
  } catch (_) {
    if (fill) st.backgroundColor = new Color(fill)
    if (stroke) { st.borderColor = new Color(stroke); st.borderWidth = lw }
    st.cornerRadius = Math.min(Math.max(r[0], r[1], r[2], r[3]), h / 2)
  }
  return st
}
// 网站的卡片：白底 + 墨黑描边 + 大小对角圆角
function cardShape(parent, w, h, big, small) {
  return shapeStack(parent, w, h, [big, small, big, small], C.card, C.ink, 1.2)
}
// 居中放一张
function makeCard(parent, w, h, big, small) {
  const row = parent.addStack()
  row.addSpacer()
  const card = cardShape(row, w, h, big, small)
  row.addSpacer()
  return card
}

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
// 日期柱 · 与网站机会卡同一条规则：白底，日期墨黑，T-n 红字；只写两样
// ============================================================
function pillar(parent, item, w, h, r, dateSize, tnSize) {
  const st = shapeStack(parent, w, h, r, null)
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
// 中号与大号共用；不主推任何一个，不写地点，不写「申请截止」——只留最要紧的三样。
function addOppCard(parent, item, s) {
  const r = s.r || [s.big, s.small, s.big, s.small]      // 四角半径：tl tr br bl
  const card = shapeStack(parent, s.w, s.h, r, C.card, C.ink, 1.2)
  card.url = item.url || SITE_URL
  card.layoutHorizontally()
  card.centerAlignContent()
  pillar(card, item, s.pillarW, s.h, [r[0], 0, 0, r[3]], s.date, s.tn)
  const bar = card.addStack()
  bar.size = new Size(1.2, s.h)
  bar.backgroundColor = new Color(C.ink)
  card.addSpacer(s.pad)
  const col = card.addStack()
  col.layoutVertically()
  col.size = new Size(s.colW, 0)
  text(col, splitTitle(item.title).title, s.title, C.ink, "bold", 1)
  col.addSpacer(3)
  text(col, `${glyphOf(item)} ${categoryLabel(item, true)}`, s.meta, C.dim, "monob", 1)
  card.addSpacer()
  keyColumn(card, item, s.keyW, s.hl, s.meta - 1)
  card.addSpacer(s.pad)
  return card
}

// 能放几行：先看全部能否放下，放不下再少放，并给「另有 n 项」那一行腾位置。
// 留 4pt 余量——这里的高度是估算，不是 iOS 的真实排版。
function fitRows(avail, rowH, gap, extra, total) {
  const need = n => n * rowH + (n - 1) * gap
  const room = avail - 4
  let n = total
  while (n > 1 && need(n) > room) n--
  if (n < total) { while (n > 1 && need(n) + extra > room) n-- }
  return Math.max(1, n)
}

// 放不下的机会压成一行小字：「另有 2 项 · 12.01 Wave Farm · 12.15 EMAF 40」
function restText(calls, shown, max = 3) {
  const hidden = calls.slice(shown)
  if (!hidden.length) return ""
  const names = hidden.slice(0, max).map(i => `${deadlineLabel(i)} ${splitTitle(i.title).title}`).join(" · ")
  return `另有 ${hidden.length} 项 · ${names}`
}

// ============================================================
// SMALL · 下一个截止：一块日期块（分类 · 巨型日期 · 倒计时）+ 标题与关键数字；右上角写明一共几项
// ============================================================
function buildSmall(data, state) {
  const pad = 10
  const m = widgetMetrics().small
  const cw = m.w - pad * 2
  const w = baseWidget(pad)
  const calls = activeCalls(data.open_calls || [], "deadline")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state, true); w.addSpacer(); return w }

  const item = calls[0]
  const panel = shapeStack(w, cw, 100, [nest(pad), nest(pad), nest(pad), 5], C.card, C.ink, 1.2)   // 上边两角贴组件边角：同心
  panel.url = item.url || SITE_URL
  panel.setPadding(10, 11, 9, 10)
  const top = panel.addStack()
  top.centerAlignContent()
  categoryTag(top, item, 7.5, C.ink)
  top.addSpacer()
  text(top, `共 ${two(calls.length)} 项`, 7.5, C.dim, "monob")
  panel.addSpacer()
  const fig = panel.addStack()
  fig.bottomAlignContent()
  text(fig, deadlineLabel(item), 41, C.ink, "didot")
  fig.addSpacer()
  const d = daysRemaining(item)
  daysPill(fig, d === null ? "TBA" : `T-${d}`, 8, 14)

  w.addSpacer(7)
  const body = w.addStack()
  body.layoutVertically()
  body.setPadding(0, 4, 0, 4)
  text(body, splitTitle(item.title).title, 12, C.ink, "bold", 1)
  body.addSpacer(3)
  const meta = body.addStack()
  meta.centerAlignContent()
  const fresh = state === "LIVE" && !isStale(data)
  text(meta, fresh ? "申请截止" : statusText(state, data), 8, fresh ? C.dim : C.soon, "mono")
  meta.addSpacer()
  const hl = highlightOf(item)
  if (hl) {
    const spec = highlightSpec(hl.value, 13)
    text(meta, hl.value, spec.size, spec.color || C.ink, spec.weight)
  }
  w.addSpacer()
  return w
}

// ============================================================
// MEDIUM · 左边一块黑色「总数」，右边三个机会，每个是一张独立的卡
// 总数：一共几项开放机会（大号数字）；放不下的写「另有 n 项」。
// ============================================================
function buildMedium(data, state) {
  const pad = 12
  const m = widgetMetrics().medium
  const w = baseWidget(pad)
  const calls = activeCalls(data.open_calls || [], "deadline")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); return w }

  const panelW = 74, gap = 10
  const innerH = m.h - pad * 2 - 2
  const listW = m.w - pad * 2 - panelW - gap
  const tight = listW < 240              // 小屏机型：日期柱与数字列收窄，把宽度让给标题
  const pw = tight ? 46 : 52, kw = tight ? 46 : 58
  const s = { w: listW, h: 44, big: 14, small: 5, pillarW: pw, date: tight ? 15 : 17, tn: 7.5, pad: 8,
    colW: listW - pw - 1.2 - 8 - kw - 8 - 4, keyW: kw, title: 10.5, meta: 7.5, hl: tight ? 14 : 16 }
  const rgap = 4
  const n = fitRows(innerH, s.h, rgap, 0, calls.length)

  const outer = w.addStack()
  outer.layoutHorizontally()

  const cr = nest(pad)                  // 贴着组件边角的那些角
  const panel = shapeStack(outer, panelW, innerH, [cr, 5, 14, cr], C.card, C.ink, 1.2)   // 左上、左下贴边；右侧两角在内部；白底描边，不用黑块
  panel.setPadding(10, 9, 9, 8)
  text(panel, compactIssue(data.issue_id) || "—", 7, C.ink, "monob")
  panel.addSpacer()
  text(panel, two(calls.length), 46, C.red, "didot")
  text(panel, "项机会", 7.5, C.dim, "mono")
  panel.addSpacer(6)
  const fresh = state === "LIVE" && !isStale(data)
  const hidden = calls.length - n
  if (hidden > 0) text(panel, `另有 ${hidden} 项`, 7, C.ink, "monob")
  else text(panel, statusText(state, data), 7, fresh ? C.dim : C.soon, "mono")

  outer.addSpacer(gap)
  const list = outer.addStack()
  list.layoutVertically()
  for (let i = 0; i < n; i++) {
    const touchBottom = n * s.h + (n - 1) * rgap >= innerH - 4
    const r = [s.big, i === 0 ? cr : s.small, i === n - 1 && touchBottom ? cr : s.big, s.small]
    addOppCard(list, calls[i], Object.assign({}, s, { r }))
    if (i < n - 1) list.addSpacer(rgap)
  }
  return w
}

// ============================================================
// LARGE · 刊头写明总数，下面五张同样的卡
// ============================================================
function addMasthead(parent, data, calls) {
  const top = parent.addStack()
  top.bottomAlignContent()
  text(top, "MEDIA ART", 10, C.ink, "bold")
  top.addSpacer(6)
  text(top, "Radar ↗", 18, C.ink, "didot")
  top.addSpacer()
  text(top, two(calls.length), 26, C.red, "didot")
  top.addSpacer(4)
  const unit = top.addStack()
  unit.layoutVertically()
  text(unit, "项机会", 8.5, C.ink, "monob")
  text(unit, compactIssue(data.issue_id) || "—", 7.5, C.dim, "mono")
  unit.addSpacer(2)
  parent.addSpacer(8)
}

function buildLarge(data, state) {
  const pad = 14
  const m = widgetMetrics().large
  const cw = m.w - pad * 2
  const w = baseWidget(pad)
  const calls = activeCalls(data.open_calls || [], "deadline")

  addMasthead(w, data, calls)
  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); footer(w, data, state); return w }

  const gap = 5
  const tight = cw < 320
  const pw = tight ? 62 : 72, kw = tight ? 64 : 80
  const s = { w: cw, h: 54, big: 18, small: 5, pillarW: pw, date: tight ? 19 : 21, tn: 8, pad: 10,
    colW: cw - pw - 1.2 - 10 - kw - 10 - 4, keyW: kw, title: 12.5, meta: 8, hl: tight ? 15 : 17 }
  const extra = 17                     // 「另有 n 项」小字行 + 与上面的间距
  const head = 38, foot = 17           // 刊头（30+8）与页脚（线 + 间距 + 一行字）
  const n = fitRows(m.h - pad * 2 - head - foot, s.h, gap, extra, calls.length)
  for (let i = 0; i < n; i++) {
    addOppCard(w, calls[i], s)
    if (i < n - 1) w.addSpacer(gap)
  }

  const rest = restText(calls, n)
  if (rest) { w.addSpacer(7); text(w, rest, 8, C.faint, "mono", 1) }

  w.addSpacer()
  rule(w)
  w.addSpacer(6)
  footer(w, data, state)
  return w
}

// ============================================================
// EXTRA LARGE · iPad / Mac 的超大组件：3×2 网格，五个机会各占一格，第六格是刊头（写明总数）
// ============================================================
// 异形卡是固定尺寸的图，必须先假定组件面积。Mac 与 iPad 超大组件的点数我没有官方数据可核对，
// 所以按屏幕大小保守假定：大屏（Mac、11 / 12.9 英寸 iPad）取 700×340，小 iPad 取 640×304。
// 真实面积更大时，网格居中，多出来的只是留白；不会溢出。
function extraLargeArea() {
  let longest = 0
  try { const s = Device.screenSize(); longest = Math.max(s.width, s.height) } catch (_) {}
  return longest >= 1180 ? { w: 700, h: 340 } : { w: 640, h: 304 }
}

// 3×2 网格里 6 个格子的四角半径：位于组件四个角上的格子，对应那个角取同心半径
function gridRadii(idx) {
  const big = 22, small = 6, cc = nest(14)
  const r = [big, small, big, small]
  if (idx === 0) r[0] = cc      // 左上
  if (idx === 2) r[1] = cc      // 右上
  if (idx === 3) r[3] = cc      // 左下
  if (idx === 5) r[2] = cc      // 右下
  return r
}

function addGridCard(parent, item, cw, ch, r) {
  const card = shapeStack(parent, cw, ch, r, C.card, C.ink, 1.2)
  card.url = item.url || SITE_URL
  card.setPadding(8, 8, 8, 8)
  const iw = cw - 16

  const panelH = ch - 16 - 51           // 下面留 51pt：标题 15 + 间距 + 关键数字一行 + 余量
  const panel = shapeStack(card, iw, panelH, r.map(v => Math.max(v - 8, 4)), C.card, C.ink, 1.2)   // 与外格同心：外格半径 − 内边距 8
  panel.setPadding(8, 11, 8, 10)
  const top = panel.addStack()
  top.centerAlignContent()
  categoryTag(top, item, 7.5, C.ink)
  top.addSpacer()
  panel.addSpacer()
  const fig = panel.addStack()
  fig.bottomAlignContent()
  text(fig, deadlineLabel(item), 38, C.ink, "didot")
  fig.addSpacer()
  const d = daysRemaining(item)
  daysPill(fig, d === null ? "TBA" : `T-${d} DAYS`, 7, 13)

  card.addSpacer(6)
  const body = card.addStack()
  body.layoutVertically()
  body.setPadding(0, 4, 0, 4)
  text(body, splitTitle(item.title).title, 12, C.ink, "bold", 1)
  body.addSpacer(2)
  const meta = body.addStack()
  meta.centerAlignContent()
  const hl = highlightOf(item)
  if (hl) {
    const spec = highlightSpec(hl.value, 14)
    text(meta, hl.value, spec.size, spec.color || C.ink, spec.weight)
    if (hl.label) { meta.addSpacer(5); text(meta, hl.label, 7, C.dim, "mono", 1) }
  }
  meta.addSpacer()
}

// 第六格：刊头。白底黑描边，与五张卡同一个异形圆角；红色大号数字写明一共几项（不用黑块）
function addMastheadCell(parent, data, state, calls, hidden, cw, ch) {
  const cell = shapeStack(parent, cw, ch, gridRadii(0), C.card, C.ink, 1.2)
  cell.setPadding(14, 16, 12, 14)
  text(cell, "MEDIA ART", 9, C.ink, "bold")
  text(cell, "Radar ↗", 20, C.ink, "didot")
  cell.addSpacer()
  text(cell, two(calls.length), 40, C.red, "didot")
  text(cell, "项机会 · OPEN CALLS", 8, C.dim, "mono")
  cell.addSpacer(4)
  const fresh = state === "LIVE" && !isStale(data)
  text(cell, `${compactIssue(data.issue_id) || "—"} · ${statusText(state, data)}`, 8, fresh ? C.dim : C.soon, "mono")
  if (hidden > 0) {
    cell.addSpacer(2)
    text(cell, `另有 ${hidden} 项 · 点击查看 ↗`, 8, C.ink, "monob")
  }
}

function buildExtraLarge(data, state) {
  const area = extraLargeArea()
  const pad = 14, gap = 10
  const cw = Math.floor((area.w - pad * 2 - gap * 2) / 3)
  const ch = Math.floor((area.h - pad * 2 - gap) / 2)
  const w = baseWidget(pad)
  const calls = activeCalls(data.open_calls || [], "deadline")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); return w }

  const shown = calls.slice(0, 5)
  const hidden = calls.length - shown.length

  w.addSpacer()                      // 上下各一个弹性空白：设备比假定面积更大时，网格居中
  for (let r = 0; r < 2; r++) {
    const wrap = w.addStack()        // 居中：两侧弹性空白
    wrap.addSpacer()
    const line = wrap.addStack()
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c          // 0 是刊头，1–5 是五个机会
      if (c > 0) line.addSpacer(gap)
      if (idx === 0) addMastheadCell(line, data, state, calls, hidden, cw, ch)
      else if (shown[idx - 1]) addGridCard(line, shown[idx - 1], cw, ch, gridRadii(idx))
      else { const blank = line.addStack(); blank.size = new Size(cw, ch) }   // 不足五项时占位，保持对齐
    }
    wrap.addSpacer()
    if (r === 0) w.addSpacer(gap)
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
  text(parent, state === "OFFLINE" ? "联网后运行脚本" : "点击查看本期周刊 ↗", 9, C.dim, "mono", 2)
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
