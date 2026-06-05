// Chunking du livre — découpe en passages ~400 mots avec overlap ~80 mots,
// en respectant les frontières de paragraphes et les balises de page <!-- Page N -->.

const TARGET_WORDS = 400;
const OVERLAP_WORDS = 80;
const MIN_CHUNK_WORDS = 80;

function countWords(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

// Découpe le texte du livre en chunks { id, page, text }.
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

  // À l'intérieur de chaque segment de page, on regroupe les paragraphes
  // jusqu'à atteindre TARGET_WORDS, avec overlap entre chunks consécutifs.
  const chunks = [];
  let id = 0;
  let buffer = [];
  let bufferWords = 0;
  let bufferPage = 1;

  function flush() {
    if (bufferWords < MIN_CHUNK_WORDS) return;
    const joined = buffer.join('\n\n').trim();
    if (!joined) return;
    chunks.push({ id: id++, page: bufferPage, text: joined });
  }

  for (const seg of segments) {
    const paragraphs = seg.text
      .split(/\n\s*\n/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (const p of paragraphs) {
      const w = countWords(p);
      if (w === 0) continue;

      if (buffer.length === 0) bufferPage = seg.page;

      if (bufferWords + w > TARGET_WORDS && buffer.length > 0) {
        flush();
        // Overlap : garde les derniers ~OVERLAP_WORDS mots
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
