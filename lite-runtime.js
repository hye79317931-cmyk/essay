'use strict';
/* e91 isolated lightweight solve runtime.
   The solve UI lives inside an iframe, so legacy document-level pointer/touch handlers
   in app.js never receive handwriting events. Existing IndexedDB/problem/list/review code stays in parent.
*/
(function essayLiteRuntimeV91(){
  if(window.__essayLiteRuntimeV91)return;window.__essayLiteRuntimeV91=true;
  const lite={session:null,frame:null,frameTimeout:null,attemptIds:new Map()};
  const problemById=id=>(state.problems||[]).find(p=>String(p.id)===String(id))||null;
  const current=()=>lite.session?problemById(lite.session.ids[lite.session.index]):null;

  // Disable legacy draft/sync entry points. Existing data is not deleted except old draft/ink cache keys.
  try{safeSetDraftV72=function(){return false};safeGetDraftV72=function(){return ''};safeRemoveDraftV72=function(){return true}}catch{}
  try{scheduleFirebaseSyncV36=function(){}}catch{};try{scheduleCloudSyncV46=function(){}}catch{};
  try{localStorage.removeItem('essayPsatBaseDraft');localStorage.removeItem('essayPsatBaseInk_v2')}catch{}
  document.getElementById('continueBtn')?.classList.add('hidden');
  document.getElementById('essayFirebaseSyncCardV36')?.remove();

  function frameHTML(){return String.raw`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fb;color:#111827}button,input,select,textarea{font:inherit}button{border:1px solid #cfd5df;background:#fff;border-radius:8px;padding:6px 10px;min-height:34px}button.on{outline:2px solid #111827}.hidden{display:none!important}
  #solve,#score{position:fixed;inset:0;display:flex;flex-direction:column;background:#f5f7fb}.bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:7px;background:#fff;border-bottom:1px solid #d7dce5;flex:0 0 auto}.badge{font-size:12px;font-weight:700;padding:4px 7px;border:1px solid #d7dce5;border-radius:999px;background:#fff}.body{display:grid;grid-template-rows:minmax(0,52%) 8px minmax(0,48%);grid-template-columns:minmax(0,1fr);flex:1;min-height:0}.pane{display:flex;flex-direction:column;min-height:0;background:#fff}.divider{background:#d7dce5}.scroll{position:relative;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:none;background:#eef1f5}.stage{position:relative;background:#fff}.stage img,.stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.stage img{pointer-events:none;user-select:none;-webkit-user-drag:none}.stage canvas{touch-action:none}.tools{display:flex;gap:6px;align-items:center;padding:5px 7px;overflow-x:auto;background:#fff;border-top:1px solid #e1e5eb;flex:0 0 auto}.tools>*{white-space:nowrap}.scorebody{overflow:auto;padding:10px;flex:1}.card{background:#fff;border:1px solid #d8dee8;border-radius:12px;padding:10px;margin-bottom:10px}.exp img{display:block;max-width:100%;height:auto;margin:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.grid label{display:flex;flex-direction:column;gap:4px;font-size:13px}.grid input,.grid select,textarea{width:100%}.check{display:flex;gap:6px;margin:5px 0}.status{margin-left:auto;font-size:12px;font-weight:700}
  .answerCanvas{
    --answer-zoom:1;
    background:
      linear-gradient(#eef2f7 1px,transparent 1px)
      0 calc(28px * var(--answer-zoom))/100% calc(32px * var(--answer-zoom)),
      #fff;
  }
  .score-comparison{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
  .score-paper{height:min(40vh,620px);overflow:auto;overscroll-behavior:contain;background:#eef1f5}
  .score-paper .stage{margin-inline:auto}
  .score-paper #aCanvas{pointer-events:none}
  #scoreCorrection{touch-action:pan-x pan-y}
  .score-edit-tools{padding:3px 0;border:0}
  .score-comparison #model{margin:0;padding:8px;white-space:pre-wrap;overflow-wrap:anywhere}
  .score-comparison #model:empty{display:none}
  @media(min-width:821px) and (orientation:landscape){
    .score-comparison{grid-template-columns:repeat(2,minmax(0,1fr))}
    .score-comparison .score-paper{height:min(52vh,620px)}
  }
  @media(min-width:900px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
  </style></head><body>
  <section id="solve" class="hidden"><div class="bar"><strong id="title">문제</strong><span id="setBadge" class="badge"></span><span id="qBadge" class="badge"></span><span id="timer" class="badge">00:00</span><span id="limit" class="badge"></span><button id="prevQ">이전쪽</button><button id="nextQ">다음쪽</button><button id="fitQ">맞춤</button><button id="zoomOutQ">−</button><button id="zoomInQ">＋</button><button id="submit">제출</button><button id="exit">끝내기</button><span id="status" class="status"></span></div><div class="body"><div class="pane"><div id="qScroll" class="scroll"><div id="qStage" class="stage"><img id="qImg"><canvas id="qCanvas"></canvas></div></div><div class="tools"><button id="qPen" class="on">문제펜</button><button id="qErase">지우개</button><button id="qClear">필기삭제</button><label>굵기 <input id="qSize" type="range" min="1" max="14" value="3"></label></div></div><div class="divider"></div><div class="pane"><div id="aScroll" class="scroll"><div id="aStage" class="stage"><canvas id="aCanvas" class="answerCanvas"></canvas><canvas id="scoreCorrection" class="hidden" aria-label="답안 수정 필기"></canvas></div></div><div class="tools"><button id="aPen" class="on">답안펜</button><button id="aErase">지우개</button><button id="aClear">필기삭제</button><button id="fitA">맞춤</button><button id="zoomOutA">−</button><button id="zoomInA">＋</button><label>굵기 <input id="aSize" type="range" min="1" max="14" value="3"></label></div></div></div></section>
  <section id="score" class="hidden"><div class="bar"><strong>자가채점</strong><span id="scoreMeta" class="badge"></span><button id="back">답안으로</button><span id="scoreStatus" class="status"></span></div><div class="scorebody">
    <div class="score-comparison">
      <section class="card" aria-labelledby="scoreAnswerTitle">
        <div class="bar" style="padding:0;border:0"><strong id="scoreAnswerTitle">내 답안</strong></div>
        <div class="bar score-edit-tools" role="group" aria-label="답안 수정 도구">
          <button id="cPen">수정펜</button>
          <button id="cErase">수정 지우개</button>
          <button id="cClear">수정필기 삭제</button>
          <label>수정 굵기 <input id="cSize" type="range" min="1" max="20" value="4"></label>
        </div>
        <div id="scoreAnswer" class="score-paper" role="region" tabindex="0" aria-label="내 손글씨 답안"></div>
      </section>
      <section class="card" aria-labelledby="scoreExplanationTitle">
        <div class="bar" style="padding:0;border:0"><strong id="scoreExplanationTitle">해설 / 모범답안</strong><span id="expBadge" class="badge"></span><button id="prevExp">이전</button><button id="nextExp">다음</button></div>
        <div class="score-paper exp" role="region" tabindex="0" aria-label="해설 / 모범답안"><img id="expImg" alt="해설 이미지"><pre id="model"></pre></div>
      </section>
    </div>
    <div class="card"><strong>채점포인트</strong><div id="checklist"></div></div><div class="card"><div class="grid"><label>점수<input id="scoreValue" type="number" min="0" step="0.5"></label><label>난이도<select id="difficulty"><option value="중">중</option><option value="상">상</option><option value="하">하</option></select></label><label>복습필요<select id="review"><option value="true">예</option><option value="false">아니오</option></select></label><label>완성도<select id="completion"><option value="목차만">목차만</option><option value="불완전">불완전</option><option value="완성">완성</option></select></label></div><label>메모<textarea id="memo" rows="3"></textarea></label><div class="bar" style="padding:8px 0 0;border:0"><button id="save">기록 저장</button><button id="saveNext">저장 후 다음</button><button id="saveFinish">저장 후 끝내기</button></div></div></div></section>
  <script>
  (()=>{const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let problem=null,index=0,total=1,mode='outline',qPage=0,expPage=0,qScale=1,aScale=1,aFitScale=1,startedAt=0,elapsedBase=0,timer=null;
  const pages=v=>Array.isArray(v)?v.filter(Boolean):[];const fmt=ms=>{const s=Math.floor(Math.max(0,ms)/1000);return Math.floor(s/60).toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0')};const elapsed=()=>elapsedBase+(Date.now()-startedAt);
  function tick(){const e=elapsed();$('timer').textContent=fmt(e);const lim=Number(problem?.timeLimit||0)*60000;$('limit').textContent=lim?(e<=lim?'남은 '+fmt(lim-e):'초과 '+fmt(e-lim)):''}
  function bindInk(id,prefix,color){
    const canvas=$(id),stage=canvas.parentElement,ctx=canvas.getContext('2d');
    const strokes=[];
    const pen=$(prefix+'Pen'),erase=$(prefix+'Erase'),sizeInput=$(prefix+'Size');
    let active=null,resizeTimer,erasing=false;

    function selectTool(useEraser){
      erasing=useEraser;
      pen.classList.toggle('on',!erasing);
      erase.classList.toggle('on',erasing);
      pen.setAttribute('aria-pressed',String(!erasing));
      erase.setAttribute('aria-pressed',String(erasing));
    }

    pen.onclick=()=>selectTool(false);
    erase.onclick=()=>selectTool(true);
    $(prefix+'Clear').onclick=()=>{
      if(prefix!=='c'||confirm('현재 답안 수정필기를 지울까요?'))clear();
    };
    selectTool(false);

    function paint(stroke,start=0){
      const {points,size,eraser}=stroke;
      ctx.setTransform(canvas.width/Number(stage.dataset.w),0,0,canvas.height/Number(stage.dataset.h),0,0);
      ctx.globalCompositeOperation=eraser?'destination-out':'source-over';
      ctx.fillStyle=ctx.strokeStyle=color;
      if(start===0){
        ctx.beginPath();
        ctx.arc(points[0].x,points[0].y,size/2,0,Math.PI*2);
        ctx.fill();
      }
      const first=Math.max(1,start);
      if(first>=points.length)return;
      ctx.lineWidth=size;
      ctx.lineCap=ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(points[first-1].x,points[first-1].y);
      for(let i=first;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
      ctx.stroke();
    }

    function resize(){
      clearTimeout(resizeTimer);
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height)return;
      // Bound both the canvas dimensions and memory use on high-DPI devices.
      const density=Math.min(window.devicePixelRatio||1,4096/width,4096/height,Math.sqrt((8*1024*1024)/(width*height)));
      const pixelsWide=Math.max(1,Math.floor(width*density));
      const pixelsHigh=Math.max(1,Math.floor(height*density));
      if(canvas.width===pixelsWide&&canvas.height===pixelsHigh)return;
      canvas.width=pixelsWide;
      canvas.height=pixelsHigh;
      for(const stroke of strokes)paint(stroke);
    }

    function scheduleResize(){
      clearTimeout(resizeTimer);
      // Keep the current ink visible during a pinch, then redraw at the new scale.
      resizeTimer=setTimeout(resize,120);
    }

    function point(event,rect){
      return {
        x:(event.clientX-rect.left)/rect.width*Number(stage.dataset.w),
        y:(event.clientY-rect.top)/rect.height*Number(stage.dataset.h)
      };
    }

    canvas.addEventListener('pointerdown',event=>{
      if(event.pointerType==='touch'||active||(prefix==='c'&&event.pointerType!=='pen'))return;
      const rect=canvas.getBoundingClientRect();
      if(rect.width<2||rect.height<2||!Number(stage.dataset.w))return;
      event.preventDefault();
      event.stopPropagation();
      try{canvas.setPointerCapture(event.pointerId)}catch{}
      resize();
      const size=Number(sizeInput.value)*(erasing?5:1);
      const stroke={eraser:erasing,size,points:[point(event,rect)]};
      strokes.push(stroke);
      active={id:event.pointerId,stroke};
      paint(stroke);
    },true);

    canvas.addEventListener('pointermove',event=>{
      if(event.pointerId!==active?.id)return;
      event.preventDefault();
      event.stopPropagation();
      const rect=canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      let samples;
      try{samples=event.getCoalescedEvents?.()}catch{}
      const stroke=active.stroke,start=stroke.points.length;
      for(const sample of samples?.length?samples:[event]){
        const next=point(sample,rect),previous=stroke.points[stroke.points.length-1];
        if(next.x!==previous.x||next.y!==previous.y)stroke.points.push(next);
      }
      if(stroke.points.length>start)paint(stroke,start);
    },true);

    function end(event){
      if(event.pointerId!==active?.id)return;
      event.preventDefault();
      event.stopPropagation();
      active=null;
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end,true);

    function clear(){
      active=null;
      strokes.length=0;
      ctx.resetTransform();
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    return {resize,scheduleResize,clear};
  }
  const ink={
    q:bindInk('qCanvas','q','#0ea5e9'),
    a:bindInk('aCanvas','a','#111827'),
    correction:bindInk('scoreCorrection','c','#ef4444')
  };
  window.addEventListener('resize',()=>{
    if(answerView)fitScoreAnswer();
    ink.q.scheduleResize();
    ink.a.scheduleResize();
  });
  function panZoom(scroll,stage,key,min,max){const sc=$(scroll),st=$(stage),touch=new Map();let pan=null,pinch=null;const ls=()=>[...touch.values()],dist=()=>{const p=ls();return p.length<2?1:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1},mid=()=>{const p=ls();return p.length<2?{x:0,y:0}:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}};const apply=v=>{if(key==='q')qScale=clamp(v,min,max);else {
      aScale=clamp(v,min,max);
      $('aCanvas').style.setProperty('--answer-zoom',aScale/aFitScale);
    }
    const z=key==='q'?qScale:aScale,w=Number(st.dataset.w||1),h=Number(st.dataset.h||1);st.style.width=Math.round(w*z)+'px';st.style.height=Math.round(h*z)+'px';ink[key].scheduleResize()};sc.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;e.preventDefault();try{sc.setPointerCapture(e.pointerId)}catch{};touch.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touch.size>=2){const m=mid(),r=sc.getBoundingClientRect(),z=key==='q'?qScale:aScale;pinch={d:dist(),z,cx:(sc.scrollLeft+m.x-r.left)/z,cy:(sc.scrollTop+m.y-r.top)/z};pan=null}else pan={id:e.pointerId,x:e.clientX,y:e.clientY,l:sc.scrollLeft,t:sc.scrollTop}},true);sc.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||!touch.has(e.pointerId))return;e.preventDefault();touch.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touch.size>=2&&pinch){const m=mid(),r=sc.getBoundingClientRect(),z=clamp(pinch.z*dist()/Math.max(1,pinch.d),min,max);apply(z);sc.scrollLeft=Math.max(0,pinch.cx*z-(m.x-r.left));sc.scrollTop=Math.max(0,pinch.cy*z-(m.y-r.top))}else if(pan&&pan.id===e.pointerId){sc.scrollLeft=pan.l-(e.clientX-pan.x);sc.scrollTop=pan.t-(e.clientY-pan.y)}},true);const end=e=>{if(e.pointerType!=='touch'||!touch.has(e.pointerId))return;touch.delete(e.pointerId);if(touch.size===1){const [id,p]=[...touch.entries()][0];pan={id,x:p.x,y:p.y,l:sc.scrollLeft,t:sc.scrollTop};pinch=null}else if(!touch.size){pan=null;pinch=null}};sc.addEventListener('pointerup',end,true);sc.addEventListener('pointercancel',end,true);return apply}
  const applyQ=panZoom('qScroll','qStage','q',.08,4),applyA=panZoom('aScroll','aStage','a',.2,3);
  function qShow(n){const arr=pages(problem?.questionPages);qPage=clamp(Number(n)||0,0,Math.max(0,arr.length-1));$('qBadge').textContent=arr.length?'문제 '+(qPage+1)+'/'+arr.length+'쪽':'문제 없음';ink.q.clear();if(!arr.length){$('qImg').removeAttribute('src');return}const img=$('qImg'),st=$('qStage'),sc=$('qScroll');img.onload=()=>{const w=img.naturalWidth||1,h=img.naturalHeight||1;st.dataset.w=w;st.dataset.h=h;qScale=clamp((sc.clientWidth-8)/w,.08,1.5);applyQ(qScale);ink.q.resize();sc.scrollLeft=0;sc.scrollTop=0};img.src=arr[qPage]}
  function answerReset(){const st=$('aStage'),sc=$('aScroll'),w=900,h=1300;st.dataset.w=w;st.dataset.h=h;ink.a.clear();ink.correction.clear();aFitScale=clamp((sc.clientWidth-8)/w,.2,1);applyA(aFitScale);ink.a.resize();sc.scrollLeft=0;sc.scrollTop=0}
  let answerView=null;
  function fitScoreAnswer(){
    const width=$('scoreAnswer').clientWidth;
    if(!width)return;
    const paperWidth=Number($('aStage').dataset.w);
    applyA(Math.min(width/paperWidth,1));
    ink.correction.scheduleResize();
  }

  function showScoreAnswer(){
    const scroll=$('aScroll'),preview=$('scoreAnswer');
    answerView={scale:aScale,left:scroll.scrollLeft,top:scroll.scrollTop};
    // The preview displays the same page and ink as the editor.
    preview.appendChild($('aStage'));
    $('scoreCorrection').classList.remove('hidden');
    fitScoreAnswer();
    $('score').querySelector('.scorebody').scrollTop=0;
    preview.scrollTop=0;
    ink.a.resize();
    ink.correction.resize();
  }

  function restoreAnswer(){
    if(!answerView)return;
    const scroll=$('aScroll');
    $('scoreCorrection').classList.add('hidden');
    scroll.appendChild($('aStage'));
    applyA(answerView.scale);
    scroll.scrollLeft=answerView.left;
    scroll.scrollTop=answerView.top;
    answerView=null;
    ink.a.resize();
  }

  function open(data){problem=data.problem;index=data.index;total=data.total;mode=data.mode;elapsedBase=0;startedAt=Date.now();$('solve').classList.remove('hidden');$('score').classList.add('hidden');restoreAnswer();$('title').textContent=problem.title||((problem.session?problem.session+' ':'')+(problem.subject||'')+' 문제');$('setBadge').textContent=(index+1)+'/'+total+' · '+(mode==='outline'?'목차연습':'실전답안');qShow(0);answerReset();clearInterval(timer);timer=setInterval(tick,500);tick();$('status').textContent=''}
  function submit(){elapsedBase=elapsed();clearInterval(timer);timer=null;$('score').classList.remove('hidden');showScoreAnswer();$('solve').classList.add('hidden');$('scoreMeta').textContent=(problem.title||'문제')+' · '+fmt(elapsedBase);$('scoreValue').value='';$('scoreValue').max=problem.maxScore||'';$('review').value='true';$('completion').value=mode==='outline'?'목차만':'완성';$('memo').value='';const box=$('checklist');box.innerHTML='';const pts=Array.isArray(problem.points)&&problem.points.length?problem.points:String(problem.pointsText||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);if(!pts.length)box.textContent='채점포인트 없음';else pts.forEach((x,i)=>{const l=document.createElement('label');l.className='check';l.innerHTML='<input type="checkbox"><span></span>';l.querySelector('span').textContent=x;box.appendChild(l)});expShow(0)}
  function expShow(n){const arr=pages(problem?.explanationPages);expPage=clamp(Number(n)||0,0,Math.max(0,arr.length-1));$('expBadge').textContent=arr.length?'해설 '+(expPage+1)+'/'+arr.length+'쪽':'해설 이미지 없음';$('prevExp').disabled=expPage===0;$('nextExp').disabled=expPage>=arr.length-1;if(arr.length){$('expImg').src=arr[expPage];$('expImg').style.display='block'}else{$('expImg').removeAttribute('src');$('expImg').style.display='none'}$('model').textContent=problem.modelText||'';const viewer=$('expImg').parentElement;viewer.classList.toggle('hidden',!arr.length&&!problem.modelText);viewer.scrollTop=0}
  function back(){ $('score').classList.add('hidden');$('solve').classList.remove('hidden');restoreAnswer();startedAt=Date.now();clearInterval(timer);timer=setInterval(tick,500);tick() }
  function sendSave(action){parent.postMessage({source:'essay-lite91',type:'save',action,data:{elapsedMs:elapsedBase||elapsed(),score:$('scoreValue').value===''?null:Number($('scoreValue').value),difficulty:$('difficulty').value,needReview:$('review').value,completion:$('completion').value,memo:$('memo').value.trim(),checkedPoints:Array.from(document.querySelectorAll('#checklist input')).map(x=>!!x.checked)}},'*');$('scoreStatus').textContent='저장 중...'}
  window.addEventListener('message',e=>{const m=e.data||{};if(e.source!==parent||m.source!=='essay-lite91-parent')return;if(m.type==='open')open(m);else if(m.type==='saved')$('scoreStatus').textContent='저장 완료'});
  $('prevQ').onclick=()=>qShow(qPage-1);$('nextQ').onclick=()=>qShow(qPage+1);$('fitQ').onclick=()=>{const sc=$('qScroll'),st=$('qStage');qScale=clamp((sc.clientWidth-8)/Number(st.dataset.w||1),.08,1.5);applyQ(qScale);sc.scrollLeft=0;sc.scrollTop=0};$('zoomOutQ').onclick=()=>applyQ(qScale-.15);$('zoomInQ').onclick=()=>applyQ(qScale+.15);$('fitA').onclick=()=>{const sc=$('aScroll'),st=$('aStage');aScale=clamp((sc.clientWidth-8)/Number(st.dataset.w||900),.2,1);applyA(aScale);sc.scrollLeft=0;sc.scrollTop=0};$('zoomOutA').onclick=()=>applyA(aScale-.15);$('zoomInA').onclick=()=>applyA(aScale+.15);$('submit').onclick=submit;$('exit').onclick=()=>parent.postMessage({source:'essay-lite91',type:'exit'},'*');$('back').onclick=back;$('prevExp').onclick=()=>expShow(expPage-1);$('nextExp').onclick=()=>expShow(expPage+1);$('save').onclick=()=>sendSave('stay');$('saveNext').onclick=()=>sendSave('next');$('saveFinish').onclick=()=>sendSave('finish');
  parent.postMessage({source:'essay-lite91',type:'ready'},'*');})();
  </script></body></html>`}

  function openFrame(){
    const frame=document.createElement('iframe');
    frame.id='essayLiteFrameV91';
    frame.title='경량 문제풀이';
    frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;background:#f5f7fb;display:none';
    frame.srcdoc=frameHTML();
    lite.frame=frame;
    lite.frameTimeout=setTimeout(()=>{
      close();
      toast('문제풀이 화면을 열지 못했어요. 다시 시도해 주세요.');
    },5000);
    document.body.appendChild(frame);
  }

  function postOpen(){
    const problem=current();
    if(!problem||!lite.frame)return;
    lite.frame.style.display='block';
    lite.frame.contentWindow.postMessage({
      source:'essay-lite91-parent',
      type:'open',
      problem,
      index:lite.session.index,
      total:lite.session.ids.length,
      mode:lite.session.mode
    },'*');
  }

  function startLite(ids,mode){
    if(!Array.isArray(ids)||!ids.length||!problemById(ids[0])||lite.frame)return;
    lite.session={ids:[...ids],index:0,mode:mode||'outline'};
    lite.attemptIds.clear();
    state.solve=lite.session;
    openFrame();
  }

  function close(){
    clearTimeout(lite.frameTimeout);
    lite.frame?.remove();
    lite.frame=null;
    lite.session=null;
    state.solve=null;
    renderAll();
  }
  async function saveMeta(data){const p=current();if(!p||!lite.session)return null;const idx=lite.session.index;let id=lite.attemptIds.get(idx);if(!id){id=typeof uuid==='function'?uuid():`id_${Date.now()}`;lite.attemptIds.set(idx,id)}const row={id,problemId:p.id,subject:p.subject,session:p.session,mode:lite.session.mode,answer:'',elapsedMs:Number(data.elapsedMs||0),score:data.score,maxScore:p.maxScore||0,difficulty:data.difficulty||'중',needReview:data.needReview||'true',completion:data.completion||(lite.session.mode==='outline'?'목차만':'완성'),memo:data.memo||'',checkedPoints:Array.isArray(data.checkedPoints)?data.checkedPoints:[],completedAt:typeof nowIso==='function'?nowIso():new Date().toISOString()};await put(STORE_ATTEMPTS,row);const i=(state.attempts||[]).findIndex(a=>String(a.id)===String(id));if(i>=0)state.attempts[i]=row;else state.attempts.unshift(row);state.attempts.sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));if(p.manualUnseenV78===true){p.manualUnseenV78=false;try{await put(STORE_PROBLEMS,p)}catch{}}return row}
  window.addEventListener('message',async event=>{
    const message=event.data||{};
    const {frame,session}=lite;
    if(!frame||event.source!==frame.contentWindow||message.source!=='essay-lite91')return;
    if(message.type==='ready'){
      clearTimeout(lite.frameTimeout);
      postOpen();
      return;
    }
    if(message.type==='exit'){
      close();
      return;
    }
    if(message.type!=='save')return;

    try{
      await saveMeta(message.data||{});
      if(lite.session!==session)return;
      frame.contentWindow.postMessage({source:'essay-lite91-parent',type:'saved'},'*');
      if(message.action==='finish'||(message.action==='next'&&session.index>=session.ids.length-1)){
        close();
      }else if(message.action==='next'){
        session.index++;
        postOpen();
      }
    }catch(error){
      console.error('e91 save',error);
      toast('기록 저장 실패');
    }
  });

  // Problem-solve filters: stop the legacy renderAll() fan-out and render only 50 solve cards.
  let solveLimitV91=50;
  function fastSolveListV91(){
    const list=document.getElementById('solveList');if(!list)return;
    let arr=filterProblems({subject:document.getElementById('solveSubject')?.value||'',session:document.getElementById('solveSession')?.value||'',scope:typeof solveScopeV25==='function'?solveScopeV25():undefined});
    list.innerHTML='';try{renderScopeSummaryV25?.(arr)}catch{}
    if(!arr.length){list.innerHTML='<p class="hint">조건에 맞는 문제가 없어.</p>';return}
    const frag=document.createDocumentFragment();for(const problem of arr.slice(0,solveLimitV91))frag.appendChild(problemCard(problem,{solve:true}));list.appendChild(frag);
    if(solveLimitV91<arr.length){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=`더 보기 (${Math.min(solveLimitV91,arr.length)}/${arr.length})`;b.style.cssText='display:block;margin:10px auto';b.onclick=()=>{solveLimitV91=Math.min(arr.length,solveLimitV91+50);fastSolveListV91()};list.appendChild(b)}
  }
  renderSolveList=fastSolveListV91;
  for(const type of ['input','change'])document.addEventListener(type,e=>{
    const id=e.target?.id;if(!['solveSubject','solveSession','solveScope','solveMode','randomCount'].includes(id))return;
    e.stopImmediatePropagation();
    if(['solveSubject','solveSession','solveScope'].includes(id)){solveLimitV91=50;requestAnimationFrame(fastSolveListV91)}
  },true);
  setTimeout(()=>{try{fastSolveListV91()}catch{}},0);

  // Route every existing problem-start path to isolated runtime.
  startSolve=startLite;
  window.essayLiteRuntimeV91={start:startLite,close,renderSolveList:fastSolveListV91};
})();
