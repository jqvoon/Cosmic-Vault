const D = 86400000;
const ALL_FILES_CATEGORY_ORDER = [
  "photos",
  "videos",
  "documents",
  "presentations",
  "spreadsheets",
  "music",
  "archives",
  "others",
];

function clampPosition(value, min = 8, max = 92) {
  return Math.max(min, Math.min(max, value));
}

function resolveOrbCollisions(initialPositions, minDistance = 14.5, iterations = 120) {
  const entries = Object.entries(initialPositions).map(([id, pos]) => ({
    id,
    x: pos.bx,
    y: pos.by,
    anchorX: pos.bx,
    anchorY: pos.by,
  }));

  for (let step = 0; step < iterations; step++) {
    for (let index = 0; index < entries.length; index++) {
      const current = entries[index];
      let pushX = 0;
      let pushY = 0;

      for (let otherIndex = 0; otherIndex < entries.length; otherIndex++) {
        if (index === otherIndex) continue;

        const other = entries[otherIndex];
        const dx = current.x - other.x;
        const dy = current.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;

        if (distance >= minDistance) continue;

        const overlap = (minDistance - distance) / 2;
        pushX += (dx / distance) * overlap;
        pushY += (dy / distance) * overlap;
      }

      // Keep each orb loosely attached to its planned slice position.
      pushX += (current.anchorX - current.x) * 0.08;
      pushY += (current.anchorY - current.y) * 0.08;

      current.x = clampPosition(current.x + pushX);
      current.y = clampPosition(current.y + pushY);
    }
  }

  return Object.fromEntries(
    entries.map((entry) => [
      entry.id,
      {
        bx: clampPosition(entry.x),
        by: clampPosition(entry.y),
      },
    ])
  );
}

export function catColor(categories, id) {
  return categories.find((c) => c.id === id)?.color || "#fff";
}

export function catIcon(categories, id) {
  return categories.find((c) => c.id === id)?.icon || "◉";
}

export function guessCategory(extMap, name) {
  return extMap[name.split(".").pop().toLowerCase()] || "others";
}

export function getPreviewType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return "image";
  }
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return "audio";
  if (["pdf"].includes(ext)) return "pdf";
  if (["txt", "md", "json", "csv", "log", "xml", "yml", "yaml", "crt"].includes(ext)) return "text";
  if (["docx", "xlsx", "pptx", "ppt", "key"].includes(ext)) return "office";
  return "none";
}

export function findSafePosition(existingFiles, minDist = 17) {
  const margin = 13;
  for (let attempt = 0; attempt < 100; attempt++) {
    const bx = margin + Math.random() * (100 - margin * 2);
    const by = margin + Math.random() * (100 - margin * 2);
    const tooClose = existingFiles.some((f) => {
      const dx = (f.bx ?? 50) - bx;
      const dy = (f.by ?? 50) - by;
      return Math.sqrt(dx * dx + dy * dy) < minDist;
    });
    if (!tooClose) return { bx, by };
  }

  const n = existingFiles.length;
  const angle = n * 2.4;
  const r = 10 + (n % 6) * 8;
  return {
    bx: Math.max(margin, Math.min(100 - margin, 50 + r * Math.cos(angle))),
    by: Math.max(margin, Math.min(100 - margin, 50 + r * Math.sin(angle))),
  };
}

export function computeClusterPositions(files, activeCategory) {
  if (activeCategory === "categories") return {};

  if (activeCategory === "allFiles") {
    const orderedFiles = [...files].sort((left, right) => {
      const leftCategoryIndex = ALL_FILES_CATEGORY_ORDER.indexOf(left.category);
      const rightCategoryIndex = ALL_FILES_CATEGORY_ORDER.indexOf(right.category);
      const categoryOrder =
        (leftCategoryIndex === -1 ? ALL_FILES_CATEGORY_ORDER.length : leftCategoryIndex) -
        (rightCategoryIndex === -1 ? ALL_FILES_CATEGORY_ORDER.length : rightCategoryIndex);

      if (categoryOrder !== 0) return categoryOrder;
      return left.name.localeCompare(right.name);
    });

    const n = orderedFiles.length;
    if (n === 0) return {};
    if (n === 1) return { [orderedFiles[0].id]: { bx: 50, by: 50 } };

    const positions = {};
    const baseRadius = 28;
    const ringStep = 13;
    const gapPerLoop = 0.42;
    const orbsPerLoop = Math.max(12, Math.ceil(n / 2));

    orderedFiles.forEach((file, index) => {
      const loopIndex = Math.floor(index / orbsPerLoop);
      const indexInLoop = index % orbsPerLoop;
      const itemsInLoop = Math.min(orbsPerLoop, n - loopIndex * orbsPerLoop);
      const loopProgress = (indexInLoop + 0.5) / itemsInLoop;
      const angle = -Math.PI / 2 + loopProgress * (2 * Math.PI - gapPerLoop);
      const radius = baseRadius + loopIndex * ringStep;

      positions[file.id] = {
        bx: 50 + radius * Math.cos(angle),
        by: 50 + radius * Math.sin(angle),
      };
    });

    return resolveOrbCollisions(positions, 15, 140);
  }

  const matching = files.filter((f) => f.category === activeCategory);
  const n = matching.length;
  if (n === 0) return {};
  if (n === 1) return { [matching[0].id]: { bx: 50, by: 50 } };

  const radius = Math.min(28, Math.max(14, n * 4.5));
  const positions = {};
  matching.forEach((f, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    positions[f.id] = {
      bx: 50 + radius * Math.cos(angle),
      by: 50 + radius * Math.sin(angle),
    };
  });
  return positions;
}

export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateLabel(ts) {
  const now = new Date();
  const d = new Date(ts);
  const diffD = Math.floor((now - d) / D);
  if (diffD === 0) return "Today";
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD} days ago`;
  if (diffD < 14) return "Last week";
  if (diffD < 30) {
    return d.toLocaleDateString([], { month: "long", day: "numeric" });
  }
  return d.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function groupByDate(files) {
  const groups = [];
  const seen = {};
  [...files]
    .sort((a, b) => b.ts - a.ts)
    .forEach((f) => {
      const label = formatDateLabel(f.ts);
      if (!seen[label]) {
        seen[label] = true;
        groups.push({ label, files: [] });
      }
      groups[groups.length - 1].files.push(f);
    });
  return groups;
}
