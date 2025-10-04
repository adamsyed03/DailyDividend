// ===========================================
// DAILY DIVIDEND - GOOGLE APPS SCRIPT (GET METHOD)
// ===========================================
// Uses GET method to avoid CORS issues
// Deploy as Web App with Execute as: Me, Who has access: Anyone

// Configuration - Daily Dividend Database
const SHEET_ID = '1t8FXT0qq6jzN0br3oOcijIpYwhaf-_Tknwz2uYVn9u0'; // DD Database spreadsheet ID
const SHEET_NAME = 'DD Database'; // Tab name in the spreadsheet

/**
 * Main form submission handler using GET method
 * @param {Object} e - The event object containing request data
 * @returns {ContentService.HtmlOutput} HTML response with postMessage
 */
function doGet(e) {
  try {
    // Get or create the target sheet
    const sheet = getTargetSheet();
    
    // Get form data from URL parameters
    const data = e.parameter || {};
    
    // Extract and normalize field values
    const firstName = (data.first_name || '').trim();
    const lastName = (data.last_name || '').trim();
    const email = (data.email || '').trim();
    const phone = (data.phone || '').trim();
    const page = (data.page || '').trim();
    
    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      throw new Error('Missing required fields');
    }
    
    // Append row to spreadsheet
    sheet.appendRow([
      new Date(),
      firstName,
      lastName,
      email,
      phone,
      page
    ]);
    
    // Log successful submission
    console.log('Successfully added row:', { firstName, lastName, email, phone, page });
    
    // Return HTML with success postMessage
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form Submitted</title>
      </head>
      <body>
        <script>
          window.top.postMessage({status:'OK'}, '*');
        </script>
        <p>Form submitted successfully!</p>
      </body>
      </html>
    `);
    
  } catch (error) {
    // Log error details
    console.error('Error in doGet:', error);
    
    // Return HTML with error postMessage
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form Error</title>
      </head>
      <body>
        <script>
          window.top.postMessage({status:'ERR', reason:'${error.toString().replace(/'/g, "\\'")}'}, '*');
        </script>
        <p>Error: ${error.toString()}</p>
      </body>
      </html>
    `);
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
    const ss = SpreadsheetApp.openById(SHEET_ID);
    sheet = ss.getSheetByName(SHEET_NAME);
  } catch (error) {
    console.log('Could not open by ID, falling back to active spreadsheet');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SHEET_ID);
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

// ===========================================
// DEPLOYMENT INSTRUCTIONS:
// ===========================================
// 1. Save this script
// 2. Click "Deploy" → "New deployment"
// 3. Type: "Web app"
// 4. Execute as: "Me"
// 5. Who has access: "Anyone"
// 6. Click "Deploy"
// 7. Copy the /exec URL
// 8. Use that URL in your HTML forms
// ===========================================
