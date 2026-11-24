/* Shared, dependency-free browser matcher. Conversion happens at build time. */
(() => {
  'use strict';
  const fold = value => String(value ?? '').normalize('NFKD')
    .replace(/\p{M}/gu, '').toLowerCase()
    .replaceAll('鍋', '锅').replaceAll('證', '证').replaceAll('築', '筑');
  const normalize = value => fold(value).replace(/[^\p{L}\p{N}]+/gu, '');
  const terms = value => String(value ?? '').trim().split(/[\s\p{Dash_Punctuation}]+/u).map(normalize).filter(Boolean);
  // Common unaccented input accepts lu/lv/lü; this does not change Latin text.
  const pinyinKey = value => normalize(value).replaceAll('v', 'u');

  function createIndex(text, readings = []) {
    if (typeof readings === 'string') {
      try { readings = JSON.parse(readings); } catch { readings = []; }
    }
    if (!Array.isArray(readings)) readings = [];
    const prefixes = new Set();
    for (const phrase of readings) {
      if (typeof phrase !== 'string') continue;
      const syllables = phrase.split(/\s+/).map(pinyinKey).filter(Boolean);
      // Only start at a syllable boundary: "meilai" can find 李美来,
      // but the interior fragment "ime" cannot. Keep phrases separate.
      for (let start = 0; start < syllables.length; start++) {
        prefixes.add(syllables.slice(start).join(''));
      }
    }
    return { text: normalize(text), words: fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean), pinyin: [...prefixes] };
  }

  function matches(index, query) {
    if (typeof query === 'string') query = terms(query);
    // Preserve full multilingual/English AND search. For an unfinished phrase
    // such as "li m", do not AND the letters against arbitrary substrings.
    const partialPhrase = query.length > 1 && query.some(term => /^[a-z]$/.test(term));
    const nativeMatch = partialPhrase
      ? query[0].length >= 2 && index.words.some((_word, start) =>
          query.every((term, offset) => index.words[start + offset]?.startsWith(term)))
      : query.every(term => index.text.includes(term));
    if (nativeMatch) return true;
    if (!query.length || query[0].length < 2) return false;
    const compact = pinyinKey(query.join(''));
    // No pinyin-only single-initial expansion or unanchored substring matching.
    if (compact.length < 2 || !/^[a-z]+$/.test(compact)) return false;
    return index.pinyin.some(phrase => phrase.startsWith(compact));
  }

  globalThis.ArchiveSearch = Object.freeze({ normalize, terms, createIndex, matches });
})();
