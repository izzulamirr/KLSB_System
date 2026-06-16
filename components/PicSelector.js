"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PIC_DROPDOWN_OPTIONS, parsePicString } from "../lib/picEmailMap";

export default function PicSelector({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPics, setSelectedPics] = useState(() => parsePicString(value));
  const containerRef = useRef(null);
  const prevValueRef = useRef(value);

  // Parse external value changes
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setSelectedPics(parsePicString(value));
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allPics = [...PIC_DROPDOWN_OPTIONS].sort();
  const [searchTerm, setSearchTerm] = useState("");

  const normalizeText = (input) =>
    String(input || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const searchTokens = searchTerm
    .split(/[,/;\n]+/)
    .map((term) => normalizeText(term))
    .filter(Boolean);

  const filteredPics = allPics.filter((pic) => {
    if (searchTokens.length === 0) return true;
    const normalizedPic = normalizeText(pic);
    return searchTokens.some((term) => normalizedPic.includes(term));
  });

  const handleTogglePic = useCallback((pic) => {
    setSelectedPics((current) => {
      const updated = current.includes(pic) ? current.filter((p) => p !== pic) : [...current, pic];
      return updated;
    });
  }, []);

  // Notify parent when selectedPics changes (deferred, not during render)
  useEffect(() => {
    const newValue = selectedPics.join(", ");
    if (newValue !== prevValueRef.current) {
      prevValueRef.current = newValue;
      onChange(newValue);
    }
  }, [selectedPics, onChange]);

  const displayText = selectedPics.length === 0 ? "Select persons in charge" : selectedPics.join(", ");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 flex items-center justify-between"
      >
        <span className={selectedPics.length === 0 ? "text-slate-400" : ""}>{displayText}</span>
        <svg
          className={`w-4 h-4 text-slate-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-lg">
          <div className="p-2">
            <div className="flex items-center gap-2 px-2 py-1">
              <input
                type="search"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-sm text-slate-500 hover:text-slate-700 px-2"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {filteredPics.length === 0 ? (
                <div className="text-sm text-slate-500 px-3 py-2">No results</div>
              ) : (
                filteredPics.map((pic) => (
                  <label
                    key={pic}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPics.includes(pic)}
                      onChange={() => handleTogglePic(pic)}
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-sm text-slate-900">{pic}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
