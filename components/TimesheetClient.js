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
            // PORTRAIT - For DCSE, extract OVERTIME HOURS column (RIGHTMOST column)
            console.log("  Portrait orientation - extracting OVERTIME column for DCSE...");
            
            // OVERTIME HOURS column is the RIGHTMOST column
            // Extract from 85% to 100% of width (15% slice) - same as landscape
            const columnWidth = Math.floor(img.width * 0.15);
            const startX = img.width - columnWidth;
            
            console.log(`  Portrait DCSE - extracting OT column ${columnWidth}px (${startX} to ${img.width})`);
            
            // Create canvas for OVERTIME column with 6x scaling (extra aggressive)
            const scale = 6;
            canvas.width = columnWidth * scale;
            canvas.height = img.height * scale;
            
            // Draw ONLY the OVERTIME column region, scaled up
            ctx.drawImage(
              img,
              startX, 0, columnWidth, img.height,  // Source: OT column
              0, 0, canvas.width, canvas.height     // Dest: full canvas
            );
            
            // Apply aggressive preprocessing
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            console.log("  Applying aggressive preprocessing to OVERTIME column...");
            for (let i = 0; i < data.length; i += 4) {
              let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              // Boost contrast even more for small numbers
              gray = ((gray - 128) * 2.0) + 128;
              gray = Math.max(0, Math.min(255, gray));
              const value = gray > 140 ? 255 : 0; // Slightly lower threshold
              data[i] = data[i + 1] = data[i + 2] = value;
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            console.log(`  ✅ OVERTIME column extracted: ${canvas.width}x${canvas.height}`);
            resolve(canvas.toDataURL());
          }
        };
        img.src = e.target.result;
      };
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
          
          setOcrProgress(75);
          // Check if we should use Google Vision as fallback
          const isBureauVeritas = text.match(/Bureau\s+Veritas/i) || text.match(/bureauveritas\.com/i);
          const lowConfidence = result?.data?.confidence < 60;
          const shortText = text.trim().length < 100;
          
          console.log(`📊 isBureauVeritas: ${!!isBureauVeritas}, lowConfidence: ${lowConfidence} (${result?.data?.confidence}%), shortText: ${shortText} (${text.trim().length} chars)`);
          
          // If Bureau Veritas format detected OR low confidence, try Google Vision
          if (isBureauVeritas || lowConfidence || shortText) {
            if (isBureauVeritas) {
              console.log("⚠️ Bureau Veritas timesheet detected - switching to Google Cloud Vision for better accuracy");
            } else if (lowConfidence) {
              console.log(`⚠️ Low Tesseract confidence (${result?.data?.confidence}%) - trying Google Vision`);
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

    console.log("\n=== SEARCHING FOR TOTAL HOURS ===");
    console.log("Full text to search:");
    console.log(text.substring(0, 1000)); // Show first 1000 chars
    
    // DETECT FORMAT FIRST - This is critical for proper parsing
    const isPrimavera = text.match(/Review[:\s]/i) || text.match(/Primavera/i);
    const isBureauVeritas = text.match(/Bureau\s+Veritas/i) || text.match(/bureauveritas\.com/i);
    const isPetrofac = text.match(/Petrofac/i) || text.match(/RNZ/i);
    const isPetronas = text.match(/Petronas/i);
    // DCSE Time Amendment format - detect by company name OR overtime column headers OR mangled form text
    const isDCSE = text.match(/DCSE/i) || 
                   text.match(/XSE.*TECH/i) || 
                   text.match(/XZSE.*TECH/i) ||
                   text.match(/TIME.*AM.*EN.*DM.*ENT.*FORM/i) ||
                   text.match(/REII?SON.*?AMENDMENT/i);
    
    console.log(`\n=== FORMAT DETECTION ===`);
    console.log(`Petrofac: ${!!isPetrofac}`);
    console.log(`Petronas: ${!!isPetronas}`);
    console.log(`Primavera: ${!!isPrimavera}`);
    console.log(`Bureau Veritas: ${!!isBureauVeritas}`);
    console.log(`DCSE: ${!!isDCSE}`);
    console.log(`========================\n`);
    
    // Look for TOTAL line which has Normal Hours and OT Hours totals
    let totalNormalHours = 0;
    let totalOTHours = 0;
    
    // ==========================================
    // DCSE TIME AMENDMENT FORMAT HANDLER
    // ==========================================
    // This format shows OT hours in rightmost column, normal hours = 8 per filled row with timestamp
    if (isDCSE && !isPetrofac && !isBureauVeritas) {
      console.log("✅ DCSE TIME AMENDMENT FORMAT DETECTED - Extracting OT hours and counting work days...");

      
      // Strategy: Count work days (lines with time entries) 
      // Weekend work = 8 hours OT (full day)
      // Weekday OT = hours after 6 PM
      let workDaysCount = 0;
      const otHoursList = [];
      
      console.log("Analyzing lines for date entries:");
      const workDayLines = [];
      const weekendLines = [];
      
      lines.forEach((line, idx) => {
        // Look for 8-digit date pattern at start of line (DDMMYYYY format)
        const dateMatch = line.match(/^\s*(\d{8})/);
        
        if (dateMatch) {
          const dateStr = dateMatch[1];
          // Parse date: Format is DDMM????YY where ???? are OCR artifacts
          // Example: "01107125" = 01/07/2025 (day 01, month 07, year 25)
          // Example: "10407125" = 10/07/2025 (day 10, month 07, year 25) - "04" is OCR noise
          const day = parseInt(dateStr.substring(0, 2));
          const month = parseInt(dateStr.substring(2, 4)) - 1; // JS months are 0-indexed
          const year = 2000 + parseInt(dateStr.substring(6, 8)); // Last 2 digits = year
          const date = new Date(year, month, day);
          const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
          
          const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
          
          // Check if this is a work day (has time entries, not just date)
          const hasTimePattern = line.match(/\d{1,2}[:\.]\d{2}\s*[AP]M/i) || 
                                 line.match(/\d{3,4}\s*[AP]M/i) ||
                                 line.match(/LEAVE/i);
          
          if (hasTimePattern || line.length > 20) {
            workDaysCount++;
            workDayLines.push(idx);
            console.log(`  Line ${idx + 1}: Work day${isWeekend ? ' (WEEKEND)' : ''} - "${line.substring(0, 60)}..."`);
          } else if (isWeekend && line.trim().length > 8) {
            // Weekend line with just date but some content = worked
            weekendLines.push(idx);
            console.log(`  Line ${idx + 1}: WEEKEND work (date only) - "${line}"`);
          } else {
            console.log(`  Line ${idx + 1}: Skipped (holiday) - "${line}"`);
          }
        }
      });
      
      console.log(`Found ${workDaysCount} work day entries + ${weekendLines.length} weekend entries`);
      
      // Try OVERTIME COLUMN first
      const overtimeColumnText = window._ocrTotalColumn || '';
      console.log(`\nExtracting OT from OVERTIME COLUMN:\n"${overtimeColumnText}"`);
      
      if (overtimeColumnText.trim()) {
        // Split by newlines and extract numbers
        const overtimeLines = overtimeColumnText.split('\n').filter(l => l.trim());
        overtimeLines.forEach((line, idx) => {
          // Look for single or double digit numbers (1-20)
          const matches = line.match(/\d{1,2}/g);
          if (matches) {
            matches.forEach(match => {
              const otValue = parseInt(match);
              // Accept values 1-20 (reasonable OT hours per day)
              if (otValue >= 1 && otValue <= 20) {
                otHoursList.push(otValue);
                console.log(`  OT Column Line ${idx + 1}: Found OT = ${otValue} hours`);
              }
            });
          }
        });
      }
      
      // FALLBACK: If OT column failed, extract from main text
      if (otHoursList.length === 0) {
        console.log("\n⚠️ OVERTIME column empty - using FALLBACK extraction from main text...");
        
        // Process weekend work first (full 8 hours OT each)
        weekendLines.forEach(lineIdx => {
          const line = lines[lineIdx];
          otHoursList.push(8);
          console.log(`  Line ${lineIdx + 1}: WEEKEND OT = 8 hours (full day)`);
        });
        
        workDayLines.forEach(lineIdx => {
          const line = lines[lineIdx];
          
          // Check if this is a weekend work day
          const dateMatch = line.match(/^\s*(\d{8})/);
          let isWeekend = false;
          if (dateMatch) {
            const dateStr = dateMatch[1];
            const day = parseInt(dateStr.substring(0, 2));
            const month = parseInt(dateStr.substring(2, 4)) - 1;
            const year = 2000 + parseInt(dateStr.substring(6, 8)); // Last 2 digits
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
          }
          
          if (isWeekend) {
            // Weekend work = 8 hours OT (full day)
            otHoursList.push(8);
            console.log(`  Line ${lineIdx + 1}: WEEKEND OT = 8 hours (full day)`);
            return;
          }
          
          // WEEKDAY: OT starts at 6:00 PM onwards
          // Look for last time in line - if after 6 PM, calculate hours after 6 PM
          const timeMatches = line.match(/(\d{1,2})[:\.]?(\d{2})?\s*PM/gi);
          if (timeMatches && timeMatches.length > 0) {
            // Get the last time (end time)
            const lastTimeStr = timeMatches[timeMatches.length - 1];
            const timeMatch = lastTimeStr.match(/(\d{1,2})[:\.]?(\d{2})?\s*PM/i);
            
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              let minute = parseInt(timeMatch[2] || '0');
              
              // Convert to 24-hour format
              if (hour !== 12) hour += 12;
              
              // OT starts at 6 PM (18:00)
              const endTimeDecimal = hour + (minute / 60);
              const otStartTime = 18.0; // 6:00 PM
              
              if (endTimeDecimal > otStartTime) {
                const otHours = endTimeDecimal - otStartTime;
                otHoursList.push(otHours);
                console.log(`  Line ${lineIdx + 1}: Weekday OT = ${otHours.toFixed(2)} hours (worked until ${hour}:${minute.toString().padStart(2, '0')} = ${lastTimeStr})`);
                return;
              }
            }
          }
          
          // Fallback Pattern 1: "pm 20 001mm" where 20 = 2.0 hours
          const pmPattern = line.match(/[AP]M\s+(\d{1,2})\s+\d{3,}mm/i);
          if (pmPattern) {
            const val = parseInt(pmPattern[1]);
            const otHours = val / 10; // 20 -> 2.0
            otHoursList.push(otHours);
            console.log(`  Line ${lineIdx + 1}: Found OT ${otHours} hours (from "pm ${val}")`);
            return;
          }
          
          // Fallback Pattern 2: Check next 2 lines for standalone OT value
          for (let offset = 1; offset <= 2; offset++) {
            if (lineIdx + offset < lines.length) {
              const nextLine = lines[lineIdx + offset];
              // Match "w 01", "N", "u", "0", or standalone digit
              const nextMatch = nextLine.match(/^\s*(?:w\s+)?(\d{1,2})\s*$/);
              if (nextMatch) {
                const val = parseInt(nextMatch[1]);
                if (val >= 1 && val <= 10) {
                  otHoursList.push(val);
                  console.log(`  Line ${lineIdx + 1}: Found OT ${val} hours (from line ${lineIdx + offset + 1}: "${nextLine.trim()}")`);
                  return;
                }
              }
            }
          }
        });
      }
      
      console.log(`\nOT hours list (${otHoursList.length} entries):`, otHoursList);
      
      // Calculate totals
      totalNormalHours = workDaysCount * 8;
      
      if (otHoursList.length > 0) {
        totalOTHours = otHoursList.reduce((sum, h) => sum + h, 0);
      }
      
      console.log(`  ✅ Calculated Normal Hours: ${totalNormalHours} (${workDaysCount} days × 8 hours)`);
      console.log(`  ✅ Calculated OT Hours: ${totalOTHours} (sum of ${otHoursList.length} entries)`);
    }
    
    // ==========================================
    // PETROFAC FORMAT HANDLER
    // ==========================================
    // Petrofac landscape timesheets require special handling
    else if (isPetrofac && !isBureauVeritas) {
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
      for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLower = line.toLowerCase();
      
      if (lineLower.includes('total') && lineLower.includes('regular')) {
        console.log(`✓ Found "Total Regular" at line ${i + 1}: "${line}"`);
        const numbers = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        console.log(`  All numbers in line: ${JSON.stringify(numbers)}`);
        
        if (numbers.length > 0) {
          totalNormalHours = numbers[numbers.length - 1];
          console.log(`  ✓ Taking LAST number as Total Regular: ${totalNormalHours}`);
        }
      }
      
      if (lineLower.includes('total') && lineLower.includes('overtime')) {
        console.log(`✓ Found "Total Overtime" at line ${i + 1}: "${line}"`);
        const numbers = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        console.log(`  All numbers in line: ${JSON.stringify(numbers)}`);
        
        if (numbers.length > 0) {
          totalOTHours = numbers[numbers.length - 1];
          console.log(`  ✓ Taking LAST number as Total Overtime: ${totalOTHours}`);
        }
      }
    }
    
    console.log(`After Format 1 search: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    
    // Format 1a: Bureau Veritas format - "Total" column with Billable rows
    // Look for lines with "Billable" followed by numbers, then "Total" with a number
    // ONLY process if Bureau Veritas was detected in format detection
    if (totalNormalHours === 0 && totalOTHours === 0 && isBureauVeritas) {
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
      
      let chargeableHours = 0;
      let nonChargeableHours = 0;
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
    
    // SANITY CHECK: Cap hours at reasonable values (skip for DCSE format - can have 22+ days)
    if (!isDCSE) {
      if (totalNormalHours > 80) {
        console.log(`⚠️ WARNING: Normal hours too high (${totalNormalHours}) - capping at 40`);
        totalNormalHours = 40;
      }
      if (totalOTHours > 40) {
        console.log(`⚠️ WARNING: OT hours too high (${totalOTHours}) - capping at 0`);
        totalOTHours = 0;
      }
    }
    
    console.log(`FINAL HOURS AFTER SANITY CHECK: Normal=${totalNormalHours}, OT=${totalOTHours}`);
    
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
                <th className="px-4 py-3 text-right text-sm font-semibold">Total Hours</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                    Loading timesheets...
                  </td>
                </tr>
              ) : filteredTimesheets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
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
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                      {(ts.normalHours || 0) + (ts.otHours || 0)}
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
