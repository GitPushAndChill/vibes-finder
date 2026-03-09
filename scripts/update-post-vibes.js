const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'posts', 'places', 'posts-places.json');
const posts = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const baseMap = {
  chill: ['easygoing', 'coffee_and_chill'],
  cozy: ['easygoing', 'cute_girl_brunch'],
  energetic: ['social', 'do_mode'],
  romantic: ['date_night', 'classy'],
  family: ['little_ones', 'do_mode'],
  adventurous: ['outdoorsy', 'do_mode'],
  hipster: ['alternative', 'hidden_gems'],
  party: ['social', 'beer_lovers'],
  artsy: ['culture_craving', 'alternative'],
};

const uniquePush = (arr, value) => {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
};

function enrichVibes(post) {
  const text = `${post.place || ''} ${post.title || ''} ${post.short_description || ''} ${post.description || ''}`.toLowerCase();
  const vibes = [];

  const base = baseMap[String(post.vibe || '').toLowerCase()] || ['easygoing', 'hidden_gems'];
  base.forEach(v => uniquePush(vibes, v));

  if (/(park|bos|duin|beach|strand|plas|tuin|tuinen|trail|hike|pier|outdoor|fort|kasteel|castle|windmill|lookout)/.test(text)) {
    uniquePush(vibes, 'outdoorsy');
  }
  if (/(museum|gallery|exhibition|science|observatory|tour|historic|rijksmuseum|mauritshuis|teylers|nemo|spoorwegmuseum)/.test(text)) {
    uniquePush(vibes, 'culture_craving');
  }
  if (/(beer|brew|jenever|brewery|bar|pub|cocktail|wine|nightlife|club|dance|dj|party|festival)/.test(text)) {
    uniquePush(vibes, 'social');
    uniquePush(vibes, 'beer_lovers');
  }
  if (/(food|market|hall|brunch|cafe|café|coffee|restaurant|lunch|bakery|street food)/.test(text)) {
    uniquePush(vibes, 'easygoing');
  }
  if (/(romantic|date|sunset|rooftop|intimate|candle)/.test(text)) {
    uniquePush(vibes, 'date_night');
    uniquePush(vibes, 'classy');
  }
  if (/(family|kids|child|nijntje|madurodam|play|interactive)/.test(text)) {
    uniquePush(vibes, 'little_ones');
  }
  if (/(street art|warehouse|underground|flea|vinyl|creative quarter|ndsm|rotsoord)/.test(text)) {
    uniquePush(vibes, 'alternative');
  }
  if (/(hidden|secret|underrated|gem|tucked-away)/.test(text)) {
    uniquePush(vibes, 'hidden_gems');
  }
  if (/(summer|sun|beach|terrace|waterside|waterfront)/.test(text)) {
    uniquePush(vibes, 'golden_summertime');
  }
  if (/(workshop|tasting|climb|swing|adventure|interactive|activity)/.test(text)) {
    uniquePush(vibes, 'do_mode');
  }

  if (vibes.length < 2) {
    uniquePush(vibes, 'easygoing');
    uniquePush(vibes, 'hidden_gems');
  }

  return vibes.slice(0, 4);
}

posts.forEach((post) => {
  const vibes = enrichVibes(post);
  post.vibes = vibes;
  post.vibe = vibes[0];
});

fs.writeFileSync(filePath, JSON.stringify(posts, null, 2) + '\n', 'utf8');
console.log(`Updated ${posts.length} posts with multi-vibe definitions.`);
