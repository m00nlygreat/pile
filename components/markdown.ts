import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const addClass = (node: HastNode, className: string) => {
  node.properties ??= {};
  const current = node.properties.className;
  const classes = Array.isArray(current) ? current : typeof current === "string" ? current.split(/\s+/) : [];
  node.properties.className = [...new Set([...classes, className])];
};

function markdownClasses() {
  const visit = (node: HastNode) => {
    if (node.type === "element") {
      if (node.tagName === "a") {
        node.properties ??= {};
        node.properties.target = "_blank";
        node.properties.rel = "noopener noreferrer";
      }
      if (/^h[1-4]$/.test(node.tagName ?? "")) {
        addClass(node, "md-h");
        addClass(node, `md-${node.tagName}`);
      }
      if (node.tagName === "p") addClass(node, "md-p");
      if (node.tagName === "blockquote") addClass(node, "md-quote");
      if (node.tagName === "ul" || node.tagName === "ol") addClass(node, "md-list");
      if (node.tagName === "table") addClass(node, "md-table");
      if (node.tagName === "hr") addClass(node, "md-hr");
      if (node.tagName === "code") addClass(node, "md-code");
      if (node.tagName === "input") addClass(node, "md-box");

      if (node.tagName === "li") {
        const hasTask = (node.children ?? []).some((child) => child.tagName === "input");
        if (hasTask) addClass(node, "md-task");
        const checked = (node.children ?? []).some((child) => child.tagName === "input" && Boolean(child.properties?.checked));
        if (checked) addClass(node, "done");
      }

      if (node.tagName === "pre") {
        addClass(node, "md-pre");
        const code = (node.children ?? []).find((child) => child.tagName === "code");
        const classes = code?.properties?.className;
        const lang = Array.isArray(classes)
          ? classes.find((name) => typeof name === "string" && name.startsWith("language-"))?.replace(/^language-/, "")
          : undefined;
        node.children = [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["md-pre-bar"] },
            children: [{ type: "element", tagName: "span", children: [{ type: "text", value: lang || "code" }] }],
          },
          ...(node.children ?? []),
        ];
      }
    }
    node.children?.forEach(visit);
  };
  return (tree: HastNode) => visit(tree);
}

const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ["target"], ["rel"]],
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
    div: [...(defaultSchema.attributes?.div ?? []), ["className"]],
    h1: [["className"]],
    h2: [["className"]],
    h3: [["className"]],
    h4: [["className"]],
    hr: [["className"]],
    input: [["className"], ["type", "checkbox"], ["checked"], ["disabled"]],
    li: [["className"]],
    ol: [["className"]],
    p: [["className"]],
    pre: [["className"]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className"]],
    table: [["className"]],
    ul: [["className"]],
  },
};

export function renderMarkdown(src: string) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeHighlight, { detect: true, ignoreMissing: true })
      .use(markdownClasses)
      .use(rehypeSanitize, schema)
      .use(rehypeStringify)
      .processSync(String(src))
  );
}
