# [Product Name TBD]: Engineering Build Specification
## Companion Document to Product Bible v4.0
## For Claude Code / Engineering Implementation

---

# HOW TO USE THIS DOCUMENT

This document translates the Product Bible v4.0 into exact engineering tasks. Each phase is broken into:
1. **Objective**: What the user should be able to do when this phase ships
2. **Prerequisites**: What must exist before this phase begins
3. **Tech stack decisions**: Frameworks, libraries, services to use
4. **Database schema**: Tables and relationships to create
5. **API routes**: Endpoints to build
6. **Services / modules**: Internal code architecture
7. **Prompts to write**: LLM prompt templates needed
8. **UI screens**: Frontend pages/components
9. **Tests**: What to validate before shipping
10. **Definition of done**: How we know the phase is complete

Reference: Product Bible v4.0 sections are cited as [PB Part X.Y]

---

# FOUNDATIONAL TECH STACK (Applies to All Phases)

## Application Framework
- **Frontend**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State management**: Zustand (lightweight, simple)
- **Backend**: Next.js API routes (serverless functions) for MVP, extract to dedicated services later if needed
- **Database**: PostgreSQL (via Supabase or Neon for managed hosting)
- **ORM**: Prisma
- **Authentication**: NextAuth.js (email/password + Google OAuth)
- **File storage**: Supabase Storage or S3
- **Hosting**: Vercel (frontend + API routes) + managed Postgres
- **Job queue**: Inngest or Trigger.dev (for async tasks like crawling, generation)
- **Vector database**: pgvector extension on PostgreSQL (for embeddings/similarity)
- **LLM**: Anthropic Claude API (Sonnet 4.6 + Haiku 4.5)
- **Monitoring**: PostHog (product analytics) + Sentry (error tracking)

## Project Structure

```
/app                    # Next.js App Router pages
  /page.tsx             # Landing / onboarding (Screen 1)
  /analyze/page.tsx     # Crawl results (Screen 2-3)
  /generate/page.tsx    # Blog generation (Screen 4-5)
  /review/[id]/page.tsx # Blog review (Screen 6)
  /signup/page.tsx      # Account creation (Screen 7)
  /dashboard/page.tsx   # Main dashboard (post-signup)
  /blog/[id]/page.tsx   # Blog editor/viewer
  /settings/page.tsx    # Workspace settings
  /api/                 # API routes
    /crawl/route.ts
    /generate/route.ts
    /voice/route.ts
    /blog/route.ts
    /feedback/route.ts
    /export/route.ts
    /auth/[...nextauth]/route.ts
/lib                    # Shared utilities
  /ai/                  # LLM interaction layer
    /client.ts          # Anthropic API client wrapper
    /prompts/           # Prompt templates (versioned)
    /models.ts          # Model routing logic
  /crawler/             # Website crawling
  /seo/                 # SEO scoring & optimization
  /detection/           # Anti-detection algorithms
  /voice/               # Voice extraction & matching
  /quality/             # Quality gate logic
/prisma
  /schema.prisma        # Database schema
/types                  # TypeScript type definitions
/components             # React components
  /ui/                  # shadcn components
  /blog-editor/         # Blog display/edit components
  /onboarding/          # Onboarding flow components
  /scores/              # Score display components
```

---

# PHASE 1: MVP ("Holy Shit" Moment)

**Product Bible Reference:** Part 2 (Onboarding), Part 3 (Archetypes - 3 of 8), Part 4 (Narrative), Part 6.2-6.3 (SEO), Part 8 (Writing System), Part 10 (Quality Gates), Part 11 (Failure Modes FM-1 through FM-4), Part 12 (Prompts), Part 23.2-23.4 (Cost/Model Routing), Part 25.2 (Activation Metrics)

## 1.1 Objective

A user pastes their website URL and receives a publishable, SEO-optimized, human-quality blog post within 10 minutes. No account required for first blog. No external data APIs. No publishing integration. Just exceptional writing from a URL.

## 1.2 Prerequisites

- Anthropic API key (Sonnet 4.6 + Haiku 4.5 access)
- Vercel account + managed Postgres
- Domain name secured

## 1.3 Database Schema

```sql
-- Workspaces (created after signup, but crawl data stored in session before that)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  url TEXT,                           -- Company website URL
  industry TEXT,
  audience_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,                 -- null if OAuth only
  name TEXT,
  auth_provider TEXT DEFAULT 'email', -- email, google
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Profiles
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  voice_attributes JSONB NOT NULL,    -- {formality: 7, humor: 3, jargon: 5, ...}
  voice_description TEXT NOT NULL,    -- "Confident and technical..."
  vocabulary_preferences JSONB,       -- {preferred: [...], avoid: [...]}
  writing_examples TEXT[],            -- Best paragraphs from crawled content
  source_quality TEXT,                -- 'strong', 'mixed', 'limited', 'none'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawled Pages (raw data from website crawl)
CREATE TABLE crawled_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_type TEXT,                     -- 'homepage', 'about', 'blog', 'product', 'other'
  title TEXT,
  content TEXT,                       -- Extracted text content
  word_count INTEGER,
  crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blogs (the main content entity)
CREATE TABLE blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT,
  content TEXT NOT NULL,              -- The blog body (Markdown)
  content_html TEXT,                  -- Rendered HTML version
  meta_title TEXT,
  meta_description TEXT,
  focus_keyword TEXT,
  archetype TEXT NOT NULL,            -- 'how_to', 'listicle', 'definitive_guide', etc.
  word_count INTEGER,
  status TEXT DEFAULT 'draft',        -- 'draft', 'approved', 'exported', 'published'
  
  -- Scores (stored for display and tracking)
  seo_score INTEGER,                  -- 0-100
  quality_score INTEGER,              -- 0-100 (composite)
  detection_risk TEXT,                -- 'low', 'medium', 'high'
  detection_risk_score INTEGER,       -- 0-100
  burstiness_score FLOAT,
  readability_score FLOAT,            -- Flesch-Kincaid
  
  -- Generation metadata
  model_used TEXT,                    -- 'sonnet-4.6'
  input_tokens INTEGER,
  output_tokens INTEGER,
  generation_cost_cents INTEGER,      -- Track actual cost
  generation_time_ms INTEGER,
  prompt_version TEXT,                -- Which prompt version was used
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Feedback (paragraph-level thumbs up/down)
CREATE TABLE blog_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES blogs(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  feedback TEXT NOT NULL,             -- 'positive', 'negative'
  comment TEXT,                       -- Optional user comment
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Versions (track all prompt templates)
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_name TEXT NOT NULL,          -- 'blog_draft', 'voice_check', 'meta_gen', etc.
  version TEXT NOT NULL,              -- 'v1.0', 'v1.1', etc.
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Storage (for pre-signup crawl data)
CREATE TABLE anonymous_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  crawl_data JSONB,                   -- Temporary storage before account creation
  voice_profile JSONB,
  blog_data JSONB,
  expires_at TIMESTAMPTZ NOT NULL,    -- 24 hours
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events (internal metrics)
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,           -- 'first_blog_generated', 'blog_exported', etc.
  user_id UUID,                       -- null for anonymous
  session_id UUID,
  properties JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 1.4 API Routes

```
POST /api/crawl
  Input: { url: string }
  Process: Crawl website, extract text, detect industry/audience, build voice profile
  Output: { sessionId, companyName, industry, audience, voiceProfile, pagesFound, sourceQuality }
  Models: Puppeteer/Cheerio (crawl), Haiku (industry classification), Sonnet (voice extraction)

POST /api/generate
  Input: { sessionId, keyword: string, archetype: string }
  Process: Generate content brief, write blog, run quality gates
  Output: { blogId, content, title, metaTitle, metaDescription, scores }
  Models: Sonnet (brief + writing + revision), Haiku (voice check, SEO gaps), Code (scoring)

GET /api/blog/:id
  Output: Full blog with all scores and metadata

POST /api/blog/:id/feedback
  Input: { paragraphIndex: number, feedback: 'positive' | 'negative', comment?: string }

POST /api/export/:id
  Input: { format: 'html' | 'markdown' | 'clipboard' }
  Output: Formatted content

POST /api/auth/signup
  Input: { email, password, sessionId }
  Process: Create user, create workspace, migrate session data to workspace

POST /api/auth/login
  Input: { email, password }

GET /api/dashboard
  Output: User's blogs list with scores and stats
```

## 1.5 Core Services / Modules

### Module: Crawler (`/lib/crawler/`)

```typescript
// crawler.ts
interface CrawlResult {
  pages: CrawledPage[];
  companyName: string;
  sitemapFound: boolean;
}

interface CrawledPage {
  url: string;
  type: 'homepage' | 'about' | 'blog' | 'product' | 'other';
  title: string;
  content: string;       // Cleaned text, no HTML
  wordCount: number;
}

// Implementation:
// 1. Fetch homepage HTML (use fetch, not headless browser for MVP speed)
// 2. Parse with cheerio: extract text, find sitemap link, find blog/about links
// 3. If sitemap found: parse it, identify blog posts
// 4. Crawl up to 10 pages: homepage, about, 5-8 most recent blog posts
// 5. For each page: strip HTML, extract clean text, classify page type
// 6. Extract company name from <title>, <meta>, or <h1>
// 
// Failure mode FM-4:
// - URL invalid: return error with message
// - Site blocks crawl: return error, offer manual input fallback
// - SPA with no content: return error, offer manual input fallback
// - Timeout after 15 seconds: return partial results or error
//
// NO AI USED. Pure HTTP + HTML parsing.
```

### Module: Voice Engine (`/lib/voice/`)

```typescript
// extract.ts - Uses Sonnet 4.6
// Input: Array of crawled page content (blog posts preferred)
// Output: VoiceProfile object
//
// Process:
// 1. Select best content sources (blog posts > about page > homepage)
// 2. If blog posts exist: send 3-5 best (by length/quality) to Sonnet
// 3. Sonnet extracts: formality level, humor usage, jargon level,
//    sentence complexity, preferred vocabulary, tone attributes,
//    2-3 example paragraphs that best represent the voice
// 4. If no blog posts: use homepage + about page for limited profile
// 5. Assess source quality: 'strong' (5+ good blogs), 'mixed' (some blogs, 
//    varying quality), 'limited' (<3 blogs or poor quality), 'none' (no blogs)

// match.ts - Uses Haiku 4.5
// Input: Generated blog text + VoiceProfile
// Output: Per-paragraph voice consistency score (1-5) + flags
//
// Process: Send voice profile + generated text to Haiku
// Haiku rates each paragraph, flags any below score 3
// Returns: { paragraphs: [{ index, score, flag?, reason? }] }
```

### Module: Blog Generator (`/lib/ai/`)

```typescript
// generator.ts - Uses Sonnet 4.6
// This is the core writing engine.
//
// Input: {
//   keyword: string,
//   archetype: 'how_to' | 'listicle' | 'definitive_guide',
//   voiceProfile: VoiceProfile,
//   companyContext: string,      // Summarized from crawled pages
//   industry: string,
//   audience: string
// }
//
// Process (sequential):
//
// STEP 1: Generate Brief (Sonnet)
//   - Determine search intent from keyword
//   - Create outline (H2/H3 structure) appropriate for archetype
//   - Generate 3 hook options
//   - Identify unique angle based on company context
//   Output: ContentBrief
//
// STEP 2: Generate Draft (Sonnet)
//   - Use 5-layer prompt architecture [PB Part 12.2]:
//     Layer 1: Base system prompt (writing principles, banned list, anti-detection rules)
//     Layer 2: Voice profile
//     Layer 3: Archetype-specific instructions
//     Layer 4: Company context + brief
//     Layer 5: "Write the blog"
//   - Single call, full blog output
//   Output: Raw blog text (Markdown)
//
// STEP 3: Voice Check (Haiku)
//   - Check draft against voice profile
//   - Flag inconsistent paragraphs
//   Output: Flags with reasons
//
// STEP 4: SEO Optimization Check (Code)
//   - Run SEO checklist programmatically
//   - Check: keyword in title, keyword in first 10%, keyword density,
//     heading structure, meta title length, meta description length,
//     internal/external link suggestions, word count vs target
//   Output: SEO score + list of issues
//
// STEP 5: Anti-Detection Check (Code)
//   - Calculate burstiness (sentence length std dev)
//   - Check banned words/phrases
//   - Check sentence length variation
//   - Check paragraph length variation  
//   - Check for structural tells (rule of three, etc.)
//   Output: Detection risk score + flagged sections
//
// STEP 6: Revision Pass (Sonnet, only if needed)
//   - If voice flags OR detection flags exist:
//   - Send ONLY the flagged sections back to Sonnet with specific instructions
//   - "Rewrite this paragraph to [fix voice/reduce detection risk]. 
//      Specific issue: [reason]. Voice profile: [profile]."
//   - Replace flagged sections in the draft
//   Output: Revised blog text
//
// STEP 7: Meta Generation (Haiku)
//   - Generate 3 meta title options (50-60 chars)
//   - Generate 3 meta description options (120-155 chars)
//   - Auto-select best, user can change later
//   Output: metaTitle, metaDescription
//
// STEP 8: Final Scoring (Code)
//   - Recalculate all scores on final version
//   - SEO score (0-100)
//   - Quality score (composite of SEO + unique value + readability)
//   - Detection risk (low/medium/high)
//   - Readability (Flesch-Kincaid)
//   Output: Final scores object

// Cost tracking:
// After each LLM call, log input_tokens, output_tokens, model, cost
// Sum all calls for total generation cost
// Store on the blog record
```

### Module: SEO Scorer (`/lib/seo/`)

```typescript
// scorer.ts - NO AI. Pure code.
//
// Input: Blog content (markdown) + focus keyword + meta title + meta description
// Output: { score: number (0-100), checks: CheckResult[] }
//
// Checks (each worth points):
// - Focus keyword in SEO title (10 pts)
// - Focus keyword in first 10% of content (8 pts)
// - Focus keyword in meta description (8 pts)
// - Focus keyword in URL/slug (7 pts)
// - Focus keyword in at least one H2 (7 pts)
// - Keyword density 0.5-1.5% (8 pts)
// - SEO title length 50-60 chars (5 pts)
// - Meta description 120-155 chars (5 pts)
// - At least 2 H2 headings (5 pts)
// - Content length >= 1000 words (5 pts)
// - At least 1 external link (4 pts)
// - At least 1 image alt text suggestion (4 pts)
// - Short paragraphs (avg < 4 sentences) (4 pts)
// - Flesch readability 50-70 (4 pts)
// - Heading hierarchy valid (H1 > H2 > H3) (4 pts)
// - URL slug is clean (3-5 words, lowercase, hyphens) (4 pts)
// - Content uses subheadings every 300 words (4 pts)
// - Meta title unique (not just keyword) (4 pts)
//
// Each check returns: { name, passed, points, maxPoints, suggestion }
// Total = sum(points) / sum(maxPoints) * 100
```

### Module: Anti-Detection (`/lib/detection/`)

```typescript
// detector.ts - NO AI. Pure code.
//
// Input: Blog content text
// Output: { riskScore: number, riskLevel: 'low'|'medium'|'high', flags: Flag[] }
//
// Algorithms:
//
// 1. Burstiness Analysis
//    - Split into sentences
//    - Calculate sentence lengths (word count per sentence)
//    - Compute: mean, standard deviation, % under 8 words, % over 25 words
//    - Flag if: SD < 8, or < 15% short sentences, or < 10% long sentences
//
// 2. Banned Word/Phrase Check
//    - Load blacklist from Appendix A [PB Appendix A]
//    - Scan content for exact matches (case-insensitive)
//    - Flag each occurrence with location
//
// 3. Structural Pattern Check
//    - Detect rule-of-three (3 items in list, 3 examples, 3 adjectives)
//    - Detect "Whether you're a X, Y, or Z" pattern
//    - Detect "In today's X" opening
//    - Detect "In summary/conclusion" closing
//    - Detect excessive parallelism (3+ consecutive sentences with same structure)
//    - Count em dashes
//
// 4. Paragraph Variation
//    - Calculate paragraph lengths
//    - Flag if 2+ consecutive paragraphs within 10 words of each other
//    - Flag if fewer than 3 distinct paragraph lengths per 500 words
//
// 5. Heading Variation
//    - Check heading styles (question, statement, how-to, etc.)
//    - Flag if all headings follow same pattern
//
// Scoring:
//   Each flag adds risk points. 
//   0-20 = Low, 21-50 = Medium, 51+ = High
//   Banned word = 5 pts each
//   Structural pattern = 8 pts each
//   Low burstiness = 15 pts
//   Low paragraph variation = 10 pts
```

### Module: Quality Gates (`/lib/quality/`)

```typescript
// gates.ts - Mix of code and Haiku
//
// Input: Blog object with all scores
// Output: { passed: boolean, gates: GateResult[], overallScore: number }
//
// Gate 1: SEO Score >= 80 (Code - already computed)
// Gate 2: Detection Risk = 'low' (Code - already computed)
// Gate 3: Readability in target range (Code - Flesch-Kincaid)
// Gate 4: Word count meets minimum for archetype (Code)
//   - how_to: >= 1200
//   - listicle: >= 1200
//   - definitive_guide: >= 2500
// Gate 5: Heading structure valid (Code)
// Gate 6: No banned words remaining (Code)
//
// Note: Gates 3 and 4 from Product Bible (AEO score, Unique Value score)
// are deferred to Phase 2+ when knowledge base and AEO features exist.
//
// Failure handling [PB Part 11.2]:
// Each failed gate returns: { gate, passed: false, reason, autoFixable, suggestion }
// Auto-fixable issues trigger automatic revision before showing to user.
// Non-fixable issues shown to user with specific action suggestions.
```

## 1.6 Prompt Templates to Write

### Prompt 1: Voice Extraction (Sonnet 4.6)

```
SYSTEM:
You are a brand voice analyst. Analyze the provided writing samples and extract 
a detailed voice profile. Be specific and precise.

Do NOT use these words in your analysis: delve, robust, seamless, leverage, 
comprehensive, holistic, nuanced, multifaceted, paradigm, synergy.

USER:
Analyze the following content from [COMPANY_NAME]'s website and extract their 
brand voice profile.

CONTENT SAMPLES:
[CRAWLED_CONTENT - up to 3,000 tokens of best blog/page content]

Return a JSON object with:
{
  "voice_description": "2-3 sentence natural language description of the voice",
  "formality": 1-10 (1=very casual, 10=very formal),
  "humor": 1-10 (1=never, 10=constant),
  "jargon_level": 1-10 (1=always plain, 10=highly technical),
  "sentence_complexity": 1-10 (1=very simple, 10=complex academic),
  "tone_attributes": ["confident", "approachable", etc. - 3-5 attributes],
  "preferred_vocabulary": ["words this brand tends to use"],
  "avoided_vocabulary": ["words this brand avoids"],
  "writing_examples": ["2-3 example paragraphs from the content that best represent the voice"],
  "source_quality": "strong|mixed|limited"
}
```

### Prompt 2: Industry Classification (Haiku 4.5)

```
SYSTEM:
Classify the company into an industry and identify their target audience.
Return JSON only. No explanation.

USER:
Company website content:
[HOMEPAGE_TEXT - first 500 words]
[ABOUT_TEXT - first 500 words]

Return:
{
  "company_name": "detected name",
  "industry": "specific industry (e.g. 'B2B SaaS - Marketing Automation')",
  "audience": "primary audience description",
  "audience_expertise": "beginner|intermediate|advanced|expert"
}
```

### Prompt 3: Blog Draft Generation (Sonnet 4.6)

See full 5-layer architecture in [PB Part 12.4]. This is the primary prompt. 
Must include:
- Layer 1: Base writing principles + complete banned word/phrase list + anti-detection instructions
- Layer 2: Voice profile (JSON from Prompt 1 output)
- Layer 3: Archetype-specific instructions (3 variants for MVP: how_to, listicle, definitive_guide)
- Layer 4: Company context + keyword + outline
- Layer 5: Generation instruction

**Archetype-specific Layer 3 variants:**

HOW_TO:
```
Write a step-by-step how-to article. Structure:
- Hook: Open with the problem this solves or a surprising fact. NOT "In today's..."
- Brief answer: Give the core answer in the first 100 words
- Steps: Numbered, clear, actionable. Each step = one specific action.
- For each step: what to do, why it matters, common mistake to avoid
- Closing: What success looks like. One specific next action.
Tone: helpful teacher. Patient but not condescending.
```

LISTICLE:
```
Write a numbered list article. Structure:
- Hook: Why this list matters. A specific claim or stat. NOT "Whether you're a..."
- Items: Each gets a subheading, 100-200 words of genuine value, not just a name and blurb
- Order: Best/most important first (or state your ordering principle)
- Each item: what it is, why it's on the list, who it's best for, a specific tip or detail
- Closing: Your top 1-2 picks with reasoning. A concrete next step.
Tone: opinionated curator. You've used these, not just listed them.
```

DEFINITIVE_GUIDE:
```
Write a comprehensive guide. Structure:
- Hook: Why this topic matters now. A specific stat or trend. NOT generic.
- Table of contents (implied by heading structure)
- Sections: Progress from foundations to advanced. Each section stands alone but builds.
- Include: definitions, examples, common mistakes, pro tips, data points
- Closing: Summary framework or checklist. What to do first.
Tone: authoritative expert. Deep but accessible. 
Guide structure must feel like a journey, not a list of sections.
```

### Prompt 4: Voice Adherence Check (Haiku 4.5)

```
SYSTEM:
Compare the blog against the voice profile. Rate each paragraph 1-5 for voice 
consistency. Only flag paragraphs scoring below 3. Return JSON.

USER:
VOICE PROFILE:
[VOICE_PROFILE_JSON]

BLOG TEXT:
[FULL_BLOG_TEXT]

Return:
{
  "flags": [
    { "paragraph_index": 0, "score": 2, "reason": "Too formal. Profile is casual." },
    ...
  ],
  "overall_score": 4.2
}
Return empty flags array if all paragraphs score 3+.
```

### Prompt 5: Section Revision (Sonnet 4.6)

```
SYSTEM:
[LAYER 1: Base system prompt - same as draft generation]
[LAYER 2: Voice profile - same as draft generation]

You are revising specific sections of a blog post. Rewrite ONLY the flagged 
sections. Keep all other content exactly the same. Match the voice profile precisely.

USER:
FULL BLOG:
[BLOG_TEXT]

SECTIONS TO REVISE:
[For each flag:]
Paragraph [INDEX]: "[ORIGINAL_TEXT]"
Issue: [REASON - e.g. "detected as AI due to low burstiness" or "voice too formal"]
Instruction: [SPECIFIC FIX - e.g. "Vary sentence lengths more. Add a short fragment." 
or "Make more casual, use contractions"]

Return the complete blog with only the flagged sections rewritten.
```

### Prompt 6: Meta Generation (Haiku 4.5)

```
SYSTEM:
Generate SEO meta titles and descriptions. Return JSON with 3 options each.

Rules:
- Title: 50-60 characters, include focus keyword naturally, use a number or power word
- Description: 120-155 characters, include a hook, imply a benefit, include subtle CTA
- Match the brand voice: [2-3 key voice attributes]
- NEVER start with "Discover", "Unlock", "Master", or "Explore"

USER:
Focus keyword: [KEYWORD]
Blog title: [TITLE]
Blog summary: [FIRST_PARAGRAPH]
Archetype: [ARCHETYPE]

Return:
{
  "titles": ["option1", "option2", "option3"],
  "descriptions": ["option1", "option2", "option3"],
  "recommended_title": 0,
  "recommended_description": 0
}
```

## 1.7 UI Screens to Build

### Screen 1: Landing / Onboarding (`/app/page.tsx`)
- Clean, minimal design. One input field. One button.
- URL input with validation (must include protocol or auto-add https://)
- "Analyze My Site" button (disabled until valid URL)
- Below: "No credit card required. No setup. Just paste and go."
- Loading state transitions to Screen 2

### Screen 2-3: Crawl + Results (`/app/analyze/page.tsx`)
- Animated progress indicator during crawl (3-10 seconds)
- Step indicators: "Reading homepage... Reading about page... Scanning blogs..."
- Page counter animation
- Results display: Company name, Industry (editable dropdown), Audience (editable text), Voice preview (2-3 sentences), Source quality badge, Pages found count
- "Looks right? Let's write your first blog" CTA
- "Edit details" secondary link
- Error states for FM-4 (crawl failures): clear message + fallback option

### Screen 4-5: Blog Setup + Generation (`/app/generate/page.tsx`)
- Topic input: text field for keyword/topic
- "Suggest a topic" button (generates suggestion from crawl data)
- Archetype selector: 3 cards (How-To, Listicle, Guide) with brief descriptions, one auto-selected
- "Generate Blog" CTA
- Generation progress (30-90 seconds): animated step indicator showing 5 stages
- Must feel intentional, not broken. Use real progress from the pipeline steps.

### Screen 6: Blog Review (`/app/review/[id]/page.tsx`)
- **Main area**: Blog displayed in clean reading format (rendered Markdown)
- Each paragraph has a subtle hover state showing thumbs up/down icons
- **Right sidebar**:
  - SEO Score: circular gauge (0-100), color-coded (red < 60, yellow 60-79, green 80+)
  - Quality Score: circular gauge
  - Detection Risk: badge (Low/Medium/High with color)
  - Readability: Flesch-Kincaid score with label
  - Word count
  - Focus keyword
  - Archetype badge
- **Top bar**: 
  - "Export as HTML" button
  - "Copy to Clipboard" button
  - "Download Markdown" button
- **Bottom banner** (for anonymous users): 
  - "Happy with this? Create your account to save it and write more."
  - CTA to signup

### Screen 7: Signup (`/app/signup/page.tsx`)
- Email + password form
- Google OAuth button
- After signup: redirect to dashboard with the blog saved
- Progressive nudge: "Want to make your next blog even better?"

### Dashboard (`/app/dashboard/page.tsx`)
- Blog list (cards): title, archetype badge, date, scores (SEO, Quality, Detection)
- "Write New Blog" button (repeats Screen 4 flow but with workspace context)
- Empty state for new users: celebrate the first blog, prompt for second
- Sidebar: workspace name, settings link

## 1.8 Tests / Validation Criteria

### Functional Tests
- [ ] Crawl: Valid URL returns company name, industry, and voice profile within 15 seconds
- [ ] Crawl: Invalid URL shows error message, not a crash
- [ ] Crawl: Site with no blog posts returns 'none' source quality and still generates voice
- [ ] Generate: Blog is generated within 90 seconds for a standard keyword
- [ ] Generate: Blog contains focus keyword in title, first paragraph, and at least one heading
- [ ] Generate: Blog word count is within archetype range
- [ ] Generate: Blog contains zero banned words from Appendix A
- [ ] Generate: SEO score is 80+ on first generation (>80% of the time)
- [ ] Generate: Detection risk is 'low' on first generation (>70% of the time)
- [ ] Export: HTML export produces valid, clean HTML
- [ ] Export: Markdown export preserves all formatting
- [ ] Export: Clipboard copy works
- [ ] Signup: Email signup creates user, workspace, migrates session data
- [ ] Signup: Google OAuth creates user, workspace, migrates session data
- [ ] Dashboard: Shows all generated blogs with correct scores

### Quality Tests (Manual)
- [ ] Generate 10 blogs across different industries and keywords
- [ ] Each blog reads as human-written to a marketing professional
- [ ] Voice varies noticeably between different company crawl profiles
- [ ] No blog contains common AI tells (check against full Appendix A)
- [ ] Blogs have genuine narrative hooks (not "In today's..." or definitions)
- [ ] Blogs have momentum (sections don't feel disconnected)
- [ ] Blogs have a satisfying conclusion (not "In summary...")

### Performance Tests
- [ ] Crawl completes in < 15 seconds for standard websites
- [ ] Blog generation completes in < 120 seconds (including all passes)
- [ ] Total API cost per blog is < $0.20
- [ ] Page load time < 2 seconds on all screens

### Metrics Instrumentation
- [ ] Track: time_to_first_blog (signup to generation complete)
- [ ] Track: first_blog_completion_rate (% of URL-pasters who see a generated blog)
- [ ] Track: first_blog_approval_rate (% who give positive feedback or export)
- [ ] Track: signup_conversion_rate (% who create account after seeing blog)
- [ ] Track: cost_per_blog (sum of all API calls)

## 1.9 Definition of Done

Phase 1 is complete when:
1. A non-technical user can paste a URL and receive a blog post within 5 minutes
2. The blog passes SEO score >= 80 on at least 80% of generations
3. The blog passes detection risk = 'low' on at least 70% of generations
4. 10 manual quality tests across different industries confirm human-quality writing
5. Signup and blog persistence work end-to-end
6. Export in all 3 formats works
7. All functional tests pass
8. Cost per blog is under $0.20
9. Analytics events are firing for all activation metrics

---

# PHASE 2: BRAND INTELLIGENCE DEEPENING

**Product Bible Reference:** Part 5 (Brand Intelligence), Part 3.2 (5 additional archetypes), Part 8.5 (Confidence Training), Part 11.2 FM-2 (Thin KB)

## 2.1 Objective

Users who invest in configuring their workspace get dramatically better output. Knowledge base import, full voice builder, unique value library, AI-Assisted mode with learning from edits, and all 8 content archetypes.

## 2.2 Prerequisites

Phase 1 complete and deployed.

## 2.3 New Database Schema

```sql
-- Knowledge Base Entries
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,           -- 'company_info', 'product', 'audience', 'competitor',
                                      -- 'industry', 'customer_story', 'expert_insight',
                                      -- 'proprietary_data', 'hot_take', 'lesson_learned',
                                      -- 'methodology', 'thought_leadership_position'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),             -- For similarity search
  metadata JSONB,                     -- Type-specific metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Never-Say List (workspace-specific banned words beyond global list)
CREATE TABLE never_say_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  words TEXT[] NOT NULL,
  phrases TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog Edit History (for AI-Assisted mode learning)
CREATE TABLE blog_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES blogs(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edit_type TEXT,                      -- 'tone', 'factual', 'restructure', 'style', 'addition', 'deletion'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Calibration Samples
CREATE TABLE voice_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  sample_text TEXT NOT NULL,
  user_rating INTEGER,                -- 1-10
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Confidence Scores (per workspace, tracked over time)
CREATE TABLE confidence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  blog_id UUID REFERENCES blogs(id),
  voice_match_score FLOAT,
  user_approval BOOLEAN,
  feedback_positive_pct FLOAT,        -- % of paragraphs with positive feedback
  edit_ratio FLOAT,                   -- % of text edited (AI-Assisted mode)
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 2.4 New API Routes

```
POST /api/knowledge-base           # Add entry (with auto-embedding)
GET  /api/knowledge-base           # List entries (filterable by type)
PUT  /api/knowledge-base/:id       # Update entry
DELETE /api/knowledge-base/:id     # Delete entry

POST /api/voice/builder            # Start guided voice builder (returns questions)
POST /api/voice/calibrate          # Generate calibration samples
POST /api/voice/calibrate/rate     # Rate a sample

POST /api/never-say                # Update never-say list

POST /api/blog/:id/edit            # Save human edits (AI-Assisted mode)
GET  /api/confidence/:workspaceId  # Get confidence dashboard data
```

## 2.5 New Modules

### Knowledge Base Context Selector (`/lib/knowledge/`)

```typescript
// selector.ts
// Input: keyword/topic + archetype + all KB entries with embeddings
// Output: Selected entries (1,000-3,000 tokens) most relevant to this blog
//
// Algorithm [PB Part 12.3]:
// 1. Embed the keyword/topic
// 2. Cosine similarity against all KB entry embeddings
// 3. Take top 10 matches
// 4. Re-rank by archetype priority:
//    - Thought Leadership: boost 'hot_take', 'thought_leadership_position', 'expert_insight'
//    - How-To: boost 'methodology', 'lesson_learned'
//    - Data Study: boost 'proprietary_data'
//    - Case Study: boost 'customer_story'
//    - Comparison: boost 'product', 'competitor'
// 5. Recency weight: entries from last 30 days get 1.5x boost
// 6. Truncate to fit 3,000 token budget (compress long entries via Haiku)
// 7. Return selected entries
```

### Edit Learning System (`/lib/voice/learning.ts`)

```typescript
// When user saves edits in AI-Assisted mode:
// 1. Diff original vs edited text per paragraph
// 2. For each changed paragraph, classify the edit type (Haiku):
//    - Tone adjustment (formality, humor, etc.)
//    - Factual correction (added specific details)
//    - Style change (sentence restructuring)
//    - Voice correction (vocabulary swap)
//    - Content addition (new information)
//    - Content removal (trimmed fluff)
// 3. Store in blog_edits table
// 4. Periodically (every 10 edits), analyze patterns:
//    - "User consistently makes paragraphs more casual" -> adjust voice formality
//    - "User consistently adds specific numbers" -> prompt for more data in briefs
//    - "User consistently removes hedging language" -> add to never-say list
// 5. Surface insights on confidence dashboard
```

## 2.6 New UI Screens

- Knowledge base management page (add/edit/delete entries by category)
- Voice builder wizard (3-step questionnaire from PB Part 5.4)
- Voice calibration screen (3 samples, rate each, iterate)
- AI-Assisted mode: blog editor with tracked changes (diff view)
- Confidence dashboard (voice match trend, edit ratio trend, approval rate)
- Never-say list manager
- 5 new archetype cards in blog setup screen

## 2.7 Definition of Done

- Knowledge base CRUD works with embedding generation
- Context selector retrieves relevant entries for blog generation
- Voice builder creates usable profiles from questionnaire alone
- Calibration flow generates 3 samples, user rates, profile adjusts
- AI-Assisted mode tracks edits and classifies edit types
- Edit patterns influence future generations (after 10+ edits)
- All 8 archetypes generate distinct, appropriate content
- Blogs with full KB score measurably higher on quality gates than zero-config blogs

---

# PHASE 3: STRATEGY & KEYWORD INTELLIGENCE

**Product Bible Reference:** Part 6.4 (Keyword Strategy), Part 9 (Briefing System), Part 23.5 (DataForSEO)

## 3.1 Objective

The platform tells users what to write, not just how. DataForSEO integration provides keyword data. Strategy builder works backward from business outcomes. Briefing system synthesizes data into actionable briefs.

## 3.2 Prerequisites

Phase 2 complete. DataForSEO account with API access ($50 minimum).

## 3.3 New Database Schema

```sql
-- SEO Strategies
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_outcomes JSONB,            -- What the company wants to achieve
  target_audience JSONB,
  status TEXT DEFAULT 'active',       -- 'active', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keywords
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id),
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  keyword_difficulty INTEGER,         -- 0-100
  cpc FLOAT,
  search_intent TEXT,                 -- 'informational', 'commercial', 'transactional', 'navigational'
  buyer_journey_stage TEXT,           -- 'awareness', 'consideration', 'decision'
  opportunity_score FLOAT,            -- Calculated: volume * (1-KD/100) * relevance
  assigned_blog_id UUID REFERENCES blogs(id),  -- Prevent cannibalization
  cluster_id UUID REFERENCES topic_clusters(id),
  status TEXT DEFAULT 'unassigned',   -- 'unassigned', 'briefed', 'written', 'published', 'ranking'
  data_fetched_at TIMESTAMPTZ,        -- For cache management
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic Clusters
CREATE TABLE topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id),
  name TEXT NOT NULL,
  pillar_keyword TEXT,
  pillar_blog_id UUID REFERENCES blogs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Briefs
CREATE TABLE content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES keywords(id),
  brief_data JSONB NOT NULL,          -- Full 17-component brief
  status TEXT DEFAULT 'draft',        -- 'draft', 'approved', 'rejected', 'written'
  user_modifications JSONB,           -- What the user changed
  blog_id UUID REFERENCES blogs(id),  -- When blog is generated from this brief
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content Calendar
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  brief_id UUID REFERENCES content_briefs(id),
  keyword_id UUID REFERENCES keywords(id),
  scheduled_date DATE,
  archetype TEXT,
  priority INTEGER,                   -- 1 = highest
  status TEXT DEFAULT 'scheduled',    -- 'scheduled', 'in_progress', 'completed', 'skipped'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DataForSEO Cache
CREATE TABLE seo_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,     -- 'keyword:{keyword}', 'serp:{keyword}', etc.
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3.4 New API Routes

```
-- DataForSEO Integration
POST /api/keywords/research         # Discover keywords (from seed or competitor)
POST /api/keywords/bulk-data        # Fetch volume/difficulty for keyword list
GET  /api/keywords/serp/:keyword    # Get SERP data for a keyword
POST /api/keywords/intent-classify  # Batch classify intents (Haiku)

-- Strategy
POST /api/strategy                  # Create strategy (business outcomes first)
GET  /api/strategy/:id              # Get strategy with all keywords
POST /api/strategy/:id/discover     # Run keyword discovery
POST /api/strategy/:id/clusters     # Generate topic clusters

-- Briefs
POST /api/brief/generate            # Generate brief from keyword
GET  /api/brief/:id                 # Get brief
PUT  /api/brief/:id/approve         # Approve (optionally with modifications)
PUT  /api/brief/:id/reject          # Reject with reason

-- Calendar
GET  /api/calendar                  # Get content calendar
PUT  /api/calendar/:id              # Reschedule/reprioritize

-- Cannibalization
POST /api/cannibalization/check     # Check keyword against existing content
```

## 3.5 New Modules

### DataForSEO Client (`/lib/seo-data/`)

```typescript
// dataforseo.ts
// Wrapper for DataForSEO API with caching
//
// Methods:
// - getKeywordData(keywords: string[]): volume, difficulty, CPC, trends
//   API: Keywords Data API (Google Ads endpoint)
//   Cache: 30 days
//   Cost: ~$0.05 per 1,000 keywords
//
// - getSerpResults(keyword: string): top 10-20 results with titles, URLs, snippets
//   API: SERP API (Standard queue for cost savings)
//   Cache: 7 days
//   Cost: $0.0006 per query (standard) 
//
// - getRelatedKeywords(seed: string): keyword suggestions
//   API: DataForSEO Labs API
//   Cache: 30 days
//
// - getDomainKeywords(domain: string): keywords a domain ranks for
//   API: DataForSEO Labs API
//   Cache: 7 days
//
// All methods check cache first. If cached and not expired, return cache.
// If not cached or expired, fetch from API, store in cache, return.
```

### Strategy Builder (`/lib/strategy/`)

```typescript
// builder.ts
// Workflow [PB Part 6.4]:
// 1. Business outcomes input (user defines goals)
// 2. Seed keyword input (user provides 3-5 seed keywords or competitor URLs)
// 3. Keyword discovery: expand seeds via DataForSEO related keywords + competitor keywords
// 4. Fetch bulk data: volume, difficulty for all discovered keywords
// 5. Intent classification: batch via Haiku
// 6. Opportunity scoring: volume * (1 - KD/100) * intent_relevance (code, no AI)
// 7. Topic clustering: group by semantic similarity (embeddings + k-means, code)
// 8. Content velocity recommendation: based on domain authority estimate and competition
// 9. Calendar generation: prioritize by opportunity score, balance archetypes/funnel stages
```

### Brief Generator (`/lib/brief/`)

```typescript
// generator.ts - Uses Sonnet 4.6
// Input: keyword data, SERP data, competitor analysis, KB context, strategy
// Output: Full 17-component brief [PB Part 9]
//
// Includes cannibalization check before generation (embedding similarity, code)
// Failure mode FM-3 handling: if keyword not viable, return alternatives
```

## 3.6 New UI Screens

- Strategy builder wizard (business outcomes > seeds > discovery > clusters > calendar)
- Keyword explorer (searchable table with volume, KD, intent, opportunity, status)
- Topic cluster visualization (simple tree view for MVP, bubble graph in Phase 4)
- Brief review screen (all 17 components, approve/modify/reject)
- Content calendar (calendar view, drag to reschedule, status indicators)
- Cannibalization alerts

## 3.7 Definition of Done

- DataForSEO integration works for keyword data, SERP, and related keywords
- All data is cached properly (verified by checking cache hits on repeat queries)
- Strategy builder produces a ranked keyword list from business outcomes + seeds
- Intent classification is 85%+ accurate (manual spot check of 50 keywords)
- Topic clustering groups related keywords logically
- Brief generation produces comprehensive, actionable briefs
- Cannibalization check catches overlapping keywords before brief approval
- Content calendar displays in chronological order with archetype balance
- Blog generation from an approved brief produces measurably better content than keyword-only generation

---

# PHASE 4: CONTENT GAP VISUALIZATION

**Product Bible Reference:** Part 17 (Content Gap & Strategy Visualization)

## 4.1 Objective

Visual intelligence showing what content exists, what's missing, and what to do next. Bubble graph for topic clusters. Gap analysis. Opportunity engine.

## 4.2 Build

- Bubble graph component (D3.js or Recharts): clusters as bubbles, size = post count, color = avg performance, proximity = semantic relatedness
- View toggles: by topic, by funnel stage, by archetype, by performance
- Gap analysis engine: competitor gaps, cluster gaps, funnel gaps, intent gaps, freshness gaps, AEO citation gaps, cannibalization, archetype gaps
- Opportunity suggestions: ranked recommendations with rationale
- Competitor content intelligence: pull competitor blog URLs from DataForSEO, analyze topics and gaps

## 4.3 Definition of Done

- Bubble graph renders with real workspace data
- Clicking a bubble shows cluster details and keyword list
- Empty space between clusters suggests gap-filling opportunities
- Gap analysis identifies at least 3 actionable gaps per workspace (tested on 5 workspaces)
- Opportunity suggestions are ranked by impact

---

# PHASE 5: AEO/GEO & PUBLISHING

**Product Bible Reference:** Part 7 (AEO/GEO), Part 13 (WordPress), Part 15 (Images), Part 16 (Internal Linking)

## 5.1 Objective

Blogs optimized for AI answer engines. WordPress publishing pipeline. Internal linking. Schema markup. Image strategy.

## 5.2 Build

**AEO Layer:**
- AEO scoring module (code): check for structured Q&A, statistics count, source citations, extractable passages, FAQ section
- AEO optimization pass in writing pipeline (Sonnet): add citation-worthy elements if missing
- Schema generation (code templates): Article, FAQ, HowTo, Author JSON-LD
- Featured snippet optimization (code + Haiku): detect snippet opportunities, format answers appropriately

**WordPress:**
- WordPress connection settings UI (URL, authentication method, credentials)
- Test connection endpoint
- Publish/schedule/draft creation via REST API
- Rank Math / Yoast field population
- Read existing posts for internal linking analysis
- Failure mode FM-5 (API failures): save locally, offer manual export

**Internal Linking (code, no AI):**
- Embed all existing posts
- When writing: cosine similarity to find 2-5 relevant existing posts
- Suggest anchor text based on target keyword of linked posts
- After publish: find existing posts that should link TO new post

**Images:**
- Image placement suggestions (code: every 300-400 words)
- Alt text generation (Haiku)
- OG image metadata

**Author Persona:**
- Author profile management (CRUD)
- Author schema generation
- Auto-assign posts to relevant author

## 5.3 Definition of Done

- Blogs include AEO-optimized structure (Q&A, statistics, schema)
- WordPress publish works end-to-end (draft, schedule, publish)
- Rank Math/Yoast fields auto-populated
- Internal links suggested during writing (2-5 per post, relevant)
- Schema markup valid (test with Google Rich Results Test)
- Author schema included on all published posts

---

# PHASE 6: POST-PUBLISH INTELLIGENCE

**Product Bible Reference:** Part 14 (Post-Publish Loop), Part 20 (ROI & Reporting)

## 6.1 Objective

Close the feedback loop. Monitor rankings, diagnose underperformance, trigger refreshes, show ROI.

## 6.2 Build

- DataForSEO Rank Tracker integration (weekly position checks)
- GA4 API integration (traffic per post)
- GSC API integration (impressions, CTR, positions)
- Decay detection (code: trend analysis, alert on 5+ position drop or 20% traffic decline)
- Underperformance diagnosis engine (Haiku: classify cause from signals)
- Content refresh engine (Sonnet: generate refresh brief, prepare updated draft)
- Retroactive internal linking (after new post, scan for linking opportunities from existing)
- ROI dashboard: traffic value per post, total value, cost comparison, time savings, rankings progress
- Monthly performance report export (PDF via server-side rendering)
- Failure mode FM-7 (refresh doesn't improve)

## 6.3 Definition of Done

- Rankings tracked weekly for all published posts
- Decay alerts fire correctly (tested with mock data)
- Diagnosis correctly classifies underperformance cause (spot-check 10 cases)
- Refresh brief includes specific, actionable changes
- ROI dashboard shows real data from GA4/GSC
- Monthly report exports as clean PDF

---

# PHASE 7: AGENTIC OPERATIONS v1

**Product Bible Reference:** Part 18.2 (Agents 1-3)

## 7.1 Objective

Three agents manage content operations with user approval: Calendar, Refresh, Internal Linking.

## 7.2 Build

- Event-driven agent architecture (Inngest/Trigger.dev cron jobs + event triggers)
- Content Calendar Agent: weekly cron job, analyzes keyword trends + performance + competitor activity, generates reprioritized calendar, sends email digest for approval
- Content Refresh Agent: daily cron job, checks all published posts for decay signals, prepares refresh drafts for flagged posts, queues for approval
- Internal Linking Agent: triggered on blog publish, scans existing content, prepares link insertions, queues for one-click approval
- Notification system: email digests + in-app notification center
- Approval workflows: approve/reject/modify agent recommendations in-app
- Agent learning: track approval/rejection rates, adjust recommendations over time

## 7.3 Definition of Done

- Calendar Agent sends weekly digest with coherent recommendations
- Refresh Agent detects decay and prepares actionable updates
- Linking Agent suggests relevant cross-links after every publish
- All agent actions are logged and reviewable
- Approval/rejection works with one click
- No agent takes autonomous action without user approval

---

# PHASE 8: AGENTIC OPERATIONS v2

**Product Bible Reference:** Part 18.2 (Agents 4-6)

- Competitive Response Agent: monitor competitor RSS feeds via DataForSEO, analyze new competitor content, prepare response drafts
- Strategy Drift Agent: quarterly strategy health check, identify underperforming strategy areas, suggest pivots
- Publishing Agent: fully autonomous pipeline, requires 20+ manual approvals with 90%+ rate, auto-pauses on negative signals
- Trust scoring system
- Agent coordination layer

---

# PHASE 9: AGENCY & MULTI-TENANT

**Product Bible Reference:** Part 19

- Multi-tenant workspace architecture (database-level isolation via workspace_id on all tables)
- Team members table (user_id + workspace_id + role)
- Agency organization table (parent of multiple workspaces)
- Agency dashboard component
- White-label report templates
- Client workspace export

---

# PHASE 10: INTEGRATIONS & ECOSYSTEM

**Product Bible Reference:** Part 21

- Browser extension (Chrome, detect keyword on page, trigger brief creation)
- Semrush API integration (alternative to DataForSEO)
- Zapier integration (triggers: blog published, decay detected; actions: create brief)
- Slack integration (notifications, brief creation via command)
- Public REST API with API key authentication
- Content repurposing module (Haiku: generate social posts, email snippets, video scripts from blog)

---

# PHASE 11: ENTERPRISE & COMPLIANCE

**Product Bible Reference:** Part 22, Part 26

- SOC 2 Type I audit preparation
- Compliance review layer (claim flagging, disclosure library)
- Multi-language support (localized SEO, hreflang, translated voice profiles)
- llms.txt file generator
- Advanced readability calibration per audience profile
- WordPress Abilities API integration
- Custom enterprise integrations framework
- SLA monitoring and support tier system

---

# APPENDIX: PHASE DEPENDENCY MAP

```
Phase 1: MVP (standalone)
  |
  v
Phase 2: Brand Intelligence (depends on Phase 1)
  |
  v
Phase 3: Strategy & Keywords (depends on Phase 2)
  |     \
  v      v
Phase 4: Visualization (depends on Phase 3)
Phase 5: AEO & Publishing (depends on Phase 2, benefits from Phase 3)
  |
  v
Phase 6: Post-Publish (depends on Phase 5)
  |
  v
Phase 7: Agents v1 (depends on Phase 3 + Phase 6)
  |
  v
Phase 8: Agents v2 (depends on Phase 7)

Phase 9: Agency (depends on Phase 1, benefits from all)
Phase 10: Integrations (depends on Phase 3+)
Phase 11: Enterprise (depends on Phase 9)
```

Note: Phases 4, 5, 9 can be built in parallel with some flexibility. The critical path is: 1 > 2 > 3 > 5 > 6 > 7 > 8.

---

*Engineering Build Specification v1.0 | Companion to Product Bible v4.0 | February 2026*
