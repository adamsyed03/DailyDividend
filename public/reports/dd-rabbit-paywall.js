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
    try{sessionStorage.setItem('ddRabbitHoleReturnTo',paymentPath());}catch(error){}
    window.top.location.assign(paymentPath());
  }

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
