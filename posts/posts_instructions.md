# Instructions to add posts
Write in the style of a professional travel blogger: vivid, engaging, and descriptive, with a natural human voice. Avoid AI-like patterns such as overuse of em dashes (—), repetitive phrasing, or overly formal language. Use varied sentence structures, sensory details, and a conversational yet polished tone. Keep it concise, authentic, and grounded in real experience rather than generic or overly perfect wording.

### Description
Adhere to the folowing data definition when populating the json file for adding new posts.

### Data elements
- **place**: the name of the place.
- **city**: the city where the place is
- **vibes**: the vibes that the place is giving. only pick vibes that are available in the content/vibes.yml. pick multiple vibes if there are multiple matches. do not link more than 3.
- **title**: the name of the place.
- **images**: cute pictures of the place and the vibe. Add minimal 1 picture and maximal 6 pictures in .jpg format.
- **short_description**: short description of the place and vibe, around the lenght of 2 sentences. it should hook the reader to read more about this place. should use some key word good for SEO.the short description should highlight why you should visit this place.
- **description**: description of the place and vibe, not longer than two paragraphs. it should give reasons to visit the place. make the description targeted for an audience searching for the best places in the netherlands. Also add a small con in the description for visiting this place. It should also be clear when not to visit the place.
- **coordinates**: coordinates of the place
- **adress**: the adress of the place
- **created_on**: the timestamp when the post was created.
- **updated_on** time timestamp when the post was updated for the last time.
