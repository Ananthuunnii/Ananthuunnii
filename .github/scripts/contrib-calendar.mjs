// Generates generated/contributions.svg: a Tokyo Night styled contribution calendar.
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.GH_USER;
const token = process.env.GH_TOKEN;
if (!user || !token) throw new Error("GH_USER and GH_TOKEN are required");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount weekday } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: user } }),
});
if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
const json = await res.json();
if (json.errors) throw new Error(JSON.stringify(json.errors));

const cal = json.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks;
const max = Math.max(1, ...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));

// Tokyo Night palette
const BG = "#1a1b27";
const TITLE = "#70a5fd";
const TEXT = "#c0caf5";
const MUTED = "#565f89";
const LEVELS = ["#2a2c3d", "#2f3f73", "#3d59a1", "#7aa2f7", "#bb9af7"];

const level = (n) => {
  if (n === 0) return 0;
  const r = n / max;
  return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4;
};

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const PAD = 25;
const GRID_Y = 92;
const W = PAD * 2 + weeks.length * STEP - GAP;
const H = GRID_Y + 7 * STEP - GAP + 44;
const font = 'font-family="Segoe UI, Arial, sans-serif"';

let cells = "";
let months = "";
const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Month labels: one per month change; drop a label if the next one is under 3 weeks away,
// and drop one that would be squeezed against the right edge.
const marks = [];
let lastMonth = -1;
weeks.forEach((week, wi) => {
  const first = week.contributionDays[0];
  if (!first) return;
  const m = new Date(first.date + "T00:00:00Z").getUTCMonth();
  if (m !== lastMonth) marks.push({ wi, m });
  lastMonth = m;
});
const keep = marks.filter((mk, i) => {
  const next = marks[i + 1];
  if (next && next.wi - mk.wi < 3) return false;
  if (weeks.length - mk.wi < 3) return false;
  return true;
});
for (const mk of keep) {
  months += `\n  <text x="${PAD + mk.wi * STEP}" y="${GRID_Y - 8}" ${font} font-size="11" fill="${MUTED}">${names[mk.m]}</text>`;
}

weeks.forEach((week, wi) => {
  const x = PAD + wi * STEP;
  for (const d of week.contributionDays) {
    const y = GRID_Y + d.weekday * STEP;
    const lv = level(d.contributionCount);
    cells += `\n  <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${LEVELS[lv]}"><title>${d.date}: ${d.contributionCount} contributions</title></rect>`;
  }
});

const legendY = H - 20;
const legendRight = W - PAD;
let legend = `\n  <text x="${legendRight - 5 * STEP - 62}" y="${legendY + 9}" ${font} font-size="11" fill="${MUTED}">Less</text>`;
LEVELS.forEach((c, i) => {
  legend += `\n  <rect x="${legendRight - 5 * STEP - 28 + i * STEP}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`;
});
legend += `\n  <text x="${legendRight - 22}" y="${legendY + 9}" ${font} font-size="11" fill="${MUTED}">More</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution calendar">
  <rect width="${W}" height="${H}" rx="12" fill="${BG}"/>
  <text x="${PAD}" y="38" ${font} font-size="18" font-weight="600" fill="${TITLE}">Daily Contributions</text>
  <text x="${PAD}" y="58" ${font} font-size="12" fill="${TEXT}">${cal.totalContributions} contributions in the last year</text>${months}${cells}${legend}
</svg>
`;

mkdirSync("generated", { recursive: true });
writeFileSync("generated/contributions.svg", svg);
console.log(`Wrote generated/contributions.svg (${cal.totalContributions} contributions, ${weeks.length} weeks)`);
