"use client";
import React, { useRef } from "react";

export default function ManpowerCsvUploader({ onImport }) {
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (onImport) onImport(file);
    e.target.value = "";
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        Import CSV / XLSX
      </button>
    </div>
  );
}
