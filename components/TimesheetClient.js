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

  // Extract text from PDF - Currently not supported, ask user to convert to image
  const extractPdfText = async (file) => {
    // PDF processing has compatibility issues with Next.js
    // Ask user to convert PDF to image instead
    throw new Error("PDF files are not currently supported. Please convert your PDF to an image file (PNG or JPG) and upload again. You can use online tools like pdf2png.com or take a screenshot of the PDF.");
  };

  // Preprocess image to improve OCR accuracy
  const preprocessImageForOCR = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas with 2x scale for better OCR
          const canvas = document.createElement('canvas');
          const scaleFactor = 2;
          canvas.width = img.width * scaleFactor;
          canvas.height = img.height * scaleFactor;
          const ctx = canvas.getContext('2d');
          
          // Draw image at higher resolution
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get image data for processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Convert to grayscale and increase contrast
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            // Increase contrast
            const contrast = 1.5;
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            const newGray = factor * (gray - 128) + 128;
            const final = Math.max(0, Math.min(255, newGray));
            
            data[i] = data[i + 1] = data[i + 2] = final;
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/png');
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
    setProcessing(true);
    setOcrProgress(0);
    
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
        
        let worker = null;
        try {
          // Create a worker with simple configuration
          worker = await Tesseract.createWorker('eng');

          setOcrProgress(30);

          // Use the original file without preprocessing - sometimes simpler is better
          const result = await worker.recognize(file, {
            tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
          });
          
          setOcrProgress(90);

          text = result?.data?.text || ""; // Ensure text is never undefined
          
          console.log("=== OCR EXTRACTION COMPLETE ===");
          console.log("OCR Recognition confidence:", result?.data?.confidence);
          console.log("=== FULL EXTRACTED TEXT (START) ===");
          console.log(text);
          console.log("=== FULL EXTRACTED TEXT (END) ===");
          console.log("Text length:", text.length, "characters");
          console.log("Number of lines:", text.split('\n').length);
          
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
  const parseTimesheetText = (text) => {
    // Validate input text
    if (!text || typeof text !== 'string') {
      console.warn("parseTimesheetText received invalid text:", text);
      return [];
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
    const projectPattern = /PROJECT\s+CODE\s*\/\s*NAME[:\s]*([A-Z0-9\s\/\-\.]+?)(?:\n|WEEK|MONTH|LOCATION)/i;
    
    let staffName = "";
    let poSoNumber = "";

    console.log("\n=== SEARCHING FOR EMPLOYEE NAME ===");
    // Extract employee name
    const empMatch = text.match(employeePattern);
    if (empMatch) {
      staffName = empMatch[1].trim().replace(/\s+/g, ' ');
      console.log("✓ Found Employee Name:", staffName);
    } else {
      console.log("✗ Employee name pattern not found");
      // Try alternative: look for lines with BIN/BINTI in first 20 lines
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const line = lines[i].trim();
        if (line.match(/\b(BIN|BINTI)\b/i) && line.split(/\s+/).length >= 3 && line.length > 10) {
          staffName = line.toUpperCase();
          console.log("✓ Found staff name (alternative):", staffName);
          break;
        }
      }
    }

    console.log("\n=== SEARCHING FOR PROJECT CODE ===");
    // Extract Project Code
    const projMatch = text.match(projectPattern);
    if (projMatch) {
      poSoNumber = projMatch[1].trim().replace(/\s+/g, ' ');
      console.log("✓ Found Project Code:", poSoNumber);
    } else {
      console.log("✗ Project code pattern not found");
      // Alternative: Look for "R####" pattern or any alphanumeric code after PROJECT
      const altProjMatch = text.match(/\b(R\d{4}[A-Z0-9\s\/\-\.]*)/i);
      if (altProjMatch) {
        poSoNumber = altProjMatch[1].trim();
        console.log("✓ Found Project Code (alternative):", poSoNumber);
      } else {
        // Try to find any project-like code
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
      }
    }

    console.log("\n=== SEARCHING FOR TOTAL HOURS ===");
    // Look for TOTAL line which has Normal Hours and OT Hours totals
    let totalNormalHours = 0;
    let totalOTHours = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      // Look for line containing "TOTAL" (usually at bottom of timesheet table)
      if (lineLower.includes('total') && !lineLower.includes('overtime')) {
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
          console.log(`✓ Extracted totals - Normal: ${totalNormalHours}, OT: ${totalOTHours}`);
        }
        break;
      }
    }

    console.log("\n=== PARSING COMPLETE ===");
    console.log("Staff Name:", staffName);
    console.log("PO/SO Number:", poSoNumber);
    console.log("Total Normal Hours:", totalNormalHours);
    console.log("Total OT Hours:", totalOTHours);
    console.log("=========================\n");
    
    // Return single entry with totals
    const entry = {
      date: new Date().toISOString().split('T')[0], // Use current date
      staffName: staffName || "Unknown",
      poSoNo: poSoNumber || "",
      normalHours: totalNormalHours,
      otHours: totalOTHours,
      nhHours: 0,
      totalHours: totalNormalHours + totalOTHours,
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
                        <div className="font-medium text-slate-700 mb-2">
                          Entries Found: {extractedData.entries.length}
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {extractedData.entries.map((entry, idx) => (
                            <div key={idx} className="p-3 bg-white rounded border border-slate-200">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="font-medium">Date: {entry.date || "N/A"}</div>
                                <div>Total: {entry.totalHours || 0}h</div>
                                <div>Normal: {entry.normalHours || 0}h</div>
                                <div>OT: {entry.otHours || 0}h</div>
                                <div>NH: {entry.nhHours || 0}h</div>
                                <div>PO/SO: {entry.poSoNo || "N/A"}</div>
                              </div>
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
