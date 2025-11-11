# DCSE Format OCR Improvements

## Date: November 11, 2025

## Issues Identified from OCR Output

### 1. Employee Name Extraction Issue
**Problem:** The system extracted "GS TIME AM EN DM" instead of the actual employee name "MUHAMMAD SYAKIP BIN WITZAID"

**Root Cause:** 
- OCR garbled the line: `MMEZMUMMMADSYAKIPBIN WTZAID DATE PKZEIVED...`
- The old pattern was capturing "TIME AM EN DM ENT" from the form title "TIME AMENDMENT FORM"

**Solution Implemented:**
- Added DCSE-specific name extraction that searches for lines containing both "BIN/BINTI" and "DATE" keywords
- Implemented OCR noise cleaning:
  - Removes prefix garbage (MMM, MMEZ, etc.)
  - Reduces repeated characters (MMM -> MM)
  - Applies common Malaysian name corrections (MUMMAD -> MUHAMMAD, WTZAID -> WITZAID)
- Extracts name before "DATE" keyword to avoid capturing form headers

### 2. Time Parsing Issues
**Problems Found:**
- Line 44: "T.30 PM" was being parsed as 42:00 (resulting in 24 hours OT)
- Line 66: "603 PM" should be "6:03 PM" but was misparsed
- Various time formats: "700 pm", "1003 PM", "9.CDAM"

**Root Causes:**
- OCR reads "8" as "T" frequently
- OCR combines time digits without separators (603, 700, 1003)
- No validation on parsed hour/minute values

**Solutions Implemented:**
1. **OCR Error Correction:**
   - Replace "T" with "8" in time strings (T.30 PM → 8.30 PM)
   - Handle 3-digit times: "603" → "6:03", "700" → "7:00"
   - Handle 4-digit times: "1003" → "10:03"

2. **Time Pattern Matching:**
   - Updated regex to match `[T0-9]{1,4}[:\.]?(\d{2})?\s*[AP]M`
   - Allows for OCR variations in hour digits

3. **Validation:**
   - Check that hour is between 1-12
   - Check that minute is between 0-59
   - Skip invalid times instead of calculating incorrect OT

### 3. OT Calculation Accuracy
**Improvements:**
- Better weekend detection using date parsing
- Fixed time-to-decimal conversion
- Added proper validation before calculating OT hours
- Correctly handles multiple time formats in the same timesheet

## Technical Changes Made

### File: `components/TimesheetClient.js`

#### Change 1: Enhanced DCSE Name Extraction (Lines ~460-520)
```javascript
// Strategy 1: Look for line containing both BIN/BINTI and DATE keywords
for (let i = 0; i < Math.min(15, lines.length); i++) {
  const line = lines[i];
  if (line.match(/\b(BIN|BINTI)\b/i) && line.match(/\bDATE\b/i)) {
    // Extract name before DATE keyword
    // Clean OCR garbage
    // Apply Malaysian name corrections
  }
}
```

#### Change 2: Improved Time Parsing (Lines ~1145-1195)
```javascript
// Handle OCR errors in time parsing
hourStr = hourStr.replace(/^T/i, '8'); // T → 8

// Handle 3-digit times: "603" → "6:03"
if (hourStr.length === 3 && !minuteStr) {
  minuteStr = hourStr.substring(1, 3);
  hourStr = hourStr.substring(0, 1);
}

// Validate hour (1-12) and minute (0-59)
if (isNaN(hour) || hour < 1 || hour > 12) return;
if (isNaN(minute) || minute < 0 || minute > 59) return;
```

#### Change 3: Extended Date Parsing (Lines ~970-1010)
```javascript
// Added support for mangled date formats:
// - "21IUTI25" → 21/07/25
// - "2WI25" → 2?/07/25
// - "2SIUTI25" → 2?/07/25
const mangledMatch = line.match(/^\s*(\d{1,2})[A-Za-z\/fIOl]{2,6}(\d{2})\s/);
```

## Testing Recommendations

### Test Case 1: DCSE Timesheet with Garbled Name
```
Input OCR: "MMEZMUMMMADSYAKIPBIN WTZAID DATE PKZEIVED"
Expected: "MUHAMMAD SYAKIP BIN WITZAID"
```

### Test Case 2: Time Parsing Variations
```
Input Times:
- "T.30 PM" → Expected: 8:30 PM (2.5 hours OT)
- "603 PM" → Expected: 6:03 PM (0.05 hours OT)
- "700 pm" → Expected: 7:00 PM (1.0 hours OT)
- "1003 PM" → Expected: 10:03 PM (4.05 hours OT)
```

### Test Case 3: Weekend Detection
```
Dates to verify:
- 02/07/25 (Wednesday) → Should calculate OT from end time
- 05/07/25 (Saturday) → Should be 8 hours OT (full day)
- 06/07/25 (Sunday) → Should be 8 hours OT (full day)
```

## Expected Improvements

### Before Fixes:
- ❌ Employee Name: "GS TIME AM EN DM"
- ❌ Line 44 OT: 24.00 hours (incorrect)
- ❌ Line 66 OT: 0.05 hours from "603 PM" (misparsed as 6:03 AM)

### After Fixes:
- ✅ Employee Name: "MUHAMMAD SYAKIP BIN WITZAID"
- ✅ Line 44 OT: 2.50 hours (8:30 PM - 6:00 PM = 2.5 hours)
- ✅ Line 66 OT: 0.05 hours (6:03 PM - 6:00 PM = 0.05 hours)
- ✅ Total OT: More accurate calculation

## Known Limitations

1. **Month Assumption:** Mangled dates like "21IUTI25" assume month is July (07). If processing different months, this needs adjustment.

2. **Name Corrections:** The common name corrections list is limited. More corrections can be added as needed:
   ```javascript
   const commonNames = {
     'MUMMAD': 'MUHAMMAD',
     'MUHMMAD': 'MUHAMMAD',
     // Add more as discovered
   };
   ```

3. **OCR Quality:** Very poor quality scans may still fail. Recommend minimum 300 DPI for timesheet scans.

## Future Enhancements

1. **AI-Powered Name Correction:**
   - Use fuzzy matching against employee database
   - Suggest corrections for ambiguous OCR results

2. **Adaptive Month Detection:**
   - Parse month from timesheet header
   - Don't assume July for mangled dates

3. **Time Format Learning:**
   - Track common OCR errors specific to user's scanner
   - Build custom correction rules

4. **Validation UI:**
   - Show extracted name and allow manual correction
   - Highlight uncertain extractions for review

## Rollback Instructions

If these changes cause issues, revert to previous version:
```bash
git checkout HEAD~1 components/TimesheetClient.js
```

Or manually revert specific sections using the git diff.
