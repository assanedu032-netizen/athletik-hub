// Chunking du livre — découpe en passages ~250 mots avec overlap ~60 mots,
// en respectant les frontières de paragraphes, les balises <!-- Page N --> et
// les bornes naturelles du livre (COURS X, CHAPITRE X, Programme X, PARTIE X, etc.).

const TARGET_WORDS = 250;
const OVERLAP_WORDS = 60;
const MIN_CHUNK_WORDS = 50;

// Une ligne qui matche ces patterns force un flush + reset (frontière dure).
const HARD_BREAK_PATTERNS = [
  /^\s*PARTIE\s+\d/i,
  /^\s*COURS\s+\d/i,
  /^\s*CHAPITRE\s+\d/i,
  /^\s*Chapitre\s+\d/,
  /^\s*Programme\s+\d/,
  /^\s*Loi\s+n°/i,
];

function countWords(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

function isHardBreak(paragraph) {
  const first = paragraph.split('\n')[0].slice(0, 100);
  return HARD_BREAK_PATTERNS.some(re => re.test(first));
}

// Découpe le texte du livre en chunks { id, page, text, section }.
function chunkBook(text) {
  // Découpe par marqueurs de page
  const pageRegex = /<!--\s*Page\s+(\d+)\s*-->/g;
  const segments = [];
  let lastIdx = 0;
  let currentPage = 1;
  let m;
  while ((m = pageRegex.exec(text)) !== null) {
    const before = text.slice(lastIdx, m.index);
    if (before.trim()) segments.push({ page: currentPage, text: before });
    currentPage = parseInt(m[1], 10);
    lastIdx = m.index + m[0].length;
  }
  const tail = text.slice(lastIdx);
  if (tail.trim()) segments.push({ page: currentPage, text: tail });

  const chunks = [];
  let id = 0;
  let buffer = [];
  let bufferWords = 0;
  let bufferPage = 1;
  let currentSection = 'Introduction';

  function flush() {
    if (bufferWords < MIN_CHUNK_WORDS) return;
    const joined = buffer.join('\n\n').trim();
    if (!joined) return;
    chunks.push({ id: id++, page: bufferPage, section: currentSection, text: joined });
  }

  for (const seg of segments) {
    const paragraphs = seg.text
      .split(/\n\s*\n/)
      .map(p => p.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean);

    for (const p of paragraphs) {
      const w = countWords(p);
      if (w === 0) continue;

      // Frontière dure : flush et reset (sans overlap, on entre dans une nouvelle section)
      if (isHardBreak(p)) {
        flush();
        buffer = [];
        bufferWords = 0;
        bufferPage = seg.page;
        currentSection = p.split('\n')[0].slice(0, 80).trim();
      }

      if (buffer.length === 0) bufferPage = seg.page;

      // Chunk plein → flush + overlap
      if (bufferWords + w > TARGET_WORDS && buffer.length > 0) {
        flush();
        const allWords = buffer.join(' ').split(/\s+/);
        const tailWords = allWords.slice(Math.max(0, allWords.length - OVERLAP_WORDS));
        buffer = [tailWords.join(' ')];
        bufferWords = tailWords.length;
        bufferPage = seg.page;
      }

      buffer.push(p);
      bufferWords += w;
    }
  }
  flush();

  return chunks;
}

module.exports = { chunkBook };
