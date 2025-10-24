"use client";
import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../firebase";
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
  const [ocrProgress, setOcrProgress] = useState(0);
  const [filterPoSo, setFilterPoSo] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

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

  // Convert PDF to image
  const pdfToImage = async (file) => {
    try {
      // Dynamically import pdfjs-dist only when needed
      const pdfjsLib = await import("pdfjs-dist");
      
      // Configure worker with correct path for Next.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1); // Get first page
      
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      // Convert canvas to blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png");
      });
    } catch (err) {
      console.error("PDF conversion error:", err);
      throw new Error("Failed to convert PDF to image");
    }
  };

  // Extract timesheet data from file using OCR
  const extractTimesheetData = async (file) => {
    setProcessing(true);
    setOcrProgress(0);
    
    try {
      let fileToProcess = file;
      
      // If PDF, convert to image first
      if (file.type === "application/pdf") {
        setOcrProgress(10);
        fileToProcess = await pdfToImage(file);
        setOcrProgress(20);
      }

      // Create a worker for better performance and resource management
      const worker = await Tesseract.createWorker({
        logger: (m) => {
          console.log(m);
        },
      });

      // Load language data
      await worker.loadLanguage("eng");
      await worker.initialize("eng");

      // Set up progress tracking
      let progressInterval = setInterval(() => {
        setOcrProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 5;
        });
      }, 500);

      // Perform OCR on the file directly
      const { data: { text } } = await worker.recognize(fileToProcess);
      
      clearInterval(progressInterval);
      setOcrProgress(100);
      
      console.log("Extracted text:", text);

      // Terminate worker to free resources
      await worker.terminate();

      // Parse the text to extract timesheet information
      const parsed = parseTimesheetText(text);
      setExtractedData(parsed);
      
      return parsed;
    } catch (err) {
      console.error("OCR Error:", err);
      alert(`Failed to extract data from file: ${err.message}. Please ensure the image/PDF is clear and readable.`);
      return null;
    } finally {
      setProcessing(false);
      setOcrProgress(0);
    }
  };

  // Parse extracted text to find timesheet data
  const parseTimesheetText = (text) => {
    const lines = text.split("\n").filter((line) => line.trim());
    const entries = [];

    // Common patterns to look for
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
    const timePattern = /(\d{1,2}:\d{2}|\d{1,2}\.\d{1,2}|\d{1,2})/;
    const poSoPattern = /(PO|SO)[:\-\s]*([A-Z0-9\-]+)/i;
    const namePattern = /^([A-Z][A-Z\s]+(?:BIN|BINTI)[A-Z\s]+)$/i;

    let currentEntry = {};
    let staffName = "";
    let poSoNumber = "";

    // Extract PO/SO from document
    const poSoMatch = text.match(poSoPattern);
    if (poSoMatch) {
      poSoNumber = poSoMatch[2].trim();
    }

    // Look for staff name (usually at the top)
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const nameMatch = lines[i].match(namePattern);
      if (nameMatch) {
        staffName = nameMatch[1].trim();
        break;
      }
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Try to find date
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        if (currentEntry.date) {
          entries.push({ ...currentEntry });
          currentEntry = {};
        }
        currentEntry.date = dateMatch[1];
        currentEntry.staffName = staffName;
        currentEntry.poSoNo = poSoNumber;
      }

      // Look for hours/time entries
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes("hour") || lowerLine.includes("hr")) {
        const timeMatch = line.match(timePattern);
        if (timeMatch) {
          const hours = parseFloat(timeMatch[1].replace(":", "."));
          
          if (lowerLine.includes("normal") || lowerLine.includes("regular")) {
            currentEntry.normalHours = hours;
          } else if (lowerLine.includes("ot") || lowerLine.includes("overtime")) {
            currentEntry.otHours = hours;
          } else if (lowerLine.includes("nh") || lowerLine.includes("night")) {
            currentEntry.nhHours = hours;
          } else {
            currentEntry.totalHours = hours;
          }
        }
      }

      // Look for NH (Night Hours)
      if (lowerLine.includes("nh") || lowerLine.includes("night")) {
        const timeMatch = line.match(timePattern);
        if (timeMatch) {
          currentEntry.nhHours = parseFloat(timeMatch[1].replace(":", "."));
        }
      }

      // Look for OT (Overtime)
      if (lowerLine.includes("ot") || lowerLine.includes("overtime")) {
        const timeMatch = line.match(timePattern);
        if (timeMatch) {
          currentEntry.otHours = parseFloat(timeMatch[1].replace(":", "."));
        }
      }
    }

    if (Object.keys(currentEntry).length > 0) {
      entries.push(currentEntry);
    }

    // If no structured entries found, create a manual entry template
    if (entries.length === 0) {
      return {
        staffName: staffName || "Unknown",
        poSoNo: poSoNumber || "",
        date: new Date().toISOString().split("T")[0],
        normalHours: 0,
        otHours: 0,
        nhHours: 0,
        totalHours: 0,
        rawText: text,
        needsManualReview: true,
      };
    }

    return {
      staffName: staffName || "Unknown",
      poSoNo: poSoNumber || "",
      entries,
      rawText: text,
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
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/bmp", "image/tiff", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload an image file (JPG, PNG, BMP, TIFF) or PDF");
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size too large. Please upload a file under 10MB.");
      return;
    }

    setSelectedFile(file);
    
    // For PDFs, show a placeholder preview
    if (file.type === "application/pdf") {
      setPreviewUrl(null); // We'll show PDF icon instead
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
    
    const data = await extractTimesheetData(selectedFile);
    if (data) {
      // Auto-save if data looks good
      if (data.entries && data.entries.length > 0) {
        await saveTimesheetData(data);
      }
    }
  };

  // Save timesheet data to database
  const saveTimesheetData = async (data) => {
    try {
      const res = await fetch("/api/timesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
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

  // Filter timesheets
  const filteredTimesheets = timesheets.filter((ts) => {
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
        <p className="text-xs text-slate-500">Supports: JPG, PNG, BMP, TIFF, PDF (max 10MB)</p>
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
                <th className="px-4 py-3 text-right text-sm font-semibold">Normal Hours</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">OT Hours</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">NH Hours</th>
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
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.date || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.staffName || "Unknown"}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{ts.poSoNo || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{ts.normalHours || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{ts.otHours || 0}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 text-right">{ts.nhHours || 0}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {(ts.normalHours || 0) + (ts.otHours || 0) + (ts.nhHours || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
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
                        <p className="text-sm text-slate-600 mt-2">PDF - First page will be scanned</p>
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
                  {extractedData.needsManualReview ? (
                    <div className="text-sm text-amber-600 mb-3">
                      ⚠ Automatic extraction incomplete. Please review and edit the data below.
                    </div>
                  ) : null}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-700">Staff Name:</span>
                      <span className="text-slate-900">{extractedData.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-700">PO/SO Number:</span>
                      <span className="text-slate-900">{extractedData.poSoNo || "N/A"}</span>
                    </div>
                    {extractedData.entries && extractedData.entries.length > 0 ? (
                      <div className="mt-4">
                        <div className="font-medium text-slate-700 mb-2">Entries Found:</div>
                        <div className="space-y-2">
                          {extractedData.entries.map((entry, idx) => (
                            <div key={idx} className="p-3 bg-white rounded border border-slate-200">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Date: {entry.date || "N/A"}</div>
                                <div>Normal: {entry.normalHours || 0}h</div>
                                <div>OT: {entry.otHours || 0}h</div>
                                <div>NH: {entry.nhHours || 0}h</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                  {processing ? "Processing..." : extractedData ? "Save to Database" : "Scan Document"}
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
