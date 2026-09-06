import { useMemo, useState } from "react";
import { CATEGORIES } from "../../../data/appData";
import {
  catColor as getCategoryColor,
  catIcon as getCategoryIcon,
  formatTime,
  groupByDate,
} from "../../../utils/fileUtils";
import "./TimelineView.css";

const catColor = (id) => getCategoryColor(CATEGORIES, id);
const catIcon = (id) => getCategoryIcon(CATEGORIES, id);

function TimelineEntry({ file, index, isSelected, onSelect }) {
  const cc = catColor(file.category);
  const isLeftAligned = index % 2 === 0;
  const categoryLabel =
    CATEGORIES.find((category) => category.id === file.category)?.label ?? file.category;

  const card = (
    <div
      className="timeline-entry__card"
      onClick={() => onSelect(file)}
      style={{
        "--accent-color": cc,
        "--accent-solid": cc,
        "--card-bg": isSelected
          ? "linear-gradient(160deg, rgba(124,58,237,0.18), rgba(10,12,22,0.96))"
          : "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        "--card-border": isSelected ? `${cc}66` : "rgba(255,255,255,0.06)",
        "--card-shadow": isSelected
          ? `0 0 30px ${cc}18, inset 0 1px 0 rgba(255,255,255,0.04)`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div className="timeline-entry__card-header">
        <div className="timeline-entry__title">{file.name}</div>
        <div className="timeline-entry__icon" style={{ "--accent-color": cc, "--accent-solid": cc }}>
          {catIcon(file.category)}
        </div>
      </div>
      <div className="timeline-entry__meta">
        {categoryLabel} ? {file.size} ? {formatTime(file.ts)}
      </div>
      <div className="timeline-entry__description">{file.description}</div>
      <div className="timeline-entry__footer">
        <div
          className="timeline-entry__tag"
          style={{ "--accent-color": cc, "--accent-tag": `${cc}CC` }}
        >
          {categoryLabel}
        </div>
      </div>
    </div>
  );

  return (
    <div className="timeline-entry">
      <div className="timeline-entry__side timeline-entry__side--left">
        {isLeftAligned && <div className="timeline-entry__card-wrap">{card}</div>}
      </div>
      <div className="timeline-entry__center">
        <div
          className="timeline-entry__node"
          style={{
            "--accent-color": cc,
            "--node-border": isSelected ? cc : `${cc}99`,
            "--node-shadow": isSelected ? `0 0 18px ${cc}55` : `0 0 10px ${cc}22`,
            "--node-ring": `${cc}22`,
          }}
        >
          <div className="timeline-entry__node-ring" />
        </div>
      </div>
      <div className="timeline-entry__side timeline-entry__side--right">
        {!isLeftAligned && <div className="timeline-entry__card-wrap">{card}</div>}
      </div>
    </div>
  );
}

export function TimelineView({ files, onSelect, selectedId, onPreview }) {
  void onPreview;

  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      files.filter((file) => {
        const categoryLabel =
          CATEGORIES.find((category) => category.id === file.category)?.label ?? file.category;
        const query = search.toLowerCase();

        return (
          !search.trim() ||
          file.name.toLowerCase().includes(query) ||
          categoryLabel.toLowerCase().includes(query) ||
          file.description.toLowerCase().includes(query)
        );
      }),
    [files, search]
  );
  const groups = groupByDate(filtered);

  return (
    <div className="timeline-view">
      <div className="timeline-view__toolbar">
        <input
          className="timeline-view__search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search timeline..."
        />
        <div className="timeline-view__count">
          {filtered.length} timeline item{filtered.length === 1 ? "" : "s"} visible
        </div>
      </div>
      <div className="timeline-view__body">
        {groups.map((group, groupIndex) => {
          const offset = groups
            .slice(0, groupIndex)
            .reduce((total, entry) => total + entry.files.length, 0);

          return (
            <div key={group.label} className="timeline-view__group">
              <div className="timeline-view__group-label">{group.label}</div>
              <div className="timeline-view__group-track">
                <div className="timeline-view__group-line" />
                {group.files.map((file, fileIndex) => (
                  <TimelineEntry
                    key={file.id}
                    file={file}
                    index={offset + fileIndex}
                    isSelected={selectedId === file.id}
                    onSelect={(selectedFile) => onSelect(selectedFile.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
