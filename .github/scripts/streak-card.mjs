// Generates generated/streak.svg: total contributions, current streak, longest streak.
// Counts come from the last 12 months of your contribution calendar.
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.GH_USER;
const token = process.env.GH_TOKEN;
if (!user || !token) throw new Error("GH_USER and GH_TOKEN are required");

const query = `query($login: String!) {
  user(login: $login) {
    createdAt
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
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

const u = json.data.user;
const cal = u.contributionsCollection.contributionCalendar;
const days = cal.weeks
  .flatMap((w) => w.contributionDays)
  .sort((a, b) => a.date.localeCompare(b.date));

const todayStr = new Date().toISOString().slice(0, 10);
const past = days.filter((d) => d.date <= todayStr);

const dayMs = 86400000;
const toMs = (s) => Date.parse(s + "T00:00:00Z");
const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (s) => {
  const d = new Date(toMs(s));
  return `${names[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const fmtY = (s) => `${fmt(s)}, ${s.slice(0, 4)}`;

// Longest streak
let longest = { len: 0, start: null, end: null };
let run = { len: 0, start: null, end: null };
for (const d of past) {
  if (d.contributionCount > 0) {
    if (run.len === 0) run = { len: 1, start: d.date, end: d.date };
    else run = { len: run.len + 1, start: run.start, end: d.date };
    if (run.len > longest.len) longest = { ...run };
  } else {
    run = { len: 0, start: null, end: null };
  }
}

// Current streak: counts back from today; if today has no contribution yet, from yesterday.
let current = { len: 0, start: null, end: null };
let i = past.length - 1;
if (i >= 0 && past[i].date === todayStr && past[i].contributionCount === 0) i--;
for (; i >= 0 && past[i].contributionCount > 0; i--) {
  if (current.len === 0) current = { len: 1, start: past[i].date, end: past[i].date };
  else current = { len: current.len + 1, start: past[i].date, end: current.end };
}

// Total range: from account creation (or start of the window) to present
const windowStart = past.length ? past[0].date : todayStr;
const created = u.createdAt.slice(0, 10);
const since = created > windowStart ? created : windowStart;

// Tokyo Night palette
const BG = "#1a1b27";
const BLUE = "#7aa2f7";
const PURPLE = "#bb9af7";
const TEXT = "#c0caf5";
const MUTED = "#565f89";
const RING = "#2a2c3d";
const font = 'font-family="Segoe UI, Arial, sans-serif"';

const span = (a, b) => (!a ? "-" : a === b ? fmt(a) : `${fmt(a)} - ${fmt(b)}`);

const W = 495;
const H = 195;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution streak">
  <rect width="${W}" height="${H}" rx="12" fill="${BG}"/>

  <line x1="165" y1="48" x2="165" y2="148" stroke="${RING}" stroke-width="1"/>
  <line x1="330" y1="48" x2="330" y2="148" stroke="${RING}" stroke-width="1"/>

  <text x="82.5" y="92" text-anchor="middle" ${font} font-size="30" font-weight="700" fill="${BLUE}">${cal.totalContributions}</text>
  <text x="82.5" y="118" text-anchor="middle" ${font} font-size="13" fill="${TEXT}">Total Contributions</text>
  <text x="82.5" y="140" text-anchor="middle" ${font} font-size="11" fill="${MUTED}">${fmtY(since)} - Present</text>

  <circle cx="247.5" cy="85" r="40" fill="none" stroke="${current.len > 0 ? BLUE : RING}" stroke-width="5"/>
  <text x="247.5" y="94" text-anchor="middle" ${font} font-size="28" font-weight="700" fill="${PURPLE}">${current.len}</text>
  <text x="247.5" y="148" text-anchor="middle" ${font} font-size="13" font-weight="600" fill="${PURPLE}">Current Streak</text>
  <text x="247.5" y="168" text-anchor="middle" ${font} font-size="11" fill="${MUTED}">${current.len ? span(current.start, current.end) : "Start one today"}</text>

  <text x="412.5" y="92" text-anchor="middle" ${font} font-size="30" font-weight="700" fill="${BLUE}">${longest.len}</text>
  <text x="412.5" y="118" text-anchor="middle" ${font} font-size="13" fill="${TEXT}">Longest Streak</text>
  <text x="412.5" y="140" text-anchor="middle" ${font} font-size="11" fill="${MUTED}">${span(longest.start, longest.end)}</text>
</svg>
`;

mkdirSync("generated", { recursive: true });
writeFileSync("generated/streak.svg", svg);
console.log(
  `total=${cal.totalContributions} current=${current.len} longest=${longest.len} (${span(longest.start, longest.end)})`
);
