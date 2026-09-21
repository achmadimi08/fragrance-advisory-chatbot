/**
 * Mini markdown renderer.
 *
 * Semua teks di-escape lebih dulu, jadi HTML mentah dari model tidak pernah
 * ikut dieksekusi; tag yang muncul di hasil akhir hanya yang dibuat di sini.
 * Mendukung: heading, bold/italic/strikethrough, inline & block code, list
 * (bertingkat), blockquote, tabel, horizontal rule, dan link.
 */
(function (global) {
  'use strict';

  const SENTINEL = '\u0000';

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Inline ----------------------------------------------------------
  function renderInline(text) {
    const codes = [];
    let out = text.replace(/`([^`]+)`/g, (_, code) => {
      codes.push(code);
      return `${SENTINEL}IC${codes.length - 1}${SENTINEL}`;
    });

    // [teks](url) — hanya skema aman yang dijadikan link.
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
      if (!/^(https?:\/\/|mailto:)/i.test(url)) return match;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    out = out.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    return out.replace(
      new RegExp(`${SENTINEL}IC(\\d+)${SENTINEL}`, 'g'),
      (_, i) => `<code>${codes[Number(i)]}</code>`
    );
  }

  // ---- Helper baris ----------------------------------------------------
  const RE_BULLET = /^(\s*)[-*+]\s+(.*)$/;
  const RE_ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
  const RE_HEADING = /^(#{1,6})\s+(.*)$/;
  const RE_HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
  const RE_QUOTE = /^\s*&gt;\s?(.*)$/;
  const RE_TABLE_SEP = /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/;

  function isListLine(line) {
    return RE_BULLET.test(line) || RE_ORDERED.test(line);
  }

  function splitRow(line) {
    return line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  // ---- List (mendukung sub-list lewat indentasi) ------------------------
  function renderList(lines, start) {
    const items = [];
    let i = start;

    while (i < lines.length && isListLine(lines[i])) {
      const bullet = lines[i].match(RE_BULLET);
      const ordered = lines[i].match(RE_ORDERED);
      const indent = (bullet ? bullet[1] : ordered[1]).replace(/\t/g, '  ').length;
      const content = bullet ? bullet[2] : ordered[3];

      items.push({ indent, ordered: Boolean(ordered), content });
      i += 1;

      // Baris lanjutan (indentasi lebih dalam, bukan item baru) digabung.
      while (i < lines.length && !isListLine(lines[i]) && /^\s{2,}\S/.test(lines[i])) {
        items[items.length - 1].content += ' ' + lines[i].trim();
        i += 1;
      }
    }

    return { html: buildList(items, 0).html, next: i };
  }

  function buildList(items, index) {
    const baseIndent = items[index].indent;
    const tag = items[index].ordered ? 'ol' : 'ul';
    let html = `<${tag}>`;
    let i = index;

    while (i < items.length && items[i].indent >= baseIndent) {
      if (items[i].indent > baseIndent) {
        const nested = buildList(items, i);
        html = html.replace(/<\/li>$/, `${nested.html}</li>`);
        i = nested.next;
        continue;
      }
      html += `<li>${renderInline(items[i].content)}</li>`;
      i += 1;
    }

    return { html: `${html}</${tag}>`, next: i };
  }

  // ---- Tabel -----------------------------------------------------------
  function renderTable(lines, start) {
    const header = splitRow(lines[start]);
    let html = '<table><thead><tr>';
    header.forEach((cell) => {
      html += `<th>${renderInline(cell)}</th>`;
    });
    html += '</tr></thead><tbody>';

    let i = start + 2;
    while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
      const cells = splitRow(lines[i]);
      html += '<tr>';
      for (let c = 0; c < header.length; c += 1) {
        html += `<td>${renderInline(cells[c] || '')}</td>`;
      }
      html += '</tr>';
      i += 1;
    }

    return { html: `${html}</tbody></table>`, next: i };
  }

  // ---- Block -----------------------------------------------------------
  function renderBlocks(text) {
    const lines = text.split('\n');
    let html = '';
    let paragraph = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      html += `<p>${renderInline(paragraph.join('\n')).replace(/\n/g, '<br />')}</p>`;
      paragraph = [];
    }

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === '') {
        flushParagraph();
        i += 1;
        continue;
      }

      if (RE_HR.test(line)) {
        flushParagraph();
        html += '<hr />';
        i += 1;
        continue;
      }

      const heading = line.match(RE_HEADING);
      if (heading) {
        flushParagraph();
        const level = Math.min(heading[1].length, 4);
        html += `<h${level}>${renderInline(heading[2])}</h${level}>`;
        i += 1;
        continue;
      }

      if (RE_QUOTE.test(line)) {
        flushParagraph();
        const quoted = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          quoted.push(lines[i].match(RE_QUOTE)[1]);
          i += 1;
        }
        html += `<blockquote>${renderBlocks(quoted.join('\n'))}</blockquote>`;
        continue;
      }

      if (
        line.includes('|') &&
        i + 1 < lines.length &&
        RE_TABLE_SEP.test(lines[i + 1]) &&
        lines[i + 1].includes('-')
      ) {
        flushParagraph();
        const table = renderTable(lines, i);
        html += table.html;
        i = table.next;
        continue;
      }

      if (isListLine(line)) {
        flushParagraph();
        const list = renderList(lines, i);
        html += list.html;
        i = list.next;
        continue;
      }

      paragraph.push(line.trim());
      i += 1;
    }

    flushParagraph();
    return html;
  }

  function renderMarkdown(raw) {
    if (!raw) return '';

    const blocks = [];
    // Code fence diamankan lebih dulu agar isinya tidak diformat ulang.
    const text = escapeHtml(String(raw).replace(/\r\n?/g, '\n'))
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        blocks.push({ lang, code: code.replace(/\n$/, '') });
        return `\n${SENTINEL}CB${blocks.length - 1}${SENTINEL}\n`;
      });

    let html = renderBlocks(text);

    html = html.replace(
      new RegExp(`<p>${SENTINEL}CB(\\d+)${SENTINEL}</p>|${SENTINEL}CB(\\d+)${SENTINEL}`, 'g'),
      (_, a, b) => {
        const block = blocks[Number(a !== undefined ? a : b)];
        const cls = block.lang ? ` class="language-${block.lang}"` : '';
        return `<pre><code${cls}>${block.code}</code></pre>`;
      }
    );

    return html;
  }

  global.renderMarkdown = renderMarkdown;
})(window);
