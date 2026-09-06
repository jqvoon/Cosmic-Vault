export const ANTHROPIC_API_KEY = "";

export const CATEGORIES = [
  { id: "categories", label: "Categories", icon: "◎", color: "#ffffff" },
  { id: "allFiles", label: "All Files", icon: "◉", color: "#ffffff" },
  { id: "photos", label: "Photos", icon: "⬡", color: "#F472B6" },
  { id: "videos", label: "Videos", icon: "▷", color: "#FB923C" },
  { id: "documents", label: "Documents", icon: "§", color: "#60A5FA" },
  { id: "presentations", label: "Presentations", icon: "◈", color: "#A78BFA" },
  { id: "spreadsheets", label: "Spreadsheets", icon: "Σ", color: "#34D399" },
  { id: "music", label: "Music", icon: "♫", color: "#FBBF24" },
  { id: "archives", label: "Archives", icon: "⊞", color: "#94A3B8" },
  { id: "others", label: "Others", icon: "◇", color: "#CBD5E1" },
];

const NOW = Date.now();
const H = 3600000;
const D = 86400000;

export const INITIAL_FILES = [
  {
    id: 1,
    name: "Maldives Trip.jpg",
    category: "photos",
    size: "4.2 MB",
    trust: 99,
    description:
      "Aerial photo of a turquoise lagoon resort in the Maldives, taken during golden hour.",
    tags: ["beach", "resort", "lagoon", "travel", "sunset"],
    imageTaggingStatus: "completed",
    dataUrl: "https://dummyimage.com/200x200/ff6b9d/ffffff&text=Photo+1",
    ts: NOW - 2 * H,
  },
  {
    id: 2,
    name: "Q4 Strategy.pdf",
    category: "documents",
    size: "2.4 MB",
    trust: 92,
    description:
      "Annual Q4 strategic planning document covering OKRs, financial targets, and roadmap.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 5 * H,
  },
  {
    id: 3,
    name: "Brand Deck.pptx",
    category: "presentations",
    size: "18 MB",
    trust: 95,
    description:
      "Brand identity presentation covering visual guidelines, tone of voice, and logo usage.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 1 * D - 2 * H,
  },
  {
    id: 4,
    name: "Revenue Model.xlsx",
    category: "spreadsheets",
    size: "1.1 MB",
    trust: 76,
    description:
      "Financial model with revenue projections, scenario analysis, and KPI tracking.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 1 * D - 5 * H,
  },
  {
    id: 5,
    name: "Team Offsite.mp4",
    category: "videos",
    size: "920 MB",
    trust: 89,
    description:
      "Highlight reel from the annual team offsite - includes keynotes and group activities.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 3 * D,
  },
  {
    id: 6,
    name: "Chill Playlist.mp3",
    category: "music",
    size: "44 MB",
    trust: 100,
    description:
      "Personal lo-fi playlist curated for deep work sessions, 48 tracks, ~3 hours.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 5 * D,
  },
  {
    id: 7,
    name: "Project Assets.zip",
    category: "archives",
    size: "340 MB",
    trust: 85,
    description:
      "Compressed archive of design assets, icons, and source files for the 2024 launch.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 7 * D,
  },
  {
    id: 8,
    name: "Family Portrait.png",
    category: "photos",
    size: "7.8 MB",
    trust: 100,
    description:
      "Annual family portrait taken at grandma's house, Christmas 2023.",
    tags: ["family", "portrait", "holiday", "home", "smile"],
    imageTaggingStatus: "completed",
    dataUrl: "https://dummyimage.com/200x200/8b5cf6/ffffff&text=Photo+2",
    ts: NOW - 14 * D,
  },
  {
    id: 9,
    name: "Investor Update.pptx",
    category: "presentations",
    size: "6 MB",
    trust: 88,
    description:
      "Quarterly investor update covering MRR growth, product milestones, and next quarter targets.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 14 * D - 3 * H,
  },
  {
    id: 10,
    name: "Meeting Notes.docx",
    category: "documents",
    size: "180 KB",
    trust: 94,
    description:
      "Consolidated meeting notes from the Q3 leadership sprint - action items and owners listed.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 21 * D,
  },
  {
    id: 11,
    name: "demo.crt",
    category: "others",
    size: "3 KB",
    trust: 81,
    description:
      "Demo certificate file used to showcase unknown file types under the Others category.",
    tags: [],
    imageTaggingStatus: "not_applicable",
    dataUrl: null,
    ts: NOW - 9 * D,
  },
].map((f, i) => ({
  ...f,
  color: CATEGORIES.find((c) => c.id === f.category)?.color || "#fff",
  bx:
    [18, 55, 72, 38, 62, 22, 80, 45, 68, 30, 57][i] ?? 15 + Math.random() * 70,
  by:
    [22, 18, 42, 65, 72, 50, 28, 78, 58, 38, 84][i] ?? 15 + Math.random() * 70,
}));

export const STARS = Array.from({ length: 100 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  s: Math.random() < 0.15 ? 2 : 1,
  o: 0.15 + Math.random() * 0.55,
  d: Math.random() * 5,
}));

export const EXT_MAP = {
  jpg: "photos",
  jpeg: "photos",
  png: "photos",
  gif: "photos",
  webp: "photos",
  heic: "photos",
  mp4: "videos",
  mov: "videos",
  avi: "videos",
  mkv: "videos",
  pdf: "documents",
  doc: "documents",
  docx: "documents",
  txt: "documents",
  ppt: "presentations",
  pptx: "presentations",
  key: "presentations",
  xls: "spreadsheets",
  xlsx: "spreadsheets",
  csv: "spreadsheets",
  mp3: "music",
  wav: "music",
  flac: "music",
  aac: "music",
  zip: "archives",
  rar: "archives",
  tar: "archives",
  gz: "archives",
};

export const LOGIN_STARS = Array.from({ length: 140 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  s: Math.random() < 0.12 ? 2.5 : Math.random() < 0.3 ? 1.5 : 1,
  o: 0.1 + Math.random() * 0.7,
  d: Math.random() * 6,
}));

export const CATEGORY_ORB_LAYOUT = {
  allFiles: { bx: 50, by: 50 },
  photos: { bx: 22, by: 30 },
  videos: { bx: 74, by: 28 },
  documents: { bx: 48, by: 24 },
  presentations: { bx: 31, by: 64 },
  spreadsheets: { bx: 66, by: 62 },
  music: { bx: 18, by: 76 },
  archives: { bx: 80, by: 74 },
  others: { bx: 52, by: 82 },
};
