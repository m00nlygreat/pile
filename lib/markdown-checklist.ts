const TASK_LINE_RE = /^((?: {0,3}>[\t ]*)* {0,3}(?:[-+*]|\d+[.)])[\t ]+)(\[[ xX]\])(?=$|[\t ])/;
const FENCE_RE = /^(?: {0,3}>[\t ]*)*( {0,3})(`{3,}|~{3,})/;

function isFenceLine(line: string) {
  return line.match(FENCE_RE);
}

function taskLines(markdown: string) {
  const lines = markdown.split(/\r\n|\n|\r/);
  const matches: { line: number; prefixLength: number }[] = [];
  let fence: { marker: string; length: number } | null = null;

  lines.forEach((line, lineIndex) => {
    const fenceMatch = isFenceLine(line);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!fence) fence = { marker, length: fenceMatch[2].length };
      else if (fence.marker === marker && fenceMatch[2].length >= fence.length) fence = null;
      return;
    }
    if (fence) return;
    const taskMatch = line.match(TASK_LINE_RE);
    if (taskMatch) matches.push({ line: lineIndex, prefixLength: taskMatch[1].length });
  });

  return { lines, matches };
}

export function countMarkdownChecklistTasks(markdown: string) {
  return taskLines(markdown).matches.length;
}

export function toggleMarkdownChecklist(markdown: string, taskIndex: number, checked: boolean) {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) return null;
  const parsed = taskLines(markdown);
  const target = parsed.matches[taskIndex];
  if (!target) return null;

  const line = parsed.lines[target.line];
  const markerStart = target.prefixLength;
  parsed.lines[target.line] = `${line.slice(0, markerStart)}[${checked ? "x" : " "}]${line.slice(markerStart + 3)}`;
  return parsed.lines.join(markdown.match(/\r\n|\n|\r/)?.[0] ?? "\n");
}
