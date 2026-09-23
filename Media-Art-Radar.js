// ============================================================
// MEDIA ART RADAR
// Opportunity Widget · Light / Dark Auto Theme
// Scriptable for iPhone / iPad / Mac
// ============================================================

// ------------------------------------------------------------
// 01 · DATA
// ------------------------------------------------------------
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const DATA_URL = SITE_URL + "latest.json"
const OPPORTUNITY_URL = SITE_URL + "#opportunities"
const REFRESH_MINUTES = 60
const DEFAULT_PREVIEW = "large"

// ------------------------------------------------------------
// 02 · LIGHT / DARK THEME
// ------------------------------------------------------------
function dynamic(light, dark) {
  return Color.dynamic(new Color(light), new Color(dark))
}

const C = {
  paper: dynamic("#FFFFFF", "#0B0B0B"),
  ink: dynamic("#050505", "#F2F2EE"),
  dim: dynamic("#666666", "#A3A3A0"),
  faint: dynamic("#A8A8A8", "#666666"),
  hair: dynamic("#E5E5E5", "#292929"),
  strongHair: dynamic("#111111", "#E7E7E2"),
  red: dynamic("#D71921", "#FF453A"),
  redSoft: dynamic("#FBEAEC", "#2B1113")
}

// ------------------------------------------------------------
// 03 · CATEGORY
// ------------------------------------------------------------
const CAT = {
  exhibition: { zh: "展览", en: "EXHIBITION", symbol: "●" },
  residency: { zh: "驻留", en: "RESIDENCY", symbol: "○" },
  prize: { zh: "奖项", en: "PRIZE", symbol: "◆" },
  conference: { zh: "学术会议", en: "CONFERENCE", symbol: "▲" }
}

// ------------------------------------------------------------
// 04 · CACHE
// ------------------------------------------------------------
const fm = FileManager.local()
const cachePath = fm.joinPath(fm.documentsDirectory(), "media-art-radar-opportunities.json")

let data
let sourceState = "LIVE"

try {
  const req = new Request(DATA_URL)
  req.timeoutInterval = 15
  req.headers = { Accept: "application/json" }
  data = await req.loadJSON()
  validateData(data)
  try {
    fm.writeString(cachePath, JSON.stringify(data))
  } catch (_) {}
} catch (error) {
  try {
    if (!fm.fileExists(cachePath)) {
      throw error
    }
    data = JSON.parse(fm.readString(cachePath))
    validateData(data)
    sourceState = "CACHE"
  } catch (_) {
    sourceState = "OFFLINE"
    data = { schema_version: 1, issue_id: "WAITING", generated_at: null, open_calls: [] }
  }
}

// ------------------------------------------------------------
// 05 · WIDGET OPTIONS
// ------------------------------------------------------------
const options = parseOptions(args.widgetParameter)
const family = config.runsInWidget ? config.widgetFamily : (options.family || DEFAULT_PREVIEW)
const calls = selectCalls(data.open_calls || [], options.category)

// ------------------------------------------------------------
// 06 · CREATE
// ------------------------------------------------------------
const widget = buildWidget(family, calls, data, sourceState, options)
widget.refreshAfterDate = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000)

// ------------------------------------------------------------
// 07 · DISPLAY
// ------------------------------------------------------------
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  if (family === "small") {
    await widget.presentSmall()
  } else if (family === "medium") {
    await widget.presentMedium()
  } else if (family === "extraLarge" && typeof widget.presentExtraLarge === "function") {
    await widget.presentExtraLarge()
  } else {
    await widget.presentLarge()
  }
}

Script.complete()

// ============================================================
// MAIN WIDGET
// ============================================================
function buildWidget(family, calls, data, sourceState, options) {
  const w = new ListWidget()
  w.backgroundColor = C.paper
  w.url = OPPORTUNITY_URL

  if (family === "small") {
    w.setPadding(14, 14, 12, 14)
  } else {
    w.setPadding(14, 16, 12, 16)
  }

  if (!calls.length) {
    renderEmpty(w, data, sourceState)
    return w
  }

  if (family === "small") {
    renderSmall(w, calls, data, sourceState)
  } else if (family === "medium") {
    renderMedium(w, calls, data, sourceState)
  } else if (family === "extraLarge") {
    renderExtraLarge(w, calls, data, sourceState)
  } else {
    renderLarge(w, calls, data, sourceState)
  }

  return w
}

// ============================================================
// SMALL
// ============================================================
function renderSmall(root, calls, data, state) {
  const item = calls[0]

  // Top brand
  const top = root.addStack()
  top.layoutHorizontally()
  top.centerAlignContent()
  addText(top, "MEDIA", 11, C.ink, "monoBold", 1)
  addText(top, "·", 14, C.red, "bold", 1)
  addText(top, "ART", 11, C.ink, "monoBold", 1)
  top.addSpacer()
  addText(top, two(calls.length), 11, C.red, "monoBold", 1)

  root.addSpacer(8)
  addRule(root, C.strongHair, 1)
  root.addSpacer(9)

  // Meta
  const meta = root.addStack()
  meta.layoutHorizontally()
  meta.centerAlignContent()
  addCategory(meta, item, 8)
  meta.addSpacer()
  addText(meta, timer(item), 8.5, urgencyColor(item), "monoBold", 1)

  root.addSpacer(6)

  // Deadline
  addLargeDate(root, item, 30)

  root.addSpacer(7)

  // Opportunity title
  const title = addText(root, titleOf(item), 14, C.ink, "bold", 3)
  title.minimumScaleFactor = 0.72

  root.addSpacer()
  addRule(root, C.hair, 1)
  root.addSpacer(6)

  // Footer
  const footer = root.addStack()
  footer.layoutHorizontally()
  footer.centerAlignContent()
  addText(footer, shortLocation(item) || issueShort(data.issue_id), 8, C.dim, "regular", 1)
  footer.addSpacer()
  addText(footer, stateLabel(state, data), 7.5, C.dim, "mono", 1)

  root.url = item.url || OPPORTUNITY_URL
}

// ============================================================
// MEDIUM
// ============================================================
function renderMedium(root, calls, data, state) {
  renderHeader(root, calls.length, data, state)
  root.addSpacer(6)
  addRule(root, C.strongHair, 1)

  const items = calls.slice(0, 2)
  items.forEach((item, index) => {
    addOpportunityRow(root, item, index + 1, {
      height: 54,
      dateWidth: 54,
      titleSize: 13,
      titleLines: 2,
      highlight: false,
      number: false
    })
    if (index < items.length - 1) {
      addRule(root, C.hair, 1)
    }
  })
}

// ============================================================
// LARGE
// ============================================================
function renderLarge(root, calls, data, state) {
  renderHeader(root, calls.length, data, state)
  root.addSpacer(6)
  addRule(root, C.strongHair, 1)

  const capacity = 5
  const items = calls.slice(0, capacity)
  items.forEach((item, index) => {
    addOpportunityRow(root, item, index + 1, {
      height: 57,
      dateWidth: 55,
      titleSize: 13,
      titleLines: 2,
      highlight: true,
      number: true
    })
    if (index < items.length - 1) {
      addRule(root, C.hair, 1)
    }
  })

  root.addSpacer()
  renderFooter(root, calls.length, capacity, data, state)
}

// ============================================================
// EXTRA LARGE
// ============================================================
function renderExtraLarge(root, calls, data, state) {
  renderHeader(root, calls.length, data, state)
  root.addSpacer(6)
  addRule(root, C.strongHair, 1)
  root.addSpacer(4)

  const columns = root.addStack()
  columns.layoutHorizontally()
  columns.spacing = 14

  const left = columns.addStack()
  left.layoutVertically()

  const separator = columns.addStack()
  separator.size = new Size(1, 268)
  separator.backgroundColor = C.hair

  const right = columns.addStack()
  right.layoutVertically()

  const items = calls.slice(0, 8)
  const leftItems = items.slice(0, 4)
  const rightItems = items.slice(4, 8)

  leftItems.forEach((item, index) => {
    addOpportunityRow(left, item, index + 1, {
      height: 62,
      dateWidth: 54,
      titleSize: 13,
      titleLines: 2,
      highlight: true,
      number: true
    })
    if (index < leftItems.length - 1) {
      addRule(left, C.hair, 1)
    }
  })

  rightItems.forEach((item, index) => {
    addOpportunityRow(right, item, index + 5, {
      height: 62,
      dateWidth: 54,
      titleSize: 13,
      titleLines: 2,
      highlight: true,
      number: true
    })
    if (index < rightItems.length - 1) {
      addRule(right, C.hair, 1)
    }
  })

  root.addSpacer()
  renderFooter(root, calls.length, 8, data, state)
}

// ============================================================
// HEADER
// ============================================================
function renderHeader(parent, count, data, state) {
  const top = parent.addStack()
  top.layoutHorizontally()
  top.centerAlignContent()
  addText(top, "MEDIA ART", 16, C.ink, "displayBold", 1)
  addText(top, ".", 17, C.red, "displayBold", 1)
  top.addSpacer(8)
  addText(top, "OPPORTUNITIES", 8, C.dim, "monoBold", 1)
  top.addSpacer()
  addText(top, two(count), 18, C.red, "displayBold", 1)

  parent.addSpacer(2)

  const sub = parent.addStack()
  sub.layoutHorizontally()
  sub.centerAlignContent()
  addText(sub, issueShort(data.issue_id), 7.5, C.dim, "mono", 1)
  sub.addSpacer()
  addText(sub, stateLabel(state, data), 7.5, C.dim, "mono", 1)
}

// ============================================================
// OPPORTUNITY ROW
// ============================================================
function addOpportunityRow(parent, item, index, options) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.size = new Size(0, options.height)
  row.url = item.url || OPPORTUNITY_URL

  // ----------------------------------------------------------
  // DATE COLUMN
  // ----------------------------------------------------------
  const date = row.addStack()
  date.layoutVertically()
  date.size = new Size(options.dateWidth, options.height)
  date.addSpacer()

  const parts = deadlineParts(item)
  if (parts) {
    const dateLine = date.addStack()
    dateLine.layoutHorizontally()
    dateLine.centerAlignContent()
    addText(dateLine, parts.month, 16, C.ink, "display", 1)
    addText(dateLine, ".", 16, C.red, "displayBold", 1)
    addText(dateLine, parts.day, 16, C.ink, "display", 1)
  } else {
    addText(date, "TBA", 13, C.ink, "display", 1)
  }

  date.addSpacer(2)
  addText(date, timer(item), 7.5, urgencyColor(item), "monoBold", 1)
  date.addSpacer()

  // Vertical line
  const vertical = row.addStack()
  vertical.size = new Size(1, options.height - 12)
  vertical.backgroundColor = C.hair

  row.addSpacer(9)

  // ----------------------------------------------------------
  // CONTENT
  // ----------------------------------------------------------
  const body = row.addStack()
  body.layoutVertically()
  body.addSpacer()

  const metadata = body.addStack()
  metadata.layoutHorizontally()
  metadata.centerAlignContent()
  addCategory(metadata, item, 8)

  const location = shortLocation(item)
  if (location) {
    addText(metadata, "  ·  " + location, 8, C.dim, "regular", 1)
  }
  metadata.addSpacer()
  if (options.number) {
    addText(metadata, two(index), 7.5, C.faint, "mono", 1)
  }

  body.addSpacer(3)

  const title = addText(body, titleOf(item), options.titleSize, C.ink, "bold", options.titleLines)
  title.minimumScaleFactor = 0.76

  body.addSpacer(2)

  const lower = body.addStack()
  lower.layoutHorizontally()
  lower.centerAlignContent()
  const highlight = cleanHighlight(item.highlight)
  if (options.highlight && highlight) {
    addText(lower, highlight, 8.5, C.dim, "regular", 1)
  } else {
    const subtitle = subtitleOf(item)
    if (subtitle) {
      addText(lower, subtitle, 8, C.dim, "regular", 1)
    }
  }
  lower.addSpacer()
  addText(lower, deadlineYear(item), 7.5, C.faint, "mono", 1)

  body.addSpacer()
}

// ============================================================
// LARGE DATE
// ============================================================
function addLargeDate(parent, item, size) {
  const parts = deadlineParts(item)
  if (!parts) {
    addText(parent, "TBA", 22, C.ink, "displayBold", 1)
    return
  }
  const row = parent.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  addText(row, parts.month, size, C.ink, "displayBold", 1)
  addText(row, ".", size, C.red, "displayBold", 1)
  addText(row, parts.day, size, C.ink, "displayBold", 1)
}

// ============================================================
// CATEGORY
// ============================================================
function addCategory(parent, item, size) {
  const category = CAT[normalizedCategory(item)] || CAT.exhibition
  addText(parent, category.symbol + " " + category.zh, size, C.ink, "medium", 1)
}

// ============================================================
// FOOTER
// ============================================================
function renderFooter(parent, total, capacity, data, state) {
  const row = parent.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  addText(row, issueShort(data.issue_id) + " · " + stateLabel(state, data), 7.5, C.dim, "mono", 1)
  row.addSpacer()

  const remain = Math.max(total - capacity, 0)
  addText(row, remain > 0 ? `+ ${remain} MORE →` : "VIEW ALL →", 8, C.ink, "monoBold", 1)

  row.url = OPPORTUNITY_URL
}

// ============================================================
// EMPTY
// ============================================================
function renderEmpty(root, data, state) {
  const top = root.addStack()
  top.layoutHorizontally()
  addText(top, "MEDIA ART", 16, C.ink, "displayBold", 1)
  addText(top, ".", 17, C.red, "displayBold", 1)

  root.addSpacer(8)
  addRule(root, C.strongHair, 1)
  root.addSpacer()

  addText(root, state === "OFFLINE" ? "WAITING FOR DATA" : "NO OPEN CALLS", 15, C.ink, "bold", 2)
  root.addSpacer(5)
  addText(root, state === "OFFLINE" ? "等待首次同步" : "目前暂无开放机会", 10, C.dim, "regular", 2)

  root.addSpacer()
  addText(root, stateLabel(state, data), 8, C.dim, "mono", 1)
}

// ============================================================
// TEXT
// ============================================================
function addText(parent, value, size, color, weight, lines) {
  const text = parent.addText(String(value == null ? "" : value))
  text.textColor = color
  text.font = getFont(size, weight)
  text.lineLimit = lines || 1
  text.minimumScaleFactor = 0.75
  return text
}

// ============================================================
// FONT
// ============================================================
function getFont(size, type) {
  switch (type) {
    case "bold":
      return Font.boldSystemFont(size)
    case "medium":
      return Font.mediumSystemFont(size)
    case "mono":
      return Font.regularMonospacedSystemFont(size)
    case "monoBold":
      return Font.boldMonospacedSystemFont(size)
    case "display":
      return customFont("Didot", size, Font.systemFont(size))
    case "displayBold":
      return customFont("Didot-Bold", size, Font.boldSystemFont(size))
    default:
      return Font.systemFont(size)
  }
}

function customFont(name, size, fallback) {
  try {
    return new Font(name, size)
  } catch (_) {
    return fallback
  }
}

// ============================================================
// RULE
// ============================================================
function addRule(parent, color, height) {
  const line = parent.addStack()
  line.size = new Size(0, height)
  line.backgroundColor = color
  return line
}

// ============================================================
// DATA VALIDATION
// ============================================================
function validateData(data) {
  if (!data) {
    throw new Error("No data")
  }
  if (!Array.isArray(data.open_calls)) {
    throw new Error("open_calls missing")
  }
}

// ============================================================
// FILTER + SORT
// ============================================================
function selectCalls(items, category) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let list = items.filter(item => {
    const deadline = parseDeadline(item)
    if (!deadline) {
      return true
    }
    return deadline.getTime() >= now.getTime()
  })

  if (category && category !== "all") {
    list = list.filter(item => normalizedCategory(item) === category)
  }

  list.sort((a, b) => {
    const da = parseDeadline(a)
    const db = parseDeadline(b)
    const ta = da ? da.getTime() : Number.MAX_SAFE_INTEGER
    const tb = db ? db.getTime() : Number.MAX_SAFE_INTEGER
    return ta - tb
  })

  return list
}

// ============================================================
// CATEGORY DETECTION
// ============================================================
function normalizedCategory(item) {
  const category = String(item.category || "").toLowerCase()
  if (CAT[category]) {
    return category
  }
  const text = (String(item.title || "") + " " + String(item.type || "")).toLowerCase()
  if (/residen|驻留|驻村/.test(text)) {
    return "residency"
  }
  if (/conference|symposium|cfp|paper|会议|论文/.test(text)) {
    return "conference"
  }
  if (/prize|award|奖项|大奖/.test(text)) {
    return "prize"
  }
  return "exhibition"
}

// ============================================================
// DEADLINE
// ============================================================
function parseDeadline(item) {
  const raw = item.deadline_at || item.deadline_date || item.deadline
  if (!raw) {
    return null
  }
  const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59)
  }
  const parsed = new Date(raw)
  return isNaN(parsed) ? null : parsed
}

// ============================================================
// DATE PARTS
// ============================================================
function deadlineParts(item) {
  const raw = String(item.deadline_date || item.deadline_at || item.deadline || "")
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return null
  }
  return { year: match[1], month: match[2], day: match[3] }
}

function deadlineYear(item) {
  const parts = deadlineParts(item)
  return parts ? parts.year : ""
}

// ============================================================
// COUNTDOWN
// ============================================================
function daysRemaining(item) {
  const deadline = parseDeadline(item)
  if (!deadline) {
    return null
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function timer(item) {
  const days = daysRemaining(item)
  if (days == null) {
    return "TBA"
  }
  if (days < 0) {
    return "CLOSED"
  }
  if (days === 0) {
    return "TODAY"
  }
  return `T−${days}`
}

function urgencyColor(item) {
  const days = daysRemaining(item)
  if (days != null && days <= 14) {
    return C.red
  }
  return C.dim
}

// ============================================================
// TITLE
// ============================================================
function titleOf(item) {
  const title = String(item.title || item.name || "Untitled").replace(/\s+/g, " ").trim()
  const first = title.split("/")[0].trim()
  return first || title
}

// ============================================================
// SUBTITLE
// ============================================================
function subtitleOf(item) {
  const raw = String(item.title || "")
  const parts = raw.split("/").map(x => x.trim()).filter(Boolean)
  if (parts.length <= 1) {
    return ""
  }
  return parts.slice(1).join(" / ").slice(0, 46)
}

// ============================================================
// LOCATION
// ============================================================
function shortLocation(item) {
  const raw = String(item.location || item.country || "").trim()
  if (!raw) {
    return ""
  }
  return raw.split(/[；;，,。·]/)[0].trim().slice(0, 25)
}

// ============================================================
// HIGHLIGHT
// ============================================================
function cleanHighlight(text) {
  if (!text) {
    return ""
  }
  return String(text).replace(/\s+/g, " ").trim().slice(0, 34)
}

// ============================================================
// DATA STATUS
// ============================================================
function stateLabel(state, data) {
  if (state === "OFFLINE") {
    return "OFFLINE"
  }
  if (isStale(data)) {
    return state === "CACHE" ? "CACHE · STALE" : "STALE"
  }
  return state === "CACHE" ? "CACHE" : "LIVE"
}

function isStale(data) {
  if (!data.generated_at) {
    return false
  }
  const time = Date.parse(data.generated_at)
  if (!Number.isFinite(time)) {
    return false
  }
  return Date.now() - time > 8 * 24 * 60 * 60 * 1000
}

// ============================================================
// ISSUE
// ============================================================
function issueShort(value) {
  if (!value) {
    return "MEDIA ART RADAR"
  }
  const text = String(value)
  const week = text.match(/W\d+/i)
  if (week) {
    return week[0].toUpperCase()
  }
  return text.replace(/^\d{4}-/, "").slice(0, 18)
}

// ============================================================
// PARAMETERS
// ============================================================
//
// Widget Parameter:
//
//   all
//   exhibition
//   residency
//   prize
//   conference
//
// Preview:
//
//   small
//   medium
//   large
//   extraLarge
//
// Advanced:
//
//   {"category":"residency","family":"large"}
//
// ============================================================
function parseOptions(raw) {
  const result = { family: null, category: "all" }
  if (!raw) {
    return result
  }
  const value = String(raw).trim()
  const families = ["small", "medium", "large", "extraLarge"]
  const categories = ["all", "exhibition", "residency", "prize", "conference"]

  if (families.includes(value)) {
    result.family = value
    return result
  }
  if (categories.includes(value)) {
    result.category = value
    return result
  }

  try {
    const json = JSON.parse(value)
    if (families.includes(json.family)) {
      result.family = json.family
    }
    if (categories.includes(json.category)) {
      result.category = json.category
    }
  } catch (_) {}

  return result
}

// ============================================================
// FORMAT
// ============================================================
function two(value) {
  return String(value).padStart(2, "0")
}
