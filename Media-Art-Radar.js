// Media Art Radar · Edition 12.2 — replace the entire Scriptable script.
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const PREVIEW_FAMILY = "large"
const C = {paper:"#FFFFFF",ink:"#040404",dim:"#505050",hair:"#ECECEC",red:"#D71921"}
const WIDGET_SIZES = {
956:{small:176,mw:378,lh:393},932:{small:170,mw:364,lh:382},926:{small:170,mw:364,lh:382},896:{small:169,mw:360,lh:379},
852:{small:158,mw:338,lh:354},844:{small:158,mw:338,lh:354},812:{small:155,mw:329,lh:345},736:{small:159,mw:348,lh:357},667:{small:148,mw:321,lh:324},568:{small:141,mw:292,lh:311}
}
const CATEGORY = {exhibition:{short:"展览",full:"展览征集",glyph:"●"},residency:{short:"驻留",full:"驻留",glyph:"○"},conference:{short:"学术会议",full:"学术会议",glyph:"▲"},prize:{short:"奖项",full:"奖项",glyph:"◆"}}
const fm = FileManager.local(), cachePath = fm.joinPath(fm.documentsDirectory(),"media-art-radar-latest.json")
let payload, source = "LIVE"
try {
  const request = new Request(SITE_URL+"latest.json"); request.timeoutInterval = 15
  payload = await request.loadJSON(); validate(payload)
  try { fm.writeString(cachePath,JSON.stringify(payload)) } catch (_) {}
} catch (error) {
  try {
    if (!fm.fileExists(cachePath)) throw error
    payload = JSON.parse(fm.readString(cachePath)); validate(payload); source = "CACHE"
  } catch (_) { payload = emptyPayload(error); source = "OFFLINE" }
}
const options = readOptions(args.widgetParameter)
const family = config.runsInWidget ? config.widgetFamily : options.family || PREVIEW_FAMILY
const metrics = widgetMetrics(family,options), widget = buildWidget(payload,source,family,metrics)
widget.refreshAfterDate = new Date(Date.now()+3600000)
if (config.runsInWidget) Script.setWidget(widget)
else if (family === "small") await widget.presentSmall()
else if (family === "medium") await widget.presentMedium()
else if (family === "extraLarge" && typeof widget.presentExtraLarge === "function") await widget.presentExtraLarge()
else await widget.presentLarge()
Script.complete()

function readOptions(raw) {
  if (raw === "mac") return {host:"mac"}
  if (["small","medium","large","extraLarge"].includes(raw)) return {family:raw}
  try { const o = JSON.parse(raw); return o && !Array.isArray(o) && typeof o === "object" ? o : {} } catch (_) { return {} }
}
function widgetMetrics(family,options = {}) {
  let height = 852
  try { const s = Device.screenSize(); height = Math.max(s.width,s.height) } catch (_) {}
  const near = Object.keys(WIDGET_SIZES).map(Number).sort((a,b)=>Math.abs(a-height)-Math.abs(b-height)||a-b)[0], t = WIDGET_SIZES[near]
  let area = family === "small" ? {w:t.small,h:t.small} : family === "medium" ? {w:t.mw,h:t.small} : family === "extraLarge" ? {w:701,h:342} : {w:t.mw,h:t.lh}
  if (options.host === "mac") area = family === "small" ? {w:162,h:162} : family === "medium" ? {w:341,h:162} : family === "extraLarge" ? {w:701,h:342} : {w:342,h:342}
  for (const [key,name] of [["w","width"],["h","height"]]) if (Number.isFinite(options[name]) && options[name]>0) area[key] = Math.max(key === "w" && family !== "small" ? 280 : 130,options[name])
  return area
}
function stack(parent,w,h,vertical = true) {
  const s = parent.addStack(); s.size = new Size(w,h); s.spacing = 0; s.setPadding(0,0,0,0)
  if (vertical) s.layoutVertically(); else s.layoutHorizontally()
  return s
}
function font(size,weight) {
  if (["display","date","serif"].includes(weight)) return new Font("Georgia-Italic",size)
  if (weight === "bold") return Font.boldSystemFont(size)
  if (weight === "mono") return Font.mediumMonospacedSystemFont(size)
  if (weight === "medium") return Font.mediumSystemFont(size)
  return Font.systemFont(size)
}
function label(parent,value,w,h,size,color = C.ink,weight = "regular",align = "left") {
  const slot = stack(parent,w,h); slot.addSpacer(); const row = stack(slot,w,0,false)
  if (align !== "left") row.addSpacer()
  const t = row.addText(String(value)); t.font = font(size,weight); t.textColor = new Color(color)
  t.lineLimit = 1; t.minimumScaleFactor = size <= 11 ? .9 : .8
  if (align !== "right") row.addSpacer()
  slot.addSpacer(); return slot
}
function rule(parent,w,color = C.hair) { const r = stack(parent,w,1); r.backgroundColor = new Color(color); return r }
// Draw individual glyphs at points: no narrow substring rectangles to wrap/crop digits.
// Conservative advances reserve space for the italic overhang at both canvas edges.
function dateMark(parent,item,w,h,requestedSize) {
  const ctx = new DrawContext(); ctx.size = new Size(w,h); ctx.opaque = false; ctx.respectScreenScale = true
  const value = deadlineLabel(item), size = Math.min(requestedSize,(w-4)/3.05,h/1.4)
  ctx.setFont(font(size,"date")); ctx.setTextAlignedLeft()
  const y = Math.max(0,(h-size*1.35)/2)
  if (/^\d{2}\.\d{2}$/.test(value)) {
    let x = 2+size*.08
    for (const ch of value) {
      ctx.setTextColor(new Color(ch === "." ? C.red : C.ink)); ctx.drawText(ch,new Point(x,y))
      x += size*(ch === "." ? .31 : .64)
    }
  } else {
    ctx.setFont(font(Math.min(14,size),"medium")); ctx.setTextColor(new Color(C.dim)); ctx.drawText(value,new Point(2,y))
  }
  const frame = stack(parent,w,h), image = frame.addImage(ctx.getImage())
  image.imageSize = new Size(w,h); image.applyFittingContentMode(); return frame
}
function titleLines(value,width,size) {
  const str = String(value || "Untitled").replace(/\s+/g," ").trim()
  const measure = text => Array.from(text).reduce((sum,ch)=>sum+(/[^\x00-\x7F]/.test(ch)?1:/[MW@]/.test(ch)?.85:/[ilI1.,' ]/.test(ch)?.28:/[A-Z]/.test(ch)?.66:.54),0)*size
  if (measure(str)<=width-4) return [str]
  let choices = []
  for (let i=1;i<str.length;i++) if (str[i] === " ") choices.push(i)
  if (!choices.length) choices = Array.from({length:Math.max(0,str.length-1)},(_,i)=>i+1)
  let best = choices[0] || str.length, score = Infinity
  for (const i of choices) {
    const a = measure(str.slice(0,i).trim()), b = measure(str.slice(i).trim()), next = Math.max(a,b)+Math.max(0,a-width+4)*10
    if (next<score) { score = next; best = i }
  }
  return [str.slice(0,best).trim(),str.slice(best).trim()].filter(Boolean)
}
function twoLineTitle(parent,value,w,h,size) {
  const slot = stack(parent,w,h), lines = titleLines(value,w,size)
  for (const line of lines) label(slot,line,w,h/2,size,C.ink,"bold")
  if (lines.length === 1) slot.addSpacer(h/2)
  return slot
}
function timer(item) { const d = daysRemaining(item); return d === null ? "TBA" : `T-${d}` }
function urgencyColor(item) { const d = daysRemaining(item); return d !== null && d<=14 ? C.red : C.dim }
function category(item) { return `${glyphOf(item)} ${categoryLabel(item,true)}` }
function masthead(parent,w,h,count) {
  const row = stack(parent,w,h,false), big = h>30
  label(row,"Media Art Radar",w-42,h,big?24:22,C.ink,"display")
  label(row,two(count),42,h,big?27:24,C.red,"display","right")
}
function buildWidget(data,state,family,area) {
  const widget = new ListWidget(); widget.backgroundColor = new Color(C.paper)
  widget.setPadding(12,12,12,12); widget.spacing = 0; widget.url = SITE_URL
  const w = area.w-24, h = area.h-25, root = stack(widget,w,h), calls = activeCalls(data.open_calls || [],"deadline")
  if (!calls.length) {
    root.addSpacer(); label(root,state === "OFFLINE"?"等待首次同步":"暂无开放机会",w,24,16,C.ink,"bold")
    label(root,state === "OFFLINE"?"联网后运行脚本":"点击查看本期周刊",w,18,10,C.dim); root.addSpacer(); return widget
  }
  if (family === "small") small(root,calls,data,state,w,h)
  else if (family === "medium") medium(root,calls,data,state,w,h)
  else if (family === "extraLarge") extraLarge(root,calls,data,state,w,h)
  else large(root,calls,data,state,w,h)
  return widget
}
function small(root,calls,data,state,w,h) {
  const item = calls[0], sc = Math.min(1,h/137); root.url = item.url || SITE_URL
  const top = stack(root,w,12,false)
  label(top,compactIssue(data.issue_id),w*.35,12,8,C.dim,"mono")
  label(top,category(item),w*.65,12,9,C.dim,"medium","right")
  root.addSpacer(4); dateMark(root,item,w,44*sc,34*sc)
  twoLineTitle(root,splitTitle(item.title).title,w,38*sc,17*sc)
  if (h>=137) label(root,splitTitle(item.title).subtitle || "Open call",w,12,9,C.dim,"serif")
  root.addSpacer(); root.addSpacer(4); rule(root,w); root.addSpacer(6)
  const foot = stack(root,w,12,false)
  label(foot,timer(item),w*.45,12,9,urgencyColor(item),"mono")
  label(foot,state === "LIVE"?`共 ${two(calls.length)} 项`:statusText(state,data),w*.55,12,8,C.dim,"mono","right")
}
function medium(root,calls,data,state,w,h) {
  masthead(root,w,26,calls.length); rule(root,w,C.ink); root.addSpacer(6)
  const ch = h-33, compact = ch<100, slots = w<290?2:3, cw = (w-(slots-1)*12)/slots, row = stack(root,w,ch,false)
  for (let i=0;i<slots;i++) {
    if (i) { row.addSpacer(5.5); const sep = stack(row,1,ch); sep.backgroundColor = new Color(C.hair); row.addSpacer(5.5) }
    const col = stack(row,cw,ch), item = calls[i]; if (!item) continue
    col.url = item.url || SITE_URL; dateMark(col,item,cw,compact?26:34,compact?18.5:24)
    col.addSpacer(2); twoLineTitle(col,splitTitle(item.title).title,cw,compact?28:38,compact?12:13)
    col.addSpacer(2); if (!compact) label(col,category(item),cw,12,10,C.dim,"medium")
    col.addSpacer(); label(col,state !== "LIVE" && i === slots-1?statusText(state,data):timer(item),cw,12,9,urgencyColor(item),"mono")
  }
}
function entry(parent,item,w,h) {
  const row = stack(parent,w,h,false); row.url = item.url || SITE_URL
  const date = stack(row,82,h); date.addSpacer(); dateMark(date,item,82,36,25.5)
  label(date,timer(item),82,12,10,urgencyColor(item),"mono"); date.addSpacer(); row.addSpacer(8)
  const bw = w-90, body = stack(row,bw,h); body.addSpacer()
  label(body,splitTitle(item.title).title,bw,22,15,C.ink,"bold"); body.addSpacer(4)
  const meta = stack(body,bw,18,false), catw = Math.min(65,bw*.43)
  label(meta,category(item),catw,18,10,C.dim,"medium")
  const value = String(item.highlight || ""), numeric = /\d/.test(value)
  label(meta,value,bw-catw,18,numeric?(value.length>=9?13:15):10,numeric?C.ink:C.dim,numeric?"serif":"medium","right"); body.addSpacer()
}
function large(root,calls,data,state,w,h) {
  masthead(root,w,36,calls.length); rule(root,w,C.ink); root.addSpacer(6)
  const area = h-62, capacity = Math.max(1,Math.min(5,Math.floor((area+1)/50))), rh = (area-capacity+1)/capacity, list = stack(root,w,area)
  for (let i=0;i<capacity;i++) { if (i) rule(list,w); if (calls[i]) entry(list,calls[i],w,rh); else stack(list,w,rh) }
  rule(root,w,C.ink); root.addSpacer(6)
  const foot = stack(root,w,12,false), hidden = Math.max(0,calls.length-capacity)
  label(foot,`${compactIssue(data.issue_id)} / 核验 ${numericDate(data.generated_at)}`,w*.6,12,8,C.dim,"mono")
  label(foot,`${hidden?`另有 ${hidden} 项 · `:""}${statusText(state,data)}`,w*.4,12,8,C.dim,"mono","right")
}
function extraLarge(root,calls,data,state,w,h) {
  const cw = (w-12)/3, ch = (h-6)/2
  for (let r=0;r<2;r++) {
    if (r) root.addSpacer(6)
    const row = stack(root,w,ch,false)
    for (let c=0;c<3;c++) {
      if (c) row.addSpacer(6)
      const index = r*3+c, cell = stack(row,cw,ch)
      cell.cornerRadius = 18; cell.borderWidth = .7; cell.borderColor = new Color(C.ink)
      cell.setPadding(10,10,10,10)
      const iw = cw-20, ih = ch-20, sc = Math.min(1,ih/117)
      if (!index) {
        label(cell,"Media Art Radar",iw,22*sc,17*sc,C.ink,"display")
        cell.addSpacer(); label(cell,two(calls.length),iw,46*sc,36*sc,C.red,"display")
        label(cell,"项机会 · OPEN CALLS",iw,14*sc,8,C.dim,"mono")
        cell.addSpacer(); label(cell,`${compactIssue(data.issue_id)} · ${statusText(state,data)}`,iw,12,8,C.dim,"mono")
      } else if (calls[index-1]) {
        const item = calls[index-1]; cell.url = item.url || SITE_URL
        label(cell,category(item),iw,12,8,C.dim,"medium")
        twoLineTitle(cell,splitTitle(item.title).title,iw,32*sc,13*sc)
        cell.addSpacer(); dateMark(cell,item,iw,34*sc,24*sc)
        const foot = stack(cell,iw,18,false)
        label(foot,timer(item),iw*.45,18,8,urgencyColor(item),"mono")
        label(foot,item.highlight || "",iw*.55,18,11,C.ink,"serif","right")
      }
    }
  }
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
