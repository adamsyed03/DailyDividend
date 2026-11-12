/* Rabbit Hole paywall.
   Free tier: one FULL rabbit hole per day (reader's local date); every other
   rabbit hole shows page 1 only. Pro members read everything.
   The day's free read is spent the moment a reader moves past page 1 of a
   rabbit hole (POST /api/rabbit-holes/unlock) — opening covers is free.
   Server keeps the record per account, so it holds across devices. */
(function(){
  var deck=document.getElementById('deck');
  if(!deck)return;

  var pages=Array.prototype.slice.call(deck.querySelectorAll('.slide, .card'));
  if(pages.length<2)return;

  var slugMatch=/\/([a-z0-9-]+)\.html$/i.exec(window.location.pathname);
  var slug=slugMatch?slugMatch[1].toLowerCase():'';

  var statusReady=false;
  var subscriptionActive=false;   // Pro member
  var unlocked=false;             // Pro, or this is today's free read
  var freeAvailable=false;        // today's free read not yet used
  var freeSlug=null;              // which rabbit hole today's free read went on
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
    +'<div class="dd-pro-p">Every day you can read one Rabbit Hole in full. On the rest you get the first page. Come back tomorrow for another free one, or go Pro to unlock every page of every Rabbit Hole.</div>'
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

  function returnToPreview(){
    try{deck.scrollTo({top:0,behavior:'auto'});}catch(error){deck.scrollTop=0;}
    try{window.scrollTo({top:0,behavior:'auto'});}catch(error){}
  }

  function secondPageIsVisible(){
    var secondPage=pages[1];
    var rect=secondPage&&secondPage.getBoundingClientRect?secondPage.getBoundingClientRect():null;
    var viewportHeight=window.innerHeight||document.documentElement.clientHeight||1;
    var visibleHeight=rect?Math.max(0,Math.min(rect.bottom,viewportHeight)-Math.max(rect.top,0)):0;
    var requiredHeight=Math.min((rect&&rect.height)||viewportHeight,viewportHeight)*0.2;
    return Boolean(rect&&visibleHeight>=requiredHeight);
  }

  function hasFullAccess(){return subscriptionActive||unlocked;}

  function showWall(){
    if(hasFullAccess())return;
    if(parentManaged&&window.parent!==window){
      window.parent.postMessage({type:'dd:paywall-request',reason:'free-read-used',slug:slug,freeSlug:freeSlug},window.location.origin);
      return;
    }
    wall.classList.add('show');
  }

  function applyAccess(data){
    if(!data)return;
    subscriptionActive=subscriptionActive||Boolean(data.pro);
    unlocked=Boolean(data.fullAccess);
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
      return response.ok?response.json():null;
    }).then(function(data){
      if(!data){freeAvailable=false;return;}
      applyAccess(data);
      if(hasFullAccess()){
        if(data.claimed&&!subscriptionActive){
          showToast('Today’s free full read — enjoy. Your next one unlocks tomorrow.');
          if(window.parent!==window)window.parent.postMessage({type:'dd:free-read-claimed',slug:slug},window.location.origin);
        }
      }
    }).catch(function(){
      freeAvailable=false;
    }).then(function(){
      claiming=false;
      gate();
    });
  }

  /* Called whenever the reader is (trying to get) past page 1. */
  function gate(){
    if(!statusReady||hasFullAccess()||claiming)return;
    if(!attemptedBeyondPreview||!secondPageIsVisible())return;
    if(freeAvailable){claimFreeRead();return;}
    showWall();
  }

  function attemptToContinue(){
    attemptedBeyondPreview=true;
    setTimeout(checkScrollPosition,0);
  }

  wall.querySelector('.dd-pro-button').addEventListener('click',function(){
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
    if(secondPageIsVisible()){
      attemptedBeyondPreview=true;
      gate();
    }
  }
  deck.addEventListener('scroll',checkScrollPosition,{passive:true});
  window.addEventListener('scroll',checkScrollPosition,{passive:true});

  fetch('/api/rabbit-holes/access?slug='+encodeURIComponent(slug)+'&date='+encodeURIComponent(localDateKey()),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}})
    .then(function(response){return response.ok?response.json():null;})
    .then(function(data){
      if(data)applyAccess(data);
      else{freeAvailable=true;} // unknown: let the unlock call decide
    })
    .catch(function(){freeAvailable=true;})
    .then(function(){statusReady=true;gate();});

  window.addEventListener('message',function(event){
    if(event.origin!==window.location.origin||!event.data)return;
    if(event.data.type==='dd:membership'){
      parentManaged=Boolean(event.data.parentManaged);
      if(event.data.subscriptionActive){subscriptionActive=true;wall.classList.remove('show');toast.classList.remove('show');}
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
      if(index>0){attemptedBeyondPreview=true;gate();}
      else if(index===0&&!wall.classList.contains('show')){attemptedBeyondPreview=false;}
    });
  },{root:deck,threshold:[0.2,0.55]});

  pages.forEach(function(page){observer.observe(page);});
})();
