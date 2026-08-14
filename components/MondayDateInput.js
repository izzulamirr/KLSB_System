"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(value) {
  const date = parseIsoDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function startOfCalendarGrid(year, month) {
  const monthStart = new Date(year, month, 1);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  return new Date(year, month, 1 - mondayOffset);
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(2000, index, 1))
);

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear + 10; year >= currentYear - 100; year -= 1) {
    years.push(year);
  }
  return years;
}

export default function MondayDateInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Select date",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseIsoDate(value) || new Date());
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);

  useEffect(() => {
    const parsed = parseIsoDate(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (event) => {
      const insideWrapper = wrapperRef.current && wrapperRef.current.contains(event.target);
      const insidePopover = popoverRef.current && popoverRef.current.contains(event.target);
      if (!insideWrapper && !insidePopover) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = 360;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = rect.left;
      if (left + popoverWidth > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - popoverWidth - 8);
      }

      let top = rect.bottom + gap;
      const openAbove = rect.bottom + gap + popoverHeight > viewportHeight - 8 && rect.top - gap - popoverHeight >= 8;
      if (openAbove) {
        top = rect.top - gap - popoverHeight;
      }

      setPopoverStyle({
        position: "fixed",
        left,
        top,
        width: popoverWidth,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, viewDate]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const start = startOfCalendarGrid(year, month);
    const cells = [];

    for (let index = 0; index < 42; index += 1) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + index);
      cells.push(cellDate);
    }

    return cells;
  }, [viewDate]);

  const selectedDate = parseIsoDate(value);
  const displayValue = selectedDate ? formatDisplayDate(value) : "";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={
          "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none " +
          className
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? "text-slate-900" : "text-slate-400"}>{displayValue || placeholder}</span>
        <span className="text-slate-400">📅</span>
      </button>

      {open && !disabled && popoverStyle && typeof document !== "undefined" && createPortal(
        <div ref={popoverRef} style={popoverStyle} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_50px_rgba(15,23,42,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
              aria-label="Previous month"
            >
              ←
            </button>

            <div className="flex items-center gap-1">
              <select
                value={viewDate.getMonth()}
                onChange={(event) => {
                  const month = Number(event.target.value);
                  setViewDate((current) => new Date(current.getFullYear(), month, 1));
                }}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-slate-900 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                aria-label="Select month"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={viewDate.getFullYear()}
                onChange={(event) => {
                  const year = Number(event.target.value);
                  setViewDate((current) => new Date(year, current.getMonth(), 1));
                }}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-slate-900 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                aria-label="Select year"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((cellDate) => {
              const isCurrentMonth = cellDate.getMonth() === viewDate.getMonth();
              const cellIso = toIsoDate(cellDate);
              const isSelected = value && cellIso === value;
              const isToday = toIsoDate(new Date()) === cellIso;

              return (
                <button
                  key={cellIso}
                  type="button"
                  onClick={() => {
                    onChange(cellIso);
                    setOpen(false);
                  }}
                  className={
                    "h-9 rounded-lg text-sm transition-colors " +
                    (isSelected
                      ? "bg-[#0f3d7a] text-white"
                      : isToday
                        ? "border border-blue-300 bg-blue-50 text-slate-900"
                        : isCurrentMonth
                          ? "text-slate-800 hover:bg-slate-100"
                          : "text-slate-300 hover:bg-slate-50")
                  }
                >
                  {cellDate.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const today = toIsoDate(new Date());
                onChange(today);
                setViewDate(new Date(today));
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-[#0f3d7a] hover:bg-blue-50"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}