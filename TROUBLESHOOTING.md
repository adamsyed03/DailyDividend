# Troubleshooting Phone Number Authentication

## Issue: Phone number not recognized even though it's in the sheet

### Step 1: Check the Google Apps Script

1. **Open your Google Sheet** → Extensions → Apps Script
2. **Check the sheet name**: Make sure `SHEET_NAME` in the script matches your actual sheet tab name
3. **Find which column has phone numbers**: Look at your sheet and identify which column (A, B, C, etc.) contains phone numbers
4. **Update PHONE_COLUMN**: If you know the column, update `PHONE_COLUMN` in the script:
   - Column A = 1
   - Column B = 2
   - Column C = 3
   - etc.
   - Leave as 0 to search all columns (slower but more flexible)

### Step 2: Test the Script Directly

1. In Apps Script editor, paste this test function at the bottom:
```javascript
function testPhoneCheck() {
  const testPhone = '919167280679'; // Replace with your test number
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
```

2. **Run the test function**:
   - Click on `testPhoneCheck` in the function dropdown
   - Click the Run button (▶️)
   - Check the Execution log (View → Execution log)
   - You should see debug output showing:
     - Input phone number
     - Normalized phone number
     - What values it's comparing against
     - Final result

### Step 3: Check Your Sheet Data

1. **Verify the phone number format** in your sheet:
   - Is it stored as text or a number?
   - Does it have a `+` prefix?
   - Are there any spaces, dashes, or other characters?

2. **Common issues**:
   - Phone stored as number (e.g., `919167280679`) - should work
   - Phone stored with `+` (e.g., `+919167280679`) - should work (normalization removes `+`)
   - Phone stored with spaces (e.g., `+91 916 728 0679`) - should work
   - Phone stored in wrong column - update `PHONE_COLUMN`

### Step 4: Check Browser Console

1. Open your login page
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Try logging in
5. Look for debug messages showing:
   - Original phone number
   - Normalized phone number
   - Response from server

### Step 5: Verify Web App URL

1. Make sure `auth.js` has the correct Web App URL
2. The URL should end with `/exec`
3. Make sure the script is deployed with "Anyone" access

### Step 6: Redeploy the Script

If you made changes to the Google Apps Script:
1. Go to Deploy → Manage deployments
2. Click the pencil icon (Edit)
3. Create a new version
4. Deploy
5. Make sure to use the NEW deployment URL in `auth.js`

## Quick Debug Checklist

- [ ] Sheet name matches `SHEET_NAME` in script
- [ ] Phone column is correct (or set to 0 to search all)
- [ ] Script is deployed as Web App with "Anyone" access
- [ ] Web App URL is correct in `auth.js`
- [ ] Test function runs successfully in Apps Script
- [ ] Browser console shows debug output
- [ ] Phone number format in sheet matches what you're entering

## Still Not Working?

1. **Check the Execution log** in Apps Script (View → Execution log)
2. **Check browser console** for errors
3. **Try the test function** with your exact phone number
4. **Verify the phone number exists** in the sheet (search for it)
5. **Check if phone is in a different column** than expected

