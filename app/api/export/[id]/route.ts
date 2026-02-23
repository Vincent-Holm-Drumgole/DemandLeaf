import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { ExportRequest } from "@/types";
import { parseConvexId } from "@/lib/convex-id";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const blogId = parseConvexId(params.id, "blogs");
  if (!blogId) {
    return NextResponse.json({ error: "Invalid blog ID" }, { status: 400 });
  }

  let body: ExportRequest;
  try {
    body = (await request.json()) as ExportRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const format = body.format;
  if (!format || !["html", "markdown", "clipboard"].includes(format)) {
    return NextResponse.json(
      { error: "format must be 'html', 'markdown', or 'clipboard'" },
      { status: 400 }
    );
  }

  const convex = await getAuthedConvexClient();
  const blog = await convex.query(api.blogs.getExportData, {
    blogId,
  });

  if (!blog) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  switch (format) {
    case "html": {
      const htmlDocument = buildHtmlExport(blog);
      return new NextResponse(htmlDocument, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slugify(blog.title)}.html"`,
        },
      });
    }

    case "markdown": {
      return new NextResponse(blog.content ?? "", {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slugify(blog.title)}.md"`,
        },
      });
    }

    case "clipboard": {
      return NextResponse.json({
        content: blog.content,
        contentHtml: blog.contentHtml,
      });
    }

    default:
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
}

function buildHtmlExport(blog: {
  title: string;
  contentHtml: string | null;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(blog.title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 0 auto; padding: 2rem; line-height: 1.7; color: #1a1a1a; }
    h1 { font-size: 2rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.5rem; margin-top: 2rem; }
    h3 { font-size: 1.25rem; margin-top: 1.5rem; }
    p { margin: 1rem 0; }
    ul, ol { padding-left: 1.5rem; }
    blockquote { border-left: 3px solid #ddd; padding-left: 1rem; margin-left: 0; color: #555; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
${blog.contentHtml || "<p>No HTML content available.</p>"}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
