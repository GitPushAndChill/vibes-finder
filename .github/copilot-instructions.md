# GitHub Copilot Instructions

## Scope
These instructions apply when creating or editing posts in `posts/places/posts-places.json`.

## Source of truth
- Follow the post field definitions from `posts/posts_instructions.md`.
- Use only vibe keys that exist in `content/vibes.yml`.
- Match the existing JSON structure and formatting already used in `posts/places/posts-places.json`.

## Required post schema
Every post object must include all of these fields:
- `place` (string): name of the place.
- `city` (string): city name.
- `vibe` (string): primary vibe key.
- `title` (string): catchy SEO-friendly title.
- `images` (array): 1 to 6 `.jpg` image paths.
- `short_description` (string): max one sentence.
- `description` (string): max one paragraph.
- `coordinates` (array): `[latitude, longitude]` as numbers.
- `adress` (string): address text (keep key name exactly `adress`, matching existing data).
- `created_on` (string): ISO-8601 UTC timestamp (example: `2026-03-10T12:00:00Z`).
- `vibes` (array): one or more vibe keys from `content/vibes.yml`.

## Constraints
- Keep `vibe` aligned with `vibes`: `vibe` should equal the first entry in `vibes`.
- Do not use vibe labels in data; use vibe keys.
- Do not add fields that are not already in the schema.
- Keep all image paths under `images/places/` and use `.jpg` extension.
- All posts must be unique; never generate or add duplicate posts.
- Duplicate check is mandatory before proposing a new post.
- Treat a post as duplicate when `place` + `city` matches an existing entry (case-insensitive).
- If a generated post would duplicate an existing one, replace it with a different place.
- Preserve valid JSON (commas, quotes, brackets) and existing array/object style.

## Content quality rules
- Write concise, natural, high-quality English copy.
- Make `title` search-intent friendly for city + place + vibe context.
- Keep `short_description` distinct from `description`.
- Ensure `coordinates` and `adress` refer to the same real location.

## Output format rule for Copilot
When asked to add posts, return only ready-to-paste JSON objects that follow this template:

```json
{
  "place": "",
  "city": "",
  "vibe": "",
  "title": "",
  "images": [
    "images/places/example.jpg"
  ],
  "short_description": "",
  "description": "",
  "coordinates": [
    0,
    0
  ],
  "adress": "",
  "created_on": "2026-03-10T12:00:00Z",
  "vibes": [
    ""
  ]
}
```

## Validation checklist
Before finalizing generated posts:
1. All required fields exist.
2. `images` count is between 1 and 6 and all are `.jpg`.
3. `vibe` is included as the first item in `vibes`.
4. Every vibe key exists in `content/vibes.yml`.
5. No duplicate `place` + `city` entries are introduced.
6. JSON remains valid.
