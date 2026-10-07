(function(){
  var deck=document.getElementById('deck');
  if(!deck)return;
  var cards=Array.prototype.slice.call(deck.querySelectorAll('.card'));
  var rail=document.getElementById('rail');
  var dLabel=document.getElementById('depthLabel');
  var dNum=document.getElementById('depthNum');
  var swipeCue=document.getElementById('swipeCue');
  var root=document.documentElement;
  var active=-1;
  var fitFrame=0;
  function pad(n){return(n<10?'0':'')+n;}
  function fitCards(){
    cancelAnimationFrame(fitFrame);
    cards.forEach(function(card){card.querySelector('.inner').style.setProperty('--fit-scale','1');});
    fitFrame=requestAnimationFrame(function(){
      cards.forEach(function(card){
        var inner=card.querySelector('.inner');
        var style=getComputedStyle(card);
        var available=card.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
        var needed=inner.scrollHeight;
        inner.style.setProperty('--fit-scale',Math.min(1,available/needed).toFixed(4));
      });
    });
  }
  cards.forEach(function(card,i){
    var button=document.createElement('button');
    button.type='button';button.setAttribute('aria-label',card.dataset.title);
    button.addEventListener('click',function(){go(i);});rail.appendChild(button);
  });
  var ticks=Array.prototype.slice.call(rail.children);
  function paint(i){
    if(i===active)return;active=i;
    var card=cards[i];root.dataset.layer=card.dataset.layer;
    dLabel.textContent=card.dataset.depth;dNum.textContent=pad(i+1)+' / '+pad(cards.length);
    swipeCue.classList.toggle('is-hidden',i!==0);
    ticks.forEach(function(t,n){t.setAttribute('aria-current',n===i?'true':'false');});
  }
  function go(i){i=Math.max(0,Math.min(cards.length-1,i));cards[i].scrollIntoView({block:'start'});}
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('on');if(entry.intersectionRatio>.55)paint(cards.indexOf(entry.target));}});
  },{root:deck,threshold:[.25,.6]});
  cards.forEach(function(card){observer.observe(card);});cards[0].classList.add('on');paint(0);fitCards();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitCards);
  window.addEventListener('resize',fitCards,{passive:true});
  swipeCue.addEventListener('click',function(){go(1);});
  document.addEventListener('keydown',function(event){
    if(event.metaKey||event.ctrlKey||event.altKey)return;
    var key=event.key;
    if(key==='ArrowDown'||key==='ArrowRight'||key==='PageDown'||key===' '){event.preventDefault();go(active+1);}
    else if(key==='ArrowUp'||key==='ArrowLeft'||key==='PageUp'){event.preventDefault();go(active-1);}
    else if(key==='Home'){event.preventDefault();go(0);}
    else if(key==='End'){event.preventDefault();go(cards.length-1);}
  });
})();
