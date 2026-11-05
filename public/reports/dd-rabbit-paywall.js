(function(){
  var deck=document.getElementById('deck');
  if(!deck)return;

  var pages=Array.prototype.slice.call(deck.querySelectorAll('.slide, .card'));
  if(pages.length<2)return;

  var statusReady=false;
  var subscriptionActive=false;
  var attemptedBeyondPreview=false;
  var touchStartY=null;

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
    .dd-pro-h{font-family:Georgia,serif;font-size:34px;line-height:1.02;letter-spacing:-.03em;margin-bottom:12px}\
    .dd-pro-p{font-size:14px;line-height:1.55;color:#56564f;margin-bottom:22px}\
    .dd-pro-button{width:100%;border:0;border-radius:999px;padding:14px 18px;background:#10110f;color:#fff;font-size:15px;font-weight:800;cursor:pointer}\
    .dd-pro-back{width:100%;border:0;background:transparent;color:#62625c;font-size:12px;padding:13px 8px 0;cursor:pointer}\
  ';
  document.head.appendChild(style);

  var wall=document.createElement('div');
  wall.className='dd-pro-wall';
  wall.setAttribute('role','dialog');
  wall.setAttribute('aria-modal','true');
  wall.setAttribute('aria-label','Daily Dividend Pro membership required');
  wall.innerHTML='<div class="dd-pro-card">'
    +'<div class="dd-pro-k">Daily Dividend Pro</div>'
    +'<div class="dd-pro-h">Keep going down the rabbit hole.</div>'
    +'<div class="dd-pro-p">The first page is free. Become a PRO member to unlock every page of every Rabbit Hole.</div>'
    +'<button class="dd-pro-button" type="button">View membership</button>'
    +'<button class="dd-pro-back" type="button">Back to the first page</button>'
    +'</div>';
  document.body.appendChild(wall);

  function returnToPreview(){
    try{deck.scrollTo({top:0,behavior:'auto'});}catch(error){deck.scrollTop=0;}
    try{window.scrollTo({top:0,behavior:'auto'});}catch(error){}
  }

  function showPaywall(){
    if(!statusReady||subscriptionActive||!attemptedBeyondPreview)return;
    returnToPreview();
    wall.classList.add('show');
  }

  function attemptToContinue(event){
    attemptedBeyondPreview=true;
    if(statusReady&&!subscriptionActive&&event&&event.cancelable){
      event.preventDefault();
      if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    }
    showPaywall();
  }

  wall.querySelector('.dd-pro-button').addEventListener('click',function(){
    try{sessionStorage.setItem('ddRabbitHoleReturnTo',paymentPath());}catch(error){}
    window.top.location.assign(paymentPath());
  });
  wall.querySelector('.dd-pro-back').addEventListener('click',function(){
    wall.classList.remove('show');
    attemptedBeyondPreview=false;
    returnToPreview();
  });

  deck.addEventListener('wheel',function(event){
    if(event.deltaY>0)attemptToContinue(event);
  },{passive:false});

  deck.addEventListener('touchstart',function(event){
    touchStartY=event.touches&&event.touches[0]?event.touches[0].clientY:null;
  },{passive:true});
  deck.addEventListener('touchmove',function(event){
    var current=event.touches&&event.touches[0]?event.touches[0].clientY:null;
    if(touchStartY!==null&&current!==null&&touchStartY-current>12)attemptToContinue(event);
  },{passive:false});

  document.addEventListener('keydown',function(event){
    if(event.metaKey||event.ctrlKey||event.altKey)return;
    if(['ArrowDown','ArrowRight','PageDown',' ','End'].indexOf(event.key)!==-1)attemptToContinue(event);
  },true);

  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('#swipeCue,[data-next]'):null;
    if(target)attemptToContinue(event);
  },true);

  function checkScrollPosition(){
    if(subscriptionActive)return;
    if(deck.scrollTop>12||window.scrollY>12){
      attemptedBeyondPreview=true;
      showPaywall();
    }
  }
  deck.addEventListener('scroll',checkScrollPosition,{passive:true});
  window.addEventListener('scroll',checkScrollPosition,{passive:true});

  fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}})
    .then(function(response){return response.ok?response.json():null;})
    .then(function(data){subscriptionActive=Boolean(data&&data.user&&data.user.subscriptionActive);})
    .catch(function(){subscriptionActive=false;})
    .then(function(){statusReady=true;showPaywall();});

  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting||entry.intersectionRatio<0.2)return;
      var index=pages.indexOf(entry.target);
      if(index>0){attemptedBeyondPreview=true;showPaywall();}
      else if(index===0&&!wall.classList.contains('show')){attemptedBeyondPreview=false;}
    });
  },{root:deck,threshold:[0.2,0.55]});

  pages.forEach(function(page){observer.observe(page);});
})();
