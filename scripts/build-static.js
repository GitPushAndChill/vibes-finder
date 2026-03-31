const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, destination) {
  if (!(await exists(source))) return;
  await fs.cp(source, destination, { recursive: true });
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  const topFiles = [
    'index.html',
    'about.html',
    'blog.html',
    'contact.html',
    'faq.html',
    'reviews.html',
    'dummy.html',
    'privacy.html',
    'cookies.html',
    'ads.txt',
    'sitemap.xml',
    '.nojekyll',
    'CNAME',
    'README.md',
  ];

  for (const file of topFiles) {
    await copyIfExists(path.join(ROOT, file), path.join(DIST, file));
  }

  const dirs = ['css', 'js', 'images', 'posts', 'city', 'content'];
  for (const dir of dirs) {
    await copyIfExists(path.join(ROOT, dir), path.join(DIST, dir));
  }

  console.log('Build prepared in dist with generated city folder structure.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
