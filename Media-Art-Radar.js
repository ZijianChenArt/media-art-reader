// MEDIA ART RADAR · Edition 03
// 纸白底 · 点阵肌理 · Didot 斜体大日期 · 分类色只用在一处
// Scriptable Home Screen widgets：small / medium / large
// 更新已有组件：将本文件完整替换进原 Scriptable 脚本，保存并运行一次。

const DATA_URL = "https://zijianchenart.github.io/media-art-reader/latest.json"
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const CACHE_NAME = "media-art-radar-latest.json"
const REFRESH_MINUTES = 60
// 在 Scriptable 内预览时改为 small / medium / large；桌面会自动识别尺寸。
const PREVIEW_FAMILY = "large"

const C = {
  paper: "#F4F4F4", card: "#FFFFFF", ink: "#040404",
  dim: "#5F5F5F", faint: "#9A9AA0", hair: "#E2E2E6",
  ex: "#DE2410",   // 展览征集
  re: "#1B3FD8",   // 驻留
  pz: "#7A3FD8",   // 奖项
  cf: "#0D7A52"    // 学术会议
}
const CATEGORY_ORDER = ["exhibition", "residency", "prize", "conference"]
const CATEGORY = {
  exhibition: { label: "展览", full: "展览征集", color: C.ex },
  residency:  { label: "驻留", full: "驻留",     color: C.re },
  prize:      { label: "奖项", full: "奖项",     color: C.pz },
  conference: { label: "会议", full: "学术会议", color: C.cf }
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
  : buildMedium(payload, source)
widget.url = SITE_URL
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60000)
if (config.runsInWidget) Script.setWidget(widget)
else if (family === "small") await widget.presentSmall()
else if (family === "large") await widget.presentLarge()
else await widget.presentMedium()
Script.complete()

// ============================================================
// 基础件
// ============================================================

function baseWidget(padding) {
  const wd = new ListWidget()
  wd.backgroundColor = new Color(C.paper)   // 纯纸白，不再叠点阵
  wd.setPadding(padding, padding, padding, padding)
  return wd
}

// 字体三层：Didot 斜体管日期 / 等宽管数据 / 系统字管标题正文
function didot(size) { return new Font("Didot-Italic", size) }
function mono(size)  { return Font.mediumMonospacedSystemFont(size) }

function text(parent, value, size, color = C.ink, weight = "regular", lines = 1) {
  const t = parent.addText(String(value))
  t.font = weight === "bold" ? Font.boldSystemFont(size)
    : weight === "semi" ? Font.semiboldSystemFont(size)
    : weight === "mono" ? mono(size)
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

// 分类圆点：全组件唯一的彩色
function categoryDot(parent, item, d = 5) {
  const dot = parent.addStack()
  dot.size = new Size(d, d)
  dot.cornerRadius = d / 2
  dot.backgroundColor = categoryColor(item)
}

// 索引条目：第一行日期+标题+倒计时，第二行分类+地点
function indexRow(parent, item, twoLine) {
  const row = parent.addStack()
  row.centerAlignContent()
  row.url = item.url || SITE_URL
  categoryDot(row, item, 4)
  row.addSpacer(8)
  text(row, deadlineLabel(item), twoLine ? 11 : 10, C.ink, "mono")
  row.addSpacer(9)
  const mid = row.addStack()
  mid.layoutVertically()
  text(mid, splitTitle(item.title).title, twoLine ? 10.5 : 9.5, C.dim, "regular", 1)
  if (twoLine) {
    mid.addSpacer(2)
    const sub = `${categoryLabel(item, false)} · ${compactPlace(item.location)}`
    text(mid, sub, 8, C.faint, "mono", 1)
  }
  row.addSpacer()
  const d = daysRemaining(item)
  text(row, d === null ? "—" : `T-${d}`, twoLine ? 9 : 8.5, C.faint, "mono")
}

// ============================================================
// SMALL · 一个巨大的日期，其余全部让路
// ============================================================
function buildSmall(data, state) {
  const w = baseWidget(13)
  const calls = activeCalls(data.open_calls || [], "deadline")

  const top = w.addStack()
  top.centerAlignContent()
  text(top, "MAR ↗", 8, C.dim, "mono")
  top.addSpacer()
  text(top, compactIssue(data.issue_id) || "—", 8, C.dim, "mono")

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state, true); w.addSpacer(); return w }

  const item = calls[0]
  const days = daysRemaining(item)

  w.addSpacer()
  // 日期占满宽度，是这个尺寸唯一的主角
  text(w, deadlineLabel(item), 46, categoryColor(item), "didot")
  w.addSpacer(3)
  text(w, days === null ? "日期待定" : days === 0 ? "今日截止" : `T-${days} DAYS`, 8.5, C.ink, "mono")
  w.addSpacer(7)
  text(w, splitTitle(item.title).title, 11.5, C.ink, "semi", 2)
  w.addSpacer()

  rule(w)
  w.addSpacer(6)
  const foot = w.addStack()
  foot.centerAlignContent()
  categoryDot(foot, item, 4)
  foot.addSpacer(5)
  text(foot, categoryLabel(item, false), 7.5, C.dim, "mono")
  foot.addSpacer()
  text(foot, statusText(state, data), 7.5, state === "LIVE" && !isStale(data) ? C.faint : C.ex, "mono")
  return w
}

// ============================================================
// MEDIUM · 四个机会：首项强调，其余三项索引
// ============================================================
function buildMedium(data, state) {
  const w = baseWidget(12)
  const calls = activeCalls(data.open_calls || [], "deadline")

  const top = w.addStack()
  top.centerAlignContent()
  text(top, "MEDIA ART RADAR", 8.5, C.dim, "mono")
  top.addSpacer()
  text(top, compactIssue(data.issue_id) || "—", 8.5, C.ink, "mono")
  w.addSpacer(5)
  rule(w, C.ink)
  w.addSpacer(7)

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); footer(w, data, state); return w }

  // 首项：日期用 Didot 放大并上分类色
  const item = calls[0]
  const lead = w.addStack()
  lead.centerAlignContent()
  lead.url = item.url || SITE_URL
  categoryDot(lead, item, 5)
  lead.addSpacer(7)
  text(lead, deadlineLabel(item), 21, categoryColor(item), "didot")
  lead.addSpacer(9)
  text(lead, splitTitle(item.title).title, 11, C.ink, "semi", 1)
  lead.addSpacer()
  const ld = daysRemaining(item)
  text(lead, ld === null ? "—" : `T-${ld}`, 9.5, categoryColor(item), "mono")

  w.addSpacer(6)
  rule(w)
  w.addSpacer(6)

  const rest = calls.slice(1, 4)
  rest.forEach((next, i) => {
    indexRow(w, next, false)
    if (i < rest.length - 1) w.addSpacer(5)
  })

  w.addSpacer()
  footer(w, data, state)
  return w
}

// ============================================================
// LARGE · 头条一张大卡，下面是索引
// ============================================================
function buildLarge(data, state) {
  const w = baseWidget(14)
  const calls = activeCalls(data.open_calls || [], "deadline")

  // 刊头
  const top = w.addStack()
  top.bottomAlignContent()
  const name = top.addStack()
  name.layoutVertically()
  text(name, "MEDIA ART", 10, C.ink, "bold")
  text(name, "Radar ↗", 21, C.ink, "didot")
  top.addSpacer()
  const meta = top.addStack()
  meta.layoutVertically()
  text(meta, compactIssue(data.issue_id) || "—", 9.5, C.ink, "mono").rightAlignText()
  meta.addSpacer(2)
  text(meta, `${two(calls.length)} 项机会`, 8.5, C.dim, "mono").rightAlignText()

  w.addSpacer(10)
  rule(w, C.ink)

  if (!calls.length) { w.addSpacer(); addEmptyState(w, state); w.addSpacer(); footer(w, data, state); return w }

  // 头条：最近截止的那一项做成白卡
  const hero = w.addStack()
  hero.layoutVertically()
  hero.setPadding(11, 13, 11, 13)
  hero.cornerRadius = 15
  hero.backgroundColor = new Color(C.card)
  hero.url = calls[0].url || SITE_URL
  w.addSpacer(11)

  const item = calls[0]
  const days = daysRemaining(item)

  const hMeta = hero.addStack()
  hMeta.centerAlignContent()
  categoryDot(hMeta, item, 5)
  hMeta.addSpacer(6)
  text(hMeta, categoryLabel(item, false), 8, categoryColor(item), "mono")
  hMeta.addSpacer(8)
  text(hMeta, compactPlace(item.location), 8, C.dim, "mono", 1)
  hero.addSpacer(6)
  text(hero, splitTitle(item.title).title, 14.5, C.ink, "bold", 2)
  hero.addSpacer(9)

  const hFig = hero.addStack()
  hFig.bottomAlignContent()
  const dCol = hFig.addStack()
  dCol.layoutVertically()
  text(dCol, deadlineLabel(item), 34, categoryColor(item), "didot")
  dCol.addSpacer(3)
  text(dCol, days === null ? "日期待定" : days === 0 ? "今日截止" : `T-${days} DAYS`, 8, C.dim, "mono")
  hFig.addSpacer()
  // 有 highlight 字段就把它当作那个"疯狂的数字"，没有就留空
  const hl = highlightOf(item)
  if (hl) {
    const kCol = hFig.addStack()
    kCol.layoutVertically()
    text(kCol, hl.value, 26, categoryColor(item), "didot").rightAlignText()
    kCol.addSpacer(4)
    text(kCol, hl.label, 7.5, C.dim, "mono").rightAlignText()
  }

  w.addSpacer(12)

  // 索引：其余各项
  const rest = calls.slice(1, 5)
  rest.forEach((next, i) => {
    indexRow(w, next, false)
    if (i < rest.length - 1) { w.addSpacer(5); rule(w); w.addSpacer(5) }
  })

  w.addSpacer()
  if (calls.length > 5) {
    text(w, `另有 ${calls.length - 5} 项 · 点击查看全部 ↗`, 8.5, C.dim, "mono")
    w.addSpacer(6)
  }
  rule(w)
  w.addSpacer(7)
  footer(w, data, state)
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
  text(row, statusText(state, data), 8, state === "LIVE" && !isStale(data) ? C.faint : C.ex, "mono")
}

function addEmptyState(parent, state, compact = false) {
  text(parent, state === "OFFLINE" ? "等待首次同步" : "暂无开放机会", compact ? 13 : 16, C.ink, "semi")
  parent.addSpacer(4)
  text(parent, state === "OFFLINE" ? "联网后运行脚本" : "点击查看本期周刊 ↗", 9, C.dim, "mono", 2)
}

// latest.json 若提供 highlight / highlight_label 就用，没有则不显示
function highlightOf(item) {
  const v = item.highlight
  if (!v) return null
  return { value: String(v), label: String(item.highlight_label || "") }
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
  return short ? meta.label : meta.full
}
function categoryColor(item) {
  return new Color(CATEGORY[normalizedCategory(item)].color)
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
function compactType(value) {
  if (!value) return "MEDIA ART"
  return String(value)
    .replace(/驻留与/g, "").replace(/艺术节作品征集：/g, "")
    .replace(/艺术研究实验室\s*\/\s*/g, "").trim().slice(0, 30)
}
function compactIssue(value) {
  if (!value) return ""
  const m = String(value).match(/W\d+/i)
  return m ? m[0].toUpperCase() : String(value)
}
function two(value) { return String(value).padStart(2, "0") }
