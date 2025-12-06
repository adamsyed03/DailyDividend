/**
 * Google Apps Script Backend for Daily Dividend Authentication
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Sheet that contains the sign-up data
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code into the script editor
 * 4. Update SHEET_NAME to match your sheet tab name (default: 'Form Responses 1')
 * 5. Update PHONE_COLUMN if you know which column has phone numbers (leave as 0 to search all columns)
 * 6. Click "Deploy" > "New deployment"
 * 7. Select type: "Web app"
 * 8. Execute as: "Me"
 * 9. Who has access: "Anyone" (or "Anyone with Google account" if you prefer)
 * 10. Click "Deploy"
 * 11. Copy the Web App URL and paste it into auth.js (replace YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE)
 * 12. Click "Authorize access" when prompted
 */

const SHEET_NAME = 'Form Responses 1'; // Change if your tab name differs
const PHONE_COLUMN = 0; // Set to column number (A=1, B=2, C=3, etc.) if phone is in a specific column, or 0 to search all columns

function doGet(e) {
  const mode = e.parameter.mode || 'check';
  const phone = (e.parameter.phone || '').trim();
  const debug = e.parameter.debug === 'true';
  
  if (!phone) {
    return ContentService.createTextOutput('missing');
  }

  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      Logger.log('Sheet not found: ' + SHEET_NAME);
      return ContentService.createTextOutput('error:sheet_not_found');
    }
    
    // Normalize phone number: remove +, spaces, dashes, parentheses, and any other non-digit characters
    function normalizePhone(phoneStr) {
      if (!phoneStr) return '';
      // Convert to string first (handles numbers stored as numbers in sheet)
      let normalized = String(phoneStr).trim();
      // Remove common formatting: +, spaces, dashes, parentheses, dots
      normalized = normalized.replace(/[\s\-\(\)\+\.]/g, '');
      // Remove any remaining non-digit characters
      normalized = normalized.replace(/[^\d]/g, '');
      return normalized;
    }
    
    // Normalize the input phone number
    const normalizedPhone = normalizePhone(phone);
    
    if (debug) {
      Logger.log('Input phone: ' + phone);
      Logger.log('Normalized phone: ' + normalizedPhone);
    }
    
    let exists = false;
    let searchData = [];
    
    if (PHONE_COLUMN > 0) {
      // Search in specific column (more efficient)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Skip header row (row 1), get data from row 2 onwards
        searchData = sheet.getRange(2, PHONE_COLUMN, lastRow - 1, 1).getValues().flat();
      }
    } else {
      // Search all columns (less efficient but more flexible)
      const data = sheet.getDataRange().getValues();
      searchData = data.flat();
    }
    
    if (debug) {
      Logger.log('Total cells to search: ' + searchData.length);
      Logger.log('First few values: ' + searchData.slice(0, 5).join(', '));
    }
    
    // Check if phone exists
    exists = searchData.some(v => {
      const value = String(v).trim();
      const normalizedValue = normalizePhone(value);
      
      if (debug && normalizedValue.length > 0) {
        Logger.log('Comparing: "' + normalizedValue + '" === "' + normalizedPhone + '"');
      }
      
      return normalizedValue === normalizedPhone && normalizedValue.length > 0;
    });
    
    if (debug) {
      Logger.log('Result: ' + (exists ? 'FOUND' : 'NOT FOUND'));
    }
    
    return ContentService.createTextOutput(exists ? 'ok' : 'no');
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return ContentService.createTextOutput('error:' + error.toString());
  }
}

/**
 * TEST FUNCTION - Run this in Apps Script editor to test your setup
 * Replace '919167280679' with a phone number from your sheet
 */
function testPhoneCheck() {
  const testPhone = '919167280679';
  const mockEvent = {
    parameter: {
      mode: 'check',
      phone: testPhone,
      debug: 'true'
    }
  };
  
  const result = doGet(mockEvent);
  Logger.log('Test result: ' + result.getContent());
  return result.getContent();
}
