import { createElement, Fragment, type ReactNode } from "react";

const orderedListPattern = /^\d+\.\s+/;
const unorderedListPattern = /^[-*+]\s+/;

export function MarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseBlocks(content);
  const classes = ["markdown-preview"];
  if (className) {
    classes.push(className);
  }

  return <div className={classes.join(" ")}>{blocks.map(renderBlock)}</div>;
}

type BlockToken =
  | { type: "heading"; level: number; value: string }
  | { type: "paragraph"; value: string }
  | { type: "code"; language: string | null; value: string }
  | { type: "list"; ordered: boolean; items: string[] };

function parseBlocks(markdown: string): BlockToken[] {
  const lines = markdown.replace(/\r\n/g, "\n").split(/\n/);
  const tokens: BlockToken[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].startsWith("```")) {
        index += 1;
      }

      tokens.push({ type: "code", language, value: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      tokens.push({
        type: "heading",
        level: headingMatch[1].length,
        value: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (orderedListPattern.test(line) || unorderedListPattern.test(line)) {
      const items: string[] = [];
      const ordered = orderedListPattern.test(line);

      while (index < lines.length) {
        const current = lines[index];
        if ((ordered && orderedListPattern.test(current)) || (!ordered && unorderedListPattern.test(current))) {
          const item = current.replace(ordered ? orderedListPattern : unorderedListPattern, "").trim();
          items.push(item);
          index += 1;
          continue;
        }
        if (!current.trim()) {
          index += 1;
        }
        break;
      }

      tokens.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const current = lines[index];
      if (!current.trim()) {
        index += 1;
        break;
      }
      if (current.startsWith("```")) {
        break;
      }
      if (current.match(/^(#{1,6})\s+/)) {
        break;
      }
      if (orderedListPattern.test(current) || unorderedListPattern.test(current)) {
        break;
      }

      paragraphLines.push(current);
      index += 1;
    }

    tokens.push({ type: "paragraph", value: paragraphLines.join("\n") });
  }

  return tokens;
}

function renderBlock(token: BlockToken, blockIndex: number): ReactNode {
  if (token.type === "heading") {
    return createElement(
      `h${token.level}`,
      { key: `heading-${blockIndex}` },
      renderInline(token.value, blockIndex),
    );
  }

  if (token.type === "code") {
    return (
      <pre key={`code-${blockIndex}`}>
        <code>{token.value}</code>
      </pre>
    );
  }

  if (token.type === "list") {
    const Wrapper = token.ordered ? "ol" : "ul";
    return (
      <Wrapper key={`list-${blockIndex}`}>
        {token.items.map((item, itemIndex) => (
          <li key={`list-${blockIndex}-${itemIndex}`}>{renderInline(item, `${blockIndex}-${itemIndex}`)}</li>
        ))}
      </Wrapper>
    );
  }

  return (
    <p key={`paragraph-${blockIndex}`}>
      {renderInline(token.value, blockIndex)}
    </p>
  );
}

function renderInline(value: string, keyBase: number | string): ReactNode {
  const nodes: ReactNode[] = [];
  let remaining = value;
  let index = 0;

  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/;

  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) {
      pushPlain(nodes, remaining, `${keyBase}-${index}`);
      break;
    }

    if (match.index > 0) {
      const plain = remaining.slice(0, match.index);
      pushPlain(nodes, plain, `${keyBase}-${index}`);
      index += 1;
    }

    const token = match[0];
    nodes.push(handleInlineToken(token, `${keyBase}-${index}`));
    remaining = remaining.slice((match.index ?? 0) + token.length);
    index += 1;
  }

  return nodes.length === 1 ? nodes[0] : <Fragment key={`fragment-${keyBase}`}>{nodes}</Fragment>;
}

function handleInlineToken(token: string, key: string): ReactNode {
  if (token.startsWith("**") && token.endsWith("**")) {
    return <strong key={key}>{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>;
  }

  if (token.startsWith("__") && token.endsWith("__")) {
    return <strong key={key}>{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>;
  }

  if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
    return <em key={key}>{renderInline(token.slice(1, -1), `${key}-em`)}</em>;
  }

  if (token.startsWith("`") && token.endsWith("`")) {
    return (
      <code key={key} className="markdown-inline-code">
        {token.slice(1, -1)}
      </code>
    );
  }

  if (token.startsWith("[") && token.includes("](")) {
    const match = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      const label = match[1];
      const url = sanitizeUrl(match[2]);
      if (url) {
        return (
          <a key={key} href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        );
      }
      return label;
    }
  }

  return token;
}

function pushPlain(nodes: ReactNode[], text: string, key: string) {
  if (!text) {
    return;
  }

  const escaped = escapeHtml(text);
  const segments = escaped.split("\n");

  segments.forEach((segment, index) => {
    if (index > 0) {
      nodes.push(<br key={`${key}-br-${index}`} />);
    }
    if (segment.length > 0) {
      nodes.push(<Fragment key={`${key}-text-${index}`}>{segment}</Fragment>);
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}
