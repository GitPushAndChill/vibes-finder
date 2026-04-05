# test-website

City and vibe discovery website with:

- a responsive static frontend,
- structured place content in JSON,
- build-time generated city and post pages,
- Google AdSense integration,
- and an automated email-to-post ingestion workflow.

## What This Project Does

- Serves static pages for home, about, FAQ, reviews, contact, privacy, and cookies.
- Generates dedicated SEO-friendly place pages from [posts/places/posts-places.json](posts/places/posts-places.json).
- Generates city landing pages and an all-posts hub under [city](city).
- Uses vibe taxonomy from [content/vibes.yml](content/vibes.yml).
- Builds a sitemap automatically from the generated routes.
- Supports automated content ingestion from forwarded email + Google Maps links + photo attachments.
- Optimizes ingested images to JPG and stores them under [images/places](images/places).

## URL Structure

Canonical routes are generated at build time:

- All-posts hub: [city/index.html](city/index.html)
- City landing pages: `city/<city>/index.html`
- Dedicated place pages: `city/<city>/<place>/index.html`

[blog.html](blog.html) is now a legacy redirect/alias to `/city/` for backwards compatibility. The canonical content hub is [city/index.html](city/index.html).

## Project Structure

- Root pages: [index.html](index.html), [about.html](about.html), [faq.html](faq.html), [contact.html](contact.html), [reviews.html](reviews.html), [privacy.html](privacy.html), [cookies.html](cookies.html), [blog.html](blog.html)
- Generated content output in source tree: [city](city)
- Static build output: [dist](dist)
- Styles and scripts: [css/style.css](css/style.css), [js/script.js](js/script.js), [js/theme-init.js](js/theme-init.js)
- Post generator: [scripts/generate-post-pages.js](scripts/generate-post-pages.js)
- Build packager: [scripts/build-static.js](scripts/build-static.js)
- Page templates: [scripts/templates](scripts/templates)
- Posts schema instructions: [posts/posts_instructions.md](posts/posts_instructions.md)
- Places posts data: [posts/places/posts-places.json](posts/places/posts-places.json)
- Ingestion script: [scripts/ingest-email-post.js](scripts/ingest-email-post.js)
- Ingestion workflow: [.github/workflows/ingest-email-post.yml](.github/workflows/ingest-email-post.yml)
- Gmail forwarder examples: [scripts/examples](scripts/examples)

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start the local site:

```bash
npm start
```

`npm start` runs `generate:post-pages` first, then starts `lite-server`.

3. Open the URL printed by `lite-server` (typically `http://localhost:3000`).

## Build

Generate pages only:

```bash
npm run generate:post-pages
```

Full build:

```bash
npm run build
```

Current build flow:

- reads place data from [posts/places/posts-places.json](posts/places/posts-places.json)
- generates post pages using [scripts/templates/post-page.template.html](scripts/templates/post-page.template.html)
- generates city pages using [scripts/templates/city-page.template.html](scripts/templates/city-page.template.html)
- generates the main hub using [scripts/templates/city-root-index.template.html](scripts/templates/city-root-index.template.html)
- updates [sitemap.xml](sitemap.xml)
- copies deployable assets into [dist](dist)

## Content Model (Places Posts)

All place posts must follow the schema in [posts/posts_instructions.md](posts/posts_instructions.md). Key fields include:

- `place`, `city`, `vibe`, `vibes`
- `title`, `short_description`, `description`
- `images` (1-3 JPG files under `images/places/`)
- `coordinates`, `adress`
- `created_on`, `updated_on`

Important rules enforced by generation and ingestion logic:

- `vibes` only contains valid vibe keys from [content/vibes.yml](content/vibes.yml).
- `vibes` is unique and capped at 3 entries.
- `vibe` aligns with the first item in `vibes`.
- Duplicate posts are detected by case-insensitive `place + city`.
- Stable post routes are generated from city/place data, with collision handling when needed.

## Automated Email Ingestion

Workflow: [.github/workflows/ingest-email-post.yml](.github/workflows/ingest-email-post.yml)

Script: [scripts/ingest-email-post.js](scripts/ingest-email-post.js)

### Trigger Types

- `repository_dispatch` with event types:
   - `email_post_ingest`
   - `gmail_forwarded_email`
- `workflow_dispatch` for manual test payloads

### Required Repository Secrets

- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`

### Model Configuration

- Default model is `gpt-5.3`.
- Workflow currently sets `OPENAI_MODEL: gpt-5.3`.
- For this model, requests must use default temperature behavior (no custom temperature field).

### What Ingestion Does

- Normalizes incoming webhook/email payload formats.
- Extracts and expands Google Maps URLs (including short links).
- Enriches place context with Google Maps/Places data.
- Generates one post draft via OpenAI using [posts/posts_instructions.md](posts/posts_instructions.md) as source-of-truth guidance.
- Optimizes images and saves JPG files in [images/places](images/places).
- Upserts posts into [posts/places/posts-places.json](posts/places/posts-places.json):
   - Create: inserts new post
   - Update: merges images/info into existing post
   - Preserves `created_on` on updates and refreshes `updated_on`

## Gmail Forwarder (Optional)

Example Apps Script and payload are provided in:

- [scripts/examples/gmail-forwarder-apps-script.gs](scripts/examples/gmail-forwarder-apps-script.gs)
- [scripts/examples/gmail-forwarder-payload.json](scripts/examples/gmail-forwarder-payload.json)

Use this to poll labeled Gmail threads and dispatch them to the GitHub workflow.

## Ads Setup

- AdSense integration script/meta is present in site pages.
- `ads.txt` is hosted at [ads.txt](ads.txt).

## Notes

- The field name `adress` is intentionally used in data files to match the existing schema.
- This repository uses CommonJS (`"type": "commonjs"`).