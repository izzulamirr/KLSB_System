"use client";

import React from "react";

export default function HighlightNumbers({ text, className = "" }) {
  if (text === null || text === undefined) return null;
  const parts = String(text).split(/(\d+)/);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        /^\d+$/.test(p) ? (
          <span key={i} className="text-blue-600 font-semibold">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}
