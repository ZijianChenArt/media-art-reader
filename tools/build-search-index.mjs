// Build-time only: no catalog text is sent to a conversion service and this
// dictionary is never shipped to the browser. Pin pinyin-pro in the build lockfile.
import { pinyin } from 'pinyin-pro';

const cache = new Map();
const hanPhrase = /\p{Script=Han}+(?:[\s·•・.'’\-]+\p{Script=Han}+)*/gu;

/** Derive search readings from supplied title/artist/aliases, never translations. */
export function buildPinyinIndex(work) {
  const values = [work.title, work.artist, ...(Array.isArray(work.searchAliases) ? work.searchAliases : [])]
    .filter(value => typeof value === 'string');
  const phrases = new Set();
  for (const value of values) {
    for (const match of value.matchAll(hanPhrase)) {
      // Preserve dotted/space-separated Chinese names as a single phrase.
      const source = match[0].replace(/[^\p{Script=Han}]/gu, '');
      if (!cache.has(source)) {
        cache.set(source, pinyin(source, {
          toneType: 'none', type: 'array', nonZh: 'removed', v: true
        }).join(' '));
      }
      const reading = cache.get(source);
      if (reading) phrases.add(reading);
    }
  }
  return [...phrases];
}
