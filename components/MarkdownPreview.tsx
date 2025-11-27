import { Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import remarkBreaks from "remark-breaks";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from "rehype-sanitize";
import rehypeReact from "rehype-react";
import { MarkdownCodeBlock } from "./MarkdownCodeBlock";
import { MarkdownInlineCode } from "./MarkdownInlineCode";

const markdownSchema: RehypeSanitizeOptions["schema"] = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "input"],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), "className", "target", "rel", "ariaHidden", "tabIndex"],
    code: [...(defaultSchema.attributes?.code || []), "className"],
    pre: [...(defaultSchema.attributes?.pre || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
    input: [...(defaultSchema.attributes?.input || []), ["type", "checkbox"], "checked", "disabled"],
    h1: [...(defaultSchema.attributes?.h1 || []), "id"],
    h2: [...(defaultSchema.attributes?.h2 || []), "id"],
    h3: [...(defaultSchema.attributes?.h3 || []), "id"],
    h4: [...(defaultSchema.attributes?.h4 || []), "id"],
    h5: [...(defaultSchema.attributes?.h5 || []), "id"],
    h6: [...(defaultSchema.attributes?.h6 || []), "id"],
  },
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap", properties: { className: ["heading-anchor"] } })
  .use(rehypeExternalLinks, { target: "_blank", rel: ["noreferrer", "noopener"] })
  .use(rehypeHighlight)
  .use(rehypeSanitize, markdownSchema)
  .use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    development: process.env.NODE_ENV !== "production",
    jsxDEV: jsx,
    components: {
      pre: MarkdownCodeBlock,
      code: MarkdownInlineCode,
    },
  });

export function MarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const rendered = markdownProcessor.processSync(normalizeContent(content ?? "")).result as ReactNode;
  const classes = ["markdown-preview"];
  if (className) {
    classes.push(className);
  }

  return <div className={classes.join(" ")}>{rendered}</div>;
}

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}
