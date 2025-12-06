# How the Login System Works (Technical Explanation)

## Why You Don't Have to Log In Again

### The Technology: Browser localStorage

When you successfully log in, the system uses **localStorage** - a built-in browser feature that stores data locally on your device.

### Step-by-Step Flow:

1. **First Login:**
   - You enter your phone number on `login.html`
   - The system calls your Google Apps Script to verify the number exists in the Google Sheet
   - If verified (returns "ok"), the system calls `rememberLogin(phone)`
   - This function stores two pieces of data in your browser's localStorage:
     ```javascript
     localStorage.setItem('dd_member', 'true')      // Login flag
     localStorage.setItem('dd_user_phone', phone)   // Your phone number
     ```

2. **Subsequent Visits:**
   - When you visit any `/tools/*` page, a guard script runs at the top:
     ```javascript
     if (!isRemembered()) {
       window.location.href = '/login.html';  // Redirect if not logged in
     }
   - The `isRemembered()` function checks:
     ```javascript
     return localStorage.getItem('dd_member') === 'true';
     ```
   - If it finds `'true'`, you're allowed in. If not, you're redirected to login.

3. **Why It Persists:**
   - **localStorage** is persistent storage that survives:
     - Browser refreshes
     - Browser restarts
     - Computer restarts
     - Until you explicitly clear it (or use the logout button)
   - It's stored per domain (dailydividend.info), so it only works on your site
   - It's stored per browser, so logging in on Chrome doesn't log you into Firefox

### Security Notes:

- **Client-side only:** This is a simple "remember me" system. The actual verification happens once during login.
- **Not server-side sessions:** There's no server tracking your session. It's purely client-side.
- **Can be cleared:** Users can clear localStorage manually (browser settings) or use the logout button.
- **No expiration:** The login persists until explicitly cleared (unlike cookies with expiration dates).

### The Logout Process:

When you click "Log out":
1. The `logout()` function runs:
   ```javascript
   localStorage.removeItem('dd_member');      // Remove login flag
   localStorage.removeItem('dd_user_phone');  // Remove phone number
   ```
2. You're redirected to `/login.html`
3. On your next visit to `/tools/*`, `isRemembered()` returns `false`, so you're redirected to login again

### Visual Flow:

```
Login Page
    ↓
[Enter Phone] → [Google Apps Script checks Sheet] → [Returns "ok"]
    ↓
[rememberLogin()] → [localStorage.setItem('dd_member', 'true')]
    ↓
[Redirect to /tools/index.html]
    ↓
[Guard script checks isRemembered()] → [Returns true] → [Page loads]
    ↓
[User can access all /tools/* pages]
    ↓
[On refresh/revisit] → [Guard checks again] → [Still true] → [No login needed]
    ↓
[Click Logout] → [logout()] → [localStorage cleared] → [Redirect to login]
```

### Key Points:

- **No server-side session management** - Everything is client-side
- **localStorage is domain-specific** - Only works on dailydividend.info
- **Persists until cleared** - Unlike cookies, no automatic expiration
- **Simple and fast** - No database lookups after initial login
- **User-controlled** - Users can clear it anytime via browser settings or logout button

