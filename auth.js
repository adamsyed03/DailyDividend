// =============================
// DAILY DIVIDEND AUTH CONTROLLER
// =============================

export const CONFIG = {
  // YOUR CORRECT WEB APP URL
  GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyN2q9eBr_PKg1YKhprjCZyQRSBWzYi9IMRxX-QF1UGUMytJ4ahJSmHxP3zM-qEB2rw/exec',
  
  STORAGE_KEY: 'dd_member',
  STORAGE_PHONE: 'dd_user_phone',
};

// -----------------------------
// Check if phone exists in the Sheet
// -----------------------------
export async function checkMembership(phone) {
  const clean = phone.trim();
  const url = `${CONFIG.GOOGLE_SCRIPT_URL}?mode=check&phone=${encodeURIComponent(clean)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = (await res.text()).trim();

    // Should be exactly: "ok" or "no"
    return text === 'ok';

  } catch (err) {
    console.error('Membership check failed:', err);
    throw new Error('NETWORK_FAIL');
  }
}

// -----------------------------
// Save login locally
// -----------------------------
export function rememberLogin(phone) {
  localStorage.setItem(CONFIG.STORAGE_KEY, 'true');
  localStorage.setItem(CONFIG.STORAGE_PHONE, phone);
}

// -----------------------------
// Is user already logged in?
// -----------------------------
export function isRemembered() {
  return localStorage.getItem(CONFIG.STORAGE_KEY) === 'true';
}

// -----------------------------
// Logout user
// -----------------------------
export function logout() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
  localStorage.removeItem(CONFIG.STORAGE_PHONE);
}
