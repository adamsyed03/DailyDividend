# Login System Setup Instructions

## Overview
This login system protects your `/tools` pages (earnings.html, macro-calendar.html, hedge-fund.html, company-analysis.html) by requiring users to authenticate with a phone number that exists in your Google Sheet.

## Files Created

1. **`login.html`** - Login page where users enter their phone number
2. **`auth.js`** - Authentication logic and access control
3. **`google-apps-script-backend.js`** - Google Apps Script code for backend validation

## Setup Steps

### Step 1: Deploy Google Apps Script

1. Open your Google Sheet that contains the sign-up data (phone numbers)
2. Go to **Extensions** > **Apps Script**
3. Delete any existing code and paste the contents of `google-apps-script-backend.js`
4. Update `SHEET_NAME` if your sheet tab name is different from 'Form Responses 1'
5. Click **Save** (Ctrl+S or Cmd+S)
6. Click **Deploy** > **New deployment**
7. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
8. Configure:
   - **Description**: "Daily Dividend Auth" (or any name)
   - **Execute as**: "Me"
   - **Who has access**: "Anyone" (or "Anyone with Google account")
9. Click **Deploy**
10. **Copy the Web App URL** (it will look like: `https://script.google.com/macros/s/...`)
11. Click **Authorize access** when prompted and allow permissions

### Step 2: Configure auth.js

1. Open `auth.js`
2. Find the line: `GOOGLE_SCRIPT_URL: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE',`
3. Replace `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with the Web App URL you copied in Step 1
4. Save the file

### Step 3: Test the System

1. Open `login.html` in your browser
2. Enter a phone number that exists in your Google Sheet
3. You should be redirected to the tools page
4. Try accessing a tools page directly - you should be redirected to login
5. After logging in, refresh the page - you should stay logged in (localStorage)

## How It Works

1. **User visits a tools page** → `auth.js` checks if they're authenticated
2. **If not authenticated** → Redirects to `login.html` with a redirect parameter
3. **User enters phone number** → `login.html` calls Google Apps Script to verify
4. **If phone exists in sheet** → User is authenticated and stored in localStorage
5. **User is redirected** → Back to the original tools page
6. **Future visits** → localStorage remembers them, no login needed

## Protected Pages

The following pages require authentication:
- `earnings.html`
- `macro-calendar.html`
- `hedge-fund.html`
- `company-analysis.html`

## Logout

Users can logout by clicking the "Logout" button in the navbar (visible on tools pages when logged in).

## Troubleshooting

### "Authentication service not configured"
- Make sure you've updated the `GOOGLE_SCRIPT_URL` in `auth.js`

### "Phone number not found"
- Verify the phone number format matches what's in your Google Sheet
- Check that the sheet tab name matches `SHEET_NAME` in the Google Apps Script
- Ensure the Google Apps Script is deployed and accessible

### CORS Errors
- Make sure the Google Apps Script Web App is deployed with "Anyone" access
- Check that the script URL is correct

### Users can't stay logged in
- Check browser localStorage is enabled
- Verify `auth.js` is loading correctly (check browser console)

## Security Notes

- Phone numbers are stored in localStorage (client-side only)
- The Google Apps Script validates against your sheet
- No passwords required - phone number is the authentication method
- Users can clear localStorage to logout

## Customization

### Change Sheet Column
If phone numbers are in a specific column, edit the Google Apps Script to use the more efficient version (see comments in `google-apps-script-backend.js`).

### Add More Protected Pages
Add the access control script to any page:
```html
<script src="auth.js"></script>
<script>
  if (typeof auth !== 'undefined' && !auth.isAuthenticated()) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent('your-page.html');
  }
</script>
```

### Change Redirect After Login
Edit `login.html` to change the default redirect location.

