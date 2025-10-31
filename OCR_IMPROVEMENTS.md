# OCR Scanner Improvements

## Overview
Enhanced the timesheet OCR scanner to accurately read both PDF and image documents with improved text extraction, parsing, and error handling.

## Key Improvements

### 1. **Enhanced Image OCR (Tesseract.js)**
- ✅ Added auto-rotation for misaligned images
- ✅ Improved progress tracking with visual feedback
- ✅ Better resource management with worker termination
- ✅ Support for more image formats (JPG, PNG, BMP, TIFF, WebP)
- ✅ Increased file size limit from 10MB to 20MB

**Technical Details:**
```javascript
const worker = await Tesseract.createWorker("eng", 1, {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js',
});

const { data: { text: ocrText } } = await worker.recognize(file, {
  rotateAuto: true, // Auto-rotate for better accuracy
});
```

### 2. **Enhanced PDF Text Extraction**
- ✅ Improved text cleaning and normalization
- ✅ Better preservation of document structure
- ✅ Server-side processing for reliability
- ✅ Added original text preservation for debugging

**Technical Details:**
```javascript
// Clean up extracted text while preserving structure
let cleanText = data.text
  .replace(/\r\n/g, '\n') // Normalize line endings
  .replace(/\t+/g, '\t') // Normalize tabs
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0) // Remove empty lines
  .join('\n');
```

### 3. **Improved Text Parsing Logic**

#### Better Pattern Recognition:
- ✅ Multiple date formats: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`
- ✅ Enhanced staff name detection with multiple patterns
- ✅ Improved PO/SO number extraction (handles PO-XXX, SO#XXX, etc.)
- ✅ Better hour extraction with multiple formats (8.5, 8:30, 8hrs, etc.)

#### Enhanced Field Detection:
- ✅ Normal Hours (NH, Normal, Regular)
- ✅ Overtime (OT, Overtime, Over Time)
- ✅ Night Hours (NH, Night)
- ✅ Total Hours with auto-calculation

#### Table Structure Support:
- ✅ Detects table-like structures with delimiters (|, \t)
- ✅ Automatically maps columns to fields

**Example Parsing:**
```javascript
// Enhanced patterns
const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
const hourPattern = /(\d+(?:\.\d+)?)\s*(?:hour|hr|h|hrs)/i;
const poSoPattern = /(PO|SO)[:\-\s#]*([A-Z0-9\-\/]+)/i;
const namePattern = /^([A-Z][A-Za-z\s]+(?:BIN|BINTI|B\.)[A-Za-z\s]+)$/i;
```

### 4. **Better User Feedback**

#### Visual Improvements:
- ✅ Real-time OCR progress bar with percentage
- ✅ Enhanced extracted data preview
- ✅ Entry count display
- ✅ Better warning messages for incomplete extraction
- ✅ Debug view with raw extracted text

#### Data Validation:
- ✅ Validates hours are within reasonable range (≤24)
- ✅ Auto-calculates total hours if not provided
- ✅ Flags entries needing manual review
- ✅ Shows number of entries found

### 5. **Debugging Features**

#### Raw Text View:
Users can now expand a "View Raw Extracted Text" section to see exactly what was extracted from the document, making it easier to:
- Verify extraction quality
- Understand parsing issues
- Provide feedback for improvements

#### Console Logging:
Enhanced logging at key stages:
- PDF text extraction
- OCR text extraction
- Parsing process
- Entry creation

## Supported Document Formats

### Images:
- ✅ JPEG (.jpg, .jpeg)
- ✅ PNG (.png)
- ✅ BMP (.bmp)
- ✅ TIFF (.tiff, .tif)
- ✅ WebP (.webp)

### Documents:
- ✅ PDF (.pdf)

### File Size:
- Maximum: 20MB (increased from 10MB)

## Expected Timesheet Format

The scanner works best with documents containing:

1. **Staff Information:**
   - Staff name (preferably in format: "FIRSTNAME BIN/BINTI LASTNAME")
   - Located near the top of the document

2. **Project Information:**
   - PO/SO number (format: "PO-XXX" or "SO-XXX")
   - Can be anywhere in the document

3. **Daily Entries:**
   - Date (DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY)
   - Hours broken down by type:
     - Normal Hours (NH)
     - Overtime (OT)
     - Night Hours (NH)
     - Total Hours

### Example Format:
```
TIMESHEET
Staff Name: AHMAD BIN ABDULLAH
PO/SO: PO-2024-001

Date       | Normal | OT  | NH  | Total
-----------|--------|-----|-----|-------
01/01/2024 | 8.0    | 2.0 | 0   | 10.0
02/01/2024 | 8.0    | 0   | 0   | 8.0
03/01/2024 | 8.0    | 3.0 | 1.0 | 12.0
```

## Usage Instructions

1. **Upload Document:**
   - Click the upload area or drag & drop
   - Select image or PDF file

2. **Scan Document:**
   - Click "Scan Document" button
   - Wait for OCR/extraction to complete
   - Review extracted data

3. **Verify & Save:**
   - Check the extracted entries
   - Expand "View Raw Extracted Text" if needed
   - Click "Save to Database" to store

4. **Manual Review:**
   - If flagged for manual review, check the data carefully
   - You can still save, but verify accuracy first

## Tips for Best Results

### For Images:
- Use high-resolution images (300+ DPI recommended)
- Ensure good lighting and contrast
- Avoid shadows or glare
- Keep the document flat and aligned
- Use clear, readable fonts

### For PDFs:
- Use text-based PDFs (not scanned images saved as PDF)
- Ensure proper formatting with clear table structures
- Avoid heavily styled or formatted text
- Simple, clean layouts work best

### General:
- Keep text horizontal (auto-rotate helps but may not be perfect)
- Use standard fonts (avoid handwriting)
- Ensure dates are in DD/MM/YYYY format
- Label columns clearly (Normal, OT, NH, Total)
- Include PO/SO number prominently

## Troubleshooting

### No Entries Found:
1. Check the "View Raw Extracted Text" section
2. Verify the document contains recognizable text
3. Ensure dates are in supported formats
4. Make sure hours are clearly labeled

### Incorrect Data:
1. Review the raw extracted text
2. Check if the document format matches expected structure
3. Ensure text is clear and not distorted
4. Consider re-scanning with higher quality

### Low Accuracy:
1. Increase image resolution
2. Improve lighting/contrast
3. Use simpler document layouts
4. Avoid complex formatting

## Future Enhancements

Potential improvements for future versions:
- [ ] Support for Excel/CSV files
- [ ] Machine learning for better pattern recognition
- [ ] Multi-language support
- [ ] Custom field mapping
- [ ] Batch processing multiple documents
- [ ] Image preprocessing (contrast, brightness adjustment)
- [ ] Template-based extraction
- [ ] Export to Excel/CSV
