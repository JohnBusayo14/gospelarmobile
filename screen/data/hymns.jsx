// data/hymns.js
// Pure CommonJS — no mixing of import/export with require().
// All hymn data lives in the database; these helpers fetch it via API.

function getBase() {
  try {
    return require('../services/api').API_BASE_URL || '';
  } catch (e) {
    return '';
  }
}

/**
 * Parse "G.H.B. 75, 433" → [75, 433]
 */
function parseHymnRef(ref) {
  try {
    if (!ref) return [];
    var s = String(ref).replace(/G\.?\s*H\.?\s*B\.?\s*/gi, '').trim();
    if (!s) return [];
    var result = [];
    var parts = s.split(/[\s,]+/);
    for (var i = 0; i < parts.length; i++) {
      var n = parseInt(parts[i], 10);
      if (!isNaN(n) && n > 0) result.push(n);
    }
    return result;
  } catch (e) {
    return [];
  }
}

/**
 * Returns true if text looks like a G.H.B. reference.
 */
function isHymnRef(text) {
  try {
    return /G\.?\s*H\.?\s*B/i.test(String(text || ''));
  } catch (e) {
    return false;
  }
}

/**
 * Fetch one hymn from the database by number.
 * Returns the hymn object or null.
 */
async function getHymn(number) {
  if (!number) return null;
  try {
    var base = getBase();
    if (!base) return null;
    var res = await fetch(base + '/api/hymns/' + number);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('getHymn(' + number + ') error:', e.message);
    return null;
  }
}

/**
 * Fetch multiple hymns in one request.
 * Returns an array in the same order as numbers; missing slots are null.
 */
async function fetchHymns(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return [];
  try {
    var base = getBase();
    if (!base) return numbers.map(function () { return null; });
    var res  = await fetch(base + '/api/hymns?numbers=' + numbers.join(','));
    if (!res.ok) return numbers.map(function () { return null; });
    var data = await res.json();
    var byNum = {};
    if (Array.isArray(data)) {
      data.forEach(function (h) {
        if (h && h.number) byNum[h.number] = h;
      });
    }
    return numbers.map(function (n) { return byNum[n] || null; });
  } catch (e) {
    console.warn('fetchHymns error:', e.message);
    return numbers.map(function () { return null; });
  }
}

module.exports = { parseHymnRef, isHymnRef, getHymn, fetchHymns };