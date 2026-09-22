// Media Art Radar \u00b7 Edition 13 \u2014 replace the entire Scriptable script.
const SITE_URL = "https://zijianchenart.github.io/media-art-reader/"
const PREVIEW_FAMILY = "large"
const C = {paper:"#FFFFFF",ink:"#040404",dim:"#505050",hair:"#ECECEC",red:"#D71921"}
const WIDGET_SIZES = {
956:{small:176,mw:378,lh:393},932:{small:170,mw:364,lh:382},926:{small:170,mw:364,lh:382},896:{small:169,mw:360,lh:379},
852:{small:158,mw:338,lh:354},844:{small:158,mw:338,lh:354},812:{small:155,mw:329,lh:345},736:{small:159,mw:348,lh:357},667:{small:148,mw:321,lh:324},568:{small:141,mw:292,lh:311}
}
const CATEGORY = {exhibition:{short:"\u5c55\u89c8",full:"\u5c55\u89c8\u5f81\u96c6",glyph:"\u25cf"},residency:{short:"\u9a7b\u7559",full:"\u9a7b\u7559",glyph:"\u25cb"},conference:{short:"\u5b66\u672f\u4f1a\u8bae",full:"\u5b66\u672f\u4f1a\u8bae",glyph:"\u25b2"},prize:{short:"\u5956\u9879",full:"\u5956\u9879",glyph:"\u25c6"}}
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
  if (["display","date","serif"].includes(weight)) return Font.boldSystemFont(size)
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
// Native system text only. No font names, bitmap text or per-glyph drawing.
function dateMark(parent,item,w,h,requestedSize,color = C.ink) {
  const value = deadlineLabel(item), row = stack(parent,w,h,false)
  if (!/^\d{2}\.\d{2}$/.test(value)) return label(row,value,w,h,14,color,"medium")
  const size = Math.min(requestedSize,w/3.15,h*.8)
  label(row,value.slice(0,2),w*.43,h,size,color,"bold","right")
  label(row,".",w*.14,h,size,C.red,"bold","center")
  label(row,value.slice(3),w*.43,h,size,color,"bold")
  return row
}
function outlined(parent,w,h,padding = 8) {
  const card = stack(parent,w,h); card.borderColor = new Color(C.ink); card.borderWidth = 1
  card.cornerRadius = 14; card.setPadding(padding,padding,padding,padding); return card
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
  const row = stack(parent,w,h,false)
  label(row,"Media Art Radar",w-44,h,17,C.ink,"bold")
  label(row,two(count),44,h,26,C.red,"bold","right")
}

function buildWidget(data,state,family,area) {
  const widget = new ListWidget(); widget.backgroundColor = new Color(C.paper)
  widget.setPadding(12,12,12,12); widget.spacing = 0; widget.url = SITE_URL
  const w = area.w-24, h = area.h-25, root = stack(widget,w,h), calls = activeCalls(data.open_calls || [],"deadline")
  if (!calls.length) {
    root.addSpacer(); label(root,state === "OFFLINE"?"\u7b49\u5f85\u9996\u6b21\u540c\u6b65":"\u6682\u65e0\u5f00\u653e\u673a\u4f1a",w,24,16,C.ink,"bold")
    label(root,state === "OFFLINE"?"\u8054\u7f51\u540e\u8fd0\u884c\u811a\u672c":"\u70b9\u51fb\u67e5\u770b\u672c\u671f\u5468\u520a",w,18,10,C.dim); root.addSpacer(); return widget
  }
  if (family === "small") small(root,calls,data,state,w,h)
  else if (family === "medium") medium(root,calls,data,state,w,h)
  else if (family === "extraLarge") extraLarge(root,calls,data,state,w,h)
  else large(root,calls,data,state,w,h)
  return widget
}
function small(root,calls,data,state,w,h) {
  const item = calls[0], card = outlined(root,w,h), iw=w-16, ih=h-16, scale=Math.min(1,ih/121)
  card.url=item.url || SITE_URL
  label(card,compactIssue(data.issue_id)+" / "+categoryLabel(item,true),iw,12,9,C.dim,"medium")
  dateMark(card,item,iw,42*scale,34*scale)
  twoLineTitle(card,splitTitle(item.title).title,iw,36*scale,16*scale)
  card.addSpacer()
  const foot=stack(card,iw,16,false)
  label(foot,timer(item),iw*.5,16,10,C.red,"bold")
  label(foot,state === "LIVE" ? two(calls.length)+" \u9879" : statusText(state,data),iw*.5,16,9,C.dim,"medium","right")
}
function medium(root,calls,data,state,w,h) {
  masthead(root,w,26,calls.length); root.addSpacer(6)
  const ch=h-32,cw=(w-8)/2, row=stack(root,w,ch,false)
  for(let i=0;i<2;i++) {
    if(i) row.addSpacer(8)
    const card=outlined(row,cw,ch),item=calls[i],iw=cw-16,ih=ch-16
    if(!item) continue
    card.url=item.url || SITE_URL
    const tight=ih<85
    const sc=Math.min(1,(ih-14)/52)
    dateMark(card,item,Math.min(iw,100),tight?24*sc:30,tight?23*sc:28)
    twoLineTitle(card,splitTitle(item.title).title,iw,tight?28*sc:36,tight?12:14)
    card.addSpacer()
    const foot=stack(card,iw,14,false)
    label(foot,category(item),iw*.62,14,9,C.dim,"medium")
    label(foot,timer(item),iw*.38,14,9,urgencyColor(item),"bold","right")
  }
}
function entry(parent,item,w,h) {
  const card=outlined(parent,w,h,0); card.layoutHorizontally(); card.url=item.url || SITE_URL
  const dw=78, tile=stack(card,dw,h); tile.backgroundColor=new Color(C.ink); tile.cornerRadius=13
  tile.addSpacer(); dateMark(tile,item,dw,30,23,C.paper)
  label(tile,timer(item),dw,16,10,C.paper,"bold","center"); tile.addSpacer()
  card.addSpacer(10)
  const bw=w-dw-20,body=stack(card,bw,h); body.addSpacer()
  twoLineTitle(body,splitTitle(item.title).title,bw,34,14)
  const meta=stack(body,bw,16,false)
  label(meta,category(item),bw*.5,16,9,C.dim,"medium")
  label(meta,item.highlight || "",bw*.5,16,11,C.ink,"bold","right")
  body.addSpacer();card.addSpacer(10)
}
function large(root,calls,data,state,w,h) {
  masthead(root,w,30,calls.length);root.addSpacer(8)
  const area=h-58, capacity=Math.max(1,Math.min(4,Math.floor((area+7)/65))),rh=(area-(capacity-1)*7)/capacity
  const list=stack(root,w,area)
  for(let i=0;i<capacity;i++) { if(i) list.addSpacer(7);if(calls[i]) entry(list,calls[i],w,rh);else stack(list,w,rh) }
  root.addSpacer(6)
  const foot=stack(root,w,14,false), hidden=Math.max(0,calls.length-capacity)
  label(foot,compactIssue(data.issue_id)+" / "+statusText(state,data),w*.55,14,9,C.dim,"medium")
  label(foot,hidden ? "\u53e6\u6709 "+hidden+" \u9879 \u2192" : "\u5168\u90e8\u673a\u4f1a",w*.45,14,9,C.ink,"bold","right")
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
        label(cell,"\u9879\u673a\u4f1a \u00b7 OPEN CALLS",iw,14*sc,8,C.dim,"mono")
        cell.addSpacer(); label(cell,`${compactIssue(data.issue_id)} \u00b7 ${statusText(state,data)}`,iw,12,8,C.dim,"mono")
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
  if (state === "OFFLINE") return "\u79bb\u7ebf"
  if (isStale(data)) return state === "CACHE" ? "\u7f13\u5b58\u00b7\u5f85\u66f4\u65b0" : "\u5f85\u66f4\u65b0"
  return state === "CACHE" ? "\u79bb\u7ebf\u7f13\u5b58" : "\u5df2\u540c\u6b65"
}
function numericDate(value) {
  const d = new Date(value)
  return isNaN(d) ? "\u2014" : `${two(d.getMonth() + 1)}.${two(d.getDate())}`
}
function deadlineLabel(item) {
  // \u4fdd\u7559\u53d1\u5e03\u65b9\u7684\u65e5\u5386\u65e5\u671f\uff0c\u4e0d\u56e0\u624b\u673a\u5904\u5728\u522b\u7684\u65f6\u533a\u800c\u6574\u4f53\u632a\u52a8\u4e00\u5929
  const raw = String(item.deadline_date || item.deadline_at || "")
  const match = raw.match(/^\d{4}-(\d{2})-(\d{2})/)
  return match ? `${match[1]}.${match[2]}` : "\u5f85\u5b9a"
}
function compactPlace(value) {
  if (!value) return ""
  // \u5728\u5206\u53f7\u3001\u95f4\u9694\u53f7\u3001\u9017\u53f7\u5904\u622a\u65ad\uff0c\u53ea\u7559\u7b2c\u4e00\u6bb5\uff1a\u300c\u897f\u73ed\u7259 Bilbao\uff0cPalacio Euskalduna\u300d\u2192\u300c\u897f\u73ed\u7259 Bilbao\u300d
  return String(value).split(/[\uff1b;\u00b7\uff0c,]/)[0].trim().slice(0, 22)
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
  // \u517c\u5bb9\u65e7\u7f13\u5b58\uff1a\u6ca1\u6709 category \u65f6\u6309\u6807\u9898\u548c\u7c7b\u578b\u63a8\u65ad
  const t = `${item.title || ""} ${item.type || ""}`.toLowerCase()
  if (/residen|\u9a7b\u7559|\u9a7b\u6751/.test(t)) return "residency"
  if (/conference|symposium|cfp|paper|\u4f1a\u8bae|\u8bba\u6587/.test(t)) return "conference"
  if (/prize|award|\u5956\u9879|\u5927\u5956/.test(t)) return "prize"
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
