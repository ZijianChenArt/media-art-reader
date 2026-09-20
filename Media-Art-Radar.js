// MEDIA ART RADAR · Edition 02 / 冷白、淡紫、银铬
// Scriptable Home Screen widgets: small / medium / large
// 小号：最近截止；中号：最近三项；大号：五项精选，兼顾各分类。
// 更新已有组件：将本文件完整替换进原 Scriptable 脚本，保存并运行一次。

const DATA_URL = "https://zijianchenart.github.io/media-art-reader/latest.json"
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const CACHE_NAME = "media-art-radar-latest.json"
const REFRESH_MINUTES = 60
// 在 Scriptable 内预览时改为 small / medium / large；桌面会自动识别尺寸。
const PREVIEW_FAMILY = "large"
const C = {
  bg: "#F3F2F6", paper: "#FCFBFE", text: "#18171C", muted: "#65616F",
  accent: "#5E458F", lilac: "#DED4F0", divider: "#CBC6D3",
  silver: "#D0CCD7", urgent: "#974312"
}
const CATEGORY_ORDER = ["exhibition", "residency", "prize", "conference"]
const CATEGORY = {
  exhibition: { label: "展览", full: "展览征集", color: C.accent },
  residency: { label: "驻留", full: "驻留", color: C.accent },
  prize: { label: "奖项", full: "奖项", color: C.accent },
  conference: { label: "会议", full: "学术会议", color: C.accent }
}

const fm = FileManager.local()
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_NAME)
let payload, source = "LIVE"
try {
  const request = new Request(DATA_URL)
  request.timeoutInterval = 15
  request.headers = { Accept: "application/json" }
  payload = await request.loadJSON()
  validate(payload)
  // A failed local write should not discard valid fresh data.
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
const widget = family === "small" ? buildSmallWidget(payload, source)
  : family === "large" ? buildLargeWidget(payload, source)
  : buildMediumWidget(payload, source)
// Small widgets have one tap target; medium/large rows keep their official URLs.
widget.url = SITE_URL
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60000)
if (config.runsInWidget) Script.setWidget(widget)
else if (family === "small") await widget.presentSmall()
else if (family === "large") await widget.presentLarge()
else await widget.presentMedium()
Script.complete()

function baseWidget(padding) {
  const w = new ListWidget()
  w.backgroundColor = new Color(C.bg)
  w.setPadding(padding, padding, padding, padding)
  return w
}
function text(parent, value, size, color = C.text, weight = "regular", lines = 1) {
  const t = parent.addText(String(value))
  t.font = weight === "bold" ? Font.boldSystemFont(size)
    : weight === "medium" ? Font.mediumSystemFont(size)
    : weight === "mono" ? Font.mediumMonospacedSystemFont(size)
    : weight === "italic" ? new Font("Georgia-Italic", size)
    : Font.systemFont(size)
  t.textColor = new Color(color)
  t.lineLimit = lines
  t.minimumScaleFactor = 0.85
  return t
}
function chromePill(parent, label) {
  const pill = parent.addStack()
  pill.centerAlignContent()
  pill.setPadding(3, 8, 3, 8)
  pill.cornerRadius = 20
  pill.borderWidth = 0.5
  pill.borderColor = new Color("#A7A0B1")
  const gradient = new LinearGradient()
  gradient.colors = [new Color("#FFFFFF"), new Color("#F5F3F9"), new Color("#C9C4D3"), new Color("#ECE8F2")]
  gradient.locations = [0, 0.4, 0.85, 1]
  gradient.startPoint = new Point(0, 0)
  gradient.endPoint = new Point(0, 1)
  pill.backgroundGradient = gradient
  text(pill, label, 9, C.text, "mono")
  return pill
}
function rule(parent) {
  const line = parent.addStack()
  line.size = new Size(0, 0.5)
  line.backgroundColor = new Color(C.divider)
  line.addSpacer()
}
function header(parent, data, small = false) {
  const row = parent.addStack()
  row.centerAlignContent()
  text(row, small ? "MAR ↗" : "MEDIA ART", small ? 17 : 11, C.text, small ? "italic" : "bold")
  if (!small) { row.addSpacer(5); text(row, "Radar", 17, C.text, "italic") }
  row.addSpacer()
  chromePill(row, compactIssue(data.issue_id) || "—")
}
function countdown(parent, item, size) {
  const row = parent.addStack()
  row.bottomAlignContent()
  const days = daysRemaining(item)
  text(row, days === null ? "—" : two(days), size, C.text, "italic")
  row.addSpacer(5)
  const labels = row.addStack()
  labels.layoutVertically()
  text(labels, days === 0 ? "今日" : days === null ? "日期" : "天后", 10, C.accent, "medium")
  text(labels, days === null ? "待定" : "截止", 10, C.accent, "medium")
  labels.addSpacer(5)
}
function footer(parent, data, state, suffix = "") {
  const row = parent.addStack()
  row.centerAlignContent()
  const date = state === "OFFLINE" ? "等待首次同步" : `核验 ${numericDate(data.generated_at)}`
  text(row, date, 9, C.muted)
  row.addSpacer()
  text(row, statusText(state, data) + suffix, 9, state === "LIVE" && !isStale(data) ? C.muted : C.urgent)
}

// SMALL · deadline poster, sized for the smaller iPhone widget canvas.
function buildSmallWidget(data, state) {
  const w = baseWidget(12)
  const calls = activeCalls(data.open_calls || [], "deadline")
  header(w, data, true)
  w.addSpacer(3)
  if (calls.length) {
    const item = calls[0]
    countdown(w, item, 38)
    w.addSpacer(1)
    text(w, splitTitle(item.title).title, 12, C.text, "bold", 2)
    w.addSpacer(3)
    text(w, `${categoryLabel(item, true)} / ${deadlineLabel(item)}`, 10, C.accent, "medium")
  } else { w.addSpacer(); addEmptyState(w, state, true) }
  w.addSpacer()
  footer(w, data, state)
  return w
}

// MEDIUM · a lilac countdown panel paired with three clearly separated rows.
function buildMediumWidget(data, state) {
  const w = baseWidget(12)
  const calls = activeCalls(data.open_calls || [], "deadline")
  header(w, data)
  w.addSpacer(7)
  if (calls.length) {
    const body = w.addStack()
    body.centerAlignContent()
    const next = body.addStack()
    next.layoutVertically()
    next.size = new Size(78, 86)
    next.setPadding(7, 9, 7, 9)
    next.cornerRadius = 15
    next.backgroundColor = new Color(C.lilac)
    next.url = calls[0].url || SITE_URL
    text(next, "NEXT / 最近", 8, C.accent, "medium")
    const days = daysRemaining(calls[0])
    text(next, days === null ? "—" : two(days), 33, C.text, "italic")
    text(next, days === null ? "日期待定" : days === 0 ? "今日截止" : "天后截止", 10, C.accent, "medium")
    body.addSpacer(12)
    const list = body.addStack()
    list.layoutVertically()
    calls.slice(0, 3).forEach((item, i, items) => {
      const row = list.addStack()
      row.layoutVertically()
      row.url = item.url || SITE_URL
      text(row, splitTitle(item.title).title, 12, C.text, "bold")
      const meta = row.addStack()
      text(meta, categoryLabel(item, true), 9, C.muted)
      meta.addSpacer()
      text(meta, deadlineLabel(item), 9, C.accent, "mono")
      if (i < items.length - 1) list.addSpacer(5)
    })
  } else { w.addSpacer(); addEmptyState(w, state) }
  w.addSpacer()
  footer(w, data, state)
  return w
}

// LARGE · a miniature weekly index; five readable rows instead of tiny type.
function buildLargeWidget(data, state) {
  const w = baseWidget(16)
  const calls = activeCalls(data.open_calls || [], "priority")
  const top = w.addStack()
  top.centerAlignContent()
  const name = top.addStack()
  name.layoutVertically()
  text(name, "MEDIA ART", 11, C.text, "bold")
  text(name, "Radar ↗", 25, C.text, "italic")
  top.addSpacer()
  const edition = top.addStack()
  edition.layoutVertically()
  chromePill(edition, compactIssue(data.issue_id) || "—")
  edition.addSpacer(3)
  text(edition, `${calls.length} 项机会`, 10, C.muted).rightAlignText()
  w.addSpacer(8)
  rule(w)
  w.addSpacer(8)
  const categories = w.addStack()
  categories.centerAlignContent()
  CATEGORY_ORDER.forEach((key, i) => {
    const count = calls.filter(item => normalizedCategory(item) === key).length
    text(categories, `${CATEGORY[key].label} ${count}`, 10, count ? C.accent : C.muted, "medium")
    if (i < CATEGORY_ORDER.length - 1) categories.addSpacer()
  })
  w.addSpacer(10)
  const visible = featuredCalls(calls, 5)
  if (!visible.length) { w.addSpacer(); addEmptyState(w, state) }
  visible.forEach((item, i) => {
    addLargeCall(w, item, i + 1)
    if (i < visible.length - 1) { w.addSpacer(7); rule(w); w.addSpacer(7) }
  })
  w.addSpacer()
  if (calls.length > visible.length) {
    text(w, `另有 ${calls.length - visible.length} 项 · 点击查看全部 ↗`, 10, C.accent)
    w.addSpacer(5)
  }
  footer(w, data, state)
  return w
}
function addLargeCall(parent, item, index) {
  const row = parent.addStack()
  row.centerAlignContent()
  row.url = item.url || SITE_URL
  text(row, two(index), 9, C.muted, "mono")
  row.addSpacer(9)
  const content = row.addStack()
  content.layoutVertically()
  const title = splitTitle(item.title)
  text(content, title.title, 13, C.text, "bold")
  text(content, `${categoryLabel(item, true)} · ${title.subtitle || compactType(item.type)}`, 10, C.muted)
  row.addSpacer()
  row.addSpacer(8)
  const date = row.addStack()
  date.layoutVertically()
  date.size = new Size(54, 0)
  text(date, deadlineLabel(item), 13, C.text, "mono").rightAlignText()
  const days = daysRemaining(item)
  text(date, days === null ? "待定" : days === 0 ? "今日截止" : `${days} 天后`, 9, days !== null && days <= 14 ? C.urgent : C.accent).rightAlignText()
}
function addEmptyState(parent, state, compact = false) {
  text(parent, state === "OFFLINE" ? "等待首次同步" : "暂无开放机会", compact ? 13 : 16, C.text, "medium")
  parent.addSpacer(4)
  text(parent, state === "OFFLINE" ? "联网后运行脚本" : "点击查看本期周刊 ↗", 10, C.muted, "regular", 2)
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
  // Keep the publisher's calendar date, rather than silently shifting it to
  // another day when the phone is in a different time zone.
  const raw = String(item.deadline_date || item.deadline_at || "")
  const match = raw.match(/^\d{4}-(\d{2})-(\d{2})/)
  return match ? `${match[1]}.${match[2]}` : "待定"
}
function validate(data) {
  if (!data || data.schema_version !== 1) throw new Error("Unsupported data format")
  if (!Array.isArray(data.open_calls)) throw new Error("Incomplete data")
}

function emptyPayload(error) {
  return {
    schema_version: 1,
    issue_id: "WAITING",
    generated_at: new Date(0).toISOString(),
    open_calls: [],
    radar: [],
    reminders: [],
    error: String(error)
  }
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
      const da = parseDeadline(a)
      const db = parseDeadline(b)
      const ta = da ? da.getTime() : Number.MAX_SAFE_INTEGER
      const tb = db ? db.getTime() : Number.MAX_SAFE_INTEGER
      return ta - tb
    })
}

// 大组件保留站点的精选顺序，同时尽量让四类机会都出现。
function featuredCalls(items, limit) {
  const picked = []

  CATEGORY_ORDER.forEach(key => {
    const match = items.find(item => normalizedCategory(item) === key)
    if (match && picked.indexOf(match) === -1) picked.push(match)
  })

  items.forEach(item => {
    if (picked.length < limit && picked.indexOf(item) === -1) picked.push(item)
  })

  return picked
    .slice(0, limit)
    .sort((a, b) => items.indexOf(a) - items.indexOf(b))
}

function normalizedCategory(item) {
  const explicit = String(item.category || "").toLowerCase()
  if (CATEGORY[explicit]) return explicit

  // 兼容旧缓存：没有 category 时，根据标题和类型推断。
  const text = `${item.title || ""} ${item.type || ""}`.toLowerCase()
  if (/residen|驻留|驻村/.test(text)) return "residency"
  if (/conference|symposium|cfp|paper|会议|论文/.test(text)) return "conference"
  if (/prize|award|奖项|大奖/.test(text)) return "prize"
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
  if (simple) {
    return new Date(Number(simple[1]), Number(simple[2]) - 1, Number(simple[3]), 23, 59, 59)
  }

  const d = new Date(raw)
  if (isNaN(d)) return null
  return d
}

function daysRemaining(item) {
  const deadline = parseDeadline(item)
  if (!deadline) return null

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())
  const diff = target.getTime() - today.getTime()

  return Math.max(0, Math.ceil(diff / 86400000))
}

// ============================================================
// TEXT HELPERS
// ============================================================

function splitTitle(value) {
  const original = value || "Untitled"
  const separator = original.indexOf("/")

  if (separator !== -1) {
    const title = original.slice(0, separator).trim()
    const subtitle = original.slice(separator + 1).trim()
    return { title, subtitle }
  }

  return { title: original, subtitle: "" }
}

function compactType(value) {
  if (!value) return "MEDIA ART"
  return String(value)
    .replace(/驻留与/g, "")
    .replace(/艺术节作品征集：/g, "")
    .replace(/艺术研究实验室\s*\/\s*/g, "")
    .trim()
    .slice(0, 30)
}

function compactIssue(value) {
  if (!value) return ""
  const match = String(value).match(/W\d+/i)
  return match ? match[0].toUpperCase() : String(value)
}

function compactDeadlineDate(item) {
  const d = parseDeadline(item)
  if (!d) return "NO DATE"

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  return `${months[d.getMonth()]} ${two(d.getDate())}`
}

function compactDate(value) {
  const d = new Date(value)
  if (isNaN(d)) return "--"

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  return `${months[d.getMonth()]} ${two(d.getDate())}`
}

function two(value) {
  return String(value).padStart(2, "0")
}

