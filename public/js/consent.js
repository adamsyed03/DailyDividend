(function(){
  'use strict';
  const STORAGE_KEY='dd_cookie_consent_v1';
  const VERSION='2026-11-04';
  const script=document.currentScript;
  const config={
    gaId:script&&script.dataset.gaId||'',
    posthogKey:script&&script.dataset.posthogKey||'',
    posthogHost:script&&script.dataset.posthogHost||'https://eu.i.posthog.com'
  };
  let preferences=readPreferences();
  let lastFocused=null;

  function readPreferences(){
    try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY));return value&&value.version===VERSION&&typeof value.analytics==='boolean'?value:null;}catch(error){return null;}
  }
  function savePreferences(analytics){
    preferences={version:VERSION,necessary:true,analytics:Boolean(analytics),updatedAt:new Date().toISOString()};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(preferences));}catch(error){}
    applyPreferences();
    document.dispatchEvent(new CustomEvent('dd:consent-changed',{detail:{...preferences}}));
  }
  function allows(category){return category==='necessary'||Boolean(preferences&&preferences[category]);}
  function addStyles(){if(!document.querySelector('link[data-dd-consent-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/consent.css';link.dataset.ddConsentStyle='';document.head.appendChild(link);}}
  function loadGoogleAnalytics(){
    if(!config.gaId||document.querySelector('script[data-dd-ga]'))return;
    window['ga-disable-'+config.gaId]=false;
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    window.gtag('js',new Date());window.gtag('config',config.gaId,{allow_google_signals:false,allow_ad_personalization_signals:false});
    const tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(config.gaId);tag.dataset.ddGa='';document.head.appendChild(tag);
  }
  function loadPostHog(){
    if(!config.posthogKey)return;
    if(window.posthog&&window.posthog.__loaded){if(window.posthog.opt_in_capturing)window.posthog.opt_in_capturing();return;}
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split('.');2===o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p=t.createElement('script');p.type='text/javascript';p.crossOrigin='anonymous';p.async=true;p.src=s.api_host.replace('.i.posthog.com','-assets.i.posthog.com')+'/static/array.js';r=t.getElementsByTagName('script')[0];r.parentNode.insertBefore(p,r);var u=e;void 0!==a?u=e[a]=[]:a='posthog';u.people=u.people||[];u.toString=function(t){var e='posthog';return'posthog'!==a&&(e+='.'+a),t||(e+=' (stub)'),e};u.people.toString=function(){return u.toString(1)+'.people (stub)'};o='capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset'.split(' ');for(n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init(config.posthogKey,{api_host:config.posthogHost,ui_host:'https://eu.posthog.com',person_profiles:'identified_only',capture_pageview:true});
  }
  function expireCookie(name){document.cookie=name+'=; Max-Age=0; path=/; SameSite=Lax';document.cookie=name+'=; Max-Age=0; path=/; domain=.'+location.hostname+'; SameSite=Lax';}
  function disableAnalytics(){
    if(config.gaId){window['ga-disable-'+config.gaId]=true;if(window.gtag)window.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied'});}
    if(window.posthog){try{if(window.posthog.opt_out_capturing)window.posthog.opt_out_capturing();if(window.posthog.reset)window.posthog.reset(true);}catch(error){}}
    document.cookie.split(';').map(item=>item.split('=')[0].trim()).filter(name=>name==='_ga'||name==='_gid'||name.startsWith('_ga_')||name.startsWith('ph_')).forEach(expireCookie);
    try{Object.keys(localStorage).filter(key=>key.startsWith('ph_')||key.includes('_posthog')).forEach(key=>localStorage.removeItem(key));}catch(error){}
  }
  function applyPreferences(){if(allows('analytics')){loadGoogleAnalytics();loadPostHog();}else disableAnalytics();}
  function closePreferences(){const layer=document.getElementById('dd-cookie-layer');if(layer){layer.hidden=true;document.body.style.removeProperty('overflow');}if(lastFocused&&lastFocused.focus)lastFocused.focus();}
  function openPreferences(){
    const layer=document.getElementById('dd-cookie-layer');if(!layer)return;
    lastFocused=document.activeElement;document.getElementById('dd-analytics-toggle').checked=allows('analytics');layer.hidden=false;document.body.style.overflow='hidden';document.getElementById('dd-cookie-close').focus();
  }
  function bindSettingsLinks(){document.querySelectorAll('[data-cookie-settings]').forEach(el=>{if(el.dataset.ddBound)return;el.dataset.ddBound='true';el.addEventListener('click',event=>{event.preventDefault();openPreferences();});});}
  function buildInterface(){
    if(document.getElementById('dd-cookie-banner'))return;
    document.body.insertAdjacentHTML('beforeend',`<section class="dd-cookie-banner" id="dd-cookie-banner" aria-label="Cookie choices" ${preferences?'hidden':''}><h2 class="dd-cookie-title">Your privacy, your choice</h2><p class="dd-cookie-copy">We use necessary storage for sign-in and subscriptions. With your permission, we also use analytics to understand and improve Daily Dividend. Read our <a href="/cookies">Cookie Policy</a>.</p><div class="dd-cookie-actions"><button class="dd-cookie-button primary" type="button" data-dd-consent="accept">Accept all</button><button class="dd-cookie-button" type="button" data-dd-consent="reject">Reject optional</button><button class="dd-cookie-button" type="button" data-dd-consent="manage">Manage preferences</button></div></section><div class="dd-cookie-layer" id="dd-cookie-layer" hidden><section class="dd-cookie-modal" role="dialog" aria-modal="true" aria-labelledby="dd-cookie-modal-title"><div class="dd-cookie-modal-head"><div><h2 class="dd-cookie-title" id="dd-cookie-modal-title">Cookie preferences</h2><p class="dd-cookie-copy">Choose whether Daily Dividend may use optional analytics. Necessary storage cannot be switched off here because it supports sign-in, security and billing.</p></div><button class="dd-cookie-close" id="dd-cookie-close" type="button" aria-label="Close cookie preferences">&times;</button></div><div class="dd-cookie-category"><div><h3>Necessary</h3><p>Authentication, security, payment flow and your saved consent choice.</p></div><span class="dd-cookie-state">Always on</span></div><label class="dd-cookie-category" for="dd-analytics-toggle"><div><h3>Analytics</h3><p>Google Analytics and PostHog help us understand visits and product usage. They remain off until you choose them.</p></div><input class="dd-cookie-toggle" id="dd-analytics-toggle" type="checkbox" aria-label="Allow analytics"></label><div class="dd-cookie-actions"><button class="dd-cookie-button primary" type="button" data-dd-consent="save">Save choices</button><a class="dd-cookie-button" href="/cookies">Read Cookie Policy</a></div></section></div>`);
    document.querySelector('[data-dd-consent="accept"]').addEventListener('click',()=>{savePreferences(true);document.getElementById('dd-cookie-banner').hidden=true;});
    document.querySelector('[data-dd-consent="reject"]').addEventListener('click',()=>{savePreferences(false);document.getElementById('dd-cookie-banner').hidden=true;});
    document.querySelector('[data-dd-consent="manage"]').addEventListener('click',openPreferences);
    document.querySelector('[data-dd-consent="save"]').addEventListener('click',()=>{savePreferences(document.getElementById('dd-analytics-toggle').checked);document.getElementById('dd-cookie-banner').hidden=true;closePreferences();});
    document.getElementById('dd-cookie-close').addEventListener('click',closePreferences);
    document.getElementById('dd-cookie-layer').addEventListener('click',event=>{if(event.target.id==='dd-cookie-layer')closePreferences();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closePreferences();});
    bindSettingsLinks();
    if(!document.documentElement.dataset.ddConsentDelegated){
      document.documentElement.dataset.ddConsentDelegated='true';
      document.addEventListener('click',event=>{const trigger=event.target.closest&&event.target.closest('[data-cookie-settings]');if(trigger){event.preventDefault();openPreferences();}});
    }
    if(!document.querySelector('[data-cookie-settings]')){const button=document.createElement('button');button.type='button';button.className='dd-cookie-settings';button.textContent='Cookie settings';button.setAttribute('data-cookie-settings','');document.body.appendChild(button);bindSettingsLinks();}
  }
  window.DDConsent={allows,open:openPreferences,getPreferences:()=>preferences?{...preferences}:null};
  addStyles();applyPreferences();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildInterface);else buildInterface();
})();
