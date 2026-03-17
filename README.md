# test-website

City and vibe discovery website with:

- a responsive static frontend,
- structured place content in JSON,
- Google AdSense integration,
- and an automated email-to-post ingestion workflow.

## What This Project Does

- Serves static pages for home, about, blog, FAQ, reviews, contact, and city landing pages.
- Stores place posts in [posts/places/posts-places.json](posts/places/posts-places.json).
- Uses vibe taxonomy from [content/vibes.yml](content/vibes.yml).
- Supports automated content ingestion from forwarded email + Google Maps links + photo attachments.
- Optimizes ingested images to JPG and stores them under [images/places](images/places).

## Project Structure

- Frontend pages: [index.html](index.html), [about.html](about.html), [blog.html](blog.html), [faq.html](faq.html), [contact.html](contact.html), [reviews.html](reviews.html)
- City pages: [city](city)
- Styles and scripts: [css/style.css](css/style.css), [js/script.js](js/script.js)
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

3. Open the URL printed by `lite-server` (typically `http://localhost:3000`).

## Build

```bash
npm run build
```

This copies site assets into `dist/` for static hosting.

## Content Model (Places Posts)

All place posts must follow the schema in [posts/posts_instructions.md](posts/posts_instructions.md). Key fields include:

- `place`, `city`, `vibe`, `vibes`
- `title`, `short_description`, `description`
- `images` (1-3 JPG files under `images/places/`)
- `coordinates`, `adress`
- `created_on`, `updated_on`

Important rules enforced by ingestion logic:

- `vibes` only contains valid vibe keys from [content/vibes.yml](content/vibes.yml).
- `vibes` is unique and capped at 3 entries.
- `vibe` aligns with the first item in `vibes`.
- Duplicate posts are detected by case-insensitive `place + city`.

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

- Default model is `gpt-5-mini`.
- Workflow currently sets `OPENAI_MODEL: gpt-5-mini`.
- For this model, requests must use default temperature behavior (no custom temperature field).

### What Ingestion Does

- Normalizes incoming webhook/email payload formats.
- Extracts and expands Google Maps URLs (including short links).
- Enriches place context with Google Maps/Places data.
- Generates one post draft via OpenAI using [posts/posts_instructions.md](posts/posts_instructions.md) as source-of-truth guidance.
- Optimizes images (Sharp) and saves JPG files in `images/places/`.
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