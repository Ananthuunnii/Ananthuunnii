// Generates generated/top-languages.svg with live language percentages.
// Percentages = share of code bytes across your own (non-fork) repos.
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.GH_USER;
const token = process.env.GH_TOKEN;
const includePrivate = process.env.INCLUDE_PRIVATE === "true"; // needs a PAT with `repo` scope
const TOP_N = 6;

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function gh(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const listUrl = (page) =>
  includePrivate
    ? `https://api.github.com/user/repos?affiliation=owner&per_page=100&page=${page}`
    : `https://api.github.com/users/${user}/repos?type=owner&per_page=100&page=${page}`;

const repos = [];
for (let page = 1; ; page++) {
  const batch = await gh(listUrl(page));
  repos.push(...batch);
  if (batch.length < 100) break;
}

const totals = {};
for (const repo of repos.filter((r) => !r.fork)) {
  const langs = await gh(repo.languages_url);
  for (const [name, bytes] of Object.entries(langs)) {
    totals[name] = (totals[name] || 0) + bytes;
  }
}

const sum = Object.values(totals).reduce((a, b) => a + b, 0);
if (sum === 0) throw new Error("No language data found");

const rows = Object.entries(totals)
  .sort((a, b) => b[1] - a[1])
  .slice(0, TOP_N)
  .map(([name, bytes]) => ({ name, pct: (bytes / sum) * 100 }));

const colors = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  "C#": "#178600",
  TSQL: "#e38c00",
  SCSS: "#c6538c",
  Python: "#3572a5",
  Java: "#b07219",
  Shell: "#89e051",
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const W = 500;
const rowH = 34;
const H = 70 + rows.length * rowH;
const trackX = 130;
const trackW = 280;

const body = rows
  .map((r, i) => {
    const y = 78 + i * rowH;
    const w = Math.max(4, (trackW * r.pct) / 100);
    const color = colors[r.name] || "#7aa2f7";
    return `
  <text x="25" y="${y + 11}" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#c0caf5">${esc(r.name)}</text>
  <rect x="${trackX}" y="${y}" width="${trackW}" height="14" rx="7" fill="#2a2c3d"/>
  <rect x="${trackX}" y="${y}" width="${w.toFixed(1)}" height="14" rx="7" fill="${color}"/>
  <text x="${trackX + trackW + 14}" y="${y + 11}" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#c0caf5">${r.pct.toFixed(1)}%</text>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Most used languages">
  <rect width="${W}" height="${H}" rx="12" fill="#1a1b27"/>
  <text x="25" y="38" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#70a5fd">Most Used Languages</text>${body}
</svg>
`;

mkdirSync("generated", { recursive: true });
writeFileSync("generated/top-languages.svg", svg);
console.log(rows.map((r) => `${r.name}: ${r.pct.toFixed(2)}%`).join("\n"));
