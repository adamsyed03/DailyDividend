// auth.js
export const CONFIG = {
  GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyN2q9eBr_PKg1YKhprjCZyQRSBWzYi9IMRxX-QF1UGUMytJ4ahJSmHxP3zM-qEB2rw/exec',
  STORAGE_KEY: 'dd_member',
  STORAGE_PHONE: 'dd_user_phone',
};

export async function checkMembership(phone) {
  const url = `${CONFIG.GOOGLE_SCRIPT_URL}?mode=check&phone=${encodeURIComponent(phone.trim())}`;
  
  console.log('Attempting to fetch:', url);
  
  try {
    const res = await fetch(url, { 
      method: 'GET', 
      cache: 'no-store'
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const text = (await res.text()).trim();
    console.log('Response from server:', text);
    return text === 'ok';
  } catch (error) {
    console.error('checkMembership error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('URL attempted:', url);
    
    // Check if it's a CORS/network error
    if (error.name === 'TypeError' && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      console.error('This appears to be a CORS or network connectivity issue.');
      console.error('Please verify:');
      console.error('1. The Google Apps Script is deployed as a Web App');
      console.error('2. "Who has access" is set to "Anyone"');
      console.error('3. The URL is correct and accessible');
      console.error('4. Test the URL directly in a browser:', url);
    }
    
    throw error;
  }
}

export function rememberLogin(phone) {
  localStorage.setItem(CONFIG.STORAGE_KEY, 'true');
  localStorage.setItem(CONFIG.STORAGE_PHONE, phone);
}

export function isRemembered() {
  return localStorage.getItem(CONFIG.STORAGE_KEY) === 'true';
}

export function logout() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
  localStorage.removeItem(CONFIG.STORAGE_PHONE);
}
