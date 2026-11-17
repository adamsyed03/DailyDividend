/* Rabbit Hole paywall.
   Guests (not logged in, /access answers 401): page 1 only.
   Free tier: the first HALF of one rabbit hole per day (reader's local date);
   every other rabbit hole shows page 1 only. Pro members read everything.
   The day's free read is spent the moment a reader moves past page 1 of a
   rabbit hole (POST /api/rabbit-holes/unlock) — opening covers is free.
   Server keeps the record per account, so it holds across devices.
   The server only SENDS the pages a reader may see (locked ones arrive as empty
   .dd-locked placeholders) and describes the reader in window.DD_REPORT_ACCESS.
   When access grows (free read claimed, Pro confirmed) this script reloads the
   page so the server sends the newly unlocked pages. */
(function(){
  var deck=document.getElementById('deck');
  if(!deck)return;

  var pages=Array.prototype.slice.call(deck.querySelectorAll('.slide, .card'));
  if(pages.length<2)return;
  /* Pages a free read covers: the first half, rounded up (page 1 included). */
  var freeHalfPages=Math.min(pages.length,Math.max(2,Math.ceil(pages.length/2)));

  var slugMatch=/\/([a-z0-9-]+)\.html$/i.exec(window.location.pathname);
  var slug=slugMatch?slugMatch[1].toLowerCase():'';
  var served=window.DD_REPORT_ACCESS&&typeof window.DD_REPORT_ACCESS==='object'?window.DD_REPORT_ACCESS:null;
  /* How many pages the server actually sent in full. */
  var sentPages=served&&served.allowed?Math.min(pages.length,served.allowed):pages.length;
  var RESUME_KEY='dd-rh-resume';

  var statusReady=false;
  var subscriptionActive=false;   // Pro member
  var unlocked=false;             // this is today's free read (first half open)
  var freeAvailable=false;        // today's free read not yet used
  var freeSlug=null;              // which rabbit hole today's free read went on
  var guest=false;                // not logged in: page 1 only
  var claiming=false;
  var parentManaged=false;
  var attemptedBeyondPreview=false;
  var touchStartY=null;

  function localDateKey(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function paymentPath(){
    var returnTo='/';
    try{
      if(window.parent!==window&&window.parent.location.origin===window.location.origin){
        returnTo=window.parent.location.pathname+window.parent.location.search;
      }
    }catch(error){}
    return '/subscribe?returnTo='+encodeURIComponent(returnTo);
  }

  var style=document.createElement('style');
  style.textContent='\
    .dd-pro-wall{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(7,16,12,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:Arial,sans-serif}\
    .dd-pro-wall.show{display:flex}\
    .dd-pro-card{width:min(420px,100%);border-radius:24px;background:#f8f5ed;color:#10110f;padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.35);text-align:left}\
    .dd-pro-k{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#167546;margin-bottom:12px}\
    .dd-pro-h{font-family:Georgia,serif;font-size:32px;line-height:1.04;letter-spacing:-.03em;margin-bottom:12px}\
    .dd-pro-p{font-size:14px;line-height:1.55;color:#56564f;margin-bottom:22px}\
    .dd-pro-button{width:100%;border:0;border-radius:999px;padding:14px 18px;background:#10110f;color:#fff;font-size:15px;font-weight:800;cursor:pointer}\
    .dd-pro-back{width:100%;border:0;background:transparent;color:#62625c;font-size:12px;padding:13px 8px 0;cursor:pointer}\
    .dd-free-toast{position:fixed;left:50%;top:calc(max(18px,env(safe-area-inset-top)) + 58px);z-index:2147483646;transform:translate(-50%,-16px);opacity:0;pointer-events:none;width:max-content;max-width:calc(100% - 32px);padding:11px 16px;border-radius:999px;background:#f8f5ed;color:#10110f;font:600 13px/1.35 Arial,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.28);text-align:center;transition:opacity .25s ease,transform .25s ease}\
    .dd-free-toast.show{opacity:1;transform:translate(-50%,0)}\
    .dd-locked-slide{display:flex!important;align-items:center;justify-content:center;width:100%;min-height:60vh;opacity:.45}\
    .dd-locked-ico{font-size:46px;filter:grayscale(1)}\
  ';
  document.head.appendChild(style);

  var wall=document.createElement('div');
  wall.className='dd-pro-wall';
  wall.setAttribute('role','dialog');
  wall.setAttribute('aria-modal','true');
  wall.setAttribute('aria-label','Daily Dividend Pro membership required');
  wall.innerHTML='<div class="dd-pro-card">'
    +'<div class="dd-pro-k">Daily Dividend Pro</div>'
    +'<div class="dd-pro-h">You’ve had today’s free read.</div>'
    +'<div class="dd-pro-p">Every day you can read the first half of one Rabbit Hole. On the rest you get the first page. Come back tomorrow for another free one, or go Pro to unlock every page of every Rabbit Hole.</div>'
    +'<button class="dd-pro-button" type="button">Go Pro</button>'
    +'<button class="dd-pro-back" type="button">Back to the first page</button>'
    +'</div>';
  document.body.appendChild(wall);

  var toast=document.createElement('div');
  toast.className='dd-free-toast';
  toast.setAttribute('role','status');
  document.body.appendChild(toast);
  var toastTimer=null;
  function showToast(text){
    toast.textContent=text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){toast.classList.remove('show');},4200);
  }

  /* Index of the first page this reader may NOT see. */
  function lockedFrom(){
    if(subscriptionActive)return pages.length;
    return unlocked?freeHalfPages:1;
  }

  /* Send the reader back to the last page they may read (page 1, or the last
     page of the free half). */
  function returnToPreview(){
    scrollToPage(Math.max(0,Math.min(lockedFrom(),pages.length)-1));
  }

  function scrollToPage(index){
    var target=pages[index];
    if(!target||target===pages[0]){
      try{deck.scrollTo({top:0,behavior:'auto'});}catch(error){deck.scrollTop=0;}
      try{window.scrollTo({top:0,behavior:'auto'});}catch(error){}
      return;
    }
    var offset=target.getBoundingClientRect().top;
    if(deck.scrollHeight>deck.clientHeight+1){
      var top=deck.scrollTop+offset-deck.getBoundingClientRect().top;
      try{deck.scrollTo({top:top,behavior:'auto'});}catch(error){deck.scrollTop=top;}
    }else{
      try{window.scrollTo({top:(window.pageYOffset||0)+offset,behavior:'auto'});}catch(error){}
    }
  }

  function lockedPageIsVisible(){
    var lockedPage=pages[lockedFrom()];
    var rect=lockedPage&&lockedPage.getBoundingClientRect?lockedPage.getBoundingClientRect():null;
    var viewportHeight=window.innerHeight||document.documentElement.clientHeight||1;
    var visibleHeight=rect?Math.max(0,Math.min(rect.bottom,viewportHeight)-Math.max(rect.top,0)):0;
    var requiredHeight=Math.min((rect&&rect.height)||viewportHeight,viewportHeight)*0.2;
    return Boolean(rect&&visibleHeight>=requiredHeight);
  }

  function hasFullAccess(){return subscriptionActive;}

  function showWall(){
    if(hasFullAccess())return;
    var halfDone=!guest&&unlocked;
    if(parentManaged&&window.parent!==window){
      window.parent.postMessage({type:'dd:paywall-request',reason:guest?'guest':halfDone?'free-half-finished':'free-read-used',slug:slug,freeSlug:freeSlug},window.location.origin);
      return;
    }
    wall.querySelector('.dd-pro-k').textContent=guest?'Daily Dividend':'Daily Dividend Pro';
    wall.querySelector('.dd-pro-h').textContent=guest?'Sign up free to keep reading.':halfDone?'That’s the free half.':'You’ve had today’s free read.';
    wall.querySelector('.dd-pro-p').textContent=guest
      ?'Without an account you get the first page. Create a free account to read the first half of one Rabbit Hole every day, or go Pro to read every page.'
      :halfDone
      ?'Your daily free read covers the first half of one Rabbit Hole. Go Pro to finish this one, and read every page of every Rabbit Hole.'
      :'Every day you can read the first half of one Rabbit Hole. On the rest you get the first page. Come back tomorrow for another free one, or go Pro to unlock every page of every Rabbit Hole.';
    wall.querySelector('.dd-pro-button').textContent=guest?'Sign up free':'Go Pro';
    wall.querySelector('.dd-pro-back').textContent=halfDone?'Back to where I was':'Back to the first page';
    wall.classList.add('show');
  }

  function applyAccess(data){
    if(!data)return;
    subscriptionActive=subscriptionActive||Boolean(data.pro);
    unlocked=Boolean(data.freeRead);
    freeAvailable=Boolean(data.freeAvailable);
    freeSlug=data.freeSlug||null;
  }

  /* Spend today's free read on this rabbit hole. */
  function claimFreeRead(){
    if(claiming)return;
    claiming=true;
    fetch('/api/rabbit-holes/unlock',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({slug:slug,date:localDateKey()})
    }).then(function(response){
      if(response.status===401)guest=true;
      return response.ok?response.json():null;
    }).then(function(data){
      if(!data){freeAvailable=false;return;}
      applyAccess(data);
      var toastText=unlocked&&data.claimed&&!subscriptionActive
        ?'Today’s free read: the first '+freeHalfPages+' of '+pages.length+' pages. Your next one unlocks tomorrow.':'';
      if(toastText&&window.parent!==window)window.parent.postMessage({type:'dd:free-read-claimed',slug:slug},window.location.origin);
      if(reloadForMorePages(1,toastText))return 'reloading';
      if(toastText)showToast(toastText);
    }).catch(function(){
      freeAvailable=false;
    }).then(function(result){
      if(result==='reloading')return;
      claiming=false;
      gate();
    });
  }

  /* The server sent fewer pages than this reader may now see (they just
     claimed the free read, or turned out to be Pro): reload so it sends them,
     then land back on `page`. Guarded so a mismatch can't loop. */
  function reloadForMorePages(page,toastText){
    if(!served||lockedFrom()<=sentPages)return false;
    try{
      var last=JSON.parse(sessionStorage.getItem(RESUME_KEY)||'null');
      if(last&&last.slug===slug&&Date.now()-last.at<15000)return false;
      sessionStorage.setItem(RESUME_KEY,JSON.stringify({slug:slug,page:page,toast:toastText||'',at:Date.now()}));
    }catch(error){return false;}
    window.location.replace(window.location.pathname+'?d='+encodeURIComponent(localDateKey()));
    return true;
  }

  /* After such a reload: jump back to where the reader was. */
  function resumeAfterReload(){
    var resume=null;
    try{resume=JSON.parse(sessionStorage.getItem(RESUME_KEY)||'null');}catch(error){}
    if(!resume||resume.slug!==slug||Date.now()-resume.at>15000)return;
    var page=Math.min(resume.page||0,Math.max(0,lockedFrom()-1));
    if(page>0){attemptedBeyondPreview=true;setTimeout(function(){scrollToPage(page);},60);}
    if(resume.toast)showToast(resume.toast);
  }

  /* Called whenever the reader is (trying to get) past what they may read:
     page 1, or the end of the free half on today's free read. */
  function gate(){
    if(!statusReady||hasFullAccess()||claiming)return;
    if(!attemptedBeyondPreview||!lockedPageIsVisible())return;
    if(!guest&&!unlocked&&freeAvailable){claimFreeRead();return;}
    showWall();
  }

  function attemptToContinue(){
    attemptedBeyondPreview=true;
    setTimeout(checkScrollPosition,0);
  }

  wall.querySelector('.dd-pro-button').addEventListener('click',function(){
    if(guest){window.top.location.assign('/onboarding');return;}
    var button=this;
    var originalText=button.textContent;
    button.disabled=true;
    button.textContent='Opening secure checkout...';
    fetch('/api/billing/checkout',{
      method:'POST',credentials:'same-origin',
      headers:{Accept:'application/json','Content-Type':'application/json'}
    }).then(function(response){
      return response.json().catch(function(){return {};}).then(function(data){return {response:response,data:data};});
    }).then(function(result){
      if(result.response.status===401){window.top.location.assign('/login?returnTo='+encodeURIComponent('/subscribe'));return;}
      if(!result.response.ok)throw new Error(result.data.error||'Could not open checkout.');
      if(!result.data.url)throw new Error('Stripe did not return a checkout page.');
      window.top.location.assign(result.data.url);
    }).catch(function(){
      button.disabled=false;
      button.textContent=originalText;
      window.top.location.assign(paymentPath());
    });
  });
  wall.querySelector('.dd-pro-back').addEventListener('click',function(){
    wall.classList.remove('show');
    attemptedBeyondPreview=false;
    returnToPreview();
  });

  deck.addEventListener('wheel',function(event){
    if(event.deltaY>0)attemptToContinue();
  },{passive:true});

  deck.addEventListener('touchstart',function(event){
    touchStartY=event.touches&&event.touches[0]?event.touches[0].clientY:null;
  },{passive:true});
  deck.addEventListener('touchmove',function(event){
    var current=event.touches&&event.touches[0]?event.touches[0].clientY:null;
    if(touchStartY!==null&&current!==null&&touchStartY-current>12)attemptToContinue();
  },{passive:true});

  document.addEventListener('keydown',function(event){
    if(event.metaKey||event.ctrlKey||event.altKey)return;
    if(['ArrowDown','ArrowRight','PageDown',' ','End'].indexOf(event.key)!==-1)attemptToContinue();
  },true);

  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('#swipeCue,[data-next]'):null;
    if(target)attemptToContinue();
  },true);

  function checkScrollPosition(){
    if(hasFullAccess())return;
    if(lockedPageIsVisible()){
      attemptedBeyondPreview=true;
      gate();
    }
  }
  deck.addEventListener('scroll',checkScrollPosition,{passive:true});
  window.addEventListener('scroll',checkScrollPosition,{passive:true});

  function currentPageIndex(){
    var best=0,bestDistance=Infinity;
    pages.forEach(function(page,index){
      var distance=Math.abs(page.getBoundingClientRect().top);
      if(distance<bestDistance){best=index;bestDistance=distance;}
    });
    return best;
  }

  if(served){
    /* The server already told us who this reader is. */
    applyAccess(served);
    guest=Boolean(served.guest);
    statusReady=true;
    resumeAfterReload();
    gate();
  }else{
    fetch('/api/rabbit-holes/access?slug='+encodeURIComponent(slug)+'&date='+encodeURIComponent(localDateKey()),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}})
      .then(function(response){
        if(response.status===401){guest=true;return null;}
        return response.ok?response.json():null;
      })
      .then(function(data){
        if(data)applyAccess(data);
        else if(!guest){freeAvailable=true;} // unknown: let the unlock call decide
      })
      .catch(function(){freeAvailable=true;})
      .then(function(){statusReady=true;gate();});
  }

  window.addEventListener('message',function(event){
    if(event.origin!==window.location.origin||!event.data)return;
    if(event.data.type==='dd:membership'){
      parentManaged=Boolean(event.data.parentManaged);
      if(event.data.guest)guest=true;
      if(event.data.subscriptionActive){
        subscriptionActive=true;wall.classList.remove('show');toast.classList.remove('show');
        reloadForMorePages(currentPageIndex(),'');
      }
      else gate();
    }
    if(event.data.type==='dd:return-preview'){
      attemptedBeyondPreview=false;
      wall.classList.remove('show');
      returnToPreview();
    }
  });
  if(window.parent!==window)window.parent.postMessage({type:'dd:reader-ready'},window.location.origin);

  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting||entry.intersectionRatio<0.2)return;
      var index=pages.indexOf(entry.target);
      var limit=lockedFrom();
      if(index>=limit){attemptedBeyondPreview=true;gate();}
      else if(index>=0&&index<limit-1&&!wall.classList.contains('show')){attemptedBeyondPreview=false;}
      else if(index===0&&!wall.classList.contains('show')){attemptedBeyondPreview=false;}
    });
  },{root:deck,threshold:[0.2,0.55]});

  pages.forEach(function(page){observer.observe(page);});
})();
