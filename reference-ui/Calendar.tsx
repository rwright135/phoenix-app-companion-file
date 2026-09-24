"use client";
import { useEffect, useRef, useState, useId } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { Icon } from "./Icon";
export function dayLabel(value: string, year = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
}
export function Calendar({
  value,
  min,
  onSelect,
  onClose,
  title = "Choose a departure date",
  anchor,
}: {
  value: string;
  min: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  title?: string;
  anchor?: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const [month, setMonth] = useState(() =>
    Temporal.PlainDate.from(value || min || Temporal.Now.plainDateISO()).with({
      day: 1,
    }),
  );
  useEffect(() => {
    const el = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    if (anchor) el.show();
    else el.showModal();
    const position = () => {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      el.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      el.style.top = `${Math.max(12, rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`;
    };
    const dismiss = (event: PointerEvent) => {
      if (
        anchor &&
        !el.contains(event.target as Node) &&
        !anchor.contains(event.target as Node)
      )
        onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (anchor && event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    position();
    if (anchor) {
      document.addEventListener("pointerdown", dismiss);
      document.addEventListener("keydown", escape);
      window.addEventListener("resize", position);
      window.addEventListener("scroll", position, true);
    }
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      el.close();
      queueMicrotask(() => trigger?.focus());
    };
  }, [anchor, onClose]);
  const start = month.subtract({ days: month.dayOfWeek % 7 });
  const days = Array.from(
    { length: Math.ceil(((month.dayOfWeek % 7) + month.daysInMonth) / 7) * 7 },
    (_, i) => start.add({ days: i }),
  );
  return (
    <dialog
      ref={dialog}
      className={"calendar-modal" + (anchor ? " calendar-popover" : "")}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close calendar"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="calendar-content">
        <div className="month-nav">
          <button
            className="icon-button"
            aria-label="Previous month"
            disabled={month.toString().slice(0, 7) <= min.slice(0, 7)}
            onClick={() => setMonth(month.subtract({ months: 1 }))}
          >
            <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
          </button>
          <h3 aria-live="polite">
            {month.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </h3>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => setMonth(month.add({ months: 1 }))}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <div className="calendar-grid">
          <div className="weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((d) => {
              const key = d.toString(),
                outside = d.month !== month.month;
              return (
                <button
                  key={key}
                  type="button"
                  data-day={key}
                  className={
                    (key === value ? "selected " : "") +
                    (outside ? "outside" : "")
                  }
                  disabled={key < min || outside}
                  aria-label={d.toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  aria-pressed={key === value}
                  autoFocus={key === (value >= min ? value : min)}
                  onKeyDown={(e) => {
                    const delta = (
                      {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      } as Record<string, number>
                    )[e.key];
                    if (delta) {
                      e.preventDefault();
                      const target = d.add({ days: delta }).toString();
                      dialog.current
                        ?.querySelector<HTMLButtonElement>(
                          `[data-day="${target}"]:not(:disabled)`,
                        )
                        ?.focus();
                    }
                  }}
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </dialog>
  );
}
