function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function renderMarkdown(src: string) {
  const lines = String(src).replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  const inline = (t: string) =>
    esc(t)
      .replace(/`([^`]+)`/g, (_, c) => `<code class="md-code">${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      const lang = ln.slice(3).trim();
      let code = "";
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code += `${lines[i]}\n`;
        i++;
      }
      i++;
      html += `<pre class="md-pre"><div class="md-pre-bar"><span>${esc(lang || "code")}</span></div><code>${esc(code.replace(/\n$/, ""))}</code></pre>`;
      continue;
    }
    if (/\|/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /\|/.test(lines[i + 1])) {
      const cells = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(ln);
      i += 2;
      let rows = "";
      while (i < lines.length && /\|/.test(lines[i])) {
        rows += `<tr>${cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
        i++;
      }
      html += `<table class="md-table"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
      continue;
    }
    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lv = h[1].length;
      html += `<h${lv} class="md-h md-h${lv}">${inline(h[2])}</h${lv}>`;
      i++;
      continue;
    }
    if (/^>\s?/.test(ln)) {
      html += `<blockquote class="md-quote">${inline(ln.replace(/^>\s?/, ""))}</blockquote>`;
      i++;
      continue;
    }
    if (/^\s*[-*]\s+\[[ x]\]/.test(ln) || /^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
      const ordered = /^\s*\d+\.\s+/.test(ln);
      let items = "";
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const raw = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        const chk = raw.match(/^\[([ x])\]\s+(.*)$/);
        if (chk) {
          const done = chk[1] === "x";
          items += `<li class="md-task ${done ? "done" : ""}"><span class="md-box">${done ? "✓" : ""}</span><span>${inline(chk[2])}</span></li>`;
        } else {
          items += `<li>${inline(raw)}</li>`;
        }
        i++;
      }
      const cls = /md-task/.test(items) ? "md-list md-tasks" : "md-list";
      html += ordered ? `<ol class="${cls}">${items}</ol>` : `<ul class="${cls}">${items}</ul>`;
      continue;
    }
    if (/^---+$/.test(ln)) {
      html += '<hr class="md-hr" />';
      i++;
      continue;
    }
    if (/^\s*$/.test(ln)) {
      i++;
      continue;
    }
    let para = ln;
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|>|```|---+$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !/\|/.test(lines[i])) {
      para += ` ${lines[i]}`;
      i++;
    }
    html += `<p class="md-p">${inline(para)}</p>`;
  }
  return html;
}
