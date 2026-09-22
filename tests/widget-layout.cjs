// Structural checks for Scriptable layouts; this does not emulate iOS text rendering.
// Run: node tests/widget-layout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Media-Art-Radar.js'), 'utf8');
class Size { constructor(width, height) { Object.assign(this, { width, height }); } }
class Node {
  constructor() { this.children = []; this.size = new Size(0, 0); this.padding = [0, 0, 0, 0]; this.axis = 'h'; }
  addStack() { const n = new Node(); this.children.push(n); return n; }
  addImage(image) {
    const n = new Node(); n.image = image;
    n.applyFittingContentMode = () => {};
    Object.defineProperty(n, 'imageSize', { set(value) { n.size = value; } });
    this.children.push(n); return n;
  }
  addSpacer(length = 0) { assert(length >= 0); this.children.push({ spacer: length }); }
  addText(value) { const t = { value, rightAlignText() {}, centerAlignText() {} }; this.children.push(t); return t; }
  setPadding(...p) { this.padding = p; }
  layoutVertically() { this.axis = 'v'; }
  layoutHorizontally() { this.axis = 'h'; }
  bottomAlignContent() {}
  centerAlignContent() {}
  async presentSmall() {}
  async presentMedium() {}
  async presentLarge() {}
  async presentExtraLarge() {}
}
class ListWidget extends Node { constructor() { super(); this.axis = 'v'; } }
class DrawContext {
  constructor() { this.draws = []; }
  setFillColor() {} setStrokeColor() {} setLineWidth() {} addPath() {} fillPath() {} strokePath() {}
  setFont(f) { this.font = f; }
  setTextColor(c) { this.color = c; }
  setTextAlignedLeft() {} setTextAlignedCenter() {} setTextAlignedRight() {}
  drawText(text, point) {
    assert(point.x >= 0 && point.y >= 0);
    assert(point.x < this.size.width && point.y < this.size.height);
    this.draws.push({ text, point, color: this.color.hex, font: this.font });
  }
  drawTextInRect(text, rect) {
    assert(rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0);
    assert(rect.x + rect.width <= this.size.width + .01, 'date must fit the drawing width');
    assert(rect.y + rect.height <= this.size.height + .01, 'date must fit the drawing height');
    this.draws.push({ text, color: this.color.hex, font: this.font });
  }
  getImage() { return { size: this.size, draws: this.draws }; }
}
class Path { move() {} addLine() {} addCurve() {} closeSubpath() {} }
class Font { constructor(name, size) { Object.assign(this, { name, size }); } }
for (const name of ['systemFont', 'mediumSystemFont', 'boldSystemFont', 'mediumMonospacedSystemFont', 'boldMonospacedSystemFont']) {
  Font[name] = size => new Font(name, size);
}
const fixture = n => ({ schema_version: 1, issue_id: '2026-W38', generated_at: new Date().toISOString(),
  open_calls: Array.from({ length: n }, (_, i) => ({ title: 'Very long title 中文标题 '.repeat(15) + '/ Subtitle',
    deadline_date: `2099-12-${String(i % 28 + 1).padStart(2, '0')}`, category: 'conference',
    highlight: i % 2 ? '未公布' : '€1,000,000', highlight_label: '非常长的资助说明'.repeat(10), url: `https://example.org/${i}` })) });

async function load({ network = fixture(5), cached = null, failWrite = false, family = 'large', parameter = '', preview = false } = {}) {
  let output, complete = false;
  const screen = { width: 440, height: 956 };
  const env = { Size, ListWidget, DrawContext, Path, Font, Point: class { constructor(x,y) { Object.assign(this,{x,y}); } },
    Rect: class { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } },
    Color: class { constructor(hex) { this.hex = hex; } },
    Device: { screenSize: () => screen }, config: { runsInWidget: !preview, widgetFamily: family }, args: { widgetParameter: parameter },
    Script: { setWidget: w => { output = w; }, complete: () => { complete = true; } },
    FileManager: { local: () => ({ documentsDirectory: () => '/cache', joinPath: (a, b) => a + '/' + b,
      fileExists: () => cached !== null, readString: () => cached,
      writeString: () => { if (failWrite) throw Error('disk full'); } }) },
    Request: class { async loadJSON() { if (network instanceof Error) throw network; return network; } }
  };
  const api = await vm.runInNewContext(`(async () => { ${source}\nreturn { buildWidget, widgetMetrics, readOptions, label, dateMark, titleLines, twoLineTitle, WIDGET_SIZES, source, payload, family, metrics }; })()`, env);
  assert(complete, 'Script.complete must be called');
  if (!preview) { assert(output); assert.equal(output.url, 'https://zijianchenart.github.io/media-art-reader/'); }
  return { ...api, screen };
}
function inspect(node, path = 'widget') {
  if (!(node instanceof Node)) return;
  const { width: w, height: h } = node.size;
  assert(Number.isFinite(w) && Number.isFinite(h) && w >= 0 && h >= 0, path + ' invalid dimensions');
  const [top, left, bottom, right] = node.padding;
  if (node.backgroundImage) {
    assert.equal(node.backgroundImage.size.width, w, path + ' background stretched horizontally');
    assert.equal(node.backgroundImage.size.height, h, path + ' background stretched vertically');
  }
  let occupied = 0;
  node.children.forEach((child, i) => {
    if (child instanceof Node) {
      occupied += node.axis === 'v' ? child.size.height : child.size.width;
      if (w) assert(child.size.width <= w - left - right + .01, path + '/' + i + ' too wide');
      if (h) assert(child.size.height <= h - top - bottom + .01, path + '/' + i + ' too tall');
      inspect(child, path + '/' + i);
    } else if ('spacer' in child) occupied += child.spacer;
    else { assert.equal(child.lineLimit > 0, true); assert.equal(child.minimumScaleFactor, child.font.size <= 11 ? .9 : .8); }
  });
  const limit = node.axis === 'v' ? h && h - top - bottom : w && w - left - right;
  if (limit) assert(occupied <= limit + .01, `${path}: children ${occupied} exceed available ${limit}`);
}
function links(node) { return (node.url ? 1 : 0) + (node.children || []).reduce((n, c) => n + links(c), 0); }
// The native API ignores WidgetText alignment inside stacks. Model a short
// text with a known width to check its position, not just the slot's bounds.
function textPositions(node, textWidth, origin = 0) {
  const [top, left, bottom, right] = node.padding;
  if (node.axis === 'v') return node.children.flatMap(child => child instanceof Node
    ? textPositions(child, textWidth, origin + left) : 'value' in child ? [origin + left] : []);
  const occupied = node.children.reduce((sum, child) => sum + (child instanceof Node
    ? child.size.width : 'value' in child ? textWidth : child.spacer), 0);
  const flexible = node.children.filter(child => 'spacer' in child && child.spacer === 0).length;
  const free = Math.max(0, node.size.width - left - right - occupied);
  let x = origin + left;
  return node.children.flatMap(child => {
    if (child instanceof Node) { const out = textPositions(child, textWidth, x); x += child.size.width; return out; }
    if ('value' in child) { const out = [x]; x += textWidth; return out; }
    x += child.spacer || (flexible ? free / flexible : 0);
    return [];
  });
}
(async () => {
  const api = await load();
  assert(!/[^\x00-\x7f]/.test(source), 'script transport must be ASCII safe');
  const collect = n => n.children.flatMap(c => c instanceof Node ? collect(c) : 'value' in c ? [c] : []);
  for (const mmdd of ['09.28','10.15','11.06','12.01','12.15']) {
    const mark = api.dateMark(new Node(), {deadline_date:'2099-'+mmdd.replace('.','-')},78,30,23);
    const runs = collect(mark);
    assert.equal(runs.map(t=>t.value).join(''),mmdd.replace('.',''));
    assert(runs.every(t=>t.font.name==='boldSystemFont'));
    const descendants = n => [n,...n.children.filter(c=>c instanceof Node).flatMap(descendants)];
    const dot = descendants(mark).find(n=>n.backgroundColor?.hex === '#D71921');
    assert(dot && dot.size.width >= 3 && dot.cornerRadius === dot.size.width/2, 'date separator must be a visible geometric circle');
    inspect(mark);
  }
  const localized = api.buildWidget({ ...fixture(1), open_calls:[{ ...fixture(1).open_calls[0],category:'exhibition'}] },'LIVE','medium',api.widgetMetrics('medium'));
  assert(collect(localized).some(t=>t.value.includes('展览')), 'Chinese labels must survive source decoding');
  for (const title of ['Technarte Bilbao 2027', 'EMAP Residencies 2027']) {
    const lines = Array.from(api.titleLines(title, 110, 12));
    assert.equal(lines.length, 2, 'long medium titles must have explicit lines');
    assert.equal(lines.join(' '), title, 'title text must not be lost');
    const block = api.twoLineTitle(new Node(), title, 110, 36, 12);
    assert.equal(block.children.filter(c => c instanceof Node).length, 2);
  }
  api.dateMark(new Node(), {}, 60, 24, 24); // Unknown date must remain readable.
  for (const [align, expected] of [['left', 0], ['center', 30], ['right', 60]]) {
    const parent = new Node();
    const slot = api.label(parent, 'Probe', 80, 24, 12, '#040404', 'regular', align);
    assert.deepEqual(textPositions(slot, 20), [expected], `short text must actually align ${align} within its stack`);
    assert.deepEqual(textPositions(slot, 80), [0], 'full-width text must stay inside its slot');
  }
  let cases = 0;
  for (const screenH of Object.keys(api.WIDGET_SIZES).map(Number)) {
    api.screen.height = screenH;
    for (const host of ['', 'mac']) for (const family of ['small', 'medium', 'large', 'extraLarge']) {
      const area = api.widgetMetrics(family, host ? { host } : {});
      for (const count of [0, 1, 2, 3, 5, 6, 12, 100]) {
        const widget = api.buildWidget(fixture(count), 'LIVE', family, area);
        inspect(widget);
        assert.equal(widget.children[0].size.width, area.w - 24);
        assert.equal(widget.children[0].size.height, area.h - 25);
        if (count && family !== 'small') assert(links(widget) > 0, 'card links must survive layout rewrite');
        cases++;
      }
    }
  }
  for (const family of ['small', 'medium', 'large', 'extraLarge']) {
    const area = api.widgetMetrics(family, { width: family === 'extraLarge' ? 540 : family === 'small' ? 130 : 280,
      height: family === 'large' || family === 'extraLarge' ? 280 : 130 });
    inspect(api.buildWidget(fixture(12), 'CACHE', family, area));
  }
  assert.equal((await load({ network: Error('offline'), cached: JSON.stringify(fixture(5)) })).source, 'CACHE');
  const offline = await load({ network: Error('offline'), cached: '{broken' });
  assert.equal(offline.source, 'OFFLINE');
  assert.equal(offline.payload.open_calls.length, 0);
  assert.equal((await load({ failWrite: true })).source, 'LIVE');
  assert.equal((await load({ network: { schema_version: 99 }, cached: JSON.stringify(fixture(1)) })).source, 'CACHE');
  for (const family of ['small', 'medium', 'large', 'extraLarge']) await load({ parameter: family, preview: true });
  assert.equal((await load({ family: 'small', parameter: 'large' })).family, 'small', 'home-screen family takes precedence');
  for (const raw of ['', '{broken', 'null', '[]', '{"width":-1,"height":0}']) {
    const area = api.widgetMetrics('large', api.readOptions(raw));
    assert(area.w > 0 && area.h > 0);
  }
  console.log(`PASS: stack text alignment regression; ${cases} layout cases, custom sizes, long text, links, cache/offline, preview and parameters. Native iOS rendering still requires device verification.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
