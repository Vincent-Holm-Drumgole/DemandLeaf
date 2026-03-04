import "server-only";

export interface WpCredentials {
  username: string;
  appPassword: string;
}

export interface WpPost {
  id: number;
  link: string;
  status: string;
  date: string;
}

export interface WpDetectedPlugin {
  rankmath: boolean;
  yoast: boolean;
}

/**
 * WordPress REST API v2 client.
 * Uses Application Password authentication (WP 5.6+).
 */
export class WpClient {
  private readonly base: string;
  private readonly authHeader: string;

  constructor(siteUrl: string, credentials: WpCredentials) {
    this.base = `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2`;
    const token = Buffer.from(
      `${credentials.username}:${credentials.appPassword}`
    ).toString("base64");
    this.authHeader = `Basic ${token}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.base}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`WP API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<{ siteName: string }> {
    const siteInfoUrl = `${this.base.replace("/wp/v2", "")}`;
    const res = await fetch(siteInfoUrl, {
      headers: { Authorization: this.authHeader },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Connection test failed: ${res.status}`);
    }
    const data = (await res.json()) as { name?: string };
    return { siteName: data.name ?? "WordPress Site" };
  }

  async detectSeoPlugins(): Promise<WpDetectedPlugin> {
    try {
      const plugins = await this.request<{ plugin: string }[]>(
        "GET",
        "/plugins"
      );
      const names = plugins.map((p) => p.plugin.toLowerCase());
      return {
        rankmath: names.some((n) => n.includes("seo-by-rank-math")),
        yoast: names.some((n) => n.includes("wordpress-seo")),
      };
    } catch {
      return { rankmath: false, yoast: false };
    }
  }

  async createPost(args: {
    title: string;
    content: string;
    status: "draft" | "publish" | "future" | "private";
    slug: string;
    metaDescription?: string;
    focusKeyword?: string;
    schemaJson?: string;
    scheduledAt?: string; // ISO 8601
    authorId?: number;
    pluginDetected?: "rankmath" | "yoast" | "none";
  }): Promise<WpPost> {
    const body: Record<string, unknown> = {
      title: args.title,
      content: args.content,
      status: args.status,
      slug: args.slug,
    };
    if (args.scheduledAt) body.date = args.scheduledAt;
    if (args.authorId) body.author = args.authorId;

    if (args.pluginDetected === "rankmath") {
      body.meta = {
        rank_math_focus_keyword: args.focusKeyword ?? "",
        rank_math_description: args.metaDescription ?? "",
      };
    } else if (args.pluginDetected === "yoast") {
      body.meta = {
        _yoast_wpseo_metadesc: args.metaDescription ?? "",
        _yoast_wpseo_focuskw: args.focusKeyword ?? "",
      };
    }

    return this.request<WpPost>("POST", "/posts", body);
  }

  async updatePost(
    wpPostId: number,
    args: Record<string, unknown>
  ): Promise<WpPost> {
    return this.request<WpPost>("POST", `/posts/${wpPostId}`, args);
  }
}
