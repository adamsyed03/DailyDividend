(function(){
  var deck=document.getElementById('deck');
  if(!deck)return;

  var pages=Array.prototype.slice.call(deck.querySelectorAll('.slide, .card'));
  if(pages.length<2)return;

  var statusReady=false;
  var subscriptionActive=false;
  var beyondPreview=false;
  var redirecting=false;

  function paymentPath(){
    var returnTo='/';
    try{
      if(window.parent!==window&&window.parent.location.origin===window.location.origin){
        returnTo=window.parent.location.pathname+window.parent.location.search;
      }
    }catch(error){}
    return '/subscribe?returnTo='+encodeURIComponent(returnTo);
  }

  function enforcePreview(){
    if(!statusReady||subscriptionActive||!beyondPreview||redirecting)return;
    redirecting=true;
    try{deck.scrollTo({top:0,behavior:'auto'});}catch(error){deck.scrollTop=0;}
    try{sessionStorage.setItem('ddRabbitHoleReturnTo',paymentPath());}catch(error){}
    window.top.location.assign(paymentPath());
  }

  function attemptToContinue(event){
    beyondPreview=true;
    if(statusReady&&!subscriptionActive&&event&&event.cancelable){
      event.preventDefault();
      if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    }
    enforcePreview();
  }

  deck.addEventListener('wheel',function(event){
    if(event.deltaY>0)attemptToContinue(event);
  },{passive:false});

  var touchStartY=null;
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

  function checkScrollPosition(){
    if(deck.scrollTop>12||window.scrollY>12)attemptToContinue();
  }
  deck.addEventListener('scroll',checkScrollPosition,{passive:true});
  window.addEventListener('scroll',checkScrollPosition,{passive:true});

  fetch('/api/auth/session',{credentials:'same-origin',headers:{Accept:'application/json'}})
    .then(function(response){return response.ok?response.json():null;})
    .then(function(data){subscriptionActive=Boolean(data&&data.user&&data.user.subscriptionActive);})
    .catch(function(){subscriptionActive=false;})
    .then(function(){statusReady=true;enforcePreview();});

  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting||entry.intersectionRatio<0.35)return;
      var index=pages.indexOf(entry.target);
      if(index>0){beyondPreview=true;enforcePreview();}
      else if(index===0){beyondPreview=false;}
    });
  },{root:deck,threshold:[0.35,0.6]});

  pages.forEach(function(page){observer.observe(page);});
})();
