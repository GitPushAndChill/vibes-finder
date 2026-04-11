# Instructions to add posts
Write in the style of a professional travel blogger: vivid, engaging, and descriptive, with a natural human voice. Avoid AI-like patterns such as overuse of em dashes (—), repetitive phrasing, or overly formal language. Use varied sentence structures, sensory details, and a conversational yet polished tone. Keep it concise, authentic, and grounded in real experience rather than generic or overly perfect wording.

Avoid:
- Generic praise (“great place”, “amazing food”)
- Repeating sentence structures
- Writing that could apply to any place

Focus on:
- Concrete details (what you see, taste, hear)
- When this place is a good idea — and when it isn’t
- A clear, honest opinion

### Description
Adhere to the folowing data definition when populating the json file for adding new posts.

### Data elements
- **place**: the name of the place.
- **city**: the city where the place is
- **vibes**: the vibes that the place is giving. only pick vibes that are available in the content/vibes.yml. pick multiple vibes if there are multiple matches. do not link more than 3.
- **title**: the name of the place with short SEO optimized add on.
- **images**: cute pictures of the place and the vibe. Add minimal 1 picture and maximal 6 pictures in .jpg format.
- **short_description**: Max 2 sentences. Must: Hook attention immediately, Include a relevant SEO keyword (e.g. “restaurant in Hoofddorp”), Clearly state why this place is worth visiting. Think: “Why should I click this?”
- **description**: The description of the place and vibe, not longer than two paragraphs. It should give reasons to visit the place. Make the description targeted for an audience searching for the best places in the netherlands. Include at least one downside for visiting this place. It should also be clear when not to visit the place. Help readers decide quickly if it fits their situation. Be honest (avoid sounding promotional).
- **coordinates**: coordinates of the place
- **adress**: the adress of the place
- **created_on**: the timestamp when the post was created.
- **updated_on** time timestamp when the post was updated for the last time.
