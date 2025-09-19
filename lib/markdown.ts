import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeExternalLinks from "rehype-external-links";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const markdownProcessor = remark()
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeExternalLinks, {
    target: "_blank",
    rel: ["noreferrer"],
  })
  .use(
    rehypeSanitize,
    {
      ...defaultSchema,
      tagNames: [
        ...(defaultSchema.tagNames ?? []),
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "del",
        "ins",
      ],
      attributes: {
        ...(defaultSchema.attributes ?? {}),
        a: [
          ...(defaultSchema.attributes?.a ?? []),
          "href",
          "title",
          "target",
          "rel",
        ],
        code: ["className"],
        span: ["className"],
      },
    },
  )
  .use(rehypeStringify, { allowDangerousCharacters: true });

export async function renderMarkdownToHtml(text: string): Promise<string> {
  const file = await markdownProcessor.process(text);
  return String(file);
}
