import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_ORB_LAYOUT } from "../../../data/appData";
import {
  catColor as getCategoryColor,
  computeClusterPositions,
} from "../../../utils/fileUtils";
import { getValidAccessToken } from "../../../utils/tokenManager";
import "./SpaceView.css";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const CENTER_EXCLUSION_RADIUS = 17;
const CATEGORY_TRANSITION_MS = 520;
const CATEGORY_COLLAPSE_MS = 600;
const CATEGORY_REVEAL_DELAY_MS = 40;
const CENTER_ORB_POSITION = { bx: 50, by: 50 };

const reserveCenterSpace = (
  bx,
  by,
  index,
  minRadius = CENTER_EXCLUSION_RADIUS,
) => {
  const dx = bx - 50;
  const dy = by - 50;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance >= minRadius) {
    return { bx, by };
  }

  const angle =
    distance === 0 ? (index / 12) * 2 * Math.PI : Math.atan2(dy, dx);
  return {
    bx: 50 + minRadius * Math.cos(angle),
    by: 50 + minRadius * Math.sin(angle),
  };
};

function BlobNode({
  file,
  index,
  isSelected,
  isDimmed,
  isClustering,
  displayX,
  displayY,
  flowMotion,
  onClick,
}) {
  const [hov, setHov] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const cc = catColor(file.category);
  const active = isSelected || hov;
  const bx = displayX ?? file.bx;
  const by = displayY ?? file.by;
  const categoryLabel =
    CATEGORIES.find((category) => category.id === file.category)?.label ??
    file.category;
  const flowClassName = flowMotion
    ? ` blob-node--flow blob-node--flow-${flowMotion.direction}-${flowMotion.phase}`
    : "";

  const sourceUrl = file.localPreviewUrl || file.dataUrl || file.previewUrl;
  const shouldLoadImage =
    !isDimmed && file.category === "photos" && sourceUrl && !file.dataUrl;

  useEffect(() => {
    let active = true;
    let nextBlobUrl = null;

    // Load Image only if photos category is selected
    if (shouldLoadImage) {
      // Only fetch if it's not a dataUrl (which doesn't need auth)
      setLoading(true);
      const loadImage = async () => {
        try {
          const token = await getValidAccessToken();
          const response = await fetch(sourceUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status}`);
          }
          const blob = await response.blob();
          if (active) {
            nextBlobUrl = URL.createObjectURL(blob);
            setImageBlobUrl(nextBlobUrl);
          }
        } catch (err) {
          console.error("Failed to load thumbnail:", err);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };
      loadImage();
    } else {
      setLoading(false);
      setImageBlobUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
    }

    return () => {
      active = false;
      if (nextBlobUrl) {
        URL.revokeObjectURL(nextBlobUrl);
      }
    };
  }, [shouldLoadImage, sourceUrl]);

  const hasImage = file.category === "photos" && (imageBlobUrl || file.dataUrl);

  return (
    <div
      className={`blob-node${flowClassName}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        "--blob-x": `${bx}%`,
        "--blob-y": `${by}%`,
        "--blob-origin-x": flowMotion ? `${flowMotion.bx}%` : `${bx}%`,
        "--blob-origin-y": flowMotion ? `${flowMotion.by}%` : `${by}%`,
        "--blob-scale": isSelected ? "1.18" : hov ? "1.1" : "1",
        "--blob-transition": isClustering
          ? "left 0.6s cubic-bezier(.34,1.1,.64,1), top 0.6s cubic-bezier(.34,1.1,.64,1), transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.4s"
          : "transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.3s",
        "--blob-opacity": isDimmed ? "0.1" : "1",
        "--blob-z": isSelected ? 20 : hov ? 10 : 2,
        "--blob-animation": isClustering
          ? "none"
          : `blobFloat ${3.2 + (index % 5) * 0.5}s ${(index * 0.38) % 3}s ease-in-out infinite`,
        "--blob-cursor": isDimmed ? "default" : "pointer",
        "--blob-events": isDimmed ? "none" : "auto",
      }}
    >
      <div
        className="blob-node__orb"
        onClick={() => onClick(file.id)}
        style={{
          "--blob-color": cc,
          "--blob-border": active ? `${cc}AA` : `${cc}44`,
          "--blob-shadow": isSelected
            ? `0 0 0 5px ${cc}18, 0 0 34px ${cc}55`
            : hov
              ? `0 0 24px ${cc}44`
              : `0 0 12px ${cc}22`,
          background: hasImage
            ? "none"
            : `radial-gradient(circle at 35% 30%, ${cc}55, ${cc}20, ${cc}08)`,
        }}
      >
        {hasImage ? (
          <img
            src={imageBlobUrl || file.dataUrl}
            alt={file.name}
            className="blob-node__orb-image"
          />
        ) : (
          CATEGORIES.find((category) => category.id === file.category)?.icon
        )}
      </div>
      <div className="blob-node__meta">
        <div
          className="blob-node__name"
          style={{ "--blob-text": active ? "white" : "rgba(255,255,255,0.65)" }}
        >
          {file.name}
        </div>
        <div
          className="blob-node__category"
          style={{ "--blob-category": `${cc}CC` }}
        >
          {categoryLabel}
        </div>
      </div>
    </div>
  );
}

function CategoryBlobNode({
  category,
  count,
  index,
  onClick,
  transitionState,
}) {
  const [hov, setHov] = useState(false);
  const pos = CATEGORY_ORB_LAYOUT[category.id] ?? {
    bx: 20 + ((index * 17) % 60),
    by: 25 + ((index * 13) % 50),
  };
  const isTransitioning = transitionState?.active;
  const isTarget = transitionState?.targetId === category.id;
  const collapseTo = transitionState?.collapseTo ?? pos;
  const isRevealing = transitionState?.mode === "reveal";

  return (
    <div
      className={`category-orb${
        isTransitioning
          ? ` category-orb--${isRevealing ? "revealing" : "collapsing"}`
          : ""
      }${isTarget ? " category-orb--target" : ""}`}
      onMouseEnter={() => !isTransitioning && setHov(true)}
      onMouseLeave={() => !isTransitioning && setHov(false)}
      style={{
        "--orb-x": `${pos.bx}%`,
        "--orb-y": `${pos.by}%`,
        "--orb-collapse-x": `${collapseTo.bx}%`,
        "--orb-collapse-y": `${collapseTo.by}%`,
        "--orb-reveal-x":
          isRevealing && transitionState.phase === "out"
            ? `${pos.bx}%`
            : `${collapseTo.bx}%`,
        "--orb-reveal-y":
          isRevealing && transitionState.phase === "out"
            ? `${pos.by}%`
            : `${collapseTo.by}%`,
        "--orb-reveal-scale":
          isRevealing && transitionState.phase === "out" ? "1" : "0.18",
        "--orb-scale": hov ? "1.08" : "1",
      }}
    >
      <div
        className="category-orb__button"
        onClick={onClick}
        style={{
          "--orb-color": category.color,
          "--orb-color-solid": category.color,
          "--orb-border": hov ? `${category.color}AA` : `${category.color}55`,
          "--orb-shadow": hov
            ? `0 0 32px ${category.color}22`
            : `0 0 18px ${category.color}12`,
        }}
      >
        <span className="category-orb__icon">{category.icon}</span>
        <span className="category-orb__label">{category.label}</span>
        <span className="category-orb__count">{count}</span>
      </div>
    </div>
  );
}

function ReturnToCategoriesOrb({ onClick }) {
  const themeCategory =
    CATEGORIES.find((entry) => entry.id === "others") ?? CATEGORIES[0];
  const categoriesMeta =
    CATEGORIES.find((entry) => entry.id === "categories") ?? CATEGORIES[0];

  return (
    <div
      className="category-orb category-orb--return"
      style={{
        "--orb-x": "50%",
        "--orb-y": "50%",
        "--orb-scale": "1",
      }}
    >
      <div
        className="category-orb__button category-orb__button--return"
        onClick={onClick}
        style={{
          "--orb-color": themeCategory.color,
          "--orb-color-solid": themeCategory.color,
          "--orb-border": `${themeCategory.color}88`,
          "--orb-shadow": `0 0 24px ${themeCategory.color}18`,
        }}
      >
        <span className="category-orb__icon">{categoriesMeta.icon}</span>
        <span className="category-orb__label">Categories</span>
        <span className="category-orb__count">{"\u2190"}</span>
      </div>
    </div>
  );
}

function TagBlobNode({ tag, index, totalTags, maxCount, onClick }) {
  const [hov, setHov] = useState(false);
  const angle = (index / Math.max(1, totalTags)) * 2 * Math.PI - Math.PI / 2;
  const radius = Math.min(28, Math.max(16, totalTags * 3.8));
  const bx = 50 + radius * Math.cos(angle);
  const by = 50 + radius * Math.sin(angle);
  const minSize = 94;
  const maxSize = 148;
  const scale = maxCount <= 1 ? 0.5 : (tag.count - 1) / (maxCount - 1);
  const size = minSize + scale * (maxSize - minSize);
  const photoColor = catColor("photos");
  const photoIcon =
    CATEGORIES.find((category) => category.id === "photos")?.icon ?? "○";

  return (
    <div
      className="tag-orb"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        "--tag-x": `${bx}%`,
        "--tag-y": `${by}%`,
        "--tag-scale": hov ? "1.06" : "1",
        "--tag-size": `${size}px`,
      }}
    >
      <button
        type="button"
        className="tag-orb__button"
        onClick={() => onClick(tag.label)}
        style={{
          "--tag-color": photoColor,
          "--tag-border": hov ? `${photoColor}AA` : `${photoColor}55`,
          "--tag-shadow": hov
            ? `0 0 32px ${photoColor}22`
            : `0 0 18px ${photoColor}12`,
        }}
      >
        <span className="tag-orb__icon">{photoIcon}</span>
        <span className="tag-orb__label">#{tag.label}</span>
        <span className="tag-orb__count">
          {tag.count} file{tag.count === 1 ? "" : "s"}
        </span>
      </button>
    </div>
  );
}

export function SpaceView({
  files,
  aiEnabled,
  activeCategory,
  onCategoryChange,
  search,
  onSearch,
  photoSearchMode,
  onPhotoSearchModeChange,
  selected,
  onSelect,
  onPreview,
}) {
  void onPreview;
  const [topTagCount, setTopTagCount] = useState(5);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [categoryTransition, setCategoryTransition] = useState(null);
  const [fileFlowPhase, setFileFlowPhase] = useState(null);
  const [categoryRevealPhase, setCategoryRevealPhase] = useState(null);
  const [pendingCategoryId, setPendingCategoryId] = useState(null);
  const normalizedSearch = search.trim().toLowerCase();
  const isPhotoCategory = activeCategory === "photos";
  const isTagSearchEnabled =
    aiEnabled && isPhotoCategory && photoSearchMode === "tags";
  const isTagLanding = isTagSearchEnabled && !normalizedSearch;

  const photoFiles = files.filter((file) => file.category === "photos");

  const topPhotoTags = useMemo(() => {
    const tagCounts = new Map();

    for (const file of photoFiles) {
      for (const tag of file.tags ?? []) {
        const normalizedTag = String(tag).trim().toLowerCase();
        if (!normalizedTag) continue;
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) ?? 0) + 1);
      }
    }

    return [...tagCounts.entries()]
      .map(([label, count], index) => {
        const angle =
          (index / Math.max(tagCounts.size, 1)) * 2 * Math.PI - Math.PI / 2;
        const radius = 18 + (index % 4) * 9;
        return {
          label,
          count,
          bx: 50 + radius * Math.cos(angle),
          by: 50 + radius * Math.sin(angle),
        };
      })
      .sort(
        (left, right) =>
          right.count - left.count || left.label.localeCompare(right.label),
      )
      .slice(0, topTagCount);
  }, [photoFiles, topTagCount]);

  const displayed = files.filter((file) => {
    const catOk =
      activeCategory === "allFiles"
        ? true
        : activeCategory === "categories"
          ? false
          : file.category === activeCategory;
    const categoryLabel =
      CATEGORIES.find((category) => category.id === file.category)?.label ??
      file.category;
    const searchOk =
      !normalizedSearch ||
      (isTagSearchEnabled
        ? (file.tags ?? []).some((tag) =>
            tag.toLowerCase().includes(normalizedSearch),
          )
        : file.name.toLowerCase().includes(normalizedSearch) ||
          categoryLabel.toLowerCase().includes(normalizedSearch) ||
          file.description.toLowerCase().includes(normalizedSearch));

    return catOk && searchOk;
  });

  const counts = Object.fromEntries(
    CATEGORIES.map((category) => [
      category.id,
      category.id === "allFiles"
        ? files.length
        : category.id === "categories"
          ? CATEGORIES.filter(
              (entry) =>
                entry.id !== "categories" &&
                (entry.id === "allFiles" ||
                  files.some((file) => file.category === entry.id)),
            ).length
          : files.filter((file) => file.category === category.id).length,
    ]),
  );

  const categoryOrbs = CATEGORIES.filter(
    (category) =>
      category.id !== "categories" &&
      (category.id === "allFiles" || counts[category.id] > 0),
  );
  const activeCategoryMeta =
    CATEGORIES.find((category) => category.id === activeCategory) ??
    CATEGORIES[0];
  const isCategoryLanding =
    activeCategory === "categories" && !normalizedSearch;
  const isClustering =
    activeCategory !== "categories" && !normalizedSearch && !isTagLanding;
  const clusterPositions = useMemo(
    () => computeClusterPositions(files, activeCategory),
    [files, activeCategory],
  );
  const visiblePositionOverrides = useMemo(() => {
    if (isCategoryLanding) return {};

    const overrides = {};
    displayed.forEach((file, index) => {
      const basePosition =
        isClustering && clusterPositions[file.id]
          ? clusterPositions[file.id]
          : { bx: file.bx, by: file.by };
      overrides[file.id] = reserveCenterSpace(
        basePosition.bx,
        basePosition.by,
        index,
        activeCategory === "allFiles" ? 22 : CENTER_EXCLUSION_RADIUS,
      );
    });
    return overrides;
  }, [
    activeCategory,
    clusterPositions,
    displayed,
    isCategoryLanding,
    isClustering,
  ]);
  const canvasRef = useRef(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
  });
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!categoryTransition) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCategoryTransition(null);
    }, CATEGORY_TRANSITION_MS + 220);

    return () => window.clearTimeout(timeoutId);
  }, [categoryTransition]);

  useEffect(() => {
    if (categoryTransition?.phase !== "dispersing") return undefined;

    const startId = window.setTimeout(() => {
      setFileFlowPhase("out");
    }, CATEGORY_REVEAL_DELAY_MS);
    const clearId = window.setTimeout(() => {
      setFileFlowPhase(null);
      setCategoryTransition(null);
    }, CATEGORY_TRANSITION_MS);

    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(clearId);
    };
  }, [categoryTransition]);

  useEffect(() => {
    if (categoryTransition?.phase !== "revealing") return undefined;

    const startId = window.setTimeout(() => {
      setCategoryRevealPhase("out");
    }, CATEGORY_REVEAL_DELAY_MS);
    const clearId = window.setTimeout(() => {
      setCategoryRevealPhase(null);
      setCategoryTransition(null);
    }, CATEGORY_TRANSITION_MS);

    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(clearId);
    };
  }, [categoryTransition]);

  useEffect(() => {
    if (categoryTransition?.phase !== "retargeting" || !pendingCategoryId) {
      return undefined;
    }

    const collapseId = window.setTimeout(() => {
      setFileFlowPhase("end");
    }, CATEGORY_REVEAL_DELAY_MS);

    const switchId = window.setTimeout(() => {
      onSelect(null);
      onSearch("");
      onCategoryChange(pendingCategoryId);
      setFileFlowPhase("in");
      setCategoryTransition((current) =>
        current?.phase === "retargeting"
          ? { ...current, phase: "dispersing" }
          : current,
      );
      setPendingCategoryId(null);
    }, CATEGORY_COLLAPSE_MS);

    return () => {
      window.clearTimeout(collapseId);
      window.clearTimeout(switchId);
    };
  }, [
    categoryTransition,
    onCategoryChange,
    onSearch,
    onSelect,
    pendingCategoryId,
  ]);

  const clampPan = useCallback((nextX, nextY) => {
    const width = canvasRef.current?.clientWidth ?? 0;
    const height = canvasRef.current?.clientHeight ?? 0;
    const maxX = Math.max(80, width * 0.35);
    const maxY = Math.max(80, height * 0.35);

    return {
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    };
  }, []);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: pan.x,
      baseY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) return;

    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }

    setPan(clampPan(dragRef.current.baseX + dx, dragRef.current.baseY + dy));
  };

  const handlePointerEnd = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
  };

  const swallowClickAfterDrag = (event) => {
    if (!dragRef.current.moved) return;

    event.preventDefault();
    event.stopPropagation();
    dragRef.current.moved = false;
  };

  const startCategoryTransition = (category) => {
    setCategoryTransition({
      id: category.id,
      label: category.label,
      color: category.color,
      icon: category.icon,
      count: counts[category.id],
      collapseTo: CENTER_ORB_POSITION,
      phase: "collapsing",
    });

    window.setTimeout(() => {
      onSelect(null);
      onSearch("");
      onCategoryChange(category.id);
      setFileFlowPhase("in");
      setCategoryTransition((current) => {
        if (current?.id !== category.id) return current;
        return { ...current, phase: "dispersing" };
      });
    }, CATEGORY_COLLAPSE_MS);
  };

  const handleCategorySelection = (categoryId) => {
    const category = CATEGORIES.find((entry) => entry.id === categoryId);

    if (!category) {
      onCategoryChange(categoryId);
      onSelect(null);
      return;
    }

    if (categoryId === "categories") {
      startReturnTransition();
      return;
    }

    if (activeCategory === "categories" && !normalizedSearch) {
      startCategoryTransition(category);
      return;
    }

    setPendingCategoryId(category.id);
    setFileFlowPhase("start");
    setCategoryTransition({
      id: category.id,
      collapseTo: CENTER_ORB_POSITION,
      phase: "retargeting",
    });
  };

  const startReturnTransition = () => {
    onSearch("");
    onSelect(null);
    setCategoryTransition({
      id: "categories",
      collapseTo: CENTER_ORB_POSITION,
      phase: "returning",
    });
    setFileFlowPhase("start");

    window.setTimeout(() => {
      setFileFlowPhase("end");
    }, CATEGORY_REVEAL_DELAY_MS);

    window.setTimeout(() => {
      onCategoryChange("categories");
      setFileFlowPhase(null);
      setCategoryRevealPhase("in");
      setCategoryTransition({
        id: "categories",
        collapseTo: CENTER_ORB_POSITION,
        phase: "revealing",
      });
    }, CATEGORY_COLLAPSE_MS);
  };

  const categoryTransitionState =
    isCategoryLanding && categoryTransition?.phase === "collapsing"
      ? {
          active: true,
          targetId: categoryTransition.id,
          collapseTo: categoryTransition.collapseTo,
          mode: "collapse",
        }
      : isCategoryLanding && categoryTransition?.phase === "revealing"
        ? {
            active: true,
            targetId: null,
            collapseTo: categoryTransition.collapseTo,
            mode: "reveal",
            phase: categoryRevealPhase,
          }
        : null;

  const fileFlowMotion =
    fileFlowPhase && categoryTransition?.collapseTo
      ? {
          ...categoryTransition.collapseTo,
          direction:
            categoryTransition.phase === "returning" ||
            categoryTransition.phase === "retargeting"
              ? "to-center"
              : "from-center",
          phase: fileFlowPhase,
        }
      : null;

  return (
    <div
      className={`space-view ${
        categoryTransition?.phase === "collapsing" ||
        categoryTransition?.phase === "returning" ||
        categoryTransition?.phase === "retargeting"
          ? "space-view--category-transitioning"
          : ""
      }`}
    >
      <div
        className={`space-view__toolbar ${filtersCollapsed ? "space-view__toolbar--collapsed" : ""}`}
      >
        <div className="space-view__toolbar-header">
          <button
            type="button"
            className="space-view__toolbar-toggle"
            onClick={() => setFiltersCollapsed((current) => !current)}
            aria-expanded={!filtersCollapsed}
          >
            <span>{filtersCollapsed ? "▤" : "✕"}</span>
            <span>
              {filtersCollapsed ? "Show Categories" : "Hide Categories"}
            </span>
          </button>
        </div>
        {!filtersCollapsed && (
          <div className="space-view__filters">
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category.id;

              return (
                <button
                  className="space-view__filter"
                  key={category.id}
                  onClick={() => {
                    handleCategorySelection(category.id);
                  }}
                  style={{
                    "--filter-border": isActive
                      ? `${category.color}55`
                      : "rgba(255,255,255,0.08)",
                    "--filter-bg": isActive
                      ? `linear-gradient(135deg, ${category.color}22, rgba(10,12,24,0.92))`
                      : "rgba(255,255,255,0.03)",
                    "--filter-color": isActive
                      ? "white"
                      : "rgba(255,255,255,0.55)",
                    "--filter-shadow": isActive
                      ? `0 0 20px ${category.color}18`
                      : "none",
                  }}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                  <span className="space-view__filter-count">
                    {counts[category.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="space-view__search-row">
          <div
            className="space-view__label"
            style={{
              "--label-color":
                activeCategory === "categories"
                  ? "rgba(255,255,255,0.3)"
                  : activeCategoryMeta.color,
            }}
          >
            {isTagLanding
              ? "Top Photo Tags"
              : activeCategory === "categories"
                ? "Categories"
                : `${activeCategoryMeta.label} Cluster`}
          </div>
          <input
            className="space-view__search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={
              isTagSearchEnabled
                ? isTagLanding
                  ? "Click a tag orb to filter photos..."
                  : "Filter photos by tags..."
                : "Search files or categories..."
            }
          />
          {isTagSearchEnabled && search && (
            <button
              type="button"
              className="space-view__search-reset"
              onClick={() => {
                onSearch("");
                onSelect(null);
              }}
              aria-label="Reset tag filter"
              title="Reset tag filter"
            >
              ↺
            </button>
          )}
          {aiEnabled && isPhotoCategory && (
            <>
              <label className="space-view__search-toggle">
                <input
                  type="checkbox"
                  checked={isTagSearchEnabled}
                  onChange={(event) => {
                    onPhotoSearchModeChange(
                      event.target.checked ? "tags" : "default",
                    );
                    onSearch("");
                    onSelect(null);
                  }}
                />
                <span>Filter by Tags</span>
              </label>
              {isTagSearchEnabled && (
                <label className="space-view__tag-count">
                  <span>Top</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={topTagCount}
                    onChange={(event) => {
                      const nextValue = Number.parseInt(event.target.value, 10);
                      setTopTagCount(
                        Number.isNaN(nextValue)
                          ? 5
                          : Math.max(1, Math.min(20, nextValue)),
                      );
                    }}
                  />
                  <span>tags</span>
                </label>
              )}
            </>
          )}
        </div>
      </div>
      <div
        className={`space-view__hint ${filtersCollapsed ? "space-view__hint--collapsed" : ""}`}
      >
        {isCategoryLanding
          ? "Choose a category orb to open its files, or drag to explore the space."
          : isTagLanding
            ? `Showing the top ${topPhotoTags.length} photo tag${topPhotoTags.length === 1 ? "" : "s"}. Click a tag orb to open matching files.`
            : `${displayed.length} visible file${displayed.length === 1 ? "" : "s"} in ${
                activeCategoryMeta.label
              }. Click an orb for details or drag to pan.`}
      </div>
      <div
        className="space-view__canvas"
        ref={canvasRef}
        style={{
          "--canvas-cursor": dragRef.current.active ? "grabbing" : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onClickCapture={swallowClickAfterDrag}
      >
        <div
          className="space-view__stage"
          style={{ "--pan-x": `${pan.x}px`, "--pan-y": `${pan.y}px` }}
        >
          {!isCategoryLanding && (
            <ReturnToCategoriesOrb onClick={startReturnTransition} />
          )}
          {isCategoryLanding
            ? categoryOrbs.map((category, index) => (
                <CategoryBlobNode
                  key={category.id}
                  category={category}
                  count={counts[category.id]}
                  index={index}
                  transitionState={categoryTransitionState}
                  onClick={() => handleCategorySelection(category.id)}
                />
              ))
            : isTagLanding
              ? topPhotoTags.map((tag, index) => (
                  <TagBlobNode
                    key={tag.label}
                    tag={tag}
                    index={index}
                    totalTags={topPhotoTags.length}
                    maxCount={topPhotoTags[0]?.count ?? 1}
                    onClick={(selectedTag) => {
                      onSelect(null);
                      onSearch(selectedTag);
                    }}
                  />
                ))
              : files.map((file, index) => {
                  const isVisible = displayed.some(
                    (visibleFile) => visibleFile.id === file.id,
                  );
                  const position =
                    visiblePositionOverrides[file.id] ??
                    clusterPositions[file.id];

                  return (
                    <BlobNode
                      key={file.id}
                      file={file}
                      index={index}
                      isSelected={selected === file.id}
                      isDimmed={!isVisible}
                      isClustering={isClustering}
                      displayX={
                        isClustering && position ? position.bx : undefined
                      }
                      displayY={
                        isClustering && position ? position.by : undefined
                      }
                      flowMotion={isVisible ? fileFlowMotion : null}
                      onClick={(id) => onSelect(selected === id ? null : id)}
                    />
                  );
                })}
        </div>
      </div>
    </div>
  );
}
