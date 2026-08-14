import fs from "node:fs";

const imagePath = "public/assets/social/public-week-agent-work.png";
const image = fs.readFileSync(imagePath);
if (image.toString("ascii", 1, 4) !== "PNG") {
  throw new Error(`${imagePath} is not a PNG`);
}
const width = image.readUInt32BE(16);
const height = image.readUInt32BE(20);
if (width !== 1200 || height !== 630) {
  throw new Error(`${imagePath} must be 1200x630, got ${width}x${height}`);
}

const html = fs.readFileSync("public/about/bootstrapping/evidence/index.html", "utf8");
for (const expected of [
  '<link rel="canonical" href="https://kungfu.tech/about/bootstrapping/evidence/">',
  '<meta property="og:url" content="https://kungfu.tech/about/bootstrapping/evidence/">',
  '<meta property="og:title" content="One Human. Agents. 1,026 Merged PRs in One Week.">',
  '<meta property="og:image" content="https://kungfu.tech/assets/social/public-week-agent-work.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="https://kungfu.tech/assets/social/public-week-agent-work.png">',
]) {
  if (!html.includes(expected)) {
    throw new Error(`public week evidence page is missing ${expected}`);
  }
}

console.log("social card metadata and dimensions verified");
