"use client";
import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../firebase";
import MondayDateInput from "./MondayDateInput";
import Tesseract from "tesseract.js";

export default function TimesheetClient() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [editableData, setEditableData] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [filterPoSo, setFilterPoSo] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const toNumberOrZero = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const extractDateFromText = (text) => {
    if (!text || typeof text !== "string") return "";

    // Match common formats like 6/02/2026, 06-02-2026, 6.2.2026
    const dateMatch = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
    if (!dateMatch) return "";

    const day = String(parseInt(dateMatch[1], 10)).padStart(2, "0");
    const month = String(parseInt(dateMatch[2], 10)).padStart(2, "0");
    const year = dateMatch[3];

    // Return ISO format for downstream date handling.
    return `${year}-${month}-${day}`;
  };

  const extractAllDatesFromText = (text) => {
    if (!text || typeof text !== "string") return [];

    const matches = [...text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/g)];
    if (matches.length === 0) return [];

    const isoDates = matches.map((m) => {
      const day = String(parseInt(m[1], 10)).padStart(2, "0");
      const month = String(parseInt(m[2], 10)).padStart(2, "0");
      const year = m[3];
      return `${year}-${month}-${day}`;
    });

    // Unique and sorted ascending.
    return Array.from(new Set(isoDates)).sort((a, b) => new Date(a) - new Date(b));
  };

  const extractWeekRangeFromText = (text) => {
    if (!text || typeof text !== "string") return { weekStart: "", weekEnd: "" };

    // Prefer explicit DATE range lines, e.g. "DATE 20/02/2026 02.03.2026"
    const explicitRange = text.match(
      /DATE\s*(?:RANGE)?\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2})\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2})/i
    );

    if (explicitRange) {
      return {
        weekStart: normalizeDateValue(explicitRange[1]) || "",
        weekEnd: normalizeDateValue(explicitRange[2]) || "",
      };
    }

    // Fallback: infer from earliest/latest dates on page.
    const pageDates = extractAllDatesFromText(text);
    return {
      weekStart: pageDates[0] || "",
      weekEnd: pageDates[pageDates.length - 1] || "",
    };
  };

  const extractPrimaryWorkDateFromText = (text) => {
    if (!text || typeof text !== "string") return "";

    // Prefer activity row dates, e.g. "13/02/2026 Billable ..."
    const rowDateMatch = text.match(
      /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2})\b\s+(?:Billable|PH|Public\s+Holiday|Overtime|Normal|NH)\b/i
    );
    if (rowDateMatch) {
      return normalizeDateValue(rowDateMatch[1]) || "";
    }

    // Next, use DATE range start if present.
    const weekRange = extractWeekRangeFromText(text);
    if (weekRange.weekStart) return weekRange.weekStart;

    // Fallback to first detected date.
    const allDates = extractAllDatesFromText(text);
    return allDates[0] || "";
  };

  const normalizeDateValue = (value) => {
    if (!value || typeof value !== "string") return "";

    // Already ISO yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    // dd/mm/yyyy | dd-mm-yyyy | dd.mm.yyyy
    let match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})$/);
    if (match) {
      const day = String(parseInt(match[1], 10)).padStart(2, "0");
      const month = String(parseInt(match[2], 10)).padStart(2, "0");
      const year = match[3];
      return `${year}-${month}-${day}`;
    }

    // Fallback to native Date parsing where possible.
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }

    return "";
  };

  const getWeekRangeFromDate = (dateIso) => {
    const normalized = normalizeDateValue(dateIso);
    if (!normalized) return { weekStart: "", weekEnd: "" };

    const date = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(date.getTime())) return { weekStart: "", weekEnd: "" };

    const day = date.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      weekStart: monday.toISOString().split("T")[0],
      weekEnd: sunday.toISOString().split("T")[0],
    };
  };

  const formatDateDisplay = (dateIso) => {
    const normalized = normalizeDateValue(dateIso);
    if (!normalized) return "N/A";
    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
  };

  const getWeekLabel = (entry) => {
    const weekStart = normalizeDateValue(entry.weekStart);
    const weekEnd = normalizeDateValue(entry.weekEnd);

    if (weekStart && weekEnd) {
      return `${formatDateDisplay(weekStart)} - ${formatDateDisplay(weekEnd)}`;
    }

    const fallbackRange = getWeekRangeFromDate(entry.date);
    if (fallbackRange.weekStart && fallbackRange.weekEnd) {
      return `${formatDateDisplay(fallbackRange.weekStart)} - ${formatDateDisplay(fallbackRange.weekEnd)}`;
    }

    return "Unknown Week";
  };

  const groupEntriesByWeek = (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    const groups = new Map();

    entries.forEach((entry, idx) => {
      const weekStart = normalizeDateValue(entry.weekStart) || getWeekRangeFromDate(entry.date).weekStart;
      const weekEnd = normalizeDateValue(entry.weekEnd) || getWeekRangeFromDate(entry.date).weekEnd;
      const pageNumber = Number(entry.sourcePage || 1);
      const key = `${pageNumber}__${weekStart || "unknown"}__${weekEnd || "unknown"}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          pageNumber,
          weekStart,
          weekEnd,
          label: `Page ${pageNumber} - ${getWeekLabel({ ...entry, weekStart, weekEnd })}`,
          rows: [],
        });
      }

      groups.get(key).rows.push({ index: idx, entry });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return (a.weekStart || "9999-99-99").localeCompare(b.weekStart || "9999-99-99");
    });
  };

  const normalizeMultiPageEntries = (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return [];

    // Preserve page coverage: keep at least one candidate row for every scanned page.
    const rowsByPage = new Map();
    entries.forEach((entry) => {
      const page = Number(entry.sourcePage || 1);
      if (!rowsByPage.has(page)) rowsByPage.set(page, []);
      rowsByPage.get(page).push(entry);
    });

    const source = [];
    rowsByPage.forEach((rows) => {
      const nonEmptyRows = rows.filter((entry) => {
        const total = toNumberOrZero(entry.totalHours);
        const normal = toNumberOrZero(entry.normalHours);
        const ot = toNumberOrZero(entry.otHours);
        const nh = toNumberOrZero(entry.nhHours);
        return total > 0 || normal > 0 || ot > 0 || nh > 0;
      });

      if (nonEmptyRows.length > 0) {
        source.push(...nonEmptyRows);
      } else {
        // Keep one 0h placeholder row so the user can manually adjust this page.
        source.push(rows[0]);
      }
    });

    // Remove likely OCR noise rows (e.g. isolated 8h daily value) only within a page that already has a strong weekly row.
    const noiseFiltered = [];
    const sourceByPage = new Map();
    source.forEach((entry) => {
      const page = Number(entry.sourcePage || 1);
      if (!sourceByPage.has(page)) sourceByPage.set(page, []);
      sourceByPage.get(page).push(entry);
    });

    sourceByPage.forEach((pageRows) => {
      const hasStrongWeekly = pageRows.some((entry) => toNumberOrZero(entry.totalHours) >= 35);
      if (!hasStrongWeekly) {
        noiseFiltered.push(...pageRows);
        return;
      }

      const cleaned = pageRows.filter((entry) => {
        const total = toNumberOrZero(entry.totalHours);
        const normal = toNumberOrZero(entry.normalHours);
        const ot = toNumberOrZero(entry.otHours);
        const nh = toNumberOrZero(entry.nhHours);
        const looksLikeDailyNoise = total > 0 && total <= 12 && ot === 0 && nh === 0 && normal === total;
        return !looksLikeDailyNoise;
      });

      noiseFiltered.push(...(cleaned.length > 0 ? cleaned : pageRows));
    });

    // De-duplicate by date + staff + PO/SO and keep the entry with the highest total.
    const bestByKey = new Map();
    noiseFiltered.forEach((entry) => {
      const page = Number(entry.sourcePage || 1);
      const date = normalizeDateValue(entry.date) || "";
      const weekStart = normalizeDateValue(entry.weekStart) || "";
      const weekEnd = normalizeDateValue(entry.weekEnd) || "";
      const staff = (entry.staffName || "Unknown").toUpperCase();
      const po = (entry.poSoNo || "").toUpperCase();
      const key = `${page}__${weekStart}__${weekEnd}__${date}__${staff}__${po}`;

      const currentTotal =
        toNumberOrZero(entry.totalHours) ||
        toNumberOrZero(entry.normalHours) + toNumberOrZero(entry.otHours) + toNumberOrZero(entry.nhHours);

      if (!bestByKey.has(key)) {
        bestByKey.set(key, { ...entry, totalHours: currentTotal });
        return;
      }

      const prev = bestByKey.get(key);
      const prevTotal =
        toNumberOrZero(prev.totalHours) ||
        toNumberOrZero(prev.normalHours) + toNumberOrZero(prev.otHours) + toNumberOrZero(prev.nhHours);

      if (currentTotal > prevTotal) {
        bestByKey.set(key, { ...entry, totalHours: currentTotal });
      }
    });

    return Array.from(bestByKey.values()).sort((a, b) => {
      const pageA = Number(a.sourcePage || 1);
      const pageB = Number(b.sourcePage || 1);
      if (pageA !== pageB) return pageA - pageB;
      return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
    });
  };

  const createEditableData = (data) => {
    const safeEntries = Array.isArray(data?.entries) && data.entries.length > 0
      ? data.entries
      : [{
          date: new Date().toISOString().split("T")[0],
          staffName: data?.staffName || "Unknown",
          poSoNo: data?.poSoNo || "",
          normalHours: 0,
          otHours: 0,
          nhHours: 0,
          totalHours: 0,
        }];

    return {
      staffName: data?.staffName || "Unknown",
      poSoNo: data?.poSoNo || "",
      rawText: data?.rawText || "",
      needsManualReview: !!data?.needsManualReview,
      entries: safeEntries.map((entry) => {
        const normalHours = toNumberOrZero(entry.normalHours);
        const otHours = toNumberOrZero(entry.otHours);
        const nhHours = toNumberOrZero(entry.nhHours);
        const normalizedDate = normalizeDateValue(entry.date) || new Date().toISOString().split("T")[0];
        const weekRange = getWeekRangeFromDate(normalizedDate);
        return {
          date: normalizedDate,
          weekStart: normalizeDateValue(entry.weekStart) || weekRange.weekStart,
          weekEnd: normalizeDateValue(entry.weekEnd) || weekRange.weekEnd,
          sourcePage: Number(entry.sourcePage || 1),
          staffName: entry.staffName || data?.staffName || "Unknown",
          poSoNo: entry.poSoNo || data?.poSoNo || "",
          normalHours,
          otHours,
          nhHours,
          totalHours: normalHours + otHours + nhHours,
        };
      }).sort((a, b) => {
        if (Number(a.sourcePage || 1) !== Number(b.sourcePage || 1)) {
          return Number(a.sourcePage || 1) - Number(b.sourcePage || 1);
        }
        return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
      }),
    };
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [router]);

  // Fetch timesheets
  const fetchTimesheets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/timesheet");
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data);
      }
    } catch (err) {
      console.error("Failed to fetch timesheets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchTimesheets();
  }, [user, fetchTimesheets]);

  // Extract text from PDF:
  // 1) extract embedded text server-side via /api/extract-pdf
  // 2) if scanned and no text, return a clear actionable error
  const extractPdfText = async (file) => {
    try {
      console.log("Starting PDF extraction...");
      setOcrProgress(20);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || "PDF extraction request failed");
      }

      const data = await res.json();
      const text = (data?.text || "").trim();
      window._pdfPageTexts = Array.isArray(data?.pageTexts) ? data.pageTexts : [];

      setOcrProgress(100);

      if (text.length >= 50) {
        console.log(`Server PDF extraction complete (${text.length} chars, pages=${data?.numPages || 0})`);
        return text;
      }

      throw new Error(
        "This PDF appears to be scanned/image-only. Please upload a clear image (JPG/PNG) of the timesheet page for OCR."
      );
    } catch (error) {
      console.error("PDF extraction failed:", error);
      throw new Error(`PDF OCR failed: ${error?.message || "Unknown error"}`);
    }
  };

  // Use Google Cloud Vision API for better OCR (fallback for complex documents)
  const extractTextWithVision = async (file) => {
    try {
      console.log("Trying Google Cloud Vision API for better OCR...");
      
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;

      // Call our API endpoint
      const response = await fetch("/api/ocr-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        throw new Error("Vision API request failed");
      }

      const data = await response.json();
      console.log(`✅ Google Vision OCR completed - confidence: ${(data.confidence * 100).toFixed(1)}%, detections: ${data.detections}`);
      return data.text || "";
    } catch (error) {
      console.error("❌ Google Vision OCR error:", error);
      return null;
    }
  };

  // Extract TOTAL column region for targeted OCR
  const extractTotalColumn = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          console.log(`📊 Extracting TOTAL column from: ${img.width}x${img.height}`);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // For landscape timesheets, TOTAL column is on the RIGHT side
          const isLandscape = img.width > img.height;
          
          if (isLandscape) {
            // Extract rightmost 12% of image (narrower focus on TOTAL column only)
            const columnWidth = Math.floor(img.width * 0.12);
            const startX = img.width - columnWidth;
            
            console.log(`  Landscape detected - extracting right ${columnWidth}px (${startX} to ${img.width})`);
            
            // Create canvas for just the TOTAL column with 5x scaling (even more aggressive)
            const scale = 5;
            canvas.width = columnWidth * scale;
            canvas.height = img.height * scale;
            
            // Draw ONLY the TOTAL column region, scaled up
            ctx.drawImage(
              img,
              startX, 0, columnWidth, img.height,  // Source: right column
              0, 0, canvas.width, canvas.height     // Dest: full canvas
            );
            
            // Apply preprocessing - same as main image
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            console.log("  Applying aggressive preprocessing to TOTAL column...");
            for (let i = 0; i < data.length; i += 4) {
              let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              gray = ((gray - 128) * 1.5) + 128;
              gray = Math.max(0, Math.min(255, gray));
              const value = gray > 150 ? 255 : 0;
              data[i] = data[i + 1] = data[i + 2] = value;
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            console.log(`  ✅ TOTAL column extracted: ${canvas.width}x${canvas.height}`);
            resolve(canvas.toDataURL());
          } else {
            // Portrait - extract rightmost 10% (similar to landscape)
            console.log("  Portrait orientation - extracting right column...");
            const columnWidth = Math.floor(img.width * 0.10);
            const startX = img.width - columnWidth;
            
            console.log(`  Portrait detected - extracting right ${columnWidth}px (${startX} to ${img.width})`);
            
            // Create canvas for TOTAL column with 5x scaling
            const scale = 5;
            canvas.width = columnWidth * scale;
            canvas.height = img.height * scale;
            
            // Draw ONLY the TOTAL column region, scaled up
            ctx.drawImage(
              img,
              startX, 0, columnWidth, img.height,  // Source: right column
              0, 0, canvas.width, canvas.height     // Dest: full canvas
            );
            
            // Apply preprocessing
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            console.log("  Applying preprocessing to TOTAL column (portrait)...");
            for (let i = 0; i < data.length; i += 4) {
              let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              const value = gray > 140 ? 255 : 0;
              data[i] = data[i + 1] = data[i + 2] = value;
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            console.log(`  ✅ TOTAL column extracted (portrait): ${canvas.width}x${canvas.height}`);
            resolve(canvas.toDataURL());
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Preprocess image to improve OCR accuracy
  const preprocessImageForOCR = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          console.log(`Original image: ${img.width}x${img.height}`);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Detect if landscape (width > height) - typical for Petrofac timesheets
          const isLandscape = img.width > img.height;
          console.log(`Image orientation: ${isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}`);
          
          // For landscape tables, use AGGRESSIVE scaling (4x) for better OCR
          const scale = isLandscape ? 4 : 3;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          // Draw scaled image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // AGGRESSIVE preprocessing for landscape tables
          if (isLandscape) {
            console.log("Applying AGGRESSIVE preprocessing for landscape table...");
            
            // Step 1: Increase contrast
            for (let i = 0; i < data.length; i += 4) {
              let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              
              // Increase contrast - make darks darker, lights lighter
              gray = ((gray - 128) * 1.5) + 128;
              gray = Math.max(0, Math.min(255, gray));
              
              // Apply very aggressive binary threshold
              const threshold = 150; // Higher threshold for cleaner text
              const value = gray > threshold ? 255 : 0;
              
              data[i] = data[i + 1] = data[i + 2] = value;
            }
          } else {
            // Standard processing for portrait
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              const threshold = 140;
              const value = gray > threshold ? 255 : 0;
              data[i] = data[i + 1] = data[i + 2] = value;
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          console.log(`Preprocessed: ${scale}x scale + ${isLandscape ? 'aggressive' : 'standard'} processing`);
          resolve(canvas.toDataURL());
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Extract timesheet data from file using OCR
  const extractTimesheetData = async (file) => {
    console.log("🔥🔥🔥 EXTRACT TIMESHEET DATA CALLED - NEW VERSION WITH REGION OCR 🔥🔥🔥");
    setProcessing(true);
    setOcrProgress(0);
    delete window._pdfPageTexts;
    
    try {
      let text = "";

      // Handle PDF files - extract text server-side
      if (file.type === "application/pdf") {
        setOcrProgress(30);
        text = await extractPdfText(file);
        text = text || ""; // Ensure text is never undefined
        setOcrProgress(100);
        console.log("Extracted PDF text:", text);
      } else {
        // Handle image files - use OCR with simpler, more reliable settings
        setOcrProgress(10);
        
        // Preprocess image for better OCR accuracy
        const preprocessedImage = await preprocessImageForOCR(file);
        
        // ALSO create a TOTAL COLUMN region for targeted extraction
        const totalColumnImage = await extractTotalColumn(file);
        
        let worker = null;
        try {
          // Create a worker with LEGACY OCR engine (sometimes better for poor quality)
          worker = await Tesseract.createWorker('eng', 0, {
            legacyCore: true,
            legacyLang: true,
          });

          setOcrProgress(30);

          // First pass: Full OCR with PSM_AUTO
          console.log("Running OCR Pass 1: Full text extraction with PSM_AUTO...");
          const result = await worker.recognize(preprocessedImage, {
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ()[]/-+:.,',
          });
          
          console.log(`OCR Pass 1 Confidence: ${result.data.confidence}%, Length: ${result.data.text.length} chars`);
          let text1 = result?.data?.text || "";
          
          // Second pass: Try SINGLE_BLOCK for better text extraction
          console.log("Running OCR Pass 2: Text with PSM_SINGLE_BLOCK...");
          setOcrProgress(45);
          
          const result2 = await worker.recognize(preprocessedImage, {
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ()[]/-+:.,',
          });
          
          console.log(`OCR Pass 2 Confidence: ${result2.data.confidence}%, Length: ${result2.data.text.length} chars`);
          const text2 = result2?.data?.text || "";
          
          // Use the LONGER text result (usually more complete)
          text = text1.length > text2.length ? text1 : text2;
          console.log(`✓ Using ${text1.length > text2.length ? 'Pass 1 (AUTO)' : 'Pass 2 (SINGLE_BLOCK)'} text: ${text.length} chars`);
          
          // Third pass: Numbers-only OCR for better number recognition
          console.log("Running OCR Pass 3: Numbers extraction with digit whitelist...");
          setOcrProgress(60);
          
          const numbersResult = await worker.recognize(preprocessedImage, {
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
            tessedit_char_whitelist: '0123456789 \n',
          });
          
          console.log(`OCR Pass 3 Confidence: ${numbersResult.data.confidence}%`);
          const numbersText = numbersResult?.data?.text || "";
          console.log("Numbers extracted (first 200 chars):", numbersText.substring(0, 200));
          
          // Fourth pass: TOTAL COLUMN OCR (landscape only)
          let totalColumnText = "";
          if (totalColumnImage) {
            console.log("🎯 Running OCR Pass 4: TOTAL COLUMN extraction...");
            setOcrProgress(75);
            
            const totalResult = await worker.recognize(totalColumnImage, {
              tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
              tessedit_char_whitelist: '0123456789 \n',
            });
            
            totalColumnText = totalResult?.data?.text || "";
            console.log(`OCR Pass 4 Confidence: ${totalResult.data.confidence}%`);
            console.log("TOTAL column numbers extracted:", totalColumnText);
            
            // Store in window for parseTimesheetText to access
            window._ocrTotalColumn = totalColumnText;
          }
          
          // Store numbers text for Petrofac processing
          window._ocrNumbersText = numbersText;
          
          // Fifth pass: RW/Worley table extraction (if detected)
          const isWorleyRW = text.match(/Review[:\s]/i) && (text.match(/N[ao]rm[ae]l\s+H[rs]s?/i) || text.match(/Overtime\s+H[rs]s?/i));
          if (isWorleyRW) {
            console.log("🎯 Running OCR Pass 5: RW/Worley table extraction with SPARSE_TEXT...");
            setOcrProgress(80);
            
            const rwResult = await worker.recognize(preprocessedImage, {
              tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
              tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ()-/:.,\n',
            });
            
            const rwText = rwResult?.data?.text || "";
            console.log(`OCR Pass 5 Confidence: ${rwResult.data.confidence}%`);
            console.log("RW/Worley table text (first 500 chars):", rwText.substring(0, 500));
            
            // Merge RW text with main text if it has more content
            if (rwText.length > text.length * 0.5) {
              console.log("✅ RW pass extracted substantial text - merging with main text");
              // Combine both texts, RW pass might capture rows missed by other passes
              text = text + "\n" + rwText;
            }
            
            // Store for parseTimesheetText to access
            window._ocrRWTable = rwText;
          }
          
          setOcrProgress(75);
          // Check if we should use Google Vision as fallback
          const isBureauVeritas = text.match(/Bureau\s+Veritas/i) || text.match(/bureauveritas\.com/i);
          const ocrConfidence = result?.data?.confidence || 0;
          const lowConfidence = ocrConfidence < 60;
          const mediumConfidence = ocrConfidence >= 60 && ocrConfidence < 75;
          const shortText = text.trim().length < 100;

          // Garbled detection - lots of dashes/dots or very low alphanumeric density
          const totalChars = Math.max(1, text.length);
          const dashCount = (text.match(/-/g) || []).length;
          const dotCount = (text.match(/\./g) || []).length;
          const alphaNumCount = (text.match(/[A-Za-z0-9]/g) || []).length;
          const dashRatio = dashCount / totalChars;
          const dotRatio = dotCount / totalChars;
          const alphanumericRatio = alphaNumCount / totalChars;
          const garbled = dashRatio > 0.08 || dotRatio > 0.08 || alphanumericRatio < 0.45;

          console.log(`📊 isBureauVeritas: ${!!isBureauVeritas}, ocrConfidence: ${ocrConfidence}%, lowConfidence: ${lowConfidence}, mediumConfidence: ${mediumConfidence}, shortText: ${shortText} (len=${text.trim().length})`);
          console.log(`🔎 Garbled metrics - dashRatio: ${dashRatio.toFixed(3)}, dotRatio: ${dotRatio.toFixed(3)}, alnumRatio: ${alphanumericRatio.toFixed(3)}, garbled: ${garbled}`);

          // If Bureau Veritas format detected OR low confidence OR garbled text, try Google Vision
          if (isBureauVeritas || lowConfidence || shortText || garbled || (mediumConfidence && garbled)) {
            if (isBureauVeritas) {
              console.log("⚠️ Bureau Veritas timesheet detected - switching to Google Cloud Vision for better accuracy");
            } else if (lowConfidence) {
              console.log(`⚠️ Low Tesseract confidence (${ocrConfidence}%) - trying Google Vision`);
            } else {
              console.log("⚠️ Very short text extracted - trying Google Vision");
            }
            
            setOcrProgress(50);
            const visionText = await extractTextWithVision(file);
            
            if (visionText && visionText.length > text.length) {
              console.log("✅ Google Vision extracted more text - using Vision results");
              text = visionText;
            } else if (visionText) {
              console.log("ℹ️ Google Vision ran but Tesseract had more text - using Tesseract");
            }
          }
          
          console.log("=== OCR EXTRACTION COMPLETE ===");
          console.log("OCR Recognition confidence:", result?.data?.confidence);
          console.log("=== FULL EXTRACTED TEXT (START) ===");
          console.log(text);
          console.log("=== FULL EXTRACTED TEXT (END) ===");
          console.log("Text length:", text.length, "characters");
          console.log("Number of lines:", text.split('\n').length);
          
          // Show alert with first 500 chars for quick debugging
          console.warn("FIRST 500 CHARACTERS OF OCR TEXT:");
          console.warn(text.substring(0, 500));
          
          // If text is empty or too short, alert user
          if (!text || text.trim().length < 50) {
            console.warn("⚠️ OCR extracted very little text. The image may be too blurry or low quality.");
            alert("OCR extracted very little text from the image. Please ensure:\n1. Image is clear and high resolution\n2. Text is readable\n3. Image is not too dark or too bright\n\nYou may need to take a better quality photo or scan.");
          }
          
          setOcrProgress(100);
        } catch (ocrError) {
          console.warn("Worker OCR processing error:", ocrError);
          // Try a direct recognize fallback
          try {
            setOcrProgress(40);
            const fallback = await Tesseract.recognize(file, 'eng');
            text = fallback?.data?.text || "";
            console.log("Fallback OCR text:", text);
            setOcrProgress(100);
          } catch (fallbackErr) {
            console.error("Fallback OCR failed:", fallbackErr);
            text = "";
            throw new Error(`OCR failed: ${fallbackErr?.message || String(fallbackErr)}`);
          }
        } finally {
          // Terminate worker to free resources
          if (worker) {
            try {
              await worker.terminate();
            } catch (terminateError) {
              console.warn("Worker termination error:", terminateError);
            }
          }
        }
      }

      // Parse the text to extract timesheet information
      const parsed = parseTimesheetText(text);
      setExtractedData(parsed);
      setEditableData(createEditableData(parsed));
      delete window._pdfPageTexts;
      
      return parsed;
    } catch (err) {
      console.error("Extraction Error:", err);
      alert(`Failed to extract data from file: ${err.message}. Please ensure the image/PDF is clear and readable.`);
      return null;
    } finally {
      setProcessing(false);
      setOcrProgress(0);
    }
  };

  // Parse extracted text to find timesheet data
  const parseTimesheetText = (text, options = {}) => {
    // Validate input text
    if (!text || typeof text !== 'string') {
      console.warn("parseTimesheetText received invalid text:", text);
      return [];
    }

    // For PDF documents, parse each page separately so all pages are keyed in.
    if (!options.skipPageSplit && Array.isArray(window._pdfPageTexts) && window._pdfPageTexts.length > 1) {
      console.log(`Detected multi-page PDF with ${window._pdfPageTexts.length} pages. Parsing page-by-page...`);

      const allEntries = [];
      let bestStaffName = "";
      let bestPoSoNo = "";
      const rawParts = [];

      window._pdfPageTexts.forEach((pageText, pageIndex) => {
        if (!pageText || pageText.trim().length < 10) return;

        const pageParsed = parseTimesheetText(pageText, { skipPageSplit: true, pageIndex: pageIndex + 1 });
        const explicitWeekRange = extractWeekRangeFromText(pageText);
        const pageDates = extractAllDatesFromText(pageText);
        const pageDate = extractPrimaryWorkDateFromText(pageText) || pageDates[0] || extractDateFromText(pageText);
        const pageWeekStart = explicitWeekRange.weekStart || pageDates[0] || getWeekRangeFromDate(pageDate).weekStart;
        const pageWeekEnd = explicitWeekRange.weekEnd || pageDates[pageDates.length - 1] || getWeekRangeFromDate(pageDate).weekEnd;
        rawParts.push(`--- PAGE ${pageIndex + 1} ---\n${pageText}`);

        if (pageParsed?.staffName && pageParsed.staffName !== "Unknown" && !bestStaffName) {
          bestStaffName = pageParsed.staffName;
        }

        if (pageParsed?.poSoNo && !bestPoSoNo) {
          bestPoSoNo = pageParsed.poSoNo;
        }

        if (Array.isArray(pageParsed?.entries)) {
          pageParsed.entries.forEach((entry) => {
            const normalHours = toNumberOrZero(entry.normalHours);
            const otHours = toNumberOrZero(entry.otHours);
            const nhHours = toNumberOrZero(entry.nhHours);
            allEntries.push({
              ...entry,
              date: normalizeDateValue(entry.date) || pageDate || new Date().toISOString().split("T")[0],
              weekStart: normalizeDateValue(entry.weekStart) || pageWeekStart || "",
              weekEnd: normalizeDateValue(entry.weekEnd) || pageWeekEnd || "",
              sourcePage: Number(entry.sourcePage || pageIndex + 1),
              staffName: entry.staffName || pageParsed.staffName || "Unknown",
              poSoNo: entry.poSoNo || pageParsed.poSoNo || "",
              normalHours,
              otHours,
              nhHours,
              totalHours: toNumberOrZero(entry.totalHours) || normalHours + otHours + nhHours,
            });
          });
        }
      });

      if (allEntries.length > 0) {
        const cleanedEntries = normalizeMultiPageEntries(allEntries);
        console.log(`✅ Multi-page parse complete. Total entries created: ${allEntries.length}, cleaned: ${cleanedEntries.length}`);
        return {
          staffName: bestStaffName || "Unknown",
          poSoNo: bestPoSoNo || "",
          entries: cleanedEntries,
          rawText: rawParts.join("\n\n"),
          needsManualReview: cleanedEntries.every((e) => toNumberOrZero(e.totalHours) === 0),
        };
      }
    }
    
    console.log("\n=== PARSING TIMESHEET TEXT ===");
    console.log("Full text length:", text.length, "characters");
    console.log("\n=== ALL LINES (with line numbers) ===");
    const lines = text.split("\n").filter((line) => line.trim());
    lines.forEach((line, index) => {
      console.log(`Line ${index + 1}: "${line}"`);
    });

    // Enhanced patterns to look for - based on actual timesheet format
    const employeePattern = /EMPLOYEE\s+NAME[:\s]*([A-Z\s]+(?:BIN|BINTI)[A-Z\s]+)/i;
    const employeeApostrophePattern = /EMPLOYEE['']?S\s+NAME[:\s]*([A-Z\s]+(?:BIN|BINTI)\s+[A-Z\s]+)/i;
    const primaveraReviewPattern = /Rev[iu]ew[:\s]+([^C\n]+?)(?:,?\s*C?\d{5,}|\n|$)/i; // Flexible: handles "Review" or "Revuew" typo
    
    // NEW: Bureau Veritas format - name right after "EMPLOYEE NAME" field
    const bvEmployeePattern = /EMPLOYEE\s+NAME[:\s]*[;:\-]*\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?=\s*(?:WORK\s+ORDER|POSITION|$))/i;
    
    // BV Fallback: If OCR mangles it, look for comma-separated names (BV often has "LAST, FIRST" format)
    const bvCommaNamePattern = /([A-Z]+),\s*([A-Z]+)/;
    
    const projectPattern = /PROJECT\s+CODE\s*\/\s*NAME[:\s]*([A-Z0-9\s\/\-\.]+?)(?:\n|WEEK|MONTH|LOCATION)/i;
    
    let staffName = "";
    let poSoNumber = "";

    console.log("\n=== SEARCHING FOR EMPLOYEE NAME ===");
    console.log("Searching in text (first 800 chars):");
    console.log(text.substring(0, 800));
    
    // List of words to exclude from names
    const excludedWords = ['approved', 'by', 'signature', 'timesheets', 'for', 'primavera', 'team', 'member', 'copyright', 'oracle', 'petronas', 'position', 'location', 'discipline', 'dept', 'sect', 'project', 'description'];
    
    // Extract employee name - try multiple formats
    const empMatch = text.match(employeePattern);
    const empAposMatch = text.match(employeeApostrophePattern);
    const primaveraMatch = text.match(primaveraReviewPattern);
    const bvMatch = text.match(bvEmployeePattern);
    
    if (bvMatch) {
      // Bureau Veritas format: "EMPLOYEE NAME : Santhosh Kumar Koottamannil"
      staffName = bvMatch[1].trim().replace(/\s+/g, ' ').toUpperCase();
      console.log("✓ Found Bureau Veritas Employee Name:", staffName);
    } else if (primaveraMatch) {
      // Primavera format: "Review: Name, Name, ID"
      const fullText = primaveraMatch[1].trim();
      // Clean up: remove trailing commas, extra spaces, "Mr.", "Ms.", etc
      const cleanName = fullText
        .replace(/,?\s*$/g, '') // Remove trailing comma
        .replace(/\b(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/gi, '') // Remove titles
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      staffName = cleanName.toUpperCase();
      console.log("✓ Found Primavera Review name:", staffName);
    } else if (empMatch) {
      staffName = empMatch[1].trim().replace(/\s+/g, ' ');
      console.log("✓ Found Employee Name:", staffName);
    } else if (empAposMatch) {
      staffName = empAposMatch[1].trim().replace(/\s+/g, ' ');
      console.log("✓ Found Employee's Name:", staffName);
    } else {
      console.log("✗ Employee name pattern not found, trying alternatives...");
      
      // Alternative 1: Look for BIN/BINTI pattern anywhere in first 10 lines (Petrofac/Petronas)
      // This is the MOST reliable pattern for Malaysian names
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        
        // Look for BIN or BINTI pattern with names on both sides
        if (line.match(/\b(BIN|BINTI|bin|binti|am)\b/i) && line.length > 10) {
          // Skip header lines
          if (line.toLowerCase().includes('position') || 
              line.toLowerCase().includes('location') ||
              line.toLowerCase().includes('staff no')) {
            continue;
          }
          
          // Extract the full name - look for pattern: FIRSTNAME BIN/BINTI/AM LASTNAME  
          // Limit to max 2 words per part to avoid capturing job titles
          // Match pattern: WORD(S) + BIN/BINTI/AM + WORD(S)
          // Stop at "eso" or common job titles
          const nameMatch = line.match(/([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+(bin|binti|am)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/i);
          if (nameMatch) {
            let firstName = nameMatch[1].trim();
            let connector = nameMatch[2].trim();
            let lastName = nameMatch[3].trim();
            
            console.log(`  DEBUG: Regex captured - First:"${firstName}", Connector:"${connector}", Last:"${lastName}"`);
            
            // Clean lastName: stop at common job title keywords (case insensitive)
            // Remove everything from "eso" onwards
            lastName = lastName.replace(/\s+(eso|e\.?s\.?o\.?|administrator|engineer|manager|supervisor|technician|coordinator|assistant|director|officer|specialist|position|dept|section).*$/i, '');
            
            console.log(`  DEBUG: After cleanup - Last:"${lastName}"`);
            
            let fullName = `${firstName} ${connector} ${lastName}`.trim().replace(/\s+/g, ' ').toUpperCase();
            
            staffName = fullName;
            console.log(`✓ Found name with BIN/BINTI pattern at line ${i + 1}: ${staffName}`);
            break;
          }
        }
      }
      
      // Alternative 2: Look for STAFF NO followed by actual employee data
      if (!staffName) {
        const staffNoMatch = text.match(/STAFF\s*NO[.:\s]*(\d+)/i);
        if (staffNoMatch) {
          const staffNo = staffNoMatch[1];
          console.log(`Found STAFF NO: ${staffNo}`);
          
          // Find the line with STAFF NO and look for the name in the same row
          const staffNoLineIndex = lines.findIndex(l => l.match(/STAFF\s*NO/i));
          if (staffNoLineIndex >= 0) {
            // Check next few lines for name with BIN/BINTI
            for (let j = staffNoLineIndex + 1; j < Math.min(staffNoLineIndex + 5, lines.length); j++) {
              const line = lines[j].trim();
              
              // Look specifically for BIN or BINTI pattern
              if (line.match(/\b(BIN|BINTI)\b/i) && line.length > 10) {
                // Extract the full name
                const nameMatch = line.match(/([A-Z][A-Z\s]+(?:BIN|BINTI)\s+[A-Z][A-Z\s]+)/i);
                if (nameMatch) {
                  staffName = nameMatch[1].trim().replace(/\s+/g, ' ').toUpperCase();
                  console.log(`✓ Found name near STAFF NO with BIN/BINTI: ${staffName}`);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Alternative 2: Look for "STAFF NO" or "STAFF NAME" followed by actual name (Petronas format)
      if (!staffName) {
        const staffNameMatch = text.match(/(?:STAFF\s+NAME|EMPLOYEE\s+NAME|NAME)[:\s]*([A-Z][A-Za-z\s]+)/i);
        if (staffNameMatch) {
          const fullName = staffNameMatch[1].trim();
          const nameLower = fullName.toLowerCase();
          const isExcluded = excludedWords.some(word => nameLower.includes(word));
          
          if (!isExcluded && fullName.split(/\s+/).length >= 2) {
            staffName = fullName.toUpperCase();
            console.log("✓ Found name from STAFF NAME field:", staffName);
          }
        }
      }
      
      // Alternative 3: Search line by line for STAFF NAME or EMPLOYEE NAME
      if (!staffName) {
        console.log("Searching line by line for STAFF/EMPLOYEE NAME...");
        for (let i = 0; i < Math.min(40, lines.length); i++) {
          const line = lines[i].trim();
          const lineLower = line.toLowerCase();
          
          if (lineLower.includes('staff') && lineLower.includes('name')) {
            console.log(`  Line ${i + 1} contains 'staff name': "${line}"`);
            // Check next 3 lines for the actual name
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
              const nextLine = lines[j].trim();
              console.log(`  Checking line ${j + 1}: "${nextLine}"`);
              
              // Skip if contains excluded words
              if (excludedWords.some(word => nextLine.toLowerCase().includes(word))) {
                console.log(`    Skipped - contains excluded word`);
                continue;
              }
              
              // Skip if too short
              if (nextLine.length < 5) {
                console.log(`    Skipped - too short`);
                continue;
              }
              
              // PRIORITY: Look for BIN/BINTI pattern (Malaysian names)
              if (nextLine.match(/\b(BIN|BINTI)\b/i)) {
                staffName = nextLine.toUpperCase();
                console.log(`✓ Found name with BIN/BINTI pattern: ${staffName}`);
                break;
              }
              
              // If no BIN/BINTI, check if line has 2+ capital words and doesn't start with number
              if (!nextLine.match(/^\d/) && nextLine.split(/\s+/).filter(w => w.length > 2).length >= 2) {
                staffName = nextLine.toUpperCase();
                console.log(`✓ Found name from line after STAFF NAME: ${staffName}`);
                break;
              }
            }
            if (staffName) break;
          }
          
          if (lineLower.includes('employee') && (lineLower.includes('name') || lineLower.includes('staff'))) {
            console.log(`  Line ${i + 1} contains 'employee name': "${line}"`);
            
            // Check next 3 lines
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
              const nextLine = lines[j].trim();
              console.log(`  Checking line ${j + 1}: "${nextLine}"`);
              
              // Skip if contains excluded words
              if (excludedWords.some(word => nextLine.toLowerCase().includes(word))) {
                console.log(`    Skipped - contains excluded word`);
                continue;
              }
              
              // Skip if too short
              if (nextLine.length < 5) {
                console.log(`    Skipped - too short`);
                continue;
              }
              
              // PRIORITY: Look for BIN/BINTI pattern (Malaysian names)
              if (nextLine.match(/\b(BIN|BINTI)\b/i)) {
                staffName = nextLine.toUpperCase();
                console.log(`✓ Found name with BIN/BINTI pattern: ${staffName}`);
                break;
              }
              
              // If no BIN/BINTI, check if line has 2+ capital words and doesn't start with number
              if (!nextLine.match(/^\d/) && nextLine.split(/\s+/).filter(w => w.length > 2).length >= 2) {
                staffName = nextLine.toUpperCase();
                console.log(`✓ Found name from line after EMPLOYEE NAME: ${staffName}`);
                break;
              }
            }
            if (staffName) break;
          }
        }
      }
      
      // Alternative 2: Look for "Timesheets for Name" pattern (Primavera format)
      if (!staffName) {
        const timesheetsForMatch = text.match(/Timesheets?\s+for\s*[:\s]*([A-Za-z]+[\s,]+[A-Za-z]+)/i);
        console.log("Trying 'Timesheets for' pattern:", timesheetsForMatch);
        if (timesheetsForMatch) {
          const fullName = timesheetsForMatch[1].trim();
          console.log("  Raw name found:", fullName);
          
          // Validate it's not an excluded word
          const nameLower = fullName.toLowerCase();
          const isExcluded = excludedWords.some(word => nameLower.includes(word));
          
          if (!isExcluded) {
            // Check if comma-separated
            if (fullName.includes(',')) {
              const nameParts = fullName.split(/\s*,\s*/);
              staffName = `${nameParts[1].trim()} ${nameParts[0].trim()}`.toUpperCase(); // "Last, First" -> "FIRST LAST"
            } else {
              staffName = fullName.toUpperCase();
            }
            console.log("✓ Found name from 'Timesheets for':", staffName);
          } else {
            console.log("✗ Name excluded (contains invalid words):", fullName);
          }
        }
      }
      
      // Alternative 2: Look for "Signature:" followed by name on SAME or NEXT line
      if (!staffName) {
        console.log("Trying 'Signature' pattern...");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.toLowerCase().includes('signature')) {
            console.log(`  Found 'Signature' at line ${i + 1}: "${line}"`);
            
            // Try to get name from same line
            const afterSig = line.substring(line.toLowerCase().indexOf('signature') + 9).trim();
            let nameMatch = afterSig.match(/^[:\s]*([A-Za-z]+[\s,]+[A-Za-z]+)/);
            
            // If not on same line, check next line
            if (!nameMatch && i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              console.log(`  Checking next line ${i + 2}: "${nextLine}"`);
              nameMatch = nextLine.match(/^([A-Za-z]+[\s,]+[A-Za-z]+)/);
              if (nameMatch) console.log(`  Found name on next line:`, nameMatch[1]);
            }
            
            if (nameMatch) {
              const fullName = nameMatch[1].trim();
              const nameLower = fullName.toLowerCase();
              const isExcluded = excludedWords.some(word => nameLower.includes(word));
              
              if (!isExcluded) {
                if (fullName.includes(',')) {
                  const nameParts = fullName.split(/\s*,\s*/);
                  staffName = `${nameParts[1].trim()} ${nameParts[0].trim()}`.toUpperCase();
                } else {
                  staffName = fullName.toUpperCase();
                }
                console.log(`✓ Found name from signature:`, staffName);
                break;
              } else {
                console.log(`✗ Signature name excluded:`, fullName);
              }
            }
          }
        }
      }
      
      // Alternative 3: Look for comma-separated name pattern anywhere, but filter out excluded words
      if (!staffName) {
        const allCommaMatches = [...text.matchAll(/\b([A-Za-z]{3,})\s*,\s*([A-Za-z]{3,})\b/g)];
        console.log(`Found ${allCommaMatches.length} comma-separated patterns`);
        
        for (const match of allCommaMatches) {
          const fullName = `${match[1]}, ${match[2]}`;
          const nameLower = fullName.toLowerCase();
          const isExcluded = excludedWords.some(word => nameLower.includes(word));
          
          console.log(`  Checking: "${fullName}" - Excluded: ${isExcluded}`);
          
          if (!isExcluded) {
            staffName = `${match[2]} ${match[1]}`.toUpperCase();
            console.log("✓ Found valid comma-separated name:", staffName);
            break;
          }
        }
      }
      
      // Alternative 4: Look for lines with BIN/BINTI anywhere in the text (AGGRESSIVE SEARCH)
      if (!staffName) {
        console.log("Last resort: Searching ALL lines for BIN/BINTI pattern...");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Must contain BIN or BINTI
          if (!line.match(/\b(BIN|BINTI)\b/i)) continue;
          
          // Must be reasonable length
          if (line.length < 10 || line.length > 100) continue;
          
          // Must have at least 3 words
          if (line.split(/\s+/).length < 3) continue;
          
          // Must NOT contain excluded words
          if (excludedWords.some(word => line.toLowerCase().includes(word))) {
            console.log(`  Line ${i + 1} has BIN/BINTI but contains excluded word: "${line}"`);
            continue;
          }
          
          // Extract just the name part (before and after BIN/BINTI)
          const nameMatch = line.match(/([A-Z][A-Z\s]+)\s+(BIN|BINTI)\s+([A-Z][A-Z\s]+)/i);
          if (nameMatch) {
            staffName = `${nameMatch[1].trim()} ${nameMatch[2].trim()} ${nameMatch[3].trim()}`.replace(/\s+/g, ' ').toUpperCase();
            console.log(`✓ Found staff name with BIN/BINTI at line ${i + 1}: ${staffName}`);
            break;
          } else {
            // If pattern doesn't match perfectly, take whole line
            staffName = line.toUpperCase();
            console.log(`✓ Found staff name (BIN/BINTI line) at line ${i + 1}: ${staffName}`);
            break;
          }
        }
      }
    }
    
    console.log("Final staff name:", staffName || "Not found");

    console.log("\n=== SEARCHING FOR PROJECT CODE ===");
    // Extract Project Code - try multiple formats
    const projMatch = text.match(projectPattern);
    if (projMatch) {
      poSoNumber = projMatch[1].trim().replace(/\s+/g, ' ');
      console.log("✓ Found Project Code:", poSoNumber);
    } else {
      console.log("✗ Project code pattern not found, trying alternatives...");
      
      // Alternative 1: Look for "NO" followed by 6-digit number (Petrofac project number)
      const petrofacNoMatch = text.match(/\bNO\s+([0-9]{6})\b/i);
      if (petrofacNoMatch) {
        poSoNumber = petrofacNoMatch[1].trim();
        console.log("✓ Found Petrofac NO (project number):", poSoNumber);
      } else if (text.match(/PROJECT.*NO/i)) {
        // Look for PROJECT...NO section and extract number
        const projNoMatch = text.match(/PROJECT.*?NO\D*(\d{5,7})/i);
        if (projNoMatch) {
          poSoNumber = projNoMatch[1].trim();
          console.log("✓ Found PROJECT NO:", poSoNumber);
        }
      }
      
      // Alternative 2: Look for "PROJECT" field (Petronas format)
      if (!poSoNumber) {
        const projectFieldMatch = text.match(/PROJECT[:\s]*([A-Z0-9][A-Za-z0-9\s\-\/]+?)(?:\n|WEEK|MONTH|LOCATION|STAFF|EMPLOYEE)/i);
        if (projectFieldMatch) {
          poSoNumber = projectFieldMatch[1].trim();
          console.log("✓ Found PROJECT field:", poSoNumber);
        }
      }
      
      if (!poSoNumber) {
        // Alternative 2: Look for "LOCATION" field (some formats use location as identifier)
        const locationMatch = text.match(/LOCATION[:\s]*([A-Z0-9][A-Za-z0-9\s\-\/]+?)(?:\n|WEEK|MONTH|STAFF|EMPLOYEE)/i);
        if (locationMatch) {
          poSoNumber = locationMatch[1].trim();
          console.log("✓ Found LOCATION as project code:", poSoNumber);
        } else {
          // Alternative 3: Look for "Activity ID" pattern (Primavera format)
          const activityIdMatch = text.match(/Activity\s+ID[:\s]*([A-Z0-9\-]+)/i);
          if (activityIdMatch) {
            poSoNumber = activityIdMatch[1].trim();
            console.log("✓ Found Activity ID as project code:", poSoNumber);
          } else {
            // Alternative 4: Look for Primavera project number format (e.g., 70032-86500)
            const primaveraProjectMatch = text.match(/\b(\d{5}-\d{5})\b/);
            if (primaveraProjectMatch) {
              poSoNumber = primaveraProjectMatch[1];
              console.log("✓ Found Primavera project number:", poSoNumber);
            } else {
              // Alternative 5: Look for "R####" pattern or any alphanumeric code after PROJECT
              const altProjMatch = text.match(/\b(R\d{4}[A-Z0-9\s\/\-\.]*)/i);
              if (altProjMatch) {
                poSoNumber = altProjMatch[1].trim();
                console.log("✓ Found Project Code (R#### pattern):", poSoNumber);
              } else {
                // Alternative 6: Try to find any project-like code
                const lines2 = text.split('\n');
                for (let line of lines2) {
                  if (line.toUpperCase().includes('PROJECT') || line.toUpperCase().includes('CODE')) {
                    const codeMatch = line.match(/([A-Z]\d{4}.*)/i);
                    if (codeMatch) {
                      poSoNumber = codeMatch[1].trim();
                      console.log("✓ Found Project Code (line scan):", poSoNumber);
                      break;
                    }
                  }
                }
                
                // Alternative 7: Look for Activity Name
                if (!poSoNumber) {
                  const activityNameMatch = text.match(/Activity\s+Name[:\s]*([A-Za-z0-9\s\-]+?)(?:\n|Activity)/i);
                  if (activityNameMatch) {
                    poSoNumber = activityNameMatch[1].trim();
                    console.log("✓ Found Activity Name as project code:", poSoNumber);
                  }
                }
                
                // Alternative 8: Bureau Veritas Contract number (8 digits)
                if (!poSoNumber) {
                  // First try to find explicit contract field
                  const bvContractMatch = text.match(/Contract[:\s]+[A-Za-z\s]*?(\d{8})/i);
                  if (bvContractMatch) {
                    poSoNumber = bvContractMatch[1];
                    console.log("✓ Found BV Contract number:", poSoNumber);
                  } else {
                    // Try to find ANY 8-digit number (likely a contract)
                    // BV contracts are 8 digits like 03873016, 22391881
                    const allEightDigits = [...text.matchAll(/\b(\d{8})\b/g)].map(m => m[1]);
                    if (allEightDigits.length > 0) {
                      // If multiple 8-digit numbers, take the first one
                      poSoNumber = allEightDigits[0];
                      console.log(`✓ Found 8-digit contract number: ${poSoNumber} (${allEightDigits.length} total found)`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    console.log("\n" + "🔥".repeat(40));
    console.log("🔥 START PARSING TIMESHEET TEXT");
    console.log("🔥".repeat(40));
    console.log("\n=== SEARCHING FOR TOTAL HOURS ===");
    console.log("Full text to search:");
    console.log(text.substring(0, 1000)); // Show first 1000 chars
    

  // Keep chargeable/non-chargeable at function scope so we can populate nhHours later
  let chargeableHours = 0;
  let nonChargeableHours = 0;
    // DETECT FORMAT FIRST - This is critical for proper parsing
    const isPrimavera = text.match(/Review[:\s]/i) || text.match(/Primavera/i);
    const isBureauVeritas = text.match(/Bureau\s+Veritas/i) || text.match(/bureauveritas\.com/i);
    const isPetrofac = text.match(/Petrofac/i) || text.match(/RNZ/i);
    const isPetronas = text.match(/Petronas/i);
    
    // Detect Worley/RW format - ONLY if we see activity rows with Normal/Overtime Hrs
    // AND we DON'T see "Total Regular" or "Total Overtime" (which indicates standard Primavera)
    const hasNormalHrsPattern = text.match(/\d+\s*N[ao]rm[ae]l[\s\-_]*H[rse]+s?/i);
    const hasOvertimeHrsPattern = text.match(/\d+\s*Overtime[\s\-_]*H[rse]+s?/i);
    const hasTotalRegularOrOT = text.match(/Total\s+(Regular|Overtime)/i);
    const hasReview = text.match(/Review[:\s]/i);
    
    // CRITICAL FIX: Only treat as Worley/RW if:
    // 1. Has activity code + Normal/Overtime Hrs pattern
    // 2. AND does NOT have "Total Regular" or "Total Overtime" (standard Primavera)
    const isWorleyRW = (hasNormalHrsPattern || hasOvertimeHrsPattern) && !hasTotalRegularOrOT;
    
    console.log(`\n=== FORMAT DETECTION ===`);
    console.log(`Petrofac: ${!!isPetrofac}`);
    console.log(`Petronas: ${!!isPetronas}`);
    console.log(`Primavera: ${!!isPrimavera}`);
    console.log(`Bureau Veritas: ${!!isBureauVeritas}`);
    console.log(`Worley/RW (Primavera with Normal/OT Hrs rows): ${!!isWorleyRW}`);
    console.log(`  - hasNormalHrsPattern: ${!!hasNormalHrsPattern}`);
    console.log(`  - hasOvertimeHrsPattern: ${!!hasOvertimeHrsPattern}`);
    console.log(`  - hasTotalRegularOrOT: ${!!hasTotalRegularOrOT} (if TRUE, use standard Primavera)`);
    console.log(`  - hasReview: ${!!hasReview}`);
    console.log(`========================\n`);
    
    // Look for TOTAL line which has Normal Hours and OT Hours totals
    let totalNormalHours = 0;
    let totalOTHours = 0;
    
    // ==========================================
    // WORLEY/RW FORMAT HANDLER (Primavera variant with activity rows)
    // ==========================================
    // RW timesheets have multiple rows like:
    // "10 Normal Hrs" with daily breakdowns (4 4 4 4 4 = 20)
    // "20 Overtime Hrs 1/2" with daily breakdowns (0 0 4 4 4 4 4 = 20)
    if (isWorleyRW && !isPetrofac && !isBureauVeritas) {
      console.log("✅ WORLEY/RW FORMAT DETECTED v2.0 - Extracting ALL Normal Hrs and Overtime Hrs rows...");
      
      // DUMP ENTIRE OCR TEXT FOR DEBUGGING
      console.log("\n📄 FULL OCR TEXT DUMP (first 2000 chars):");
      console.log("═".repeat(80));
      console.log(text.substring(0, 2000));
      console.log("═".repeat(80));
      console.log(`Total OCR text length: ${text.length} characters\n`);
      
      // Combine all available OCR text sources for maximum coverage
      let combinedText = text;
      if (window._ocrRWTable) {
        combinedText += "\n" + window._ocrRWTable;
        console.log("  → Added dedicated RW table OCR data");
        console.log("  → RW Table OCR (first 500 chars):", window._ocrRWTable.substring(0, 500));
      }
      
      const combinedLines = combinedText.split('\n');
      console.log(`  → Total lines to scan: ${combinedLines.length}`);
      
      // Log all lines containing "Normal Hrs" or "Overtime Hrs" for debugging
      console.log("\n🔍 DEBUG: Lines containing Normal/OT Hrs:");
      combinedLines.forEach((line, idx) => {
        if (line.match(/n[ao]rm[ae]l[\s\-_]*h[rse]+s?|overtime[\s\-_]*h[rse]+s?/i)) {
          console.log(`  Line ${idx + 1}: "${line}"`);
        }
      });
      
      let normalHrsRows = [];
      let overtimeHrsRows = [];
      
      for (let i = 0; i < combinedLines.length; i++) {
        const line = combinedLines[i].trim();
        if (!line || line.length < 5) continue;
        
        // Look for "10 Normal Hrs" or "Normal Hrs" pattern (with OCR variations like "Narmal", "HS", "Hre", "Hr")
        // Also match variations like "Normal-Hrs", "Normal_Hrs", "NormalHrs"
        // Pattern 1: Look for leading number + "Normal Hrs" (e.g., "10 Normal Hrs")
        let normalHrsMatch = line.match(/(\d+)\s*n[ao]rm[ae]l[\s\-_]*h[rse]+s?/i);
        
        // Pattern 2: If no leading number, look for "Normal Hrs" anywhere in the line
        // This catches lines like "MY-14    10 Normal Hrs    4 4 4 4 4    20"
        if (!normalHrsMatch) {
          normalHrsMatch = line.match(/n[ao]rm[ae]l[\s\-_]*h[rse]+s?/i);
          if (normalHrsMatch) {
            // Try to find a number BEFORE "Normal Hrs" on the same line (the activity code)
            const beforePattern = line.substring(0, normalHrsMatch.index);
            const leadingNumMatch = beforePattern.match(/(\d+)\s*$/);
            if (leadingNumMatch) {
              // Found it, create a match object similar to Pattern 1
              normalHrsMatch = {
                0: leadingNumMatch[1] + ' ' + normalHrsMatch[0],
                1: leadingNumMatch[1],
                index: leadingNumMatch.index
              };
            }
          }
        }
        
        if (normalHrsMatch) {
          const leadingNum = parseInt(normalHrsMatch[1]);
          
          // Extract the Total value - multiple strategies
          let total = 0;
          const afterPattern = line.substring(normalHrsMatch.index + normalHrsMatch[0].length);
          
          // Strategy 1: Find the LAST standalone number on the line (the Total column)
          // This handles format: "10 Normal Hrs 4 4 4 4 4 20" or "MY-14 10 Normal Hrs 4 4 4 4 4 20"
          const allNumbers = [...afterPattern.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
          
          console.log(`    🔍 Row ${i + 1} afterPattern: "${afterPattern}"`);
          console.log(`    🔍 Numbers found: [${allNumbers.join(', ')}]`);
          
          if (allNumbers.length > 0) {
            // Check if we have daily numbers (0-16 range) followed by a total
            const dailyNumbers = allNumbers.filter(n => n >= 0 && n <= 16);
            const lastNum = allNumbers[allNumbers.length - 1];
            
            // Strategy 1a: If last number is 15-80 and we have 3+ smaller numbers before it, it's likely the total
            if (lastNum >= 15 && lastNum <= 80 && dailyNumbers.length >= 3) {
              // Check if last number equals sum of daily numbers (excluding itself)
              const dailySum = dailyNumbers.slice(0, -1).reduce((a, b) => a + b, 0);
              if (Math.abs(dailySum - lastNum) <= 2) { // Allow small OCR error
                total = lastNum;
                console.log(`    ✅ Last number matches sum of daily numbers: ${lastNum}`);
              } else {
                total = lastNum;
                console.log(`    ✅ Using last number as Total: ${total}`);
              }
            }
            // Strategy 1b: If we only have daily numbers (all 0-16), sum them
            else if (dailyNumbers.length >= 5 && dailyNumbers.length === allNumbers.length) {
              total = dailyNumbers.reduce((a, b) => a + b, 0);
              console.log(`    ✅ Summing all daily numbers: ${dailyNumbers.join('+')} = ${total}`);
            }
            // Strategy 1c: Last number is in valid range, use it
            else if (lastNum >= 15 && lastNum <= 80) {
              total = lastNum;
              console.log(`    ✅ Using last number as Total: ${total}`);
            }
          }
          
          // Strategy 2: Check next 10 lines (increased from 3) for numbers that could be the Total
          // OCR often splits table rows across multiple text lines
          if (total === 0) {
            console.log(`    🔍 Total not found on same line, searching next 10 lines...`);
            let collectedDailyNumbers = [...allNumbers.filter(n => n >= 0 && n <= 16)];
            
            for (let j = 1; j <= 10 && i + j < combinedLines.length; j++) {
              const nextLine = combinedLines[i + j].trim();
              console.log(`    🔍 Checking next line +${j}: "${nextLine}"`);
              
              // Stop if we hit another activity row
              if (nextLine.match(/\d+\s*(normal|overtime|public\s+holiday)/i)) {
                console.log(`    ⛔ Hit another activity row, stopping search`);
                break;
              }
              
              // Collect all numbers from this line
              const lineNumbers = [...nextLine.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
              if (lineNumbers.length > 0) {
                console.log(`    🔢 Line has numbers: [${lineNumbers.join(', ')}]`);
                
                // ⚠️ CRITICAL: Filter out invalid numbers:
                // - Account numbers (5+ digits like "412029")
                // - Year numbers (1900-2099 like "2022")  
                // - Numbers surrounded by large account numbers (like "30" from "412029-00030-2022")
                const validNumbers = lineNumbers.filter((n, idx) => {
                  // Filter 1: Exclude 5+ digit numbers (account numbers)
                  if (n.toString().length >= 5) return false;
                  
                  // Filter 2: Exclude year numbers
                  if (n >= 1900 && n <= 2099) return false;
                  
                  // Filter 3: If surrounded by large numbers (5+ digits), likely part of account pattern
                  const prevNum = idx > 0 ? lineNumbers[idx - 1] : null;
                  const nextNum = idx < lineNumbers.length - 1 ? lineNumbers[idx + 1] : null;
                  if ((prevNum && prevNum.toString().length >= 5) || (nextNum && nextNum.toString().length >= 5)) {
                    console.log(`    🚫 Rejecting ${n} (surrounded by account number)`);
                    return false;
                  }
                  
                  return true;
                });
                console.log(`    🔧 After filtering account/year numbers: [${validNumbers.join(', ')}]`);
                
                // Check if this line has a total (15-80 range)
                const largeNumbers = validNumbers.filter(n => n >= 15 && n <= 80);
                const dailyLineNumbers = validNumbers.filter(n => n >= 0 && n <= 16);
                
                // If we find a large number (and it's NOT an account number), it's likely the total
                if (largeNumbers.length > 0) {
                  total = largeNumbers[largeNumbers.length - 1]; // Use last one
                  console.log(`    ✅ Found Total in next line: ${total}`);
                  break;
                }
                
                // Collect daily numbers to sum later
                if (dailyLineNumbers.length > 0) {
                  collectedDailyNumbers.push(...dailyLineNumbers);
                  console.log(`    📥 Collected daily numbers: [${dailyLineNumbers.join(', ')}], total so far: [${collectedDailyNumbers.join(', ')}]`);
                }
              }
            }
            
            // If we collected enough daily numbers but no total, sum them
            if (total === 0 && collectedDailyNumbers.length >= 5) {
              total = collectedDailyNumbers.reduce((a, b) => a + b, 0);
              console.log(`    ✅ Summing all collected daily numbers: ${collectedDailyNumbers.join('+')} = ${total}`);
            }
            
            // 🔧 RESCUE 1: If we have 3-4 identical daily numbers (e.g., [4,4,4]), estimate 5-day week
            if (total === 0 && collectedDailyNumbers.length >= 3 && collectedDailyNumbers.length <= 4) {
              const uniqueNumbers = [...new Set(collectedDailyNumbers)];
              if (uniqueNumbers.length === 1) {
                const dailyHours = uniqueNumbers[0];
                if (dailyHours >= 4 && dailyHours <= 8) {
                  total = dailyHours * 5; // Estimate 5-day week
                  console.log(`    🔧 RESCUE 1: Found ${collectedDailyNumbers.length} identical daily hours (${dailyHours}h each), estimating 5-day week: ${dailyHours} × 5 = ${total}h`);
                }
              }
            }
            
            // 🔧 RESCUE 2: If we have only 1-2 identical daily numbers (e.g., [4] or [4,4]), also estimate 5-day week
            if (total === 0 && collectedDailyNumbers.length >= 1 && collectedDailyNumbers.length < 3) {
              const uniqueNumbers = [...new Set(collectedDailyNumbers)];
              if (uniqueNumbers.length === 1) {
                const dailyHours = uniqueNumbers[0];
                if (dailyHours >= 4 && dailyHours <= 8) {
                  total = dailyHours * 5; // Estimate 5-day week
                  console.log(`    🔧 RESCUE 2: Found only ${collectedDailyNumbers.length} daily hours (${dailyHours}h each), estimating 5-day week: ${dailyHours} × 5 = ${total}h`);
                }
              }
            }
          }

          // OCR corrections for typical totals
          if (total > 0) {
            const originalTotal = total;
            // Snap to common weekly totals
            if (total >= 18 && total <= 22) total = 20;
            else if (total >= 28 && total <= 32) total = 30;
            else if (total >= 38 && total <= 42) total = 40;
            else if (total >= 58 && total <= 62) total = 60;
            
            if (total !== originalTotal) {
              console.log(`    🔧 OCR correction: ${originalTotal} → ${total}`);
            }
          }
          
          // Accept this row if we have a valid total (allow multiple Normal rows)
          if (total > 0) {
            normalHrsRows.push({
              lineNum: i + 1,
              leadingNum,
              total,
              line
            });
            console.log(`  ✓ Row ${i + 1}: Found "${normalHrsMatch[0]}" | TOTAL: ${total}h | Line: "${line.substring(0, 80)}..."`);
          } else {
            console.log(`    ⚠️ Row ${i + 1}: Found "${normalHrsMatch[0]}" but no valid Total found`);
          }
        }
        
        // Look for "20 Overtime Hrs" or "Overtime Hrs 1/2" or "Overtime Hrs 1/0" pattern (with OCR variations)
        // Pattern now captures optional rate suffixes like "1/2", "1/0", "1.5", "2", etc.
        // Also match variations like "Overtime-Hrs", "Overtime_Hrs", "OvertimeHrs"
        // Pattern 1: Look for leading number + "Overtime Hrs" (e.g., "20 Overtime Hrs 1/0")
        let overtimeHrsMatch = line.match(/(\d+)\s*overtime[\s\-_]*h[rse]+s?(?:\s+[\d\/\.]+)?/i);
        
        // Pattern 2: If no leading number, look for "Overtime Hrs" anywhere in the line
        // This catches lines like "MY-12    20 Overtime Hrs 1/0    0 0 4 4 4 4 4    20"
        if (!overtimeHrsMatch) {
          overtimeHrsMatch = line.match(/overtime[\s\-_]*h[rse]+s?(?:\s+[\d\/\.]+)?/i);
          if (overtimeHrsMatch) {
            // Try to find a number BEFORE "Overtime Hrs" on the same line (the activity code)
            const beforePattern = line.substring(0, overtimeHrsMatch.index);
            const leadingNumMatch = beforePattern.match(/(\d+)\s*$/);
            if (leadingNumMatch) {
              // Found it, create a match object similar to Pattern 1
              overtimeHrsMatch = {
                0: leadingNumMatch[1] + ' ' + overtimeHrsMatch[0],
                1: leadingNumMatch[1],
                index: leadingNumMatch.index
              };
            }
          }
        }
        
        if (overtimeHrsMatch) {
          const leadingNum = parseInt(overtimeHrsMatch[1]);
          
          // Extract the Total value - multiple strategies
          let total = 0;
          const afterPattern = line.substring(overtimeHrsMatch.index + overtimeHrsMatch[0].length);
          
          // Strategy 1: Find the LAST standalone number on the line (the Total column)
          // This handles format: "20 Overtime Hrs 1/0 0 0 4 4 4 4 4 20"
          const allNumbers = [...afterPattern.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
          
          console.log(`    🔍 OT Row ${i + 1} afterPattern: "${afterPattern}"`);
          console.log(`    🔍 OT Numbers found: [${allNumbers.join(', ')}]`);
          
          if (allNumbers.length > 0) {
            // Check if we have daily numbers (0-16 range) followed by a total
            const dailyNumbers = allNumbers.filter(n => n >= 0 && n <= 16);
            const lastNum = allNumbers[allNumbers.length - 1];
            
            console.log(`    🔍 OT dailyNumbers: [${dailyNumbers.join(', ')}], lastNum: ${lastNum}`);
            
            // Strategy 1a: If last number is 15-80 and we have 3+ smaller numbers before it, it's likely the total
            if (lastNum >= 15 && lastNum <= 80 && dailyNumbers.length >= 3) {
              // Check if last number equals sum of daily numbers (excluding itself)
              const dailySum = dailyNumbers.slice(0, -1).reduce((a, b) => a + b, 0);
              console.log(`    🔍 OT Strategy 1a: dailySum=${dailySum}, lastNum=${lastNum}, diff=${Math.abs(dailySum - lastNum)}`);
              if (Math.abs(dailySum - lastNum) <= 2) { // Allow small OCR error
                total = lastNum;
                console.log(`    ✅ OT Last number matches sum of daily numbers: ${lastNum}`);
              } else {
                total = lastNum;
                console.log(`    ✅ OT Using last number as Total: ${total}`);
              }
            }
            // Strategy 1b: If we only have daily numbers (all 0-16), sum them
            else if (dailyNumbers.length >= 5 && dailyNumbers.length === allNumbers.length) {
              total = dailyNumbers.reduce((a, b) => a + b, 0);
              console.log(`    ✅ OT Summing all daily numbers: ${dailyNumbers.join('+')} = ${total}`);
            }
            // Strategy 1c: Last number is in valid range, use it
            else if (lastNum >= 15 && lastNum <= 80) {
              total = lastNum;
              console.log(`    ✅ OT Strategy 1c - Using last number as Total: ${total}`);
            } else {
              console.log(`    ⚠️ OT Strategy 1 failed - lastNum=${lastNum}, dailyNumbers.length=${dailyNumbers.length}, allNumbers.length=${allNumbers.length}`);
            }
          }
          
          // Strategy 2: Check next 10 lines (increased from 3) for the Total
          // OCR often splits table rows across multiple text lines
          if (total === 0) {
            console.log(`    🔍 Total not found on same line, searching next 10 lines...`);
            let collectedDailyNumbers = [...allNumbers.filter(n => n >= 0 && n <= 16)];
            
            for (let j = 1; j <= 10 && i + j < combinedLines.length; j++) {
              const nextLine = combinedLines[i + j].trim();
              console.log(`    🔍 Checking next line +${j}: "${nextLine}"`);
              
              // Stop if we hit another activity row
              if (nextLine.match(/\d+\s*(normal|overtime|public\s+holiday)/i)) {
                console.log(`    ⛔ Hit another activity row, stopping search`);
                break;
              }
              
              // Collect all numbers from this line
              const lineNumbers = [...nextLine.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
              if (lineNumbers.length > 0) {
                console.log(`    🔢 Line has numbers: [${lineNumbers.join(', ')}]`);
                
                // ⚠️ CRITICAL: Filter out invalid numbers:
                // - Account numbers (5+ digits like "412029")
                // - Year numbers (1900-2099 like "2022")  
                // - Numbers surrounded by large account numbers (like "30" from "412029-00030-2022")
                const validNumbers = lineNumbers.filter((n, idx) => {
                  // Filter 1: Exclude 5+ digit numbers (account numbers)
                  if (n.toString().length >= 5) return false;
                  
                  // Filter 2: Exclude year numbers
                  if (n >= 1900 && n <= 2099) return false;
                  
                  // Filter 3: If surrounded by large numbers (5+ digits), likely part of account pattern
                  const prevNum = idx > 0 ? lineNumbers[idx - 1] : null;
                  const nextNum = idx < lineNumbers.length - 1 ? lineNumbers[idx + 1] : null;
                  if ((prevNum && prevNum.toString().length >= 5) || (nextNum && nextNum.toString().length >= 5)) {
                    console.log(`    🚫 Rejecting ${n} (surrounded by account number)`);
                    return false;
                  }
                  
                  return true;
                });
                console.log(`    🔧 After filtering account/year numbers: [${validNumbers.join(', ')}]`);
                
                // Check if this line has a total (15-80 range)
                const largeNumbers = validNumbers.filter(n => n >= 15 && n <= 80);
                const dailyLineNumbers = validNumbers.filter(n => n >= 0 && n <= 16);
                
                // If we find a large number (and it's NOT an account number), it's likely the total
                if (largeNumbers.length > 0) {
                  total = largeNumbers[largeNumbers.length - 1]; // Use last one
                  console.log(`    ✅ Found Total in next line: ${total}`);
                  break;
                }
                
                // Collect daily numbers to sum later
                if (dailyLineNumbers.length > 0) {
                  collectedDailyNumbers.push(...dailyLineNumbers);
                  console.log(`    📥 Collected daily numbers: [${dailyLineNumbers.join(', ')}], total so far: [${collectedDailyNumbers.join(', ')}]`);
                }
              }
            }
            
            // If we collected enough daily numbers but no total, sum them
            if (total === 0 && collectedDailyNumbers.length >= 5) {
              total = collectedDailyNumbers.reduce((a, b) => a + b, 0);
              console.log(`    ✅ Summing all collected daily numbers: ${collectedDailyNumbers.join('+')} = ${total}`);
            }
            
            // 🔧 RESCUE 1: If we have 3-4 identical daily numbers (e.g., [4,4,4]), estimate 5-day week
            if (total === 0 && collectedDailyNumbers.length >= 3 && collectedDailyNumbers.length <= 4) {
              const uniqueNumbers = [...new Set(collectedDailyNumbers)];
              if (uniqueNumbers.length === 1) {
                const dailyHours = uniqueNumbers[0];
                if (dailyHours >= 4 && dailyHours <= 8) {
                  total = dailyHours * 5; // Estimate 5-day week
                  console.log(`    🔧 RESCUE 1: Found ${collectedDailyNumbers.length} identical daily hours (${dailyHours}h each), estimating 5-day week: ${dailyHours} × 5 = ${total}h`);
                }
              }
            }
            
            // 🔧 RESCUE 2: If we have only 1-2 identical daily numbers (e.g., [4] or [4,4]), also estimate 5-day week
            if (total === 0 && collectedDailyNumbers.length >= 1 && collectedDailyNumbers.length < 3) {
              const uniqueNumbers = [...new Set(collectedDailyNumbers)];
              if (uniqueNumbers.length === 1) {
                const dailyHours = uniqueNumbers[0];
                if (dailyHours >= 4 && dailyHours <= 8) {
                  total = dailyHours * 5; // Estimate 5-day week
                  console.log(`    🔧 RESCUE 2: Found only ${collectedDailyNumbers.length} daily hours (${dailyHours}h each), estimating 5-day week: ${dailyHours} × 5 = ${total}h`);
                }
              }
            }
          }
          
          // OCR corrections for typical totals
          if (total > 0) {
            const originalTotal = total;
            if (total >= 18 && total <= 22) total = 20;
            else if (total >= 28 && total <= 32) total = 30;
            else if (total >= 38 && total <= 42) total = 40;
            else if (total >= 58 && total <= 62) total = 60;
            
            if (total !== originalTotal) {
              console.log(`    🔧 OCR correction: ${originalTotal} → ${total}`);
            }
          }
          
          // Accept this row if we have a valid total (allow multiple OT rows even with same activity code)
          if (total > 0) {
            overtimeHrsRows.push({
              lineNum: i + 1,
              leadingNum,
              total,
              line
            });
            console.log(`  ✓ Row ${i + 1}: Found "${overtimeHrsMatch[0]}" | TOTAL: ${total}h | Line: "${line.substring(0, 80)}..."`);
          } else {
            console.log(`    ⚠️ Row ${i + 1}: Found "${overtimeHrsMatch[0]}" but no valid Total found`);
          }
        }
        
        // Look for "90 Public Holiday" or other OT activity types (Sick Leave, Annual Leave, etc.)
        // Pattern: number + activity type that should count as OT/NH
        const otActivityMatch = line.match(/(\d+)\s*(public\s+holiday|sick\s+leave|annual\s+leave|training|standby|call\s+out)/i);
        if (otActivityMatch) {
          const leadingNum = parseInt(otActivityMatch[1]);
          const activityType = otActivityMatch[2];
          
          // Extract the Total value - same strategies as above
          let total = 0;
          const afterPattern = line.substring(otActivityMatch.index + otActivityMatch[0].length);
          
          const allNumbers = [...afterPattern.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
          
          console.log(`    🔍 OT Activity Row ${i + 1} (${activityType}) afterPattern: "${afterPattern}"`);
          console.log(`    🔍 Numbers found: [${allNumbers.join(', ')}]`);
          
          if (allNumbers.length > 0) {
            // Filter daily numbers (0-16 range) - these are individual day hours
            const dailyNumbers = allNumbers.filter(n => n >= 0 && n <= 16);
            
            // Check if the LAST number could be a weekly total (sum of previous daily numbers)
            if (dailyNumbers.length >= 3) {
              const lastNum = dailyNumbers[dailyNumbers.length - 1];
              const sumOfPrevious = dailyNumbers.slice(0, -1).reduce((a, b) => a + b, 0);
              
              // If last number equals sum of previous numbers, it's the total column
              if (lastNum === sumOfPrevious || Math.abs(lastNum - sumOfPrevious) <= 2) {
                total = lastNum;
                console.log(`    ✅ Last number (${lastNum}) is the Total column (sum of daily: ${dailyNumbers.slice(0, -1).join('+')} ≈ ${sumOfPrevious})`);
              }
              // Otherwise, sum ALL daily numbers including the last one
              else {
                total = dailyNumbers.reduce((a, b) => a + b, 0);
                console.log(`    ✅ Summing all ${dailyNumbers.length} daily numbers: ${dailyNumbers.join('+')} = ${total}`);
              }
            }
            // If we have exactly 2 daily numbers, sum them (no separate total column detected)
            else if (dailyNumbers.length === 2) {
              total = dailyNumbers.reduce((a, b) => a + b, 0);
              console.log(`    ✅ Summing 2 daily numbers: ${dailyNumbers.join('+')} = ${total}`);
            }
            // If we have only 1 daily number, use it
            else if (dailyNumbers.length === 1) {
              total = dailyNumbers[0];
              console.log(`    ✅ Using single number as Total: ${total}`);
            }
            // Otherwise try to find a total in the 8-80 range at the end
            else {
              const lastNum = allNumbers[allNumbers.length - 1];
              if (lastNum >= 8 && lastNum <= 80) {
                total = lastNum;
                console.log(`    ✅ Using last number as Total: ${total}`);
              }
            }
          }
          
          // Strategy 2: Check next 10 lines (increased from 3) for the Total
          // OCR often splits table rows across multiple text lines
          if (total === 0) {
            console.log(`    🔍 Total not found on same line, searching next 10 lines...`);
            let collectedDailyNumbers = [...allNumbers.filter(n => n >= 0 && n <= 16)];
            
            for (let j = 1; j <= 10 && i + j < combinedLines.length; j++) {
              const nextLine = combinedLines[i + j].trim();
              console.log(`    🔍 Checking next line +${j}: "${nextLine}"`);
              
              // Stop if we hit another activity row
              if (nextLine.match(/\d+\s*(normal|overtime|public\s+holiday)/i)) {
                console.log(`    ⛔ Hit another activity row, stopping search`);
                break;
              }
              
              // Collect all numbers from this line
              const lineNumbers = [...nextLine.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
              if (lineNumbers.length > 0) {
                console.log(`    🔢 Line has numbers: [${lineNumbers.join(', ')}]`);
                
                // Check if this line has a total (15-80 range)
                const largeNumbers = lineNumbers.filter(n => n >= 15 && n <= 80);
                const dailyLineNumbers = lineNumbers.filter(n => n >= 0 && n <= 16);
                
                // If we find a large number, it's likely the total
                if (largeNumbers.length > 0) {
                  total = largeNumbers[largeNumbers.length - 1]; // Use last one
                  console.log(`    ✅ Found Total in next line: ${total}`);
                  break;
                }
                
                // Collect daily numbers to sum later
                if (dailyLineNumbers.length > 0) {
                  collectedDailyNumbers.push(...dailyLineNumbers);
                  console.log(`    📥 Collected daily numbers: [${dailyLineNumbers.join(', ')}], total so far: [${collectedDailyNumbers.join(', ')}]`);
                }
              }
            }
            
            // If we collected enough daily numbers but no total, sum them
            if (total === 0 && collectedDailyNumbers.length >= 5) {
              total = collectedDailyNumbers.reduce((a, b) => a + b, 0);
              console.log(`    ✅ Summing all collected daily numbers: ${collectedDailyNumbers.join('+')} = ${total}`);
            }
            
            // RESCUE: If we have 3-4 identical daily numbers but no total, estimate based on pattern
            if (total === 0 && collectedDailyNumbers.length >= 3 && collectedDailyNumbers.length < 5) {
              const uniqueNumbers = [...new Set(collectedDailyNumbers)];
              // If all numbers are the same (e.g., [4,4,4]), estimate 5 days
              if (uniqueNumbers.length === 1) {
                const dailyHours = uniqueNumbers[0];
                total = dailyHours * 5; // Assume 5-day work week
                console.log(`    🔧 RESCUE: Found ${collectedDailyNumbers.length} identical daily hours (${dailyHours}h each), estimating 5-day week: ${dailyHours} × 5 = ${total}h`);
              } else {
                // Sum what we have
                total = collectedDailyNumbers.reduce((a, b) => a + b, 0);
                console.log(`    🔧 RESCUE: Summing ${collectedDailyNumbers.length} partial daily numbers: ${collectedDailyNumbers.join('+')} = ${total}h`);
              }
            }
          }
          
          // OCR corrections
          if (total > 0) {
            const originalTotal = total;
            if (total >= 14 && total <= 18) total = 16;
            else if (total >= 18 && total <= 22) total = 20;
            else if (total >= 38 && total <= 42) total = 40;
            
            if (total !== originalTotal) {
              console.log(`    🔧 OCR correction: ${originalTotal} → ${total}`);
            }
          }
          
          // Add to OT rows if valid total found (allow multiple OT activity rows even with same activity code)
          if (total > 0) {
            overtimeHrsRows.push({
              lineNum: i + 1,
              leadingNum,
              total,
              activityType,
              line
            });
            console.log(`  ✓ Row ${i + 1}: Found "${otActivityMatch[0]}" | TOTAL: ${total}h | Line: "${line.substring(0, 80)}..."`);
          } else {
            console.log(`    ⚠️ Row ${i + 1}: Found "${otActivityMatch[0]}" but no valid Total found`);
          }
        }
      }
      
      console.log(`\n📊 RW/WORLEY ROW DETECTION:`);
      console.log(`   Normal Hrs rows found: ${normalHrsRows.length}`);
      console.log(`   Overtime Hrs rows found: ${overtimeHrsRows.length}`);
      
      // 🔧 DEDUPLICATE ROWS: OCR merges multiple passes, causing duplicate detections
      // If two rows have the same total and same activity code, and are far apart (150+ lines),
      // they're likely duplicates from merged OCR text
      if (normalHrsRows.length > 1) {
        console.log(`\n🔍 Checking for duplicate Normal Hrs rows...`);
        const uniqueNormalRows = [];
        
        for (let i = 0; i < normalHrsRows.length; i++) {
          const currentRow = normalHrsRows[i];
          let isDuplicate = false;
          
          // Check against already accepted unique rows
          for (const uniqueRow of uniqueNormalRows) {
            const sameKey = currentRow.leadingNum === uniqueRow.leadingNum && 
                           currentRow.total === uniqueRow.total;
            const farApart = Math.abs(currentRow.lineNum - uniqueRow.lineNum) > 150;
            
            // Only mark as duplicate if BOTH same key AND far apart (likely OCR duplicate)
            if (sameKey && farApart) {
              console.log(`   🚫 Skipping duplicate: Row ${currentRow.lineNum} (same as Row ${uniqueRow.lineNum}: Activity ${currentRow.leadingNum}, ${currentRow.total}h, distance: ${Math.abs(currentRow.lineNum - uniqueRow.lineNum)} lines)`);
              isDuplicate = true;
              break;
            }
          }
          
          if (!isDuplicate) {
            uniqueNormalRows.push(currentRow);
          }
        }
        
        if (uniqueNormalRows.length < normalHrsRows.length) {
          console.log(`   ✅ Deduplicated: ${normalHrsRows.length} → ${uniqueNormalRows.length} Normal Hrs rows`);
          normalHrsRows = uniqueNormalRows;
        } else {
          console.log(`   ✅ No duplicates found - keeping all ${normalHrsRows.length} rows`);
        }
      }
      
      if (overtimeHrsRows.length > 1) {
        console.log(`\n🔍 Checking for duplicate Overtime rows...`);
        const uniqueOTRows = [];
        
        for (let i = 0; i < overtimeHrsRows.length; i++) {
          const currentRow = overtimeHrsRows[i];
          let isDuplicate = false;
          
          // Check against already accepted unique rows
          for (const uniqueRow of uniqueOTRows) {
            const sameKey = currentRow.leadingNum === uniqueRow.leadingNum && 
                           currentRow.total === uniqueRow.total;
            const farApart = Math.abs(currentRow.lineNum - uniqueRow.lineNum) > 150;
            
            // Only mark as duplicate if BOTH same key AND far apart (likely OCR duplicate)
            if (sameKey && farApart) {
              console.log(`   🚫 Skipping duplicate: Row ${currentRow.lineNum} (same as Row ${uniqueRow.lineNum}: Activity ${currentRow.leadingNum}, ${currentRow.total}h, distance: ${Math.abs(currentRow.lineNum - uniqueRow.lineNum)} lines)`);
              isDuplicate = true;
              break;
            }
          }
          
          if (!isDuplicate) {
            uniqueOTRows.push(currentRow);
          }
        }
        
        if (uniqueOTRows.length < overtimeHrsRows.length) {
          console.log(`   ✅ Deduplicated: ${overtimeHrsRows.length} → ${uniqueOTRows.length} Overtime rows`);
          overtimeHrsRows = uniqueOTRows;
        } else {
          console.log(`   ✅ No duplicates found - keeping all ${overtimeHrsRows.length} rows`);
        }
      }
      
      // Calculate totals from ACTUAL detected rows
      let normalTotal = 0;
      let otTotal = 0;
      
      // Sum up normal hours - just use the extracted Total value
      if (normalHrsRows.length > 0) {
        console.log(`\n   📝 Summing Normal Hours from ${normalHrsRows.length} rows:`);
        normalTotal = normalHrsRows.reduce((sum, row) => {
          console.log(`      → Row ${row.lineNum} (Activity Code ${row.leadingNum}): ${row.total}h`);
          return sum + row.total;
        }, 0);
        console.log(`   ✅ Total Normal Hours: ${normalTotal}h`);
      }
      
      // Sum up OT hours - just use the extracted Total value
      if (overtimeHrsRows.length > 0) {
        console.log(`\n   📝 Summing OT Hours from ${overtimeHrsRows.length} rows:`);
        otTotal = overtimeHrsRows.reduce((sum, row) => {
          const activityLabel = row.activityType ? `${row.activityType}` : 'Overtime Hrs';
          console.log(`      → Row ${row.lineNum} (Activity Code ${row.leadingNum}, ${activityLabel}): ${row.total}h`);
          return sum + row.total;
        }, 0);
        console.log(`   ✅ Total OT Hours: ${otTotal}h`);
      }
      
      totalNormalHours = normalTotal;
      totalOTHours = otTotal;
      
      // FALLBACK: If we didn't find valid totals, search for daily hour patterns
      if (totalNormalHours === 0 && totalOTHours === 0) {
        console.log("\n⚠️ RW rows found but no totals extracted - trying pattern search...");
        
        // Look for patterns like "8 8 8 8 8" (5 eights = 40 hours)
        const eightPattern = combinedText.match(/\b8\s+8\s+8\s+8\s+8\b/);
        if (eightPattern) {
          totalNormalHours = 40;
          console.log("  ✅ Found pattern '8 8 8 8 8' → Normal Hours = 40");
        }
        
        // Look for patterns like "4 4 4 4 4" (5 fours = 20 hours OT)
        const fourPattern = combinedText.match(/\b4\s+4\s+4\s+4\s+4\b/);
        if (fourPattern) {
          totalOTHours = 20;
          console.log("  ✅ Found pattern '4 4 4 4 4' → OT Hours = 20");
        }
      }
      
      console.log(`\n✅ RW/WORLEY FINAL TOTALS (from ${normalHrsRows.length} normal + ${overtimeHrsRows.length} OT rows):`);
      console.log(`   Normal Hours: ${totalNormalHours}h (from ${normalHrsRows.length} rows with "Normal Hrs" type)`);
      console.log(`   OT Hours: ${totalOTHours}h (from ${overtimeHrsRows.length} rows with "Overtime Hrs" or similar types)`);
      console.log(`   Grand Total: ${totalNormalHours + totalOTHours}h\n`);
      
      // Clean up temp storage
      delete window._ocrRWTable;
    }
    
    // ==========================================
    // PETROFAC FORMAT HANDLER
    // ==========================================
    // Petrofac landscape timesheets require special handling
    if (isPetrofac && !isBureauVeritas) {
      console.log("✅ PETROFAC FORMAT DETECTED - Attempting to extract hours...");
      
      // PRIORITY 1: Use TOTAL COLUMN OCR if available (landscape only)
      const totalColumnText = window._ocrTotalColumn || "";
      console.log("TOTAL column OCR available:", !!totalColumnText);
      
      if (totalColumnText) {
        console.log("🎯 Using TOTAL COLUMN extraction:");
        console.log("Raw TOTAL column text:", totalColumnText);
        
        // Extract all numbers from the TOTAL column
        const columnNumbers = [...totalColumnText.matchAll(/\b(\d+)\b/g)]
          .map(m => parseInt(m[1]))
          .filter(n => !isNaN(n) && n > 0);
        
        console.log("Numbers in TOTAL column:", columnNumbers);
        
        // Filter for reasonable weekly hours (20-80)
        const validTotals = columnNumbers.filter(n => n >= 20 && n <= 80);
        console.log("Valid totals (20-80 range):", validTotals);
        
        if (validTotals.length > 0) {
          // Strategy 1: Look for 40 (standard week)
          if (validTotals.includes(40)) {
            totalNormalHours = 40;
            console.log("  ✅ Found standard 40-hour week in TOTAL column");
          }
          // Strategy 1b: OCR correction - 46 is often misread 40 (6 mistaken for 0)
          else if (validTotals.includes(46)) {
            totalNormalHours = 40;
            console.log("  ✅ Correcting OCR error: 46 → 40 (common misread)");
          }
          // Strategy 1c: OCR correction - 57/56/58 are often misread 40 (5=4, 7/8=0)
          else if (validTotals.includes(57) || validTotals.includes(56) || validTotals.includes(58)) {
            totalNormalHours = 40;
            const found = validTotals.find(n => n === 57 || n === 56 || n === 58);
            console.log(`  ✅ Correcting OCR error: ${found} → 40 (common misread)`);
          }
          // Strategy 2: Look for numbers in the 35-48 range (typical weekly totals)
          else {
            const weeklyRange = validTotals.filter(n => n >= 35 && n <= 48);
            if (weeklyRange.length > 0) {
              // Take the LARGEST number in weekly range (likely the sum)
              let maxHours = Math.max(...weeklyRange);
              
              // OCR correction: Round common misreads to 40
              if (maxHours === 46 || maxHours === 41 || maxHours === 39) {
                console.log(`  🔧 Correcting likely OCR error: ${maxHours} → 40`);
                maxHours = 40;
              }
              
              totalNormalHours = maxHours;
              console.log(`  ✅ Using corrected hours: ${totalNormalHours}`);
            } else {
              // Fallback: Take largest valid number
              totalNormalHours = Math.max(...validTotals);
              console.log(`  ✅ Using LARGEST valid number: ${totalNormalHours} hours`);
            }
          }
          totalOTHours = 0;
        } else {
          console.log("  ⚠️ No valid totals in TOTAL column, trying fallback methods...");
        }
      }
      
      // FALLBACK: If TOTAL column didn't work, try other methods
      if (totalNormalHours === 0) {
        const numbersText = window._ocrNumbersText || "";
        console.log("Numbers OCR available:", !!numbersText);
      
      
        if (numbersText) {
          // FIRST: Try to find numbers near "TOTAL" or "HOURS" keywords in MAIN text
          console.log("Looking for TOTAL/HOURS context in main text:");
          const totalLines = lines.filter(line => 
            line.match(/TOTAL/i) || line.match(/HOURS/i)
          );
          
          console.log(`Found ${totalLines.length} lines with TOTAL/HOURS:`);
          totalLines.forEach((line, idx) => {
            console.log(`  Context ${idx + 1}: "${line}"`);
          });
          
          // Extract numbers from these contextual lines
          let contextualNumbers = [];
          totalLines.forEach(line => {
            const nums = line.match(/\b\d+\b/g);
            if (nums) {
              nums.forEach(n => {
                const val = parseInt(n);
                if (!isNaN(val) && val >= 20 && val <= 80) {
                  contextualNumbers.push(val);
                  console.log(`    Found contextual number: ${val}`);
                }
              });
            }
          });
          
          console.log(`Contextual numbers: ${JSON.stringify(contextualNumbers)}`);
          
          // If we found contextual numbers, use the FIRST one
          if (contextualNumbers.length > 0) {
            totalNormalHours = contextualNumbers[0];
            console.log(`  ✅ Using CONTEXTUAL number from TOTAL/HOURS line: ${totalNormalHours} hours`);
          } else {
            // FALLBACK: Frequency analysis but EXCLUDE high-frequency noise
            console.log("No contextual numbers, using filtered frequency analysis:");
            console.log("Analyzing numbers-only OCR output:");
            const numberLines = numbersText.split('\n').filter(l => l.trim());
            
            // Extract all numbers from numbers-only OCR
            const allNumbers = [...numbersText.matchAll(/\b(\d+)\b/g)]
              .map(m => parseInt(m[1]))
              .filter(n => n > 0);
            
            console.log(`All numbers extracted: ${JSON.stringify(allNumbers.slice(0, 30))}`);
            
            // Look for weekly total pattern: 20-80 range
            const weeklyTotals = allNumbers.filter(n => n >= 20 && n <= 80);
            console.log(`Potential weekly totals (20-80): ${JSON.stringify(weeklyTotals)}`);
            
            if (weeklyTotals.length > 0) {
              // Smart selection: Look for the most common value OR specific patterns
              const frequency = {};
              weeklyTotals.forEach(n => frequency[n] = (frequency[n] || 0) + 1);
              
              console.log(`Frequency analysis:`, frequency);
              
              // EXCLUDE numbers that appear > 10 times (likely table structure noise like "33")
              const validNumbers = Object.entries(frequency)
                .filter(([num, count]) => count <= 10)
                .sort((a, b) => b[1] - a[1]); // Sort by frequency descending
              
              console.log(`Valid numbers (excluding high-frequency noise):`, validNumbers);
              
              if (validNumbers.length > 0) {
                totalNormalHours = parseInt(validNumbers[0][0]);
                console.log(`  ✅ Using most frequent VALID number: ${totalNormalHours} hours (appears ${validNumbers[0][1]} times, excluding noise)`);
              } else {
                // All numbers are high-frequency - take first occurrence
                totalNormalHours = weeklyTotals[0];
                console.log(`  ⚠️ All numbers are high-frequency, using first: ${totalNormalHours} hours`);
              }
              
              totalOTHours = 0;
            }
          }
        }
      }
      
      // Strategy 1: Look for "TOTAL HOURS" or "TOTAL CHARGEABLE" row in main OCR
      if (totalNormalHours === 0) {
        console.log("  Trying main OCR text for TOTAL row...");
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const lineLower = line.toLowerCase();
          
          // Look for TOTAL line (various OCR variations)
          if (lineLower.includes('total') && (lineLower.includes('hour') || lineLower.includes('chargeable'))) {
            console.log(`  Found TOTAL line at ${i + 1}: "${line}"`);
            
            // Extract ALL numbers from this line and next 2 lines
            const relevantText = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
            const numbers = [...relevantText.matchAll(/\b(\d+)\b/g)]
              .map(m => parseInt(m[1]))
              .filter(n => n > 0 && n <= 80); // Reasonable weekly hours
            
            console.log(`  Numbers found near TOTAL: ${JSON.stringify(numbers)}`);
            
            // Look for reasonable weekly totals (20-80 hours)
            const validTotals = numbers.filter(n => n >= 20 && n <= 80);
            
            if (validTotals.length > 0) {
              // Take the FIRST reasonable number as the total
              totalNormalHours = validTotals[0];
              totalOTHours = 0;
              console.log(`  ✅ Extracted ${totalNormalHours} hours from TOTAL line`);
              break;
            }
          }
        }
      }
      
      // Strategy 2: Look for daily hours summation (8 8 8 8 8 = 40)
      if (totalNormalHours === 0 && numbersText) {
        console.log("  Trying daily hours pattern recognition...");
        
        const numberLines = numbersText.split('\n');
        for (let i = 0; i < numberLines.length; i++) {
          const numbers = [...numberLines[i].matchAll(/\b(\d+)\b/g)]
            .map(m => parseInt(m[1]))
            .filter(n => n >= 0 && n <= 16); // Daily hours range
          
          if (numbers.length >= 4 && numbers.length <= 7) {
            const sum = numbers.reduce((a, b) => a + b, 0);
            console.log(`  Line ${i + 1} has ${numbers.length} daily hours: [${numbers.join(', ')}] = ${sum}`);
            
            if (sum >= 20 && sum <= 80) {
              totalNormalHours = sum;
              totalOTHours = 0;
              console.log(`  ✅ Summed daily hours = ${sum}`);
              break;
            }
          }
        }
      }
      
      // Strategy 3: Default to 40 only as LAST RESORT
      if (totalNormalHours === 0) {
        console.log("  ⚠️ WARNING: Could not extract hours from OCR - defaulting to 40");
        console.log("  Please verify the hours manually!");
        totalNormalHours = 40;
        totalOTHours = 0;
      }
      
      // Clean up temp storage
      delete window._ocrNumbersText;
    }
    
    // ==========================================
    // OTHER FORMATS - Only process if NOT Petrofac
    // ==========================================
    if (!isPetrofac) {
      // Format 1: Look for "Total Regular" and "Total Overtime" (Primavera format)
      console.log("Searching line by line for Total Regular/Overtime...");
      
      let totalRegularLineIndex = -1;
      let totalOvertimeLineIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      if (lineLower.includes('total') && lineLower.includes('regular')) {
        console.log(`✓ Found "Total Regular" at line ${i + 1}: "${line}"`);
        totalRegularLineIndex = i;
        const numbers = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        console.log(`  All numbers in line: ${JSON.stringify(numbers)}`);
        
        if (numbers.length > 0) {
          totalNormalHours = numbers[numbers.length - 1];
          console.log(`  ✓ Taking LAST number as Total Regular: ${totalNormalHours}`);
        }
      }
      
      if (lineLower.includes('total') && lineLower.includes('overtime')) {
        console.log(`✓ Found "Total Overtime" at line ${i + 1}: "${line}"`);
        totalOvertimeLineIndex = i;
        const numbers = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        console.log(`  All numbers in line: ${JSON.stringify(numbers)}`);
        
        if (numbers.length > 0) {
          totalOTHours = numbers[numbers.length - 1];
          console.log(`  ✓ Taking LAST number as Total Overtime: ${totalOTHours}`);
        }
      }
    }
    
    console.log(`After Format 1 search: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    
    // PRIMAVERA FIX: Look for "Total Hours" column which may contain the actual totals
    // This handles cases where "Total Regular 0.00 8.00" shows daily value (8) but actual total is in "Total Hours" column (40)
    if (totalNormalHours > 0 && totalRegularLineIndex >= 0) {
      console.log("🔍 Checking for 'Total Hours' column with larger values...");
      
      // Look for "Total" or "Hours" header, then scan following lines for larger numbers
      for (let i = totalRegularLineIndex; i < Math.min(totalRegularLineIndex + 30, lines.length); i++) {
        const line = lines[i].trim();
        const lineLower = line.toLowerCase();
        
        // Found "Total Hours" header
        if ((lineLower.includes('total') && lineLower.includes('hours')) || lineLower === 'total' || lineLower === 'hours') {
          console.log(`  ✓ Found Total/Hours header at line ${i + 1}: "${line}"`);
          
          // Scan next 10 lines and collect ALL standalone numbers, then take the LARGEST
          let maxTotalFound = totalNormalHours;
          let maxLineNum = -1;
          
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            const numLine = lines[j].trim();
            const numbers = [...numLine.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
            
            // Look for standalone numbers in Total Hours column (exclude 0.00)
            if (numbers.length === 1 && numbers[0] > 0 && numbers[0] <= 200) {
              if (numbers[0] > maxTotalFound) {
                console.log(`  📊 Found potential total at line ${j + 1}: ${numbers[0]}`);
                maxTotalFound = numbers[0];
                maxLineNum = j + 1;
              }
            }
          }
          
          // Use the LARGEST value found
          if (maxTotalFound > totalNormalHours) {
            console.log(`  ✅ Using LARGEST value from "Total Hours" column at line ${maxLineNum}: ${maxTotalFound}`);
            console.log(`     Updating Normal Hours: ${totalNormalHours} → ${maxTotalFound}`);
            totalNormalHours = maxTotalFound;
          }
          break;
        }
      }
    }
    
    console.log(`After Total Hours column check: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    
    // Format 1a: Bureau Veritas format - "Total" column with Billable rows
    // Look for lines with "Billable" followed by numbers, then "Total" with a number
  if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("Trying Bureau Veritas format (Billable rows with Total column)...");
      
      let bvTotalFound = false;
      
      // BV specific: Look for 8-digit contract numbers followed by small numbers (hours)
      // Pattern: Line with 8-digit number, next line(s) have small numbers (1-20)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip header lines
        if (line.toLowerCase().includes('bureau veritas') || 
            line.toLowerCase().includes('dayabumi') || 
            line.toLowerCase().includes('kuala lumpur') ||
            line.toLowerCase().includes('timesheet') ||
            line.toLowerCase().includes('contract') ||
            line.toLowerCase().includes('employee') ||
            line.toLowerCase().includes('position')) {
          continue;
        }
        
        // Look for 8-digit contract numbers
        const contractMatch = line.match(/\b(\d{8})\b/);
        
        if (contractMatch && i + 1 < lines.length) {
          console.log(`  Found contract number at line ${i + 1}: ${contractMatch[1]}`);
          
          // Check ONLY the immediate next line for the total
          const nextLine = lines[i + 1].trim();
          const numbers = [...nextLine.matchAll(/\b(\d+)\b/g)].map(m => parseInt(m[1]));
          
          // Look for a SINGLE small number (0-20) which is the total for this contract
          if (numbers.length === 1 && numbers[0] >= 0 && numbers[0] <= 20) {
            const hours = numbers[0];
            totalNormalHours += hours;
            console.log(`  ✓ Found BV contract total at line ${i + 2}: +${hours} (running total: ${totalNormalHours})`);
            bvTotalFound = true;
          }
        }
      }
      
      if (bvTotalFound) {
        totalOTHours = 0;
        console.log(`  ✅ Bureau Veritas total: ${totalNormalHours} hours`);
      }
    }
    
    console.log(`After BV Format search: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    
    // Format 1b: Primavera bottom total row (no label, just numbers in last row)
    // Look for a line with multiple small numbers (0-16) followed by a larger sum (30-100)
    if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("Trying Primavera bottom row format (sequence of daily hours)...");
      
      // Check LAST 15 lines (more thorough)
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line || line.length < 3) continue;
        
        // Skip if line has lots of text - BUT allow "Normal Hrs" pattern
        const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
        const hasNormalHrs = line.match(/normal\s+hrs/i);
        
        if (letterCount > 10 && !hasNormalHrs) {
          console.log(`  Skipping line ${i + 1} (too many letters, no Normal Hrs): "${line}"`);
          continue;
        }
        
        const numbers = [...line.matchAll(/(\d+)/g)].map(m => parseInt(m[1]));
        
        console.log(`  Checking line ${i + 1}: "${line}"`);
        console.log(`  Numbers found: ${JSON.stringify(numbers)}`);
        
        // PRIORITY 1: If line contains "Normal Hrs" and has a number at the end
        if (hasNormalHrs && numbers.length > 0) {
          // Take the LAST number (the total)
          const lastNum = numbers[numbers.length - 1];
          if (lastNum >= 1 && lastNum <= 80) {
            // If the last number looks like a total (30-80), use it
            // Otherwise if it's close to 40, round to 40
            if (lastNum >= 35 && lastNum <= 45) {
              totalNormalHours = 40;
            } else {
              totalNormalHours = lastNum;
            }
            totalOTHours = 0;
            console.log(`  ✅ FOUND "Normal Hrs" line with total: ${totalNormalHours}`);
            break;
          }
        }
        
        // PRIORITY 2: If line contains 40, use it immediately
        if (numbers.includes(40)) {
          totalNormalHours = 40;
          totalOTHours = 0;
          console.log(`  ✅ FOUND 40 in bottom line - using it!`);
          break;
        }
        
        // PRIORITY 3: If we have 5+ eights, sum them (should be 40)
        const eights = numbers.filter(n => n === 8);
        if (eights.length >= 5) {
          totalNormalHours = 40; // Force to 40 for standard work week
          totalOTHours = 0;
          console.log(`  ✅ FOUND ${eights.length} eights in bottom row - forcing to 40`);
          break;
        }
        
        // PRIORITY 4: Pattern of daily hours (0-16) with a bigger total at the end
        if (numbers.length >= 6) {
          const dailyHours = numbers.filter(n => n >= 0 && n <= 16);
          const bigNumbers = numbers.filter(n => n >= 30 && n <= 80);
          
          if (dailyHours.length >= 5 && bigNumbers.length > 0) {
            totalNormalHours = Math.max(...bigNumbers);
            totalOTHours = 0;
            console.log(`  ✅ Found Primavera total pattern: ${totalNormalHours} hours`);
            break;
          }
        }
      }
      
      console.log(`After Primavera format search: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    }
    
    // Format 2: Look for "TOTAL CHARGEABLE HOURS" and "TOTAL HOURS (A + B)" (Petronas/RNZ format)
    if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("Format 1 not found, trying Format 2 (Petronas TOTAL CHARGEABLE/TOTAL HOURS)...");
      
  let foundTotalHoursLine = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineLower = line.toLowerCase();
        
        // Look for "TOTAL HOURS (A + B)" - PRIORITY SEARCH
        // MUST exclude "chargeable" to avoid matching wrong rows
        if ((lineLower.includes('total') && lineLower.includes('hours') && (lineLower.includes('a') || lineLower.includes('b') || lineLower.includes('+'))) ||
            (lineLower.match(/total\s+hours\s*\(.*\)/i))) {
          
          // SKIP if it's "chargeable" or "non-chargeable" line
          if (lineLower.includes('chargeable')) {
            console.log(`  Skipping line ${i + 1} (contains 'chargeable'): "${line}"`);
            continue;
          }
          
          foundTotalHoursLine = true;
          console.log(`✓ Found "Total Hours (A + B)" at line ${i + 1}: "${line}"`);
          
          // Extract ALL numbers
          const allNumbers = [...line.matchAll(/(\d+)/g)].map(m => parseInt(m[1]));
          console.log(`  ALL numbers in line: ${JSON.stringify(allNumbers)}`);
          
          // Count how many 8s we have
          const eights = allNumbers.filter(n => n === 8);
          console.log(`  Found ${eights.length} eights`);
          
          // PRIORITY 1: If we have exactly 5 eights, FORCE it to 40 (5 days x 8 hours)
          if (eights.length === 5) {
            totalNormalHours = 40;
            console.log(`  ✅ FOUND 5 EIGHTS - FORCING total to 40 hours (5 days × 8)`);
            totalOTHours = 0;
            break;
          }
          
          // PRIORITY 2: Look for 40 explicitly in the line
          if (allNumbers.includes(40)) {
            totalNormalHours = 40;
            console.log(`  ✅ Found 40 explicitly - using it`);
            totalOTHours = 0;
            break;
          }
          
          // PRIORITY 3: If we have ANY eights (but not 5), sum them
          if (eights.length > 0 && eights.length <= 5) {
            totalNormalHours = eights.reduce((a, b) => a + b, 0);
            console.log(`  ✅ SUMMING ${eights.length} eights = ${totalNormalHours} hours`);
            totalOTHours = 0;
            break;
          }
          
          // PRIORITY 4: If we see 38 or 39, it's probably OCR error - round to 40
          if (allNumbers.includes(38) || allNumbers.includes(39)) {
            totalNormalHours = 40;
            console.log(`  ✅ Found 38/39 - OCR misread, correcting to 40`);
            totalOTHours = 0;
            break;
          }
          
          // Look for biggest number between 35-50 (reasonable weekly total)
          const validNumbers = allNumbers.filter(n => n >= 35 && n <= 50);
          if (validNumbers.length > 0) {
            totalNormalHours = Math.max(...validNumbers);
            console.log(`  ✅ Using max valid number (35-50): ${totalNormalHours}`);
            totalOTHours = 0;
            break;
          }
          
          // Fallback: take last number
          if (allNumbers.length > 0) {
            totalNormalHours = allNumbers[allNumbers.length - 1];
            console.log(`  ✅ Using last number: ${totalNormalHours}`);
            totalOTHours = 0;
            break;
          }
        }
        
        // Look for "TOTAL CHARGEABLE HOURS (A)" 
        if (!foundTotalHoursLine && (lineLower.includes('total') && lineLower.includes('chargeable') && lineLower.includes('hours'))) {
          console.log(`✓ Found "Total Chargeable Hours" at line ${i + 1}: "${line}"`);
          const numbers = [...line.matchAll(/(\d+)/g)].map(m => parseInt(m[1])).filter(n => n > 0 && n <= 100);
          console.log(`  Numbers in line: ${JSON.stringify(numbers)}`);
          
          if (numbers.length > 0) {
            chargeableHours = numbers[numbers.length - 1];
            console.log(`  ✓ Chargeable Hours: ${chargeableHours}`);
          }
        }
        
        // Look for "TOTAL NON-CHARGEABLE HOURS (B)"
        if (!foundTotalHoursLine && (lineLower.includes('total') && lineLower.includes('non') && lineLower.includes('chargeable'))) {
          console.log(`✓ Found "Total Non-Chargeable Hours" at line ${i + 1}: "${line}"`);
          const numbers = [...line.matchAll(/(\d+)/g)].map(m => parseInt(m[1])).filter(n => n > 0 && n <= 100);
          console.log(`  Numbers in line: ${JSON.stringify(numbers)}`);
          
          if (numbers.length > 0) {
            nonChargeableHours = numbers[numbers.length - 1];
            console.log(`  ✓ Non-Chargeable Hours: ${nonChargeableHours}`);
          }
        }
      }
      
      // If we found chargeable/non-chargeable but not the final total, add them
      if (totalNormalHours === 0 && (chargeableHours > 0 || nonChargeableHours > 0)) {
        totalNormalHours = chargeableHours + nonChargeableHours;
        console.log(`  ✓ Calculated total from chargeable (${chargeableHours}) + non-chargeable (${nonChargeableHours}) = ${totalNormalHours}`);
      }
      
      // LAST RESORT for Petrofac: Look for project description line followed by daily hours
      // Pattern: "PROJECT_NAME" line followed by line with multiple 8s or daily hours (0-16)
      if (totalNormalHours === 0) {
        console.log("  Trying Petrofac daily hours pattern...");
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          const nextLine = lines[i + 1].trim();
          
          // Look for a line with project/description text
          if (line.length > 5 && line.match(/[A-Za-z]/)) {
            // Check if next line has multiple single-digit numbers (daily hours)
            const numbers = [...nextLine.matchAll(/\b([0-9]|1[0-6])\b/g)]
              .map(m => parseInt(m[1]))
              .filter(n => n >= 0 && n <= 16);
            
            // If we have 4-7 numbers (representing weekdays), check for patterns
            if (numbers.length >= 4 && numbers.length <= 7) {
              // PRIORITY 1: If we have 4 or 5 eights, it's a standard 40-hour week
              const eights = numbers.filter(n => n === 8);
              if (eights.length >= 4) {
                totalNormalHours = 40;
                console.log(`  ✅ Found ${eights.length} eights in daily hours - FORCING to 40 hours (standard week)`);
                break;
              }
              
              // PRIORITY 2: Sum the daily hours
              const sum = numbers.reduce((a, b) => a + b, 0);
              
              // If sum is close to 40 (36-42), round to 40
              if (sum >= 36 && sum <= 42) {
                totalNormalHours = 40;
                console.log(`  ✅ Found daily hours sum ${sum} (close to 40) - rounding to 40 hours`);
                break;
              }
              
              // Otherwise, use the sum if reasonable (16-80)
              if (sum >= 16 && sum <= 80) {
                totalNormalHours = sum;
                console.log(`  ✅ Found daily hours pattern at lines ${i + 1}-${i + 2}: [${numbers.join(', ')}] = ${sum} hours`);
                break;
              }
            }
          }
        }
      }
      
      console.log(`After Format 2 search: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    }
    
    // Format 3: If still no hours found, look for any line with "TOTAL" and large numbers
    if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("Formats 1 & 2 not found, trying Format 3 (generic TOTAL line)...");
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineLower = line.toLowerCase();
        
        // Look for line containing "TOTAL" but not "overtime" or "regular"
        if (lineLower.includes('total') && !lineLower.includes('overtime') && !lineLower.includes('regular') && !lineLower.includes('signature')) {
          console.log(`Found generic TOTAL line at ${i + 1}: "${line}"`);
          
          // Extract all numbers from the total line
          const numbers = [...line.matchAll(/\b(\d+)\b/g)]
            .map(m => parseInt(m[1]))
            .filter(n => !isNaN(n) && n > 0);
          
          console.log(`Numbers in TOTAL line: ${JSON.stringify(numbers)}`);
          
          // If we have at least 2 numbers, take first two as Normal and OT totals
          if (numbers.length >= 2) {
            totalNormalHours = numbers[0];
            totalOTHours = numbers[1];
            console.log(`✓ Format 3: Extracted totals - Normal: ${totalNormalHours}, OT: ${totalOTHours}`);
            break;
          }
        }
      }
      
      console.log(`After Format 3 search: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    }
    
    // NUCLEAR OPTION: Just find number 40 anywhere
    if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("NUCLEAR OPTION: Searching for 40 anywhere...");
      
      for (let i = 0; i < lines.length; i++) {
        const numbers = [...lines[i].matchAll(/(\d+)/g)].map(m => parseInt(m[1]));
        if (numbers.includes(40)) {
          totalNormalHours = 40;
          totalOTHours = 0;
          console.log(`✅ FOUND 40 at line ${i + 1}`);
          break;
        }
      }
    }
    
    // End of format-specific processing
    } // Close the if (!isPetrofac) block
    
    // Format 2: If still no totals, look for TOTAL line with numbers (original format)
    if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("Format 1 not found, trying Format 2...");
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineLower = line.toLowerCase();
        
        // Look for line containing "TOTAL" (usually at bottom of timesheet table)
        if (lineLower.includes('total') && !lineLower.includes('overtime') && !lineLower.includes('regular')) {
          console.log(`Found TOTAL line at ${i + 1}: "${line}"`);
          
          // Extract all numbers from the total line
          const numbers = [...line.matchAll(/\b(\d+)\b/g)]
            .map(m => parseInt(m[1]))
            .filter(n => !isNaN(n) && n > 0);
          
          console.log(`Numbers in TOTAL line: ${JSON.stringify(numbers)}`);
          
          // Typically the TOTAL line has: Normal Hours Total, OT Hours Total, NH Hours Total
          // Take first two numbers as Normal and OT totals
          if (numbers.length >= 2) {
            totalNormalHours = numbers[0];
            totalOTHours = numbers[1];
            console.log(`✓ Format 2: Extracted totals - Normal: ${totalNormalHours}, OT: ${totalOTHours}`);
          }
          break;
        }
      }
    }
    
    // Format 3: If still no totals found, try looking for staff name pattern in header
    if (totalNormalHours === 0 && totalOTHours === 0) {
      console.log("Formats 1 & 2 not found, trying Format 3 (extract from name line)...");
      
      // Some timesheets have format like: "Shankar, Aalok" as staff name
      // Look for comma-separated names
      const nameCommaMatch = text.match(/([A-Z][a-z]+)\s*,\s*([A-Z][a-z]+)/);
      if (nameCommaMatch && !staffName) {
        staffName = `${nameCommaMatch[2]} ${nameCommaMatch[1]}`.toUpperCase(); // Reverse to "Aalok Shankar"
        console.log(`✓ Found name in comma format: ${staffName}`);
      }
    }

    console.log("\n=== PARSING COMPLETE ===");
    console.log("Staff Name:", staffName);
    console.log("PO/SO Number:", poSoNumber);
    console.log("Total Normal Hours:", totalNormalHours);
    console.log("Total OT Hours:", totalOTHours);
    console.log("=========================\n");
    
    console.log(`DEBUG: Checking default condition: staffName="${staffName}", isUnknown=${staffName === "Unknown"}, normalHours=${totalNormalHours}, otHours=${totalOTHours}`);
    
    // FINAL FIX: If we found a name but no hours, check format and apply defaults
    if (staffName && staffName !== "Unknown" && totalNormalHours === 0 && totalOTHours === 0) {
      console.log("⚠️ No hours extracted, checking format for defaults...");
      
      const isPrimavera = text.match(/Review[:\s]/i);
      const isBureauVeritas = text.match(/Bureau\s+Veritas/i) || text.match(/bureauveritas\.com/i);
      const isPetrofac = text.match(/Petrofac/i) || text.match(/RNZ/i);
      
      console.log(`Format detection: Primavera=${!!isPrimavera}, BV=${!!isBureauVeritas}, Petrofac=${!!isPetrofac}`);
      
      // Only default to 40 if it's Primavera OR Petrofac, NOT Bureau Veritas
      if ((isPrimavera || isPetrofac) && !isBureauVeritas) {
        totalNormalHours = 40;
        totalOTHours = 0;
        console.log(`⚠️ ${isPetrofac ? 'Petrofac' : 'Primavera'} format detected but OCR failed to extract hours - defaulting to 40 (standard week)`);
      } else if (isBureauVeritas) {
        // For BV, we can't assume 40 - hours vary by project
        // Keep at 0 and let user manually enter
        console.log("⚠️ Bureau Veritas format detected but no hours extracted - user must enter manually");
      }
    } else {
      console.log("DEBUG: Default condition NOT met - skipping format detection");
    }
    
    // Finalize NH (Non-chargeable) and OT if not set yet
    let nhHours = 0;

    // If we parsed nonChargeableHours in Format 2, use it
    if (typeof nonChargeableHours !== 'undefined' && nonChargeableHours > 0) {
      nhHours = nonChargeableHours;
    } else if (typeof chargeableHours !== 'undefined' && chargeableHours > 0 && totalNormalHours > 0) {
      // Derive NH if chargeableHours was found
      const derived = totalNormalHours - chargeableHours;
      if (derived > 0) nhHours = derived;
    }

    // Last-pass: if OT still zero, try to find explicit OT/Overtime mentions anywhere
    if ((totalOTHours === 0 || totalOTHours === null) && text) {
      const otMatch = text.match(/(?:OT|Overtime|Over\s*Time|OT Hrs|OT Hours?)[:\s]*?(\d+(?:\.\d+)?)/i);
      if (otMatch) {
        totalOTHours = parseFloat(otMatch[1]);
      }
    }

    // Normalize nhHours to a reasonable number
    nhHours = Math.max(0, Math.round((nhHours || 0) * 100) / 100);

    // Rescue heuristics: if OCR produced an implausible large total (e.g., 77) try to recover 40
    if (totalNormalHours > 50 && totalNormalHours <= 80) {
      console.log(`⚠️ Large total detected (${totalNormalHours}) - running rescue heuristics for likely 40h week`);

      // 1) Look for a line with 5+ small daily numbers (0-16) whose sum is close to 40
      let recovered = false;
      for (let i = Math.max(0, lines.length - 20); i < lines.length; i++) {
        const nums = [...lines[i].matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        const smallDaily = nums.filter(n => n >= 0 && n <= 16);
        if (smallDaily.length >= 5) {
          const s = smallDaily.reduce((a, b) => a + b, 0);
          console.log(`  - Line ${i + 1} daily-sum candidate = ${s} (nums: ${JSON.stringify(smallDaily)})`);
          if (s >= 35 && s <= 45) {
            totalNormalHours = Math.round(s);
            totalOTHours = 0;
            recovered = true;
            console.log(`  ✅ Recovered totalNormalHours=${totalNormalHours} from line ${i + 1}`);
            break;
          }
        }
      }

      // 2) If not recovered, count isolated '8' occurrences across the text (5 eights -> 40)
      if (!recovered) {
        const allNumbers = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        const eights = allNumbers.filter(n => Math.round(n) === 8).length;
        console.log(`  - Found ${eights} occurrences of 8 across document`);
        if (eights >= 5) {
          totalNormalHours = 40;
          totalOTHours = 0;
          recovered = true;
          console.log(`  ✅ Forced totalNormalHours=40 due to ${eights} eights`);
        }
      }

      // 3) If still not recovered, try summing the last row of small numbers across the bottom (last 12 lines)
      if (!recovered) {
        const lookBack = Math.min(12, lines.length);
        const bottomNumbers = [];
        for (let i = lines.length - lookBack; i < lines.length; i++) {
          const nums = [...lines[i].matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
          bottomNumbers.push(...nums.filter(n => n >= 0 && n <= 16));
        }
        if (bottomNumbers.length >= 5) {
          const s = bottomNumbers.slice(-5).reduce((a, b) => a + b, 0);
          console.log(`  - Bottom numbers candidate sum (last 5) = ${s} (values: ${JSON.stringify(bottomNumbers.slice(-8))})`);
          if (s >= 35 && s <= 45) {
            totalNormalHours = Math.round(s);
            totalOTHours = 0;
            recovered = true;
            console.log(`  ✅ Recovered totalNormalHours=${totalNormalHours} from bottom numbers`);
          }
        }
      }

      if (!recovered) console.log('  ❌ Rescue heuristics did not find a 40h pattern');
    }

    // LOW-TOTAL RESCUE: first-page OCR often captures a daily value (e.g., 8) instead of weekly total.
    if (totalNormalHours > 0 && totalNormalHours <= 12 && totalOTHours === 0) {
      console.log(`⚠️ Low total detected (${totalNormalHours}) - checking for weekly-hour patterns`);

      let lineBasedCandidate = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const letterCount = (line.match(/[A-Za-z]/g) || []).length;

        // Skip verbose text lines; we only want table-like rows.
        if (letterCount > 20) continue;

        const dailyNumbers = [...line.matchAll(/(\d+(?:\.\d+)?)/g)]
          .map((m) => parseFloat(m[1]))
          .filter((n) => n >= 0 && n <= 16);

        if (dailyNumbers.length >= 5) {
          const sum = Math.round(dailyNumbers.reduce((a, b) => a + b, 0));
          if (sum >= 20 && sum <= 80) {
            lineBasedCandidate = Math.max(lineBasedCandidate, sum);
            console.log(`  - Weekly candidate from line ${i + 1}: ${sum} (nums: ${JSON.stringify(dailyNumbers)})`);
          }
        }
      }

      // If we found a stronger weekly candidate than the low extracted total, use it.
      if (lineBasedCandidate > totalNormalHours) {
        console.log(`  ✅ Low-total correction: ${totalNormalHours} → ${lineBasedCandidate}`);
        totalNormalHours = lineBasedCandidate;
      } else {
        // Last fallback for common "8 vs 40" OCR issue in weekly sheets.
        const hasWeeklyContext = /total\s+regular|total\s+hours|normal\s+hrs/i.test(text);
        const hasForty = /\b40(?:\.0+)?\b/.test(text);
        const eightCount = (text.match(/\b8(?:\.0+)?\b/g) || []).length;

        if (hasWeeklyContext && (hasForty || eightCount >= 5)) {
          console.log(`  ✅ Context-based correction: ${totalNormalHours} → 40 (hasForty=${hasForty}, eightCount=${eightCount})`);
          totalNormalHours = 40;
        }
      }
    }

    // SANITY CHECK: Cap hours at reasonable values
    if (totalNormalHours > 80) {
      console.log(`⚠️ WARNING: Normal hours too high (${totalNormalHours}) - capping at 40`);
      totalNormalHours = 40;
    }
    if (totalOTHours > 40) {
      console.log(`⚠️ WARNING: OT hours too high (${totalOTHours}) - capping at 0`);
      totalOTHours = 0;
    }
    
    console.log(`FINAL HOURS AFTER SANITY CHECK: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    
    // Return single entry with totals
    const detectedDates = extractAllDatesFromText(text);
    const explicitWeekRange = extractWeekRangeFromText(text);
    const detectedDate =
      extractPrimaryWorkDateFromText(text) ||
      detectedDates[0] ||
      extractDateFromText(text) ||
      new Date().toISOString().split('T')[0];
    const fallbackWeek = getWeekRangeFromDate(detectedDate);
    const entry = {
      date: normalizeDateValue(detectedDate) || new Date().toISOString().split('T')[0],
      weekStart: explicitWeekRange.weekStart || detectedDates[0] || fallbackWeek.weekStart,
      weekEnd: explicitWeekRange.weekEnd || detectedDates[detectedDates.length - 1] || fallbackWeek.weekEnd,
      sourcePage: Number(options.pageIndex || 1),
      staffName: staffName || "Unknown",
      poSoNo: poSoNumber || "",
      normalHours: totalNormalHours,
      otHours: totalOTHours,
      nhHours: nhHours,
      totalHours: totalNormalHours + totalOTHours + nhHours,
    };
    
    return {
      staffName: staffName || "Unknown",
      poSoNo: poSoNumber || "",
      entries: [entry], // Return single entry with totals
      rawText: text,
      needsManualReview: totalNormalHours === 0 && totalOTHours === 0
    };
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file) => {
    // Check file type - accept images and PDFs
    const validTypes = [
      "image/jpeg", "image/png", "image/jpg", "image/bmp", 
      "image/tiff", "image/webp", "application/pdf"
    ];
    if (!validTypes.includes(file.type)) {
      alert("Please upload an image file (JPG, PNG, BMP, TIFF, WebP) or PDF");
      return;
    }

    // Check file size (max 20MB for better support)
    if (file.size > 20 * 1024 * 1024) {
      alert("File size too large. Please upload a file under 20MB.");
      return;
    }

    setSelectedFile(file);
    setExtractedData(null); // Reset extracted data
    
    // Show preview for images, placeholder for PDFs
    if (file.type === "application/pdf") {
      setPreviewUrl(null);
    } else {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
    
    setShowUploadModal(true);
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Process the uploaded file
  const handleProcessFile = async () => {
    if (!selectedFile) return;

    // Step 1: OCR scan and populate editable fields.
    if (!extractedData) {
      await extractTimesheetData(selectedFile);
      return;
    }

    // Step 2: Save user-adjusted data.
    if (editableData && editableData.entries && editableData.entries.length > 0) {
      await saveTimesheetData(editableData);
    } else {
      alert("No extracted entries to save. Please scan the document first.");
    }
  };

  // Save timesheet data to database
  const saveTimesheetData = async (data) => {
    try {
      const normalized = createEditableData(data);

      const res = await fetch("/api/timesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...normalized,
          uploadedBy: user?.email,
          uploadedAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        alert("Timesheet saved successfully!");
        fetchTimesheets();
        closeModal();
      } else {
        alert("Failed to save timesheet");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save timesheet");
    }
  };

  // Close modal and reset
  const closeModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setEditableData(null);
    setOcrProgress(0);
  };

  // Delete timesheet
  const handleDelete = async (id) => {
    if (!confirm("Delete this timesheet record?")) return;

    try {
      const res = await fetch(`/api/timesheet?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Deleted");
        fetchTimesheets();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Group timesheets by saved document so each upload appears as one line.
  const groupedTimesheets = (() => {
    const byDocument = new Map();

    timesheets.forEach((ts) => {
      const docId = ts.parentId || ts.id;
      if (!byDocument.has(docId)) {
        byDocument.set(docId, {
          id: docId,
          staffName: ts.staffName || "Unknown",
          poSoNo: ts.poSoNo || "",
          uploadedAt: ts.uploadedAt || "",
          entries: [],
        });
      }

      const doc = byDocument.get(docId);
      doc.entries.push(ts);

      // Keep latest non-empty metadata.
      if ((!doc.staffName || doc.staffName === "Unknown") && ts.staffName) doc.staffName = ts.staffName;
      if (!doc.poSoNo && ts.poSoNo) doc.poSoNo = ts.poSoNo;
      if (!doc.uploadedAt && ts.uploadedAt) doc.uploadedAt = ts.uploadedAt;
    });

    return Array.from(byDocument.values())
      .map((doc) => {
        const entryDates = doc.entries
          .map((e) => normalizeDateValue(e.date))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        const firstDate = entryDates[0] || "";
        const lastDate = entryDates[entryDates.length - 1] || "";

        const weekMap = new Map();
        doc.entries.forEach((entry) => {
          const weekStart = normalizeDateValue(entry.weekStart) || getWeekRangeFromDate(entry.date).weekStart;
          const weekEnd = normalizeDateValue(entry.weekEnd) || getWeekRangeFromDate(entry.date).weekEnd;
          const sourcePage = Number(entry.sourcePage || 1);
          const weekKey = `${sourcePage}__${weekStart}__${weekEnd}`;
          if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, {
              sourcePage,
              weekStart,
              weekEnd,
              label: `Page ${sourcePage}: ${formatDateDisplay(weekStart)} - ${formatDateDisplay(weekEnd)}`,
              normalHours: 0,
              otHours: 0,
              nhHours: 0,
              totalHours: 0,
            });
          }

          const wk = weekMap.get(weekKey);
          wk.normalHours += toNumberOrZero(entry.normalHours);
          wk.otHours += toNumberOrZero(entry.otHours);
          wk.nhHours += toNumberOrZero(entry.nhHours);
          wk.totalHours += toNumberOrZero(entry.totalHours) ||
            toNumberOrZero(entry.normalHours) + toNumberOrZero(entry.otHours) + toNumberOrZero(entry.nhHours);
        });

        const weeks = Array.from(weekMap.values()).sort((a, b) => {
          if (a.sourcePage !== b.sourcePage) return a.sourcePage - b.sourcePage;
          return (a.weekStart || "9999-99-99").localeCompare(b.weekStart || "9999-99-99");
        });

        const normalHours = weeks.reduce((sum, w) => sum + toNumberOrZero(w.normalHours), 0);
        const otHours = weeks.reduce((sum, w) => sum + toNumberOrZero(w.otHours), 0);
        const nhHours = weeks.reduce((sum, w) => sum + toNumberOrZero(w.nhHours), 0);
        const totalHours = weeks.reduce((sum, w) => sum + toNumberOrZero(w.totalHours), 0);

        return {
          id: doc.id,
          staffName: doc.staffName,
          poSoNo: doc.poSoNo,
          dateLabel: firstDate && lastDate
            ? (firstDate === lastDate ? formatDateDisplay(firstDate) : `${formatDateDisplay(firstDate)} - ${formatDateDisplay(lastDate)}`)
            : "N/A",
          weeks,
          normalHours,
          otHours,
          nhHours,
          totalHours,
          uploadedAt: doc.uploadedAt,
        };
      })
      .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  })();

  // Filter grouped rows.
  const filteredTimesheets = groupedTimesheets.filter((ts) => {
    const matchPoSo = !filterPoSo || String(ts.poSoNo || "").toLowerCase().includes(filterPoSo.toLowerCase());
    const matchStaff = !filterStaff || String(ts.staffName || "").toLowerCase().includes(filterStaff.toLowerCase());
    return matchPoSo && matchStaff;
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Timesheet Management</h1>
        <p className="text-slate-600">Upload and scan timesheet documents to extract hours, OT, and NH data</p>
      </div>

      {/* Upload Area */}
      <div
        className="mb-6 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-white hover:border-[#0e2b57] transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById("fileInput").click()}
      >
        <div className="text-6xl mb-4">📄</div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Timesheet Document</h3>
        <p className="text-sm text-slate-600 mb-4">
          Drag and drop your timesheet image or PDF here, or click to browse
        </p>
        <p className="text-xs text-slate-500">Supports: JPG, PNG, BMP, TIFF, WebP, PDF (max 20MB)</p>
        <input
          id="fileInput"
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Filter by PO/SO..."
          value={filterPoSo}
          onChange={(e) => setFilterPoSo(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]"
        />
        <input
          type="text"
          placeholder="Filter by Staff Name..."
          value={filterStaff}
          onChange={(e) => setFilterStaff(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e2b57]"
        />
        <button
          onClick={() => { setFilterPoSo(""); setFilterStaff(""); }}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
        >
          Clear Filters
        </button>
      </div>

      {/* Timesheets Table */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#0e2b57] to-[#1a3d6f] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Staff Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">PO/SO No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Weeks</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Normal Hours</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">OT Hours</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total Hours</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Loading timesheets...
                  </td>
                </tr>
              ) : filteredTimesheets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    No timesheet records found. Upload a document to get started.
                  </td>
                </tr>
              ) : (
                filteredTimesheets.map((ts) => (
                  <tr key={ts.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.dateLabel || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.staffName || "Unknown"}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.poSoNo || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.weeks.length}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{ts.normalHours || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{ts.otHours || 0}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {ts.totalHours || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <details className="inline-block text-left mr-3">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Weeks Details
                        </summary>
                        <div className="mt-2 p-3 bg-white border border-slate-200 rounded shadow-sm min-w-72 max-w-96">
                          <div className="text-xs font-semibold text-slate-700 mb-2">Scanned Weeks</div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {ts.weeks.map((wk, i) => (
                              <div key={`${ts.id}_wk_${i}`} className="text-xs border border-slate-100 rounded px-2 py-1 bg-slate-50">
                                <div className="font-medium text-slate-800">{wk.label}</div>
                                <div className="text-slate-600">Normal {wk.normalHours}h | OT {wk.otHours}h | NH {wk.nhHours}h | Total {wk.totalHours}h</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                      <button
                        onClick={() => handleDelete(ts.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Process Timesheet</h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* Preview */}
              {selectedFile && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Document Preview</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-w-full h-auto max-h-96 mx-auto"
                      />
                    ) : selectedFile.type === "application/pdf" ? (
                      <div className="flex flex-col items-center justify-center py-16 bg-slate-50">
                        <div className="text-6xl mb-4">📄</div>
                        <p className="text-lg font-semibold text-slate-900">{selectedFile.name}</p>
                        <p className="text-sm text-slate-600 mt-2">PDF - Text will be extracted</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* OCR Progress */}
              {processing && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Scanning document...</span>
                    <span className="text-sm font-semibold text-[#0e2b57]">{ocrProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#0e2b57] to-[#7aa4cf] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Extracted Data */}
              {extractedData && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Extracted Data</h3>
                  
                  {/* Show raw OCR text for debugging */}
                  {extractedData.rawText && (
                    <details className="mb-4">
                      <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                        Click to view raw OCR text (for debugging)
                      </summary>
                      <pre className="mt-2 p-3 bg-white rounded border border-slate-300 text-xs overflow-x-auto max-h-48">
                        {extractedData.rawText}
                      </pre>
                    </details>
                  )}
                  
                  {extractedData.needsManualReview ? (
                    <div className="text-sm text-amber-600 mb-3 p-3 bg-amber-50 rounded border border-amber-200">
                      ⚠ Automatic extraction incomplete. Please review and edit the data below.
                    </div>
                  ) : null}
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Staff Name</label>
                        <input
                          type="text"
                          value={editableData?.staffName || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditableData((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                staffName: value,
                                entries: prev.entries.map((entry) => ({ ...entry, staffName: value })),
                              };
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0e2b57]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">PO/SO Number</label>
                        <input
                          type="text"
                          value={editableData?.poSoNo || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditableData((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                poSoNo: value,
                                entries: prev.entries.map((entry) => ({ ...entry, poSoNo: value })),
                              };
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0e2b57]"
                        />
                      </div>
                    </div>

                    {editableData?.entries && editableData.entries.length > 0 ? (
                      <div className="mt-4">
                        <div className="font-medium text-slate-700 mb-2">
                          Entries Found: {editableData.entries.length}
                        </div>
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {groupEntriesByWeek(editableData.entries).map((group) => (
                            <div key={group.key} className="space-y-2">
                              <div className="text-xs font-semibold text-[#0e2b57] bg-blue-50 border border-blue-100 rounded px-2 py-1">
                                Week: {group.label}
                              </div>
                              {group.rows.map(({ index: idx, entry }) => (
                            <div key={idx} className="p-3 bg-white rounded border border-slate-200">
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                                <div>
                                  <label className="block text-slate-600 mb-1">Date</label>
                                  <MondayDateInput
                                    value={entry.date || ""}
                                    onChange={(value) => {
                                      setEditableData((prev) => {
                                        if (!prev) return prev;
                                        const entries = [...prev.entries];
                                        const weekRange = getWeekRangeFromDate(value);
                                        entries[idx] = {
                                          ...entries[idx],
                                          date: value,
                                          weekStart: weekRange.weekStart,
                                          weekEnd: weekRange.weekEnd,
                                        };
                                        return { ...prev, entries };
                                      });
                                    }}
                                    className="w-full px-2 py-1 border border-slate-300 rounded"
                                  />
                                  <div className="mt-1 text-[11px] text-slate-500">{formatDateDisplay(entry.date)}</div>
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">Normal Hours</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={entry.normalHours ?? 0}
                                    onChange={(e) => {
                                      const normalHours = Math.max(0, toNumberOrZero(e.target.value));
                                      setEditableData((prev) => {
                                        if (!prev) return prev;
                                        const entries = [...prev.entries];
                                        const current = entries[idx];
                                        const totalHours = normalHours + toNumberOrZero(current.otHours) + toNumberOrZero(current.nhHours);
                                        entries[idx] = { ...current, normalHours, totalHours };
                                        return { ...prev, entries };
                                      });
                                    }}
                                    className="w-full px-2 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">OT Hours</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={entry.otHours ?? 0}
                                    onChange={(e) => {
                                      const otHours = Math.max(0, toNumberOrZero(e.target.value));
                                      setEditableData((prev) => {
                                        if (!prev) return prev;
                                        const entries = [...prev.entries];
                                        const current = entries[idx];
                                        const totalHours = toNumberOrZero(current.normalHours) + otHours + toNumberOrZero(current.nhHours);
                                        entries[idx] = { ...current, otHours, totalHours };
                                        return { ...prev, entries };
                                      });
                                    }}
                                    className="w-full px-2 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">NH Hours</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={entry.nhHours ?? 0}
                                    onChange={(e) => {
                                      const nhHours = Math.max(0, toNumberOrZero(e.target.value));
                                      setEditableData((prev) => {
                                        if (!prev) return prev;
                                        const entries = [...prev.entries];
                                        const current = entries[idx];
                                        const totalHours = toNumberOrZero(current.normalHours) + toNumberOrZero(current.otHours) + nhHours;
                                        entries[idx] = { ...current, nhHours, totalHours };
                                        return { ...prev, entries };
                                      });
                                    }}
                                    className="w-full px-2 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">Total Hours</label>
                                  <div className="px-2 py-1 border border-slate-200 rounded bg-slate-50 text-slate-800 font-semibold">
                                    {(toNumberOrZero(entry.normalHours) + toNumberOrZero(entry.otHours) + toNumberOrZero(entry.nhHours)).toFixed(1)}h
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 text-amber-600 text-sm">
                        No entries found in the document. Please check if the document is clear and contains timesheet data.
                      </div>
                    )}
                    
                    {/* Show raw text for debugging */}
                    {extractedData.rawText && (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">
                          View Raw Extracted Text (Debug)
                        </summary>
                        <div className="mt-2 p-3 bg-white rounded border border-slate-200 text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {extractedData.rawText}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleProcessFile}
                  disabled={processing || !selectedFile}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#0e2b57] to-[#1a3d6f] text-white rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? "Processing..." : extractedData ? "Save Adjusted Data" : "Scan Document"}
                </button>
                <button
                  onClick={closeModal}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }

