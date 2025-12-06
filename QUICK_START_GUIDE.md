# Quick Start Guide - Making Login System Work

## Step 1: Set Up Google Apps Script (5 minutes)

1. **Open your Google Sheet** that has the phone numbers from sign-ups
2. **Click Extensions** → **Apps Script** (opens in new tab)
3. **Delete any existing code** in the editor
4. **Copy ALL the code** from `google-apps-script-backend.js` and paste it
5. **Check the sheet tab name** - if it's NOT "Form Responses 1", change line 18:
   ```javascript
   const SHEET_NAME = 'Your Actual Sheet Tab Name';
   ```
6. **Click Save** (💾 icon or Ctrl+S)
7. **Click "Deploy"** button (top right) → **"New deployment"**
8. **Click the gear icon** ⚙️ next to "Select type" → Choose **"Web app"**
9. Fill in:
   - **Description**: "Daily Dividend Auth" (any name works)
   - **Execute as**: **"Me"** (your email)
   - **Who has access**: **"Anyone"** (important for public access)
10. **Click "Deploy"**
11. **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/AKfycby.../exec`)
12. **Click "Authorize access"** → Choose your Google account → Click "Advanced" → "Go to [project name] (unsafe)" → "Allow"

## Step 2: Configure auth.js (1 minute)

1. **Open `auth.js`** in your project
2. **Find line 9**: `GOOGLE_SCRIPT_URL: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE',`
3. **Replace** `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL you copied
4. **Save the file**

Example:
```javascript
GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby.../exec',
```

## Step 3: Test It! (2 minutes)

1. **Open `login.html`** in your browser
2. **Enter a phone number** that exists in your Google Sheet
   - Try the exact format as it appears in the sheet
   - Or try with/without +, spaces, dashes (the system normalizes it)
3. **Click "Sign In"**
4. **If successful**: You'll be redirected to a tools page
5. **Try accessing a tools page directly** (like `earnings.html`) - should redirect to login if not logged in

## Troubleshooting

### ❌ "Authentication service not configured"
- You haven't updated the URL in `auth.js` yet
- Go back to Step 2

### ❌ "Phone number not found" (but you know it's in the sheet)
- Check the sheet tab name matches `SHEET_NAME` in the script
- Try different phone formats: `+1234567890`, `1234567890`, `(123) 456-7890`
- Check browser console (F12) for errors

### ❌ CORS Error or "Failed to fetch"
- Make sure Google Apps Script is deployed with **"Anyone"** access
- Check the Web App URL is correct
- Try redeploying the script (create a new deployment version)

### ❌ Script says "error"
- Check the sheet tab name is correct
- Make sure the sheet has data
- Check Apps Script execution log: View → Execution log

## Quick Test Checklist

- [ ] Google Apps Script deployed as Web App
- [ ] Web App URL copied
- [ ] `auth.js` updated with the URL
- [ ] Tested login with a phone number from your sheet
- [ ] Tested accessing tools page directly (should redirect to login)
- [ ] Tested staying logged in after refresh

## Need Help?

Check the browser console (F12) for error messages - they'll tell you what's wrong!

---

## Membership Check (mode=check) — Final Steps

1. **Deploy Google Apps Script Web App**

   - In your Google Sheet → Extensions → Apps Script

   - Paste the provided script (supports `mode=check`)

   - Deploy → New deployment → Web app

   - Execute as: **Me**; Who has access: **Anyone**

   - Copy the **Web App URL** (ends with `/exec`)

2. **Set the URL**

   - Open `/auth.js`

   - Set `GOOGLE_SCRIPT_URL` to the Web App URL

3. **Login page**

   - `/login.html` imports `./auth.js` and calls `checkMembership(phone)`

   - On success: stores `dd_member=true` and redirects to `/tools/index.html`

4. **Protect tools pages**

   - Add the guard snippet at the top of all `/tools/*.html`

   - If not remembered, users are sent to `/login.html`

5. **Test**

   - Add a known phone number in the Sheet (exact format used by users, e.g., `+4479...`)

   - Visit `/login.html`, enter the phone → should enter `/tools`

   - Return to `/tools` → should skip login as long as localStorage persists

