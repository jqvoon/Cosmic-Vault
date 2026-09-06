import { useState } from "react";

const formatHistoryTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export function QueueSidebar({
  open,
  queues,
  history,
  failedImageAnalysisItems = [],
  onRetryImageTagging,
  onDismissImageTaggingFailure,
  failedSummarizationItems = [],
  onRetrySummarization,
  onDismissSummarizationFailure,
  onToggle,
}) {
  const [activeTab, setActiveTab] = useState("progress");
  const totalItems = queues.reduce((sum, queue) => sum + queue.count, 0);
  const queueLabels = {
    scan: "Security Check",
    imageTagging: "Image Analysis",
    textSummarization: "Summarizing Documents",
  };

  const subtitle =
    activeTab === "progress"
      ? totalItems === 0
        ? "Nothing in progress right now"
        : `${totalItems} active item${totalItems === 1 ? "" : "s"}`
      : history.length === 0
        ? "No activity recorded in this session"
        : `${history.length} recorded event${history.length === 1 ? "" : "s"}`;

  return (
    <aside className={`queue-sidebar ${open ? "open" : "closed"}`}>
      <button
        type="button"
        className="queue-sidebar__toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="queue-sidebar__toggle-icon">{open ? "<" : ">"}</span>
        <span className="queue-sidebar__toggle-label">Live Activity</span>
        <span className="queue-sidebar__toggle-count">{totalItems}</span>
      </button>

      <div className="queue-sidebar__panel">
        <div className="queue-sidebar__header">
          <div className="queue-sidebar__title">Live Activity</div>
          <div className="queue-sidebar__subtitle">{subtitle}</div>
        </div>

        <div className="queue-sidebar__tabs">
          <button
            type="button"
            className={`queue-sidebar__tab ${activeTab === "progress" ? "active" : ""}`}
            onClick={() => setActiveTab("progress")}
          >
            In Progress
          </button>
          <button
            type="button"
            className={`queue-sidebar__tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </div>

        {activeTab === "progress" ? (
          <div className="queue-sidebar__sections">
            {queues.map((queue) => (
              <section key={queue.key} className="queue-sidebar__section">
                <div className="queue-sidebar__section-header">
                  <span>{queueLabels[queue.key] ?? queue.label}</span>
                  <span className="queue-sidebar__section-count">
                    {queue.count}
                  </span>
                </div>

                {queue.items.length === 0 ? (
                  <div className="queue-sidebar__empty">
                    No files in progress
                  </div>
                ) : (
                  <div className="queue-sidebar__list">
                    {queue.items.map((item) => (
                      <article key={item.id} className="queue-sidebar__item">
                        <div
                          className="queue-sidebar__item-name"
                          title={item.fileName}
                        >
                          {item.fileName}
                        </div>
                        <div className="queue-sidebar__item-meta">
                          <span
                            className={`queue-sidebar__status queue-sidebar__status--${item.status}`}
                          >
                            {item.status}
                          </span>
                          {item.position > 0 && (
                            <span className="queue-sidebar__position">
                              #{item.position}
                            </span>
                          )}
                          {typeof item.attempt === "number" &&
                            item.attempt > 0 && (
                              <span className="queue-sidebar__attempt">
                                Retry {item.attempt}
                              </span>
                            )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {queue.key === "imageTagging" &&
                  failedImageAnalysisItems.length > 0 && (
                    <div className="queue-sidebar__list">
                      {failedImageAnalysisItems.map((item) => (
                        <article
                          key={`failed-${item.id}`}
                          className="queue-sidebar__item"
                        >
                          <div
                            className="queue-sidebar__item-name"
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div className="queue-sidebar__item-meta">
                            <span className="queue-sidebar__status queue-sidebar__status--failed">
                              failed
                            </span>
                            <button
                              type="button"
                              className="queue-sidebar__tab"
                              onClick={() => onRetryImageTagging?.(item)}
                              style={{
                                marginLeft: "auto",
                                padding: "4px 8px",
                                fontSize: 10,
                              }}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              className="queue-sidebar__tab"
                              onClick={() =>
                                onDismissImageTaggingFailure?.(item)
                              }
                              style={{ padding: "4px 8px", fontSize: 10 }}
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                {queue.key === "textSummarization" &&
                  failedSummarizationItems.length > 0 && (
                    <div className="queue-sidebar__list">
                      {failedSummarizationItems.map((item) => (
                        <article
                          key={`failed-summary-${item.id}`}
                          className="queue-sidebar__item"
                        >
                          <div
                            className="queue-sidebar__item-name"
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div className="queue-sidebar__item-meta">
                            <span className="queue-sidebar__status queue-sidebar__status--failed">
                              failed
                            </span>
                            <button
                              type="button"
                              className="queue-sidebar__tab"
                              onClick={() => onRetrySummarization?.(item)}
                              style={{
                                marginLeft: "auto",
                                padding: "4px 8px",
                                fontSize: 10,
                              }}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              className="queue-sidebar__tab"
                              onClick={() =>
                                onDismissSummarizationFailure?.(item)
                              }
                              style={{ padding: "4px 8px", fontSize: 10 }}
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
              </section>
            ))}
          </div>
        ) : (
          <div className="queue-sidebar__history">
            {history.length === 0 ? (
              <div className="queue-sidebar__empty">
                No activity recorded in this session
              </div>
            ) : (
              history.map((entry) => (
                <article key={entry.id} className="queue-sidebar__history-item">
                  <div className="queue-sidebar__history-message">
                    {entry.message}
                  </div>
                  <div className="queue-sidebar__history-time">
                    {formatHistoryTime(entry.timestamp)}
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
