// MEDIA ART RADAR · Edition 07
// 与主页同一套视觉：纸白底 · 异形圆角卡 · 巨型斜体日期 · 分类色只用在一处
// Scriptable Home Screen widgets：small / medium / large
// 更新已有组件：将本文件完整替换进原 Scriptable 脚本，保存并运行一次。

const DATA_URL = "https://zijianchenart.github.io/media-art-reader/latest.json"
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const CACHE_NAME = "media-art-radar-latest.json"
const REFRESH_MINUTES = 60
// 在 Scriptable 内预览时改为 small / medium / large / extraLarge；桌面会自动识别尺寸。
const PREVIEW_FAMILY = "large"

// 与主页 style.css 的变量一一对应。改这里之前先改主页，保持两边一致。
const C = {
  paper: "#FFFFFF", card: "#FFFFFF", ink: "#050505",
  dim: "#717176", faint: "#9A9AA0", hair: "#D5D5D7", mute: "#B9B9BF",
  exhibition: "#1479E8", residency: "#FFB314", prize: "#FF5B22", conference: "#0BB64A",
  soon: "#DE2410"
}
const SOON_DAYS = 14       // 与 status.js 的阈值一致

// 异形圆角卡是一张固定尺寸的背景图，必须知道组件的真实点数。
// 表来自 Apple 的 iPhone 组件规格，按屏幕高度（pt）查。
// 注意：这个 const 必须写在下面的执行入口之前——const 不会提升，
// 放在入口之后会在中号、大号里触发 "before initialization" 而整块空白。
const WIDGET_SIZES = {
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
  exhibition: { short: "展览", full: "展览征集", color: C.exhibition },
  residency:  { short: "驻留", full: "驻留",     color: C.residency },
  prize:      { short: "奖项", full: "奖项",     color: C.prize },
  conference: { short: "会议", full: "学术会议", color: C.conference }
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
  wd.backgroundColor = new Color(C.paper)   // 纯纸白，不叠点阵：桌面壁纸各不相同，底纹只会变脏
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

// 异形圆角：左上、右下大，右上、左下小 —— 与主页 border-radius:30px 6px 30px 6px 同一个形状。
// Scriptable 的 stack 只支持四角等圆，所以用 DrawContext 把整张卡画成背景图。
function cardImage(w, h, big, small) {
  const k = 0.5523                      // 用三次贝塞尔逼近四分之一圆
  const x0 = 0.5, y0 = 0.5, x1 = w - 0.5, y1 = h - 0.5   // 内缩半像素，描边不会被裁
  const tl = big, tr = small, br = big, bl = small
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
  ctx.setFillColor(new Color(C.card))
  ctx.addPath(p)
  ctx.fillPath()
  ctx.setStrokeColor(new Color(C.hair))
  ctx.setLineWidth(1)
  ctx.addPath(p)
  ctx.strokePath()
  return ctx.getImage()
}

// 一张固定尺寸的异形卡；画图失败时退回等圆角，组件不会因此空白
function cardStack(parent, w, h, big, small) {
  const card = parent.addStack()
  card.layoutVertically()
  card.size = new Size(w, h)
  try {
    card.backgroundImage = cardImage(w, h, big, small)
  } catch (_) {
    card.backgroundColor = new Color(C.card)
    card.cornerRadius = Math.min(big, h / 2)
  }
  return card
}
// 居中放一张
function makeCard(parent, w, h, big, small) {
  const row = parent.addStack()
  row.addSpacer()
  const card = cardStack(row, w, h, big, small)
  row.addSpacer()
  return card
}

// ============================================================
// 数据 → 展示（规则与主页 status.js / style.css 一致）
// ============================================================
function isSoon(item) {
  const d = daysRemaining(item)
  return d !== null && d <= SOON_DAYS
}
// 主页规则：日期默认墨黑，14 天内才变红，不再按分类上色
function dateColor(item) { return isSoon(item) ? C.soon : C.ink }

function daysLabel(item) {
  const d = daysRemaining(item)
  return d === null ? "日期待定" : d === 0 ? "今日截止" : `T-${d} DAYS`
}
// 「T-8 DAYS 申请截止」：倒计时加粗，说明降为灰色
function daysLine(parent, item, size) {
  const row = parent.addStack()
  row.centerAlignContent()
  text(row, daysLabel(item), size, isSoon(item) ? C.soon : C.ink, "monob")
  row.addSpacer(5)
  text(row, "申请截止", size - 0.5, C.dim, "mono")
}

// 关键数字：与主页三档字号一致——短的最大，4 字符以上缩小，纯中文变灰
function highlightOf(item) {
  const v = item.highlight
  if (!v) return null
  return { value: String(v), label: String(item.highlight_label || "") }
}
function highlightSpec(value, base) {
  if (!/\d/.test(value)) return { size: base * 0.5, weight: "medium", color: C.mute }
  if (value.length >= 4) return { size: base * 0.68, weight: "didot", color: null }
  return { size: base, weight: "didot", color: null }
}
function addHighlight(parent, item, base, withLabel = true) {
  const hl = highlightOf(item)
  if (!hl) return
  const spec = highlightSpec(hl.value, base)
  const col = parent.addStack()
  col.layoutVertically()
  text(col, hl.value, spec.size, spec.color || categoryColor(item), spec.weight).rightAlignText()
  if (withLabel && hl.label) {
    col.addSpacer(2)
    text(col, hl.label, 7.5, C.dim, "mono").rightAlignText()
  }
}

// 索引行：分类色短标签 · 日期 · 标题 · 倒计时
function indexRow(parent, item, size) {
  const row = parent.addStack()
  row.centerAlignContent()
  row.url = item.url || SITE_URL
  text(row, categoryLabel(item, true), size - 1.5, categoryColor(item), "monob")
  row.addSpacer(7)
  text(row, deadlineLabel(item), size, C.ink, "mono")
  row.addSpacer(8)
  text(row, splitTitle(item.title).title, size - 0.5, C.dim, "regular", 1)
  row.addSpacer()
  const d = daysRemaining(item)
  text(row, d === null ? "—" : `T-${d}`, size - 1.5, C.faint, "mono")
}

// ============================================================
// SMALL · 与网页预览一致：只回答“下一个截止”
// ============================================================
function buildSmall(data, state) {
  const w = baseWidget(13)
  const calls = activeCalls(data.open_calls || [], "deadline")

  const top = w.addStack()
  top.centerAlignContent()
  text(top, "MAR ↗", 8, C.ink, "monob")
  top.addSpacer()
  text(top, compactIssue(data.issue_id) || "—", 8, C.dim, "mono")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state, true); w.addSpacer(); return w }

  const item = calls[0]
  const ms = widgetMetrics().small.w
  const dateSize = ms >= 165 ? 50 : 46

  w.addSpacer()
  text(w, deadlineLabel(item), dateSize, dateColor(item), "didot")
  w.addSpacer(2)
  text(w, splitTitle(item.title).title, 11.5, C.ink, "bold", 1)
  w.addSpacer(3)
  text(w, daysLabel(item), 8.5, isSoon(item) ? C.soon : C.dim, "monob")
  w.addSpacer()
  return w
}

// ============================================================
// WEB-PREVIEW ROW · 日期 / 标题 / 关键数字 + 分类 / 地点 / 倒计时
// ============================================================
function addPreviewRow(parent, item, spec) {
  const block = parent.addStack()
  block.layoutVertically()
  block.url = item.url || SITE_URL

  const r1 = block.addStack()
  r1.centerAlignContent()

  const dbox = r1.addStack()
  dbox.size = new Size(spec.dateW, 0)
  text(dbox, deadlineLabel(item), spec.date, dateColor(item), "didot")

  r1.addSpacer(5)
  text(r1, splitTitle(item.title).title, spec.title, C.ink, "bold", 1)
  r1.addSpacer()
  addHighlight(r1, item, spec.hl, false)

  block.addSpacer(1)

  const r2 = block.addStack()
  r2.centerAlignContent()

  const blank = r2.addStack()
  blank.size = new Size(spec.dateW, 0)
  r2.addSpacer(5)

  text(r2, categoryLabel(item, true), spec.meta, categoryColor(item), "monob")
  r2.addSpacer(5)
  text(r2, compactPlace(item.location), spec.meta, C.dim, "mono", 1)
  r2.addSpacer()

  const d = daysRemaining(item)
  text(r2, d === null ? "—" : `T-${d}`, spec.meta, isSoon(item) ? C.soon : C.ink, "monob")
  if (item.highlight_label) {
    r2.addSpacer(5)
    text(r2, item.highlight_label, spec.meta, C.dim, "mono", 1)
  }
}

// ============================================================
// MEDIUM · 四个机会，每个机会完全同权
// ============================================================
function buildMedium(data, state) {
  const w = baseWidget(12)
  const calls = activeCalls(data.open_calls || [], "deadline")
  const m = widgetMetrics().medium

  const top = w.addStack()
  top.centerAlignContent()
  text(top, "MEDIA ART RADAR", 8.5, C.ink, "monob")
  top.addSpacer()
  const fresh = state === "LIVE" && !isStale(data)
  text(top, `${compactIssue(data.issue_id) || "—"} · ${statusText(state, data)}`, 8, fresh ? C.dim : C.soon, "mono")
  w.addSpacer(5)

  if (!calls.length) { rule(w, C.ink); w.addSpacer(); addEmptyState(w, state); w.addSpacer(); return w }

  const tight = m.h < 165
  const spec = tight
    ? { dateW: 34, date: 12, title: 9, hl: 10.5, meta: 6.3 }
    : { dateW: 36, date: 13.5, title: 10, hl: 12, meta: 7 }

  const shown = calls.slice(0, 4)
  shown.forEach((item, i) => {
    addPreviewRow(w, item, spec)
    if (i < shown.length - 1) w.addSpacer(tight ? 2 : 3)
  })

  w.addSpacer()
  const foot = w.addStack()
  const hidden = calls.length - shown.length
  if (hidden > 0) {
    text(foot, `另有 ${hidden} 项`, 7, C.dim, "mono")
  }
  foot.addSpacer()
  text(foot, `${compactIssue(data.issue_id) || "—"} · ${statusText(state, data)}`, 7, C.dim, "mono")
  return w
}

// ============================================================
// LARGE · 刊头 + 五张等权信息卡
// ============================================================
function buildLarge(data, state) {
  const pad = 14
  const w = baseWidget(pad)
  const calls = activeCalls(data.open_calls || [], "deadline")
  const m = widgetMetrics().large
  const cw = m.w - pad * 2

  const mast = w.addStack()
  mast.bottomAlignContent()
  text(mast, "MEDIA ART", 10, C.ink, "bold")
  mast.addSpacer(6)
  text(mast, "Radar ↗", 18, C.ink, "didot")
  mast.addSpacer()
  text(mast, `${compactIssue(data.issue_id) || "—"} · ${two(calls.length)} 项机会`, 8.5, C.dim, "mono")
  w.addSpacer(8)

  if (!calls.length) { addEmptyState(w, state); return w }

  const cardH = m.h >= 350 ? 54 : 47
  const tight = cardH < 50
  const spec = tight
    ? { dateW: 45, date: 16, title: 10, hl: 13, meta: 6.6 }
    : { dateW: 50, date: 19, title: 12, hl: 16, meta: 7.5 }

  calls.slice(0, 5).forEach((item, i) => {
    const card = makeCard(w, cw, cardH, 16, 4)
    card.setPadding(tight ? 6 : 8, tight ? 11 : 14, tight ? 6 : 8, tight ? 11 : 14)
    addPreviewRow(card, item, spec)
    if (i < Math.min(calls.length, 5) - 1) w.addSpacer(tight ? 3 : 5)
  })

  w.addSpacer()
  return w
}

// ============================================================
// EXTRA LARGE · 3×2：五个机会 + 最后一格刊头
// ============================================================
function extraLargeArea() {
  let longest = 0
  try { const s = Device.screenSize(); longest = Math.max(s.width, s.height) } catch (_) {}
  return longest >= 1180 ? { w: 700, h: 340 } : { w: 640, h: 304 }
}

function addPreviewGridCell(parent, item, cw, ch) {
  const card = cardStack(parent, cw, ch, 20, 4)
  card.setPadding(9, 12, 9, 12)
  card.url = item.url || SITE_URL

  const meta = card.addStack()
  meta.centerAlignContent()
  text(meta, categoryLabel(item, false), 7.5, categoryColor(item), "monob")
  meta.addSpacer()
  const d = daysRemaining(item)
  text(meta, d === null ? "—" : `T-${d}`, 7.5, isSoon(item) ? C.soon : C.ink, "monob")

  card.addSpacer()

  text(card, deadlineLabel(item), 30, dateColor(item), "didot")
  card.addSpacer(5)
  text(card, splitTitle(item.title).title, 11, C.ink, "bold", 1)
  card.addSpacer(3)

  const foot = card.addStack()
  addHighlight(foot, item, 13, false)
  foot.addSpacer()
  text(foot, compactPlace(item.location), 7.5, C.dim, "mono", 1)
}

function addPreviewMastheadCell(parent, data, state, calls, cw, ch) {
  const cell = parent.addStack()
  cell.layoutVertically()
  cell.size = new Size(cw, ch)
  cell.setPadding(0, 4, 4, 4)

  rule(cell, C.ink)
  cell.addSpacer(9)
  text(cell, "MEDIA ART", 11, C.ink, "bold")
  text(cell, "Radar ↗", 26, C.ink, "didot")
  cell.addSpacer()
  text(cell, compactIssue(data.issue_id) || "—", 10, C.ink, "monob")
  cell.addSpacer(2)
  text(cell, `${two(calls.length)} 项机会`, 8.5, C.dim, "mono")
  cell.addSpacer(2)
  text(cell, `${statusText(state, data)}`, 8, C.faint, "mono")
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

  w.addSpacer()
  for (let r = 0; r < 2; r++) {
    const wrap = w.addStack()
    wrap.addSpacer()
    const line = wrap.addStack()

    for (let c = 0; c < 3; c++) {
      if (c > 0) line.addSpacer(gap)
      const idx = r * 3 + c

      if (idx < 5 && shown[idx]) {
        addPreviewGridCell(line, shown[idx], cw, ch)
      } else if (idx === 5) {
        addPreviewMastheadCell(line, data, state, calls, cw, ch)
      } else {
        const blank = line.addStack()
        blank.size = new Size(cw, ch)
      }
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
  return String(value).split(/[；;·]/)[0].trim().slice(0, 16)
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
function categoryColor(item) {
  return CATEGORY[normalizedCategory(item)].color
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
