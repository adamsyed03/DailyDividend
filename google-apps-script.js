// ===========================================
// DAILY DIVIDEND - GOOGLE APPS SCRIPT
// ===========================================
// Handles both HTML form submissions and JSON API calls
// Deploy as Web App with Execute as: Me, Who has access: Anyone

// Configuration - Daily Dividend Database
const SHEET_ID = '1t8FXT0qq6jzN0br3oOcijIpYwhaf-_Tknwz2uYVn9u0'; // DD Database spreadsheet ID
const SHEET_NAME = 'Leads'; // Tab name in the spreadsheet

/**
 * Health check endpoint
 * @returns {ContentService.TextOutput} Simple "up" response
 */
function doGet() {
  return ContentService.createTextOutput('up');
}

/**
 * Main form submission handler
 * Accepts both application/x-www-form-urlencoded and application/json
 * @param {Object} e - The event object containing request data
 * @returns {ContentService.TextOutput} Success or error response
 */
function doPost(e) {
  try {
    // Get or create the target sheet
    const sheet = getTargetSheet();
    
    // Parse incoming data based on content type
    const data = parseIncomingData(e);
    
    // Normalize and extract field values
    const normalizedData = normalizeFields(data);
    
    // Append row to spreadsheet
    sheet.appendRow([
      new Date(),
      normalizedData.first,
      normalizedData.last,
      normalizedData.email,
      normalizedData.phone,
      normalizedData.page
    ]);
    
    // Log successful submission
    console.log('Successfully added row:', normalizedData);
    
    return ContentService.createTextOutput('OK');
    
  } catch (error) {
    // Log error details
    console.error('Error in doPost:', error);
    console.error('Error stack:', error.stack);
    
    return ContentService.createTextOutput('ERR: ' + error.toString());
  }
}

/**
 * Get the target spreadsheet sheet
 * @returns {Sheet} The target sheet
 */
function getTargetSheet() {
  let sheet;
  
  try {
    // Try to open by ID first
    if (SHEET_ID && SHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      sheet = ss.getSheetByName(SHEET_NAME);
    }
  } catch (error) {
    console.log('Could not open by ID, falling back to active spreadsheet');
  }
  
  // Fallback to active spreadsheet
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.insertSheet(SHEET_NAME);
    
    // Add headers
    sheet.appendRow(['Timestamp', 'First Name', 'Last Name', 'Email', 'Phone', 'Page']);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 6);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('white');
  }
  
  return sheet;
}

/**
 * Parse incoming data based on content type
 * @param {Object} e - The event object
 * @returns {Object} Parsed data object
 */
function parseIncomingData(e) {
  let data = {};
  
  // Check if we have URL-encoded form data (from HTML forms)
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    data = e.parameter;
    console.log('Received URL-encoded data:', data);
  }
  // Check if we have JSON data (from fetch/API calls)
  else if (e.postData && e.postData.contents) {
    const contentType = e.postData.type || '';
    
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(e.postData.contents);
        console.log('Received JSON data:', data);
      } catch (parseError) {
        throw new Error('Invalid JSON: ' + parseError.message);
      }
    } else {
      // Try to parse as JSON anyway (fallback)
      try {
        data = JSON.parse(e.postData.contents);
        console.log('Parsed as JSON (fallback):', data);
      } catch (parseError) {
        throw new Error('Could not parse data as JSON or form data');
      }
    }
  } else {
    throw new Error('No data received in request');
  }
  
  return data;
}

/**
 * Normalize field names and extract values
 * @param {Object} data - Raw data object
 * @returns {Object} Normalized data with consistent field names
 */
function normalizeFields(data) {
  // Helper function to find value by multiple possible keys
  function findValue(obj, keys) {
    for (const key of keys) {
      if (obj && obj[key] !== null && obj[key] !== undefined && String(obj[key]).trim() !== '') {
        return String(obj[key]).trim();
      }
    }
    return '';
  }
  
  return {
    first: findValue(data, [
      'first_name', 'firstName', 'firstname', 'First Name', 
      'given_name', 'givenName', 'fname', 'first'
    ]),
    last: findValue(data, [
      'last_name', 'lastName', 'lastname', 'Last Name', 
      'family_name', 'familyName', 'lname', 'last'
    ]),
    email: findValue(data, [
      'email', 'email_address', 'emailAddress', 'Email', 'Email Address'
    ]),
    phone: findValue(data, [
      'phone', 'phone_number', 'phoneNumber', 'mobile', 
      'whatsapp', 'Phone', 'Phone Number'
    ]),
    page: findValue(data, [
      'page', 'Page', 'path', 'source'
    ])
  };
}

// ===========================================
// DEPLOYMENT INSTRUCTIONS:
// ===========================================
// 1. Replace SHEET_ID with your actual spreadsheet ID
// 2. Save the script
// 3. Click "Deploy" → "New deployment"
// 4. Type: "Web app"
// 5. Execute as: "Me"
// 6. Who has access: "Anyone"
// 7. Click "Deploy"
// 8. Copy the /exec URL
// 9. Use that URL in your HTML forms
// ===========================================
