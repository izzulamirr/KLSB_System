import { NextResponse } from "next/server";

// POST - Extract text from PDF using pdfjs-dist (server-side only)
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get file data
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log(`Processing PDF: ${file.name}, size: ${uint8Array.length} bytes`);

    // Use pdfjs-dist for server-side PDF parsing. Attempt several import paths and validate the
    // loaded module before using it. This improves compatibility across pdfjs-dist package layouts.
    let pdfjsLib = null;
    const tryPaths = [
      'pdfjs-dist/legacy/build/pdf.mjs',
      'pdfjs-dist/legacy/build/pdf.js',
      'pdfjs-dist/legacy/build/pdf',
      'pdfjs-dist/es5/build/pdf.js',
      'pdfjs-dist',
    ];

    for (const p of tryPaths) {
      try {
        const mod = await import(p);
        pdfjsLib = mod && (mod.default || mod);
        if (pdfjsLib) break;
      } catch (err) {
        // continue trying other paths
      }
    }

    if (!pdfjsLib || typeof pdfjsLib.getDocument !== 'function') {
      console.error('pdfjs-dist import failed or getDocument not available. Module:', !!pdfjsLib);
      return NextResponse.json({ error: 'pdfjs-dist not available on server. Please install pdfjs-dist.' }, { status: 500 });
    }

    // Some builds expose GlobalWorkerOptions; if it's present and an object, disable workers for Node.
    try {
      if (pdfjsLib.GlobalWorkerOptions && typeof pdfjsLib.GlobalWorkerOptions === 'object') {
        pdfjsLib.GlobalWorkerOptions.disableWorker = true;
      }
    } catch (err) {
      // ignore if cannot set global worker options
      console.warn('Could not set GlobalWorkerOptions.disableWorker', err && err.message ? err.message : err);
    }

    // Load the PDF (use Buffer as well in case pdfjs expects node Buffer)
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array, useSystemFonts: true });
    
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    
    console.log(`PDF loaded: ${numPages} pages`);
    
    let fullText = '';
    
    // Extract text from each page (guard each page extraction so we can report which page fails)
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine text items, defensively handle missing item.str
        const pageText = (textContent && Array.isArray(textContent.items))
          ? textContent.items.map(item => (item && typeof item.str === 'string') ? item.str : '').join(' ')
          : '';

        fullText += pageText + '\n';
      } catch (pageErr) {
        console.error(`Error extracting page ${pageNum}:`, pageErr && pageErr.message ? pageErr.message : pageErr);
        // continue with next pages but note failure in the output
        fullText += `\n[Error extracting page ${pageNum}: ${pageErr && pageErr.message ? pageErr.message : String(pageErr)}]\n`;
      }
    }
    
    // Clean up the extracted text
    let cleanText = fullText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
    
    console.log("Extracted PDF text (first 500 chars):", cleanText.substring(0, 500));
    
    return NextResponse.json({
      text: cleanText,
      originalText: fullText,
      numPages: numPages,
      info: { numPages },
    });
  } catch (error) {
    console.error("PDF extraction error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { 
        error: "Failed to extract PDF text", 
        details: error.message,
        type: error.name 
      },
      { status: 500 }
    );
  }
}
