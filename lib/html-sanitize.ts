import * as cheerio from "cheerio";
import { isTag, type Element } from "domhandler";

const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  "*": new Set(["class"]),
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
};

export function sanitizeGeneratedHtml(html: string): string {
  const $ = cheerio.load(html, { xmlMode: false });

  $("*").each((_index, node) => {
    if (!isTag(node)) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      $(element).replaceWith($(element).text());
      return;
    }

    const allowed = new Set([
      ...(ALLOWED_ATTRIBUTES["*"] ?? []),
      ...(ALLOWED_ATTRIBUTES[tag] ?? []),
    ]);

    for (const attr of Object.keys(element.attribs ?? {})) {
      const lowerAttr = attr.toLowerCase();
      if (lowerAttr.startsWith("on") || !allowed.has(lowerAttr)) {
        $(element).removeAttr(attr);
      }
    }

    if (tag === "a") {
      const href = $(element).attr("href");
      if (!href || !isSafeLinkTarget(href)) {
        $(element).removeAttr("href");
      }

      if ($(element).attr("target") === "_blank") {
        $(element).attr("rel", "noopener noreferrer");
      }
    }

    if (tag === "img") {
      const src = $(element).attr("src");
      if (!src || !isSafeLinkTarget(src)) {
        $(element).remove();
      }
    }
  });

  return $.root().html() ?? "";
}

function isSafeLinkTarget(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}
