const APP_VERSION="essay-psat-base-v49";const DB_NAME="essayPsatBaseDB_v1";const DB_VERSION=1;const STORE_PROBLEMS="problems";const STORE_ATTEMPTS="attempts";const $=id=>document.getElementById(id);const $$=sel=>Array.from(document.querySelectorAll(sel));let db;const state={problems:[],attempts:[],questionPages:[],explanationPages:[],selectedQuestionPage:-1,selectedExplanationPage:-1,activePasteTarget:"question",solve:null,timer:null,qPage:0,expPage:0,zoom:1,installPrompt:null};
function uuid(){return crypto.randomUUID&&crypto.randomUUID()||`id_${Date.now()}_${Math.random().toString(16).slice(2)}`}function nowIso(){return new Date().toISOString()}function toast(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add("hidden"),2300)}function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function fmtTime(ms){ms=Math.max(0,Math.floor(ms||0));const sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}function pointsFromText(text){return String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean)}function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE_PROBLEMS))d.createObjectStore(STORE_PROBLEMS,{keyPath:"id"});if(!d.objectStoreNames.contains(STORE_ATTEMPTS))d.createObjectStore(STORE_ATTEMPTS,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name)}function getAll(name){return new Promise((resolve,reject)=>{const req=store(name).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}function put(name,value){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error)})}function del(name,key){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}function clearStore(name){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").clear();req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}async function loadData(){state.problems=(await getAll(STORE_PROBLEMS)).sort((a,b)=>(a.order||0)-(b.order||0));state.attempts=(await getAll(STORE_ATTEMPTS)).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))}function setPasteTarget(target){state.activePasteTarget=target;$("questionPasteZone")?.classList.toggle("active-paste",target==="question");$("explanationPasteZone")?.classList.toggle("active-paste",target==="explanation")}function dataUrlBytes(dataUrl){const comma=dataUrl.indexOf(",");const base64=comma>=0?dataUrl.slice(comma+1):dataUrl;return Math.round(base64.length*.75)}function formatBytes(bytes){if(!bytes)return"0B";const u=["B","KB","MB"];let v=bytes,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return`${v.toFixed(i?1:0)}${u[i]}`}function imageBlobToDataUrl(blob){return new Promise((resolve,reject)=>{const mode=$("qualityInput").value||"sharp";if(mode==="original"){const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const maxDim=mode==="bulk"?1500:2400,scale=Math.min(1,maxDim/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL("image/jpeg",mode==="bulk"?.72:.88))};img.onerror=reject;img.src=reader.result};reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}async function addImageFiles(files,target){const arr=Array.from(files||[]).filter(file=>file&&file.type&&file.type.startsWith("image/"));if(!arr.length){toast("이미지 파일이 없어");return}let added=0,size=0;for(const file of arr){const data=await imageBlobToDataUrl(file);if(target==="explanation")state.explanationPages.push(data);else state.questionPages.push(data);size+=dataUrlBytes(data);added++}renderPageLists();setPasteTarget(target);toast(`${target==="explanation"?"해설":"문제"} 이미지 ${added}장 추가 · ${formatBytes(size)}`)}async function pasteImageFromClipboardEvent(event,explicitTarget=""){const items=event.clipboardData?.items?Array.from(event.clipboardData.items):[];const files=items.filter(entry=>entry.type&&entry.type.startsWith("image/")).map(entry=>entry.getAsFile()).filter(Boolean);if(!files.length)return false;event.preventDefault();const target=explicitTarget||event.target.closest?.("[data-paste-target]")?.dataset?.pasteTarget||state.activePasteTarget||"question";toast("스크린샷 처리 중...");await addImageFiles(files,target);return true}async function pasteImageWithClipboardApi(target){setPasteTarget(target);if(!navigator.clipboard||!navigator.clipboard.read){toast("이 브라우저는 버튼 붙여넣기를 지원하지 않아. 영역 클릭 후 Ctrl+V를 눌러줘.");return}try{const items=await navigator.clipboard.read();const files=[];for(const item of items){const type=item.types.find(t=>t.startsWith("image/"));if(!type)continue;const blob=await item.getType(type);files.push(new File([blob],`${target}_${Date.now()}_${files.length}.png`,{type}))}if(!files.length){toast("클립보드에 이미지가 없어");return}toast("스크린샷 처리 중...");await addImageFiles(files,target)}catch(err){console.warn(err);toast("붙여넣기 권한이 막혔어. 영역 클릭 후 Ctrl+V를 눌러줘.")}}function setupPasteZone(zoneId,inputId,target){const zone=$(zoneId),input=$(inputId);zone.addEventListener("click",()=>{setPasteTarget(target);zone.focus()});zone.addEventListener("focus",()=>setPasteTarget(target));zone.addEventListener("paste",event=>pasteImageFromClipboardEvent(event,target));input.addEventListener("change",async()=>{await addImageFiles(input.files,target);input.value=""})}function makeButton(text,fn,cls=""){const b=document.createElement("button");b.type="button";b.textContent=text;if(cls)b.className=cls;b.addEventListener("click",fn);return b}function movePage(target,index,dir){const arr=target==="explanation"?state.explanationPages:state.questionPages,next=index+dir;if(next<0||next>=arr.length)return;[arr[index],arr[next]]=[arr[next],arr[index]];renderPageLists()}function deletePage(target,index){const arr=target==="explanation"?state.explanationPages:state.questionPages;arr.splice(index,1);renderPageLists()}function renderPageList(id,arr,target){const box=$(id);box.innerHTML="";if(!arr.length){box.innerHTML='<p class="hint">아직 이미지가 없어.</p>';return}arr.forEach((src,index)=>{const div=document.createElement("div");div.className="page-item";div.innerHTML=`<img src="${src}" alt="${index+1}쪽" /><div><strong>${index+1}쪽</strong><p class="hint">${target==="explanation"?"해설":"문제"} 페이지</p><div class="page-actions"></div></div>`;const actions=div.querySelector(".page-actions");actions.append(makeButton("위",()=>movePage(target,index,-1),"secondary small"));actions.append(makeButton("아래",()=>movePage(target,index,1),"secondary small"));actions.append(makeButton("삭제",()=>deletePage(target,index),"danger small"));box.append(div)})}function renderPageLists(){renderPageList("questionPageList",state.questionPages,"question");renderPageList("explanationPageList",state.explanationPages,"explanation")}function titleOf(p){return p.title||`${p.session?p.session+" ":""}${p.subject||""} 문제`}function attemptsOf(id){return state.attempts.filter(a=>a.problemId===id)}function lastAttempt(id){return attemptsOf(id).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))[0]}function metaOf(p){const last=lastAttempt(p.id);return`${p.subject||"-"} · ${p.session||"회차 없음"} · 문제 ${realPages(p.questionPages||[]).length}쪽 · 해설 ${realPages(p.explanationPages||[]).length}쪽 · ${p.maxScore||0}점 · 제한 ${p.timeLimit||0}분 · 기록 ${attemptsOf(p.id).length}회${last?" · 최근 "+fmtTime(last.elapsedMs):""}`}function filterProblems({subject="",session="",search=""}={}){const s=session.trim().toLowerCase(),q=search.trim().toLowerCase();return state.problems.filter(p=>{if(subject&&p.subject!==subject)return false;if(s&&!String(p.session||"").toLowerCase().includes(s))return false;if(q){const blob=[p.title,p.session,p.subject,p.pointsText,p.modelText].join(" ").toLowerCase();if(!blob.includes(q))return false}return true})}function showView(id){$$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));renderAll()}function problemCard(p,opts={}){const last=lastAttempt(p.id),div=document.createElement("div");div.className="problem-card";div.innerHTML=`<h3>${esc(titleOf(p))}</h3><p class="meta">${esc(metaOf(p))}</p><div class="badges"><span class="badge">${esc(p.subject||"-")}</span><span class="badge">${esc(p.session||"회차 없음")}</span><span class="badge">문제 ${realPages(p.questionPages||[]).length}쪽</span><span class="badge">해설 ${realPages(p.explanationPages||[]).length}쪽</span>${last?`<span class="badge">최근점수 ${last.score??"-"}</span>`:""}</div><div class="card-actions"></div>`;const actions=div.querySelector(".card-actions");if(opts.solve)actions.append(makeButton("풀기",()=>startSolve([p.id],$("solveMode").value||"outline")));if(opts.review)actions.append(makeButton("다시 풀기",()=>startSolve([p.id],"outline")));if(opts.list){actions.append(makeButton("수정",()=>fillForm(p),"secondary"));actions.append(makeButton("복제",async()=>{const copy={...p,id:uuid(),title:`${titleOf(p)} 복사본`,createdAt:nowIso(),updatedAt:nowIso(),order:Date.now()};await put(STORE_PROBLEMS,copy);await loadData();renderAll();toast("복제 완료")},"secondary"));actions.append(makeButton("삭제",async()=>{if(!confirm("이 문제와 풀이기록을 삭제할까?"))return;await del(STORE_PROBLEMS,p.id);for(const a of attemptsOf(p.id))await del(STORE_ATTEMPTS,a.id);await loadData();renderAll();toast("삭제 완료")},"danger small"))}return div}function renderSolveList(){const list=$("solveList"),arr=filterProblems({subject:$("solveSubject").value,session:$("solveSession").value});list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">조건에 맞는 문제가 없어.</p>';return}arr.forEach(p=>list.append(problemCard(p,{solve:true})))}function renderList(){const list=$("problemList"),arr=filterProblems({subject:$("listSubject").value,session:$("listSession").value,search:$("listSearch").value});list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">등록된 문제가 없어.</p>';return}arr.forEach((p,i)=>{const card=problemCard(p,{list:true});card.querySelector("h3").textContent=`${i+1}. ${titleOf(p)}`;list.append(card)})}function renderReview(){const list=$("reviewList");let arr=filterProblems({subject:$("reviewSubject").value,session:$("reviewSession").value});if($("reviewType").value==="needed")arr=arr.filter(p=>String(lastAttempt(p.id)?.needReview)==="true");else arr=arr.filter(p=>attemptsOf(p.id).length);list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">복습 대상이 없어.</p>';return}arr.forEach(p=>list.append(problemCard(p,{review:true})))}function renderStats(){const done=new Set(state.attempts.map(a=>a.problemId)).size,review=state.problems.filter(p=>String(lastAttempt(p.id)?.needReview)==="true").length;$("statsGrid").innerHTML=`<div class="stat-card">등록 문제<strong>${state.problems.length}</strong></div><div class="stat-card">풀이 완료<strong>${done}</strong></div><div class="stat-card">풀이 기록<strong>${state.attempts.length}</strong></div><div class="stat-card">복습 필요<strong>${review}</strong></div>`}function renderContinue(){$("continueBtn").classList.toggle("hidden",!localStorage.getItem("essayPsatBaseDraft"))}function renderAll(){renderSolveList();renderList();renderReview();renderStats();renderContinue();renderPageLists()}async function saveProblem(event){event.preventDefault();const id=$("editId").value||uuid(),existing=state.problems.find(p=>p.id===id);if(!realPages(state.questionPages).length){toast("문제 이미지를 최소 1쪽 넣어줘");return}const problem={id,subject:$("subjectInput").value,session:$("sessionInput").value.trim(),title:$("titleInput").value.trim(),maxScore:Number($("scoreInput").value||0),timeLimit:Number($("timeInput").value||0),questionPages:realPages(state.questionPages),explanationPages:realPages(state.explanationPages),pointsText:$("pointsInput").value.trim(),points:pointsFromText($("pointsInput").value),modelText:$("modelTextInput").value.trim(),order:existing?.order??Date.now(),createdAt:existing?.createdAt||nowIso(),updatedAt:nowIso()};await put(STORE_PROBLEMS,problem);await loadData();toast($("editId").value?"수정 저장 완료":"저장 완료");resetForm();renderAll()}function fillForm(p){$("formTitle").textContent="문제 수정";$("editId").value=p.id;$("subjectInput").value=p.subject||"형법";$("sessionInput").value=p.session||"";$("titleInput").value=p.title||"";$("scoreInput").value=p.maxScore||20;$("timeInput").value=p.timeLimit||30;$("pointsInput").value=p.pointsText||(p.points||[]).join("\n");$("modelTextInput").value=p.modelText||"";state.questionPages=[...(p.questionPages||[])];state.explanationPages=[...(p.explanationPages||[])];renderPageLists();showView("addView");window.scrollTo(0,0)}function resetForm(){$("formTitle").textContent="문제 등록";$("problemForm").reset();$("editId").value="";$("scoreInput").value=20;$("timeInput").value=30;$("qualityInput").value="sharp";state.questionPages=[];state.explanationPages=[];setPasteTarget("question");renderPageLists()}function chooseRandom(arr,n){return[...arr].sort(()=>Math.random()-.5).slice(0,Math.min(n,arr.length))}function startRandom(reviewOnly=false){let arr=filterProblems({subject:$("solveSubject").value,session:$("solveSession").value});if(reviewOnly)arr=arr.filter(p=>String(lastAttempt(p.id)?.needReview)==="true");if(!arr.length){toast(reviewOnly?"복습필요 문제가 없어":"조건에 맞는 문제가 없어");return}const picks=chooseRandom(arr,Number($("randomCount").value||1));startSolve(picks.map(p=>p.id),$("solveMode").value||"outline")}function currentProblem(){return state.problems.find(p=>p.id===state.solve?.ids[state.solve.index])}function startSolve(ids,mode){state.solve={ids,index:0,mode,startedAt:Date.now(),startedProblemAt:Date.now(),elapsedBase:0,answer:""};state.qPage=0;localStorage.setItem("essayPsatBaseDraft",JSON.stringify(state.solve));openCurrentProblem()}function openCurrentProblem(){const p=currentProblem();if(!p){finishSolve(false);return}state.qPage=0;$("solveOverlay").classList.remove("hidden");$("solveTitle").textContent=titleOf(p);$("solveMeta").textContent=metaOf(p);$("setBadge").textContent=`${state.solve.index+1}/${state.solve.ids.length} · ${state.solve.mode==="outline"?"목차연습":"실전답안"}`;$("answerLabel").textContent=state.solve.mode==="outline"?"내 목차/쟁점":"내 답안";$("answerText").value=state.solve.answer||"";showQuestionPage(0);clearInterval(state.timer);state.timer=setInterval(updateTimer,500);updateTimer()}function showQuestionPage(index){const p=currentProblem(),pages=realPages(p?.questionPages||[]);state.qPage=Math.max(0,Math.min(index,pages.length-1));$("questionImageView").src=pages[state.qPage]||"";$("questionPageBadge").textContent=pages.length?`문제 ${state.qPage+1}/${pages.length}쪽`:"문제 없음";fitImage();saveDraft()}function elapsedNow(){return state.solve?(state.solve.elapsedBase||0)+Date.now()-state.solve.startedProblemAt:0}function updateTimer(){const p=currentProblem(),elapsed=elapsedNow();$("timerText").textContent=fmtTime(elapsed);const limit=Number(p?.timeLimit||0)*6e4;$("limitText").textContent=limit?elapsed<=limit?`남은 ${fmtTime(limit-elapsed)}`:`초과 ${fmtTime(elapsed-limit)}`:""}function saveDraft(){if(!state.solve)return;state.solve.answer=$("answerText")?.value??state.solve.answer;localStorage.setItem("essayPsatBaseDraft",JSON.stringify(state.solve));renderContinue()}function pauseSolve(){if(!state.solve)return;state.solve.elapsedBase=elapsedNow();state.solve.answer=$("answerText").value;clearInterval(state.timer);state.timer=null;saveDraft();$("solveOverlay").classList.add("hidden");toast("이어풀기 저장 완료")}function continueSolve(){try{const saved=JSON.parse(localStorage.getItem("essayPsatBaseDraft")||"null");if(!saved||!saved.ids?.length){toast("이어풀 문제가 없어");return}state.solve=saved;state.solve.startedProblemAt=Date.now();openCurrentProblem()}catch{toast("이어풀 문제가 없어")}}function submitAnswer(){if(!state.solve)return;state.solve.elapsedBase=elapsedNow();state.solve.answer=$("answerText").value;clearInterval(state.timer);state.timer=null;openScore()}function openScore(){const p=currentProblem();if(!p)return;state.expPage=0;$("scoreOverlay").classList.remove("hidden");$("scoreMeta").textContent=`${titleOf(p)} · 풀이시간 ${fmtTime(state.solve.elapsedBase)}`;$("ownAnswerView").textContent=state.solve.answer||"(작성한 답안 없음)";$("modelTextView").textContent=p.modelText||"";$("attemptScoreInput").value="";$("attemptScoreInput").max=p.maxScore||"";$("completionInput").value=state.solve.mode==="outline"?"목차만":"완성";$("needReviewInput").value="true";renderChecklist(p);showExplanationPage(0)}function showExplanationPage(index){const p=currentProblem(),pages=realPages(p?.explanationPages||[]);state.expPage=Math.max(0,Math.min(index,pages.length-1));if(pages.length){$("explanationImageView").src=pages[state.expPage];$("explanationImageView").classList.remove("hidden");$("explanationPageBadge").textContent=`해설 ${state.expPage+1}/${pages.length}쪽`}else{$("explanationImageView").classList.add("hidden");$("explanationPageBadge").textContent="해설 이미지 없음"}}function renderChecklist(p){const box=$("pointChecklist"),points=p.points?.length?p.points:pointsFromText(p.pointsText);box.innerHTML="";if(!points.length){box.innerHTML='<p class="hint">채점포인트 없음</p>';return}points.forEach((point,i)=>{const row=document.createElement("label");row.className="check-item";row.innerHTML=`<input type="checkbox" data-point="${i}" /> <span>${esc(point)}</span>`;box.append(row)})}async function saveAttempt(){const p=currentProblem();if(!p||!state.solve)return null;const attempt={id:uuid(),problemId:p.id,subject:p.subject,session:p.session,mode:state.solve.mode,answer:state.solve.answer||"",elapsedMs:state.solve.elapsedBase,score:$("attemptScoreInput").value===""?null:Number($("attemptScoreInput").value),maxScore:p.maxScore||0,difficulty:$("difficultyResultInput").value,needReview:$("needReviewInput").value,completion:$("completionInput").value,memo:$("memoInput").value.trim(),checkedPoints:$$("#pointChecklist input").map(x=>x.checked),completedAt:nowIso()};await put(STORE_ATTEMPTS,attempt);await loadData();toast("풀이 기록 저장 완료");return attempt}async function saveAndNext(){await saveAttempt();if(!state.solve)return;if(state.solve.index>=state.solve.ids.length-1){finishSolve(true);return}state.solve.index++;state.solve.answer="";state.solve.elapsedBase=0;state.solve.startedProblemAt=Date.now();$("scoreOverlay").classList.add("hidden");openCurrentProblem()}function finishSolve(clearDraft=true){clearInterval(state.timer);state.timer=null;state.solve=null;$("solveOverlay").classList.add("hidden");$("scoreOverlay").classList.add("hidden");if(clearDraft)localStorage.removeItem("essayPsatBaseDraft");renderAll()}function fitImage(){state.zoom=1;applyZoom();setTimeout(()=>{const img=$("questionImageView"),scroller=$("questionImageScroller");if(!img.naturalWidth||!scroller.clientWidth)return;state.zoom=Math.max(.2,Math.min(1,(scroller.clientWidth-20)/img.naturalWidth));applyZoom()},30)}function applyZoom(){$("questionImageView").style.width=`${Math.round(state.zoom*100)}%`}async function exportBackup(){const payload={app:APP_VERSION,exportedAt:nowIso(),problems:state.problems,attempts:state.attempts};const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`essay_psat_base_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}async function importBackup(file){if(!file)return;const data=JSON.parse(await file.text());if(!Array.isArray(data.problems)){toast("백업 파일이 아니야");return}if(!confirm("백업 데이터를 현재 앱에 합쳐서 불러올까? 같은 ID는 덮어쓰기 돼."))return;for(const p of data.problems)await put(STORE_PROBLEMS,p);for(const a of data.attempts||[])await put(STORE_ATTEMPTS,a);await loadData();renderAll();toast("복원 완료")}async function wipeAll(){if(!confirm("모든 문제와 기록을 삭제할까? 백업 없으면 복구 불가."))return;await clearStore(STORE_PROBLEMS);await clearStore(STORE_ATTEMPTS);localStorage.removeItem("essayPsatBaseDraft");await loadData();resetForm();renderAll();toast("전체 삭제 완료")}function setupInstall(){
  const btn=$("installBtn");
  if(!btn)return;

  state.installPrompt=null;

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    state.installPrompt=event;
    btn.classList.remove("hidden");
  });

  window.addEventListener("appinstalled",()=>{
    state.installPrompt=null;
    btn.classList.add("hidden");
    toast("앱 설치 완료");
  });

  btn.addEventListener("click",async()=>{
    if(!state.installPrompt){
      toast("설치 준비 중이야. 잠시 후 다시 눌러줘.");
      return;
    }
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(()=>null);
    state.installPrompt=null;
    btn.classList.add("hidden");
  });
}
function setupEvents(){setupInstall();$$(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));["solveSubject","solveSession","solveMode","randomCount","listSubject","listSession","listSearch","reviewSubject","reviewSession","reviewType"].forEach(id=>{$(id).addEventListener("input",renderAll);$(id).addEventListener("change",renderAll)});setupPasteZone("questionPasteZone","questionFileInput","question");setupPasteZone("explanationPasteZone","explanationFileInput","explanation");document.addEventListener("paste",event=>pasteImageFromClipboardEvent(event));$("pasteQuestionBtn").addEventListener("click",()=>pasteImageWithClipboardApi("question"));$("pasteExplanationBtn").addEventListener("click",()=>pasteImageWithClipboardApi("explanation"));$("addQuestionFileBtn").addEventListener("click",()=>addBlankPage("question"));$("addExplanationFileBtn").addEventListener("click",()=>addBlankPage("explanation"));$("clearQuestionBtn").addEventListener("click",()=>{state.questionPages=[];renderPageLists()});$("clearExplanationBtn").addEventListener("click",()=>{state.explanationPages=[];renderPageLists()});$("problemForm").addEventListener("submit",saveProblem);$("resetBtn").addEventListener("click",resetForm);$("randomStartBtn").addEventListener("click",()=>startRandom(false));$("reviewRandomStartBtn").addEventListener("click",()=>startRandom(true));$("continueBtn").addEventListener("click",continueSolve);$("answerText").addEventListener("input",saveDraft);$("exitSolveBtn").addEventListener("click",pauseSolve);$("submitAnswerBtn").addEventListener("click",submitAnswer);$("prevQuestionPageBtn").addEventListener("click",()=>showQuestionPage(state.qPage-1));$("nextQuestionPageBtn").addEventListener("click",()=>showQuestionPage(state.qPage+1));$("fitBtn").addEventListener("click",fitImage);$("zoomInBtn").addEventListener("click",()=>{state.zoom=Math.min(3,state.zoom+.15);applyZoom()});$("zoomOutBtn").addEventListener("click",()=>{state.zoom=Math.max(.2,state.zoom-.15);applyZoom()});$("questionImageView").addEventListener("load",fitImage);$("backToAnswerBtn").addEventListener("click",()=>{$("scoreOverlay").classList.add("hidden");if(state.solve){state.solve.startedProblemAt=Date.now();clearInterval(state.timer);state.timer=setInterval(updateTimer,500);$("solveOverlay").classList.remove("hidden")}});$("prevExplanationPageBtn").addEventListener("click",()=>showExplanationPage(state.expPage-1));$("nextExplanationPageBtn").addEventListener("click",()=>showExplanationPage(state.expPage+1));$("saveAttemptBtn").addEventListener("click",saveAttempt);$("saveAndNextBtn").addEventListener("click",saveAndNext);$("finishBtn").addEventListener("click",async()=>{await saveAttempt();finishSolve(true)});$("exportBtn").addEventListener("click",exportBackup);$("importInput").addEventListener("change",async()=>{try{await importBackup($("importInput").files[0])}catch(e){console.error(e);toast("복원 실패")}$("importInput").value=""});$("wipeBtn").addEventListener("click",wipeAll)}async function init(){db=await openDB();await loadData();await normalizeStoredProblems();setupEvents();resetForm();renderAll();}
/* === v49: 에세이 PWA 설치 상태 1회 초기화 후 PSAT 방식으로 재등록 === */
async function resetEssayPwaOnceV49(){
  if(!("serviceWorker" in navigator))return;

  const resetKey="essayPwaResetV49Done";
  if(sessionStorage.getItem(resetKey)==="1")return;

  sessionStorage.setItem(resetKey,"1");

  try{
    const regs=await navigator.serviceWorker.getRegistrations();
    for(const reg of regs){
      try{
        const scope=String(reg.scope||"");
        if(scope.includes("/essay/"))await reg.unregister();
      }catch{}
    }
  }catch{}

  try{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(key=>String(key).toLowerCase().includes("essay"))
        .map(key=>caches.delete(key))
    );
  }catch{}

  /*
    IndexedDB / localStorage / Firebase 데이터는 삭제하지 않는다.
    서비스워커와 Cache Storage만 초기화한다.
  */
  location.replace("./?v=49&pwareset=1");
}

async function registerEssayServiceWorkerV49(){
  if(!("serviceWorker" in navigator))return;
  try{
    const reg=await navigator.serviceWorker.register("./sw.js");
    try{await reg.update()}catch{}
    try{await navigator.serviceWorker.ready}catch{}
  }catch(err){
    console.warn("Service worker registration failed",err);
  }
}

async function bootEssayV49(){
  await resetEssayPwaOnceV49();
  await registerEssayServiceWorkerV49();
  await init();
}

bootEssayV49().catch(err=>{
  console.error(err);
  alert(`앱 초기화 실패: ${err.message}`);
});

/* === v2 스타일러스 필기 레이어 === */
state.inkTool = "pen";
state.inkSize = 3;
state.currentStroke = null;
state.inkData = {};
try {
  state.inkData = JSON.parse(localStorage.getItem("essayPsatBaseInk_v2") || "{}");
} catch {
  state.inkData = {};
}

function inkKey() {
  const p = currentProblem?.();
  if (!p) return "";
  return `${p.id}:${state.qPage || 0}`;
}
function saveInkData() {
  try {
    localStorage.setItem("essayPsatBaseInk_v2", JSON.stringify(state.inkData));
  } catch (err) {
    console.warn(err);
    toast("필기 저장공간이 부족할 수 있어");
  }
}
function resizeInkCanvas() {
  const img = $("questionImageView");
  const canvas = $("inkCanvas");
  const wrap = $("imageCanvasWrap");
  if (!img || !canvas || !wrap || !img.naturalWidth) return;

  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  wrap.style.width = `${rect.width}px`;
  wrap.style.height = `${rect.height}px`;

  const dpr = window.devicePixelRatio || 1;
  const nextW = Math.max(1, Math.round(rect.width * dpr));
  const nextH = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }
  drawInk();
}
function drawInk() {
  const canvas = $("inkCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const strokes = state.inkData[inkKey()] || [];
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length < 1) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#0ea5e9";
    ctx.lineWidth = Number(stroke.size || 3);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
}
function canvasPoint(event) {
  const canvas = $("inkCanvas");
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}
function setInkTool(tool) {
  state.inkTool = tool === "eraser" ? "eraser" : "pen";
  $("penToolBtn")?.classList.toggle("ink-active", state.inkTool === "pen");
  $("eraserToolBtn")?.classList.toggle("ink-active", state.inkTool === "eraser");
  toast(state.inkTool === "pen" ? "펜 모드" : "지우개 모드");
}
function clearCurrentInk() {
  const key = inkKey();
  if (!key) return;
  if (!confirm("현재 문제의 현재 쪽 필기를 지울까?")) return;
  state.inkData[key] = [];
  saveInkData();
  drawInk();
}
function setupInkLayer() {
  const canvas = $("inkCanvas");
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = "1";

  canvas.addEventListener("pointerdown", (event) => {
    // 손가락은 스크롤/확대용, 스타일러스와 마우스만 필기
    if (event.pointerType === "touch") return;
    const key = inkKey();
    if (!key) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    const stroke = {
      tool: state.inkTool || "pen",
      size: Number(state.inkSize || 3) * (state.inkTool === "eraser" ? 3 : 1),
      points: [canvasPoint(event)]
    };
    state.currentStroke = stroke;
    if (!state.inkData[key]) state.inkData[key] = [];
    state.inkData[key].push(stroke);
    drawInk();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.currentStroke) return;
    if (event.pointerType === "touch") return;
    event.preventDefault();
    state.currentStroke.points.push(canvasPoint(event));
    drawInk();
  });

  const endStroke = (event) => {
    if (!state.currentStroke) return;
    if (event.pointerType !== "touch") event.preventDefault();
    state.currentStroke = null;
    saveInkData();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", endStroke);

  $("penToolBtn")?.addEventListener("click", () => setInkTool("pen"));
  $("eraserToolBtn")?.addEventListener("click", () => setInkTool("eraser"));
  $("clearInkBtn")?.addEventListener("click", clearCurrentInk);
  $("inkSizeInput")?.addEventListener("input", (event) => {
    state.inkSize = Number(event.target.value || 3);
  });

  window.addEventListener("resize", () => setTimeout(resizeInkCanvas, 100));
  setInkTool("pen");
}

const originalApplyZoomForInk = applyZoom;
applyZoom = function() {
  originalApplyZoomForInk();
  requestAnimationFrame(resizeInkCanvas);
};

const originalShowQuestionPageForInk = showQuestionPage;
showQuestionPage = function(index) {
  originalShowQuestionPageForInk(index);
  setTimeout(() => {
    setupInkLayer();
    resizeInkCanvas();
    drawInk();
  }, 80);
};

const originalOpenCurrentProblemForInk = openCurrentProblem;
openCurrentProblem = function() {
  originalOpenCurrentProblemForInk();
  setTimeout(() => {
    setupInkLayer();
    resizeInkCanvas();
    drawInk();
  }, 120);
};

setTimeout(() => {
  setupInkLayer();
  resizeInkCanvas();
}, 300);


/* === v6 페이지 슬롯/빈페이지 수정 === */
function isRealPage(src) {
  return typeof src === "string" && /^data:image\//.test(src);
}
function realPages(arr) {
  return Array.isArray(arr) ? arr.filter(isRealPage) : [];
}
function selectedIndexFor(target) {
  return target === "explanation" ? state.selectedExplanationPage : state.selectedQuestionPage;
}
function setSelectedIndex(target, index) {
  if (target === "explanation") state.selectedExplanationPage = index;
  else state.selectedQuestionPage = index;
}
function pageArray(target) {
  return target === "explanation" ? state.explanationPages : state.questionPages;
}
function addBlankPage(target) {
  const arr = pageArray(target);
  arr.push("");
  setSelectedIndex(target, arr.length - 1);
  setPasteTarget(target);
  renderPageLists();
  toast(`${target === "explanation" ? "해설" : "문제"} 빈 페이지 추가. 이제 스샷 붙여넣기를 눌러줘.`);
}
async function addImageFiles(files, target) {
  const arrFiles = Array.from(files || []).filter(file => file && file.type && file.type.startsWith("image/"));
  if (!arrFiles.length) { toast("이미지 파일이 없어"); return; }

  const arr = pageArray(target);
  let selected = selectedIndexFor(target);
  if (selected < 0 || selected >= arr.length) selected = arr.findIndex(x => !isRealPage(x));

  let added = 0, size = 0;
  for (const file of arrFiles) {
    const data = await imageBlobToDataUrl(file);
    if (selected >= 0 && selected < arr.length && !isRealPage(arr[selected])) {
      arr[selected] = data;
      setSelectedIndex(target, selected);
      selected = arr.findIndex((x, idx) => idx > selected && !isRealPage(x));
    } else {
      arr.push(data);
      setSelectedIndex(target, arr.length - 1);
      selected = arr.findIndex((x, idx) => idx > arr.length - 1 && !isRealPage(x));
    }
    size += dataUrlBytes(data);
    added++;
  }
  renderPageLists();
  setPasteTarget(target);
  toast(`${target === "explanation" ? "해설" : "문제"} 이미지 ${added}장 추가 · ${formatBytes(size)}`);
}
function movePage(target,index,dir){
  const arr=pageArray(target), next=index+dir;
  if(next<0||next>=arr.length)return;
  [arr[index],arr[next]]=[arr[next],arr[index]];
  const selected=selectedIndexFor(target);
  if(selected===index)setSelectedIndex(target,next);
  else if(selected===next)setSelectedIndex(target,index);
  renderPageLists();
}
function deletePage(target,index){
  const arr=pageArray(target);
  arr.splice(index,1);
  const selected=selectedIndexFor(target);
  if(selected===index)setSelectedIndex(target,Math.min(index,arr.length-1));
  else if(selected>index)setSelectedIndex(target,selected-1);
  renderPageLists();
}
function renderPageList(id,arr,target){
  const box=$(id);
  box.innerHTML="";
  if(!arr.length){box.innerHTML='<p class="hint">아직 페이지가 없어. “빈 페이지 추가”를 누른 뒤 스샷을 붙여넣어.</p>';return}
  const selected=selectedIndexFor(target);
  arr.forEach((src,index)=>{
    const div=document.createElement("div");
    div.className="page-item"+(selected===index?" selected-page":"");
    div.addEventListener("click",()=>{setSelectedIndex(target,index);setPasteTarget(target);renderPageLists();});
    const thumb=isRealPage(src)
      ? `<img src="${src}" alt="${index+1}쪽" />`
      : `<div class="blank-thumb">빈 페이지<br/>붙여넣기</div>`;
    div.innerHTML=`${thumb}<div><strong>${index+1}쪽 ${selected===index?"· 선택됨":""}</strong><p class="hint">${isRealPage(src) ? (target==="explanation"?"해설 이미지":"문제 이미지") : "이 페이지 선택 후 스샷 붙여넣기"}</p><div class="page-actions"></div></div>`;
    const actions=div.querySelector(".page-actions");
    actions.append(makeButton("선택",()=>{setSelectedIndex(target,index);setPasteTarget(target);renderPageLists();},"secondary small"));
    actions.append(makeButton("위",()=>movePage(target,index,-1),"secondary small"));
    actions.append(makeButton("아래",()=>movePage(target,index,1),"secondary small"));
    actions.append(makeButton("삭제",()=>deletePage(target,index),"danger small"));
    box.append(div);
  });
}
function showQuestionPage(index){
  const p=currentProblem(), pages=realPages(p?.questionPages||[]);
  state.qPage=Math.max(0,Math.min(index,pages.length-1));
  const img=$("questionImageView");
  if(pages.length){
    img.classList.remove("hidden");
    img.src=pages[state.qPage]||"";
    $("questionPageBadge").textContent=`문제 ${state.qPage+1}/${pages.length}쪽`;
  } else {
    img.classList.add("hidden");
    $("questionPageBadge").textContent="문제 이미지 없음";
  }
  fitImage();
  saveDraft();
}
function showExplanationPage(index){
  const p=currentProblem(),pages=realPages(p?.explanationPages||[]);
  state.expPage=Math.max(0,Math.min(index,pages.length-1));
  if(pages.length){
    $("explanationImageView").src=pages[state.expPage];
    $("explanationImageView").classList.remove("hidden");
    $("explanationPageBadge").textContent=`해설 ${state.expPage+1}/${pages.length}쪽`;
  }else{
    $("explanationImageView").classList.add("hidden");
    $("explanationPageBadge").textContent="해설 이미지 없음";
  }
}


/* === v7 기존 빈페이지/구버전 데이터 정리 === */
function collectImagePagesFromProblem(p, kind) {
  const candidates = [];
  if (kind === "question") {
    if (Array.isArray(p.questionPages)) candidates.push(...p.questionPages);
    if (Array.isArray(p.questionImages)) candidates.push(...p.questionImages);
    candidates.push(p.questionImage, p.questionImageData, p.problemImage, p.problemImageData, p.imageData, p.image);
  } else {
    if (Array.isArray(p.explanationPages)) candidates.push(...p.explanationPages);
    if (Array.isArray(p.explanationImages)) candidates.push(...p.explanationImages);
    if (Array.isArray(p.modelPages)) candidates.push(...p.modelPages);
    if (Array.isArray(p.modelImages)) candidates.push(...p.modelImages);
    candidates.push(p.explanationImage, p.explanationImageData, p.modelImage, p.modelImageData, p.answerImageData);
  }
  return candidates.filter((x, idx, arr) => isRealPage(x) && arr.indexOf(x) === idx);
}
async function normalizeStoredProblems() {
  let changed = false;
  for (const p of state.problems) {
    const q = collectImagePagesFromProblem(p, "question");
    const e = collectImagePagesFromProblem(p, "explanation");

    if (JSON.stringify(p.questionPages || []) !== JSON.stringify(q)) {
      p.questionPages = q;
      changed = true;
    }
    if (JSON.stringify(p.explanationPages || []) !== JSON.stringify(e)) {
      p.explanationPages = e;
      changed = true;
    }
    if (!Array.isArray(p.points) && p.pointsText) p.points = pointsFromText(p.pointsText);
  }
  if (changed) {
    for (const p of state.problems) await put(STORE_PROBLEMS, p);
    await loadData();
    toast("기존 빈 페이지/구버전 이미지 데이터를 정리했어");
  }
}
function hasQuestionImage(p) {
  return realPages(p?.questionPages || []).length > 0 || collectImagePagesFromProblem(p || {}, "question").length > 0;
}
const originalStartSolveV7 = startSolve;
startSolve = function(ids, mode) {
  const first = state.problems.find((p) => p.id === ids?.[0]);
  if (!hasQuestionImage(first)) {
    toast("이 문제는 실제 문제 이미지가 없어. 목록→수정에서 빈 페이지에 스샷을 붙여넣고 다시 저장해줘.");
    showView("listView");
    return;
  }
  originalStartSolveV7(ids, mode);
};
const originalShowQuestionPageV7 = showQuestionPage;
showQuestionPage = function(index) {
  const p = currentProblem();
  const pages = realPages(p?.questionPages || []);
  const scroller = $("questionImageScroller");
  let note = $("emptyQuestionNote");
  if (!note && scroller) {
    note = document.createElement("div");
    note.id = "emptyQuestionNote";
    note.className = "empty-image-note hidden";
    note.textContent = "문제 이미지가 없습니다. 목록에서 이 문제를 수정해서 빈 페이지에 스크린샷을 붙여넣고 저장하세요.";
    scroller.appendChild(note);
  }

  if (!pages.length) {
    $("questionImageView").classList.add("hidden");
    if (note) note.classList.remove("hidden");
    $("questionPageBadge").textContent = "문제 이미지 없음";
    return;
  }

  if (note) note.classList.add("hidden");
  $("questionImageView").classList.remove("hidden");
  originalShowQuestionPageV7(index);
};


/* === v8 문제 이미지 표시 + 답안 손글씨/키보드 이원화 === */
state.answerInkTool = "pen";
state.answerInkSize = 3;
state.answerInkStrokes = [];
state.answerInkCurrentStroke = null;
state.answerInputMode = "handwriting";

function dataUrlFromAnswerCanvas() {
  const canvas = $("answerInkCanvas");
  if (!canvas) return "";
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
function answerHasInk() {
  return Array.isArray(state.answerInkStrokes) && state.answerInkStrokes.length > 0;
}
function resizeAnswerCanvas() {
  const canvas = $("answerInkCanvas");
  const wrap = $("handwritingWrap");
  if (!canvas || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const old = dataUrlFromAnswerCanvas();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    drawAnswerInk();
  }
}
function answerPoint(event) {
  const canvas = $("answerInkCanvas");
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}
function drawAnswerInk() {
  const canvas = $("answerInkCanvas");
  const wrap = $("handwritingWrap");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (const stroke of state.answerInkStrokes || []) {
    if (!stroke.points || !stroke.points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#111827";
    ctx.lineWidth = Number(stroke.size || 3);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
  if (wrap) wrap.classList.toggle("has-ink", answerHasInk());
}
function saveAnswerDraftInk() {
  if (!state.solve) return;
  state.solve.answerInkStrokes = state.answerInkStrokes || [];
  state.solve.answerInkData = answerHasInk() ? dataUrlFromAnswerCanvas() : "";
  state.solve.answerInputMode = state.answerInputMode || "handwriting";
  saveDraft();
}
function setAnswerInkTool(tool) {
  state.answerInkTool = tool === "eraser" ? "eraser" : "pen";
  $("answerPenBtn")?.classList.toggle("ink-active", state.answerInkTool === "pen");
  $("answerEraserBtn")?.classList.toggle("ink-active", state.answerInkTool === "eraser");
}
function clearAnswerInk() {
  if (!confirm("답안 손글씨를 모두 지울까?")) return;
  state.answerInkStrokes = [];
  drawAnswerInk();
  saveAnswerDraftInk();
}
function setAnswerInputMode(mode) {
  state.answerInputMode = mode === "keyboard" ? "keyboard" : "handwriting";
  const canvasWrap = $("handwritingWrap");
  const text = $("answerText");
  const btn = $("keyboardToggleBtn");
  if (!canvasWrap || !text || !btn) return;
  canvasWrap.classList.toggle("hidden", state.answerInputMode === "keyboard");
  text.classList.toggle("hidden", state.answerInputMode !== "keyboard");
  btn.textContent = state.answerInputMode === "keyboard" ? "손글씨 입력" : "키보드 입력";
  if (state.answerInputMode === "keyboard") setTimeout(() => text.focus(), 0);
  else setTimeout(() => { resizeAnswerCanvas(); drawAnswerInk(); }, 50);
  if (state.solve) state.solve.answerInputMode = state.answerInputMode;
  saveDraft();
}
function setupAnswerInkLayer() {
  const canvas = $("answerInkCanvas");
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = "1";

  canvas.addEventListener("pointerdown", (event) => {
    // 손가락은 스크롤, S펜/마우스는 필기
    if (event.pointerType === "touch") return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const stroke = {
      tool: state.answerInkTool || "pen",
      size: Number(state.answerInkSize || 3) * (state.answerInkTool === "eraser" ? 4 : 1),
      points: [answerPoint(event)]
    };
    state.answerInkCurrentStroke = stroke;
    state.answerInkStrokes.push(stroke);
    drawAnswerInk();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.answerInkCurrentStroke) return;
    if (event.pointerType === "touch") return;
    event.preventDefault();
    state.answerInkCurrentStroke.points.push(answerPoint(event));
    drawAnswerInk();
  });
  const endStroke = (event) => {
    if (!state.answerInkCurrentStroke) return;
    if (event.pointerType !== "touch") event.preventDefault();
    state.answerInkCurrentStroke = null;
    saveAnswerDraftInk();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", endStroke);

  $("keyboardToggleBtn")?.addEventListener("click", () => setAnswerInputMode(state.answerInputMode === "keyboard" ? "handwriting" : "keyboard"));
  $("answerPenBtn")?.addEventListener("click", () => setAnswerInkTool("pen"));
  $("answerEraserBtn")?.addEventListener("click", () => setAnswerInkTool("eraser"));
  $("clearAnswerInkBtn")?.addEventListener("click", clearAnswerInk);
  $("answerInkSizeInput")?.addEventListener("input", (event) => { state.answerInkSize = Number(event.target.value || 3); });
  window.addEventListener("resize", () => setTimeout(() => { resizeAnswerCanvas(); drawAnswerInk(); resizeInkCanvas?.(); }, 120));
}

/* 문제 이미지가 0px로 보이는 문제 수정: percent가 아니라 실제 px로 표시 */
function applyZoom() {
  const img = $("questionImageView");
  if (!img) return;
  if (img.naturalWidth) img.style.width = `${Math.max(1, Math.round(img.naturalWidth * (state.zoom || 1)))}px`;
  else img.style.width = "auto";
  requestAnimationFrame(() => { try { resizeInkCanvas(); } catch(_) {} });
}
function fitImage() {
  const img = $("questionImageView");
  const scroller = $("questionImageScroller");
  if (!img || !scroller) return;
  const run = () => {
    if (!img.naturalWidth || !scroller.clientWidth) {
      img.style.width = "auto";
      return;
    }
    state.zoom = Math.max(0.2, Math.min(1, (scroller.clientWidth - 20) / img.naturalWidth));
    applyZoom();
  };
  run();
  setTimeout(run, 80);
}

/* 문제 이미지 없는 경우 빈 회색창 대신 안내 */
function showQuestionPage(index) {
  const p = currentProblem();
  const pages = realPages(p?.questionPages || []);
  const scroller = $("questionImageScroller");
  let note = $("emptyQuestionNote");
  if (!note && scroller) {
    note = document.createElement("div");
    note.id = "emptyQuestionNote";
    note.className = "empty-image-note hidden";
    note.textContent = "문제 이미지가 없습니다. 목록에서 수정해 문제 빈 페이지에 스크린샷을 붙여넣고 저장하세요.";
    scroller.appendChild(note);
  }
  state.qPage = Math.max(0, Math.min(index, pages.length - 1));
  if (!pages.length) {
    $("questionImageView")?.classList.add("hidden");
    if (note) note.classList.remove("hidden");
    $("questionPageBadge").textContent = "문제 이미지 없음";
    return;
  }
  if (note) note.classList.add("hidden");
  const img = $("questionImageView");
  img.classList.remove("hidden");
  img.src = pages[state.qPage] || "";
  $("questionPageBadge").textContent = `문제 ${state.qPage + 1}/${pages.length}쪽`;
  fitImage();
  saveDraft();
}

/* 문제풀이 열 때 손글씨 답안 복구 */
const openCurrentProblem_v8 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v8();
  if (!state.solve) return;
  state.answerInkStrokes = Array.isArray(state.solve.answerInkStrokes) ? state.solve.answerInkStrokes : [];
  state.answerInputMode = state.solve.answerInputMode || "handwriting";
  setupAnswerInkLayer();
  setAnswerInkTool("pen");
  setAnswerInputMode(state.answerInputMode);
  setTimeout(() => { resizeAnswerCanvas(); drawAnswerInk(); fitImage(); }, 120);
};

/* 초안 저장 시 손글씨 데이터도 포함 */
const saveDraft_v8 = saveDraft;
saveDraft = function() {
  if (state.solve) {
    state.solve.answer = $("answerText")?.value ?? state.solve.answer;
    state.solve.answerInkStrokes = state.answerInkStrokes || [];
    state.solve.answerInkData = answerHasInk() ? dataUrlFromAnswerCanvas() : "";
    state.solve.answerInputMode = state.answerInputMode || "handwriting";
  }
  saveDraft_v8();
};

/* 제출/채점 저장에 손글씨 포함 */
const submitAnswer_v8 = submitAnswer;
submitAnswer = function() {
  if (state.solve) {
    state.solve.answerInkStrokes = state.answerInkStrokes || [];
    state.solve.answerInkData = answerHasInk() ? dataUrlFromAnswerCanvas() : "";
    state.solve.answerInputMode = state.answerInputMode || "handwriting";
  }
  submitAnswer_v8();
  const ink = $("ownAnswerInkView");
  if (ink) {
    if (state.solve?.answerInkData) {
      ink.src = state.solve.answerInkData;
      ink.classList.remove("hidden");
    } else {
      ink.classList.add("hidden");
    }
  }
};
const saveAttempt_v8 = saveAttempt;
saveAttempt = async function() {
  if (state.solve) {
    state.solve.answerInkData = answerHasInk() ? dataUrlFromAnswerCanvas() : "";
    state.solve.answerInkStrokes = state.answerInkStrokes || [];
  }
  const attempt = await saveAttempt_v8();
  if (attempt) {
    attempt.answerInkData = state.solve?.answerInkData || "";
    attempt.answerInkStrokes = state.solve?.answerInkStrokes || [];
    attempt.answerInputMode = state.solve?.answerInputMode || "handwriting";
    await put(STORE_ATTEMPTS, attempt);
    await loadData();
  }
  return attempt;
};

setTimeout(() => {
  setupAnswerInkLayer();
  resizeAnswerCanvas();
  drawAnswerInk();
  fitImage();
}, 500);


/* === v9 화면맞춤/가로이동/필기/지우개 안정화 === */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function applyZoom() {
  const img = $("questionImageView");
  const wrap = $("imageCanvasWrap");
  if (!img || !wrap) return;
  if (!img.naturalWidth) return;

  const width = Math.max(1, Math.round(img.naturalWidth * (state.zoom || 1)));
  const height = Math.max(1, Math.round(img.naturalHeight * (state.zoom || 1)));

  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  wrap.style.width = `${width}px`;
  wrap.style.height = `${height}px`;

  requestAnimationFrame(() => {
    resizeInkCanvasV9();
    drawInkV9();
  });
}

function fitImage() {
  const img = $("questionImageView");
  const scroller = $("questionImageScroller");
  if (!img || !scroller) return;

  const run = () => {
    if (!img.naturalWidth || !scroller.clientWidth) return;
    const widthRatio = Math.max(0.05, (scroller.clientWidth - 4) / img.naturalWidth);
    state.zoom = clamp(widthRatio, 0.05, 1);
    applyZoom();
    scroller.scrollLeft = 0;
    scroller.scrollTop = 0;
  };

  if (!img.naturalWidth) img.onload = run;
  run();
  setTimeout(run, 80);
  setTimeout(run, 250);
}

function showQuestionPage(index) {
  const p = currentProblem();
  const pages = realPages(p?.questionPages || []);
  const scroller = $("questionImageScroller");
  let note = $("emptyQuestionNote");
  if (!note && scroller) {
    note = document.createElement("div");
    note.id = "emptyQuestionNote";
    note.className = "empty-image-note hidden";
    note.textContent = "문제 이미지가 없습니다. 목록에서 수정해 문제 빈 페이지에 스크린샷을 붙여넣고 저장하세요.";
    scroller.appendChild(note);
  }

  state.qPage = Math.max(0, Math.min(index, pages.length - 1));
  const img = $("questionImageView");

  if (!pages.length) {
    img?.classList.add("hidden");
    if (note) note.classList.remove("hidden");
    $("questionPageBadge").textContent = "문제 이미지 없음";
    return;
  }

  if (note) note.classList.add("hidden");
  img.classList.remove("hidden");
  img.onload = () => {
    fitImage();
    resetProblemInkLayerV9();
  };
  img.src = pages[state.qPage] || "";
  $("questionPageBadge").textContent = `문제 ${state.qPage + 1}/${pages.length}쪽`;
  saveDraft();
}

/* 문제 이미지 위 필기 */
function problemInkKeyV9() {
  const p = currentProblem?.();
  if (!p) return "";
  return `${p.id}:${state.qPage || 0}`;
}
function resizeInkCanvasV9() {
  const img = $("questionImageView");
  const canvas = $("inkCanvas");
  const wrap = $("imageCanvasWrap");
  if (!img || !canvas || !wrap || img.classList.contains("hidden")) return;

  const w = img.offsetWidth || Math.round((img.naturalWidth || 1) * (state.zoom || 1));
  const h = img.offsetHeight || Math.round((img.naturalHeight || 1) * (state.zoom || 1));
  if (!w || !h) return;

  wrap.style.width = `${w}px`;
  wrap.style.height = `${h}px`;

  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(1, Math.round(w * dpr));
  const ch = Math.max(1, Math.round(h * dpr));

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}
function drawInkV9() {
  const canvas = $("inkCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const strokes = state.inkData?.[problemInkKeyV9()] || [];
  for (const stroke of strokes) {
    if (!stroke.points || !stroke.points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#0ea5e9";
    ctx.lineWidth = Number(stroke.size || 3);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
}
function canvasPointV9(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
  };
}
function setInkTool(tool) {
  state.inkTool = tool === "eraser" ? "eraser" : "pen";
  $("penToolBtn")?.classList.toggle("ink-active", state.inkTool === "pen");
  $("eraserToolBtn")?.classList.toggle("ink-active", state.inkTool === "eraser");
}
function saveInkDataV9() {
  try {
    localStorage.setItem("essayPsatBaseInk_v2", JSON.stringify(state.inkData || {}));
  } catch (err) {
    console.warn(err);
  }
}
function clearCurrentInk() {
  const key = problemInkKeyV9();
  if (!key) return;
  if (!confirm("현재 문제의 현재 쪽 필기를 지울까?")) return;
  if (!state.inkData) state.inkData = {};
  state.inkData[key] = [];
  saveInkDataV9();
  drawInkV9();
}
function resetProblemInkLayerV9() {
  let canvas = $("inkCanvas");
  if (!canvas) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  resizeInkCanvasV9();
  drawInkV9();

  canvas.addEventListener("pointerdown", (event) => {
    // 손가락은 이미지 이동/스크롤용. S펜/마우스만 문제 위 필기.
    if (event.pointerType === "touch") return;
    const key = problemInkKeyV9();
    if (!key) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    if (!state.inkData) state.inkData = {};
    if (!state.inkData[key]) state.inkData[key] = [];

    const stroke = {
      tool: state.inkTool === "eraser" ? "eraser" : "pen",
      size: Number(state.inkSize || 3) * (state.inkTool === "eraser" ? 5 : 1),
      points: [canvasPointV9(event, canvas)]
    };
    state.currentStroke = stroke;
    state.inkData[key].push(stroke);
    drawInkV9();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.currentStroke) return;
    if (event.pointerType === "touch") return;
    event.preventDefault();
    state.currentStroke.points.push(canvasPointV9(event, canvas));
    drawInkV9();
  });

  const end = (event) => {
    if (!state.currentStroke) return;
    if (event.pointerType !== "touch") event.preventDefault();
    state.currentStroke = null;
    saveInkDataV9();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("penToolBtn") && ($("penToolBtn").onclick = () => setInkTool("pen"));
  $("eraserToolBtn") && ($("eraserToolBtn").onclick = () => setInkTool("eraser"));
  $("clearInkBtn") && ($("clearInkBtn").onclick = clearCurrentInk);
  $("inkSizeInput") && ($("inkSizeInput").oninput = (event) => { state.inkSize = Number(event.target.value || 3); });

  setInkTool(state.inkTool || "pen");
}

/* 답안 손글씨: 손가락/S펜 모두 필기 가능, 지우개 정상화 */
function resizeAnswerCanvasV9() {
  const canvas = $("answerInkCanvas");
  const wrap = $("handwritingWrap");
  if (!canvas || !wrap || wrap.classList.contains("hidden")) return;
  const rect = wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  drawAnswerInkV9();
}
function drawAnswerInkV9() {
  const canvas = $("answerInkCanvas");
  const wrap = $("handwritingWrap");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (const stroke of state.answerInkStrokes || []) {
    if (!stroke.points || !stroke.points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#111827";
    ctx.lineWidth = Number(stroke.size || 3);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
  if (wrap) wrap.classList.toggle("has-ink", (state.answerInkStrokes || []).length > 0);
}
function setAnswerInkTool(tool) {
  state.answerInkTool = tool === "eraser" ? "eraser" : "pen";
  $("answerPenBtn")?.classList.toggle("ink-active", state.answerInkTool === "pen");
  $("answerEraserBtn")?.classList.toggle("ink-active", state.answerInkTool === "eraser");
}
function resetAnswerInkLayerV9() {
  let canvas = $("answerInkCanvas");
  if (!canvas) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  resizeAnswerCanvasV9();
  drawAnswerInkV9();

  canvas.addEventListener("pointerdown", (event) => {
    // 답안칸은 필기앱처럼 손가락/S펜 모두 필기
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const stroke = {
      tool: state.answerInkTool === "eraser" ? "eraser" : "pen",
      size: Number(state.answerInkSize || 3) * (state.answerInkTool === "eraser" ? 5 : 1),
      points: [canvasPointV9(event, canvas)]
    };
    state.answerInkCurrentStroke = stroke;
    if (!Array.isArray(state.answerInkStrokes)) state.answerInkStrokes = [];
    state.answerInkStrokes.push(stroke);
    drawAnswerInkV9();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.answerInkCurrentStroke) return;
    event.preventDefault();
    state.answerInkCurrentStroke.points.push(canvasPointV9(event, canvas));
    drawAnswerInkV9();
  });
  const end = (event) => {
    if (!state.answerInkCurrentStroke) return;
    event.preventDefault();
    state.answerInkCurrentStroke = null;
    saveAnswerDraftInk?.();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("answerPenBtn") && ($("answerPenBtn").onclick = () => setAnswerInkTool("pen"));
  $("answerEraserBtn") && ($("answerEraserBtn").onclick = () => setAnswerInkTool("eraser"));
  $("clearAnswerInkBtn") && ($("clearAnswerInkBtn").onclick = () => {
    if (!confirm("답안 손글씨를 모두 지울까?")) return;
    state.answerInkStrokes = [];
    drawAnswerInkV9();
    saveAnswerDraftInk?.();
  });
  $("answerInkSizeInput") && ($("answerInkSizeInput").oninput = (event) => {
    state.answerInkSize = Number(event.target.value || 3);
  });

  setAnswerInkTool(state.answerInkTool || "pen");
}

const openCurrentProblem_v9 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v9();
  setTimeout(() => {
    fitImage();
    resetProblemInkLayerV9();
    resetAnswerInkLayerV9();
    resizeAnswerCanvasV9();
  }, 160);
};

const originalSetAnswerInputModeV9 = typeof setAnswerInputMode === "function" ? setAnswerInputMode : null;
if (originalSetAnswerInputModeV9) {
  setAnswerInputMode = function(mode) {
    originalSetAnswerInputModeV9(mode);
    setTimeout(() => {
      resizeAnswerCanvasV9();
      resetAnswerInkLayerV9();
    }, 80);
  };
}

window.addEventListener("resize", () => {
  setTimeout(() => {
    fitImage();
    resizeInkCanvasV9();
    drawInkV9();
    resizeAnswerCanvasV9();
    drawAnswerInkV9();
  }, 160);
});

setTimeout(() => {
  fitImage();
  resetProblemInkLayerV9();
  resetAnswerInkLayerV9();
}, 700);


/* === v10 레이아웃/폭맞춤/답안쪽 추가 최종 수정 === */
function clampV10(v, min, max) { return Math.max(min, Math.min(max, v)); }
function realProblemPagesV10() {
  const p = currentProblem?.();
  return realPages(p?.questionPages || []);
}
function problemScrollerV10() { return $("questionImageScroller"); }

function applyZoom() {
  const img = $("questionImageView");
  const wrap = $("imageCanvasWrap");
  if (!img || !wrap || !img.naturalWidth) return;

  const width = Math.max(1, Math.floor(img.naturalWidth * (state.zoom || 1)));
  const height = Math.max(1, Math.floor(img.naturalHeight * (state.zoom || 1)));

  img.style.width = width + "px";
  img.style.height = height + "px";
  wrap.style.width = width + "px";
  wrap.style.height = height + "px";
  wrap.style.minWidth = width + "px";
  wrap.style.minHeight = height + "px";

  requestAnimationFrame(() => {
    resizeInkCanvasV10();
    drawInkV10();
  });
}
function fitImage() {
  const img = $("questionImageView");
  const scroller = problemScrollerV10();
  if (!img || !scroller) return;

  const run = () => {
    if (!img.naturalWidth || !scroller.clientWidth) return;
    // 화면 폭 100%에 맞춤. 패딩 0 기준.
    state.zoom = clampV10(scroller.clientWidth / img.naturalWidth, 0.05, 2);
    applyZoom();
    scroller.scrollLeft = 0;
    scroller.scrollTop = 0;
  };
  if (!img.naturalWidth) img.onload = run;
  run();
  setTimeout(run, 80);
  setTimeout(run, 250);
}
function zoomByV10(delta) {
  const scroller = problemScrollerV10();
  const oldZoom = state.zoom || 1;
  const oldLeft = scroller ? scroller.scrollLeft : 0;
  const oldTop = scroller ? scroller.scrollTop : 0;
  state.zoom = clampV10(oldZoom + delta, 0.05, 4);
  applyZoom();
  if (scroller) {
    scroller.scrollLeft = Math.round(oldLeft * (state.zoom / oldZoom));
    scroller.scrollTop = Math.round(oldTop * (state.zoom / oldZoom));
  }
}
function showQuestionPage(index) {
  const pages = realProblemPagesV10();
  const scroller = problemScrollerV10();
  let note = $("emptyQuestionNote");
  if (!note && scroller) {
    note = document.createElement("div");
    note.id = "emptyQuestionNote";
    note.className = "empty-image-note hidden";
    note.textContent = "문제 이미지가 없습니다. 목록에서 수정해 문제 빈 페이지에 스크린샷을 붙여넣고 저장하세요.";
    scroller.appendChild(note);
  }

  state.qPage = Math.max(0, Math.min(index, pages.length - 1));
  const img = $("questionImageView");
  if (!pages.length) {
    img?.classList.add("hidden");
    if (note) note.classList.remove("hidden");
    $("questionPageBadge").textContent = "문제 없음";
    return;
  }

  if (note) note.classList.add("hidden");
  img.classList.remove("hidden");
  img.onload = () => {
    fitImage();
    resetProblemInkLayerV10();
  };
  img.src = pages[state.qPage] || "";
  $("questionPageBadge").textContent = `문제 ${state.qPage + 1}/${pages.length}`;
  saveDraft();
}

/* 문제 위 필기: S펜/마우스만, 손가락은 가로/세로 이동 */
function problemInkKeyV10() {
  const p = currentProblem?.();
  return p ? `${p.id}:${state.qPage || 0}` : "";
}
function resizeInkCanvasV10() {
  const img = $("questionImageView"), canvas = $("inkCanvas"), wrap = $("imageCanvasWrap");
  if (!img || !canvas || !wrap || img.classList.contains("hidden")) return;
  const w = img.offsetWidth || Math.floor((img.naturalWidth || 1) * (state.zoom || 1));
  const h = img.offsetHeight || Math.floor((img.naturalHeight || 1) * (state.zoom || 1));
  if (!w || !h) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}
function drawInkV10() {
  const canvas = $("inkCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const strokes = state.inkData?.[problemInkKeyV10()] || [];
  strokes.forEach(stroke => {
    if (!stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#0ea5e9";
    ctx.lineWidth = Number(stroke.size || 3);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  });
}
function pointV10(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampV10((event.clientX - rect.left) / rect.width, 0, 1),
    y: clampV10((event.clientY - rect.top) / rect.height, 0, 1)
  };
}
function setInkTool(tool) {
  state.inkTool = tool === "eraser" ? "eraser" : "pen";
  $("penToolBtn")?.classList.toggle("ink-active", state.inkTool === "pen");
  $("eraserToolBtn")?.classList.toggle("ink-active", state.inkTool === "eraser");
}
function saveProblemInkV10() {
  try { localStorage.setItem("essayPsatBaseInk_v2", JSON.stringify(state.inkData || {})); } catch {}
}
function clearCurrentInk() {
  const key = problemInkKeyV10();
  if (!key) return;
  if (!confirm("현재 문제의 현재 쪽 필기를 지울까?")) return;
  if (!state.inkData) state.inkData = {};
  state.inkData[key] = [];
  saveProblemInkV10();
  drawInkV10();
}
function resetProblemInkLayerV10() {
  let canvas = $("inkCanvas");
  if (!canvas) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;
  resizeInkCanvasV10();
  drawInkV10();

  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    const key = problemInkKeyV10();
    if (!key) return;
    canvas.setPointerCapture?.(event.pointerId);
    if (!state.inkData) state.inkData = {};
    if (!state.inkData[key]) state.inkData[key] = [];
    const stroke = {
      tool: state.inkTool === "eraser" ? "eraser" : "pen",
      size: Number(state.inkSize || 3) * (state.inkTool === "eraser" ? 5 : 1),
      points: [pointV10(event, canvas)]
    };
    state.currentStroke = stroke;
    state.inkData[key].push(stroke);
    drawInkV10();
  });
  canvas.addEventListener("pointermove", event => {
    if (!state.currentStroke || event.pointerType === "touch") return;
    event.preventDefault();
    state.currentStroke.points.push(pointV10(event, canvas));
    drawInkV10();
  });
  const end = event => {
    if (!state.currentStroke) return;
    if (event.pointerType !== "touch") event.preventDefault();
    state.currentStroke = null;
    saveProblemInkV10();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("penToolBtn") && ($("penToolBtn").onclick = () => setInkTool("pen"));
  $("eraserToolBtn") && ($("eraserToolBtn").onclick = () => setInkTool("eraser"));
  $("clearInkBtn") && ($("clearInkBtn").onclick = clearCurrentInk);
  $("inkSizeInput") && ($("inkSizeInput").oninput = event => { state.inkSize = Number(event.target.value || 3); });
  setInkTool(state.inkTool || "pen");
}

/* 답안 페이지 */
function ensureAnswerPagesV10() {
  if (!state.solve) return;
  if (!Array.isArray(state.solve.answerPages) || !state.solve.answerPages.length) {
    state.solve.answerPages = [{
      text: state.solve.answer || "",
      strokes: Array.isArray(state.solve.answerInkStrokes) ? state.solve.answerInkStrokes : []
    }];
  }
  if (typeof state.solve.answerPageIndex !== "number") state.solve.answerPageIndex = 0;
  state.solve.answerPageIndex = clampV10(state.solve.answerPageIndex, 0, state.solve.answerPages.length - 1);
}
function currentAnswerPageV10() {
  ensureAnswerPagesV10();
  return state.solve.answerPages[state.solve.answerPageIndex];
}
function saveCurrentAnswerPageV10() {
  if (!state.solve) return;
  ensureAnswerPagesV10();
  const page = currentAnswerPageV10();
  page.text = $("answerText")?.value || "";
  page.strokes = Array.isArray(state.answerInkStrokes) ? state.answerInkStrokes : [];
  state.solve.answer = state.solve.answerPages.map((p, i) => `[${i+1}쪽]\n${p.text || ""}`).join("\n\n");
  state.solve.answerInkStrokes = state.answerInkStrokes || [];
  state.solve.answerInkData = answerHasInk?.() ? dataUrlFromAnswerCanvas?.() : "";
  localStorage.setItem("essayPsatBaseDraft", JSON.stringify(state.solve));
  renderAnswerPageBadgeV10();
}
function loadAnswerPageV10(index) {
  if (!state.solve) return;
  ensureAnswerPagesV10();
  state.solve.answerPageIndex = clampV10(index, 0, state.solve.answerPages.length - 1);
  const page = currentAnswerPageV10();
  $("answerText").value = page.text || "";
  state.answerInkStrokes = Array.isArray(page.strokes) ? page.strokes : [];
  renderAnswerPageBadgeV10();
  setTimeout(() => {
    resizeAnswerCanvasV10();
    drawAnswerInkV10();
  }, 40);
}
function renderAnswerPageBadgeV10() {
  const badge = $("answerPageBadge");
  if (!badge || !state.solve) return;
  ensureAnswerPagesV10();
  badge.textContent = `답안 ${state.solve.answerPageIndex + 1}/${state.solve.answerPages.length}쪽`;
}
function addAnswerPageV10() {
  if (!state.solve) return;
  saveCurrentAnswerPageV10();
  state.solve.answerPages.push({ text: "", strokes: [] });
  loadAnswerPageV10(state.solve.answerPages.length - 1);
}
function nextAnswerPageV10(delta) {
  if (!state.solve) return;
  saveCurrentAnswerPageV10();
  loadAnswerPageV10((state.solve.answerPageIndex || 0) + delta);
}

/* 답안 손글씨: 답안칸은 손가락/S펜 모두 필기 */
function resizeAnswerCanvasV10() {
  const canvas = $("answerInkCanvas"), wrap = $("handwritingWrap");
  if (!canvas || !wrap || wrap.classList.contains("hidden")) return;
  const rect = wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  drawAnswerInkV10();
}
function drawAnswerInkV10() {
  const canvas = $("answerInkCanvas"), wrap = $("handwritingWrap");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  (state.answerInkStrokes || []).forEach(stroke => {
    if (!stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#111827";
    ctx.lineWidth = Number(stroke.size || 3);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  });
  if (wrap) wrap.classList.toggle("has-ink", (state.answerInkStrokes || []).length > 0);
}
function setAnswerInkTool(tool) {
  state.answerInkTool = tool === "eraser" ? "eraser" : "pen";
  $("answerPenBtn")?.classList.toggle("ink-active", state.answerInkTool === "pen");
  $("answerEraserBtn")?.classList.toggle("ink-active", state.answerInkTool === "eraser");
}
function resetAnswerInkLayerV10() {
  let canvas = $("answerInkCanvas");
  if (!canvas) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;
  resizeAnswerCanvasV10();
  drawAnswerInkV10();

  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const stroke = {
      tool: state.answerInkTool === "eraser" ? "eraser" : "pen",
      size: Number(state.answerInkSize || 3) * (state.answerInkTool === "eraser" ? 5 : 1),
      points: [pointV10(event, canvas)]
    };
    state.answerInkCurrentStroke = stroke;
    if (!Array.isArray(state.answerInkStrokes)) state.answerInkStrokes = [];
    state.answerInkStrokes.push(stroke);
    drawAnswerInkV10();
  });
  canvas.addEventListener("pointermove", event => {
    if (!state.answerInkCurrentStroke) return;
    event.preventDefault();
    state.answerInkCurrentStroke.points.push(pointV10(event, canvas));
    drawAnswerInkV10();
  });
  const end = event => {
    if (!state.answerInkCurrentStroke) return;
    event.preventDefault();
    state.answerInkCurrentStroke = null;
    saveCurrentAnswerPageV10();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("answerPenBtn") && ($("answerPenBtn").onclick = () => setAnswerInkTool("pen"));
  $("answerEraserBtn") && ($("answerEraserBtn").onclick = () => setAnswerInkTool("eraser"));
  $("clearAnswerInkBtn") && ($("clearAnswerInkBtn").onclick = () => {
    if (!confirm("현재 답안쪽 필기를 지울까?")) return;
    state.answerInkStrokes = [];
    drawAnswerInkV10();
    saveCurrentAnswerPageV10();
  });
  $("answerInkSizeInput") && ($("answerInkSizeInput").oninput = event => { state.answerInkSize = Number(event.target.value || 3); });
  $("prevAnswerPageBtn") && ($("prevAnswerPageBtn").onclick = () => nextAnswerPageV10(-1));
  $("nextAnswerPageBtn") && ($("nextAnswerPageBtn").onclick = () => nextAnswerPageV10(1));
  $("addAnswerPageBtn") && ($("addAnswerPageBtn").onclick = addAnswerPageV10);
  setAnswerInkTool(state.answerInkTool || "pen");
}

/* 기존 함수 덮어쓰기 */
const openCurrentProblem_v10 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v10();
  if (!state.solve) return;
  ensureAnswerPagesV10();
  loadAnswerPageV10(state.solve.answerPageIndex || 0);
  setTimeout(() => {
    fitImage();
    resetProblemInkLayerV10();
    resetAnswerInkLayerV10();
    resizeAnswerCanvasV10();
  }, 140);
};
const saveDraft_v10 = saveDraft;
saveDraft = function() {
  if (state.solve) saveCurrentAnswerPageV10();
  else saveDraft_v10();
};
const submitAnswer_v10 = submitAnswer;
submitAnswer = function() {
  if (state.solve) saveCurrentAnswerPageV10();
  submitAnswer_v10();
};
const saveAttempt_v10 = saveAttempt;
saveAttempt = async function() {
  if (state.solve) saveCurrentAnswerPageV10();
  const attempt = await saveAttempt_v10();
  if (attempt && state.solve?.answerPages) {
    attempt.answerPages = state.solve.answerPages;
    await put(STORE_ATTEMPTS, attempt);
    await loadData();
  }
  return attempt;
};

/* 버튼 재연결 */
setTimeout(() => {
  $("fitBtn") && ($("fitBtn").onclick = fitImage);
  $("zoomInBtn") && ($("zoomInBtn").onclick = () => zoomByV10(0.15));
  $("zoomOutBtn") && ($("zoomOutBtn").onclick = () => zoomByV10(-0.15));
  $("prevQuestionPageBtn") && ($("prevQuestionPageBtn").onclick = () => showQuestionPage((state.qPage || 0) - 1));
  $("nextQuestionPageBtn") && ($("nextQuestionPageBtn").onclick = () => showQuestionPage((state.qPage || 0) + 1));
  resetProblemInkLayerV10();
  resetAnswerInkLayerV10();
  fitImage();
}, 600);

window.addEventListener("resize", () => {
  setTimeout(() => {
    fitImage();
    resizeAnswerCanvasV10();
    drawAnswerInkV10();
  }, 160);
});


/* === v11 해설화면 수정/답안페이지/분할크기 조절 === */
function clampV11(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* 문제/답안 화면 크기 손가락 슬라이드 조절 */
function setSplitRatioV11(ratio) {
  ratio = clampV11(ratio, 25, 75);
  const shell = $("solveShell");
  if (!shell) return;
  shell.style.gridTemplateRows = `${ratio}dvh 10px calc(${100 - ratio}dvh - 10px)`;
  localStorage.setItem("essaySplitRatioV11", String(ratio));
  setTimeout(() => {
    try { fitImage(); } catch {}
    try { resizeAnswerCanvasV10(); drawAnswerInkV10(); } catch {}
  }, 80);
}
function setupSplitHandleV11() {
  const handle = $("splitHandle");
  if (!handle || handle.dataset.ready) return;
  handle.dataset.ready = "1";
  const saved = Number(localStorage.getItem("essaySplitRatioV11") || 48);
  setSplitRatioV11(saved);
  const move = (clientY) => {
    const ratio = clientY / window.innerHeight * 100;
    setSplitRatioV11(ratio);
  };
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    const onMove = (e) => move(e.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

/* v10 함수가 없을 수 있는 경우 대비: 문제 폭맞춤/이동 */
function problemScrollerV11(){ return $("questionImageScroller"); }
function applyZoom() {
  const img = $("questionImageView"), wrap = $("imageCanvasWrap");
  if (!img || !wrap || !img.naturalWidth) return;
  const w = Math.max(1, Math.floor(img.naturalWidth * (state.zoom || 1)));
  const h = Math.max(1, Math.floor(img.naturalHeight * (state.zoom || 1)));
  img.style.width = w + "px"; img.style.height = h + "px";
  wrap.style.width = w + "px"; wrap.style.height = h + "px";
  wrap.style.minWidth = w + "px"; wrap.style.minHeight = h + "px";
  requestAnimationFrame(() => { try { resizeInkCanvasV10(); drawInkV10(); } catch {} });
}
function fitImage() {
  const img = $("questionImageView"), scroller = problemScrollerV11();
  if (!img || !scroller) return;
  const run = () => {
    if (!img.naturalWidth || !scroller.clientWidth) return;
    state.zoom = clampV11(scroller.clientWidth / img.naturalWidth, 0.05, 2);
    applyZoom();
    scroller.scrollLeft = 0; scroller.scrollTop = 0;
  };
  img.onload = run;
  run(); setTimeout(run, 80); setTimeout(run, 250);
}
function zoomByV11(delta) {
  const scroller = problemScrollerV11();
  const oldZoom = state.zoom || 1;
  const oldLeft = scroller ? scroller.scrollLeft : 0;
  const oldTop = scroller ? scroller.scrollTop : 0;
  state.zoom = clampV11(oldZoom + delta, 0.05, 4);
  applyZoom();
  if (scroller) {
    scroller.scrollLeft = Math.round(oldLeft * (state.zoom / oldZoom));
    scroller.scrollTop = Math.round(oldTop * (state.zoom / oldZoom));
  }
}

/* 해설화면: 내답안 페이지 넘김 */
state.scoreAnswerPageIndex = 0;
state.scoreAnswerEditTool = "pen";
state.scoreExpEditTool = "pen";
state.scoreAnswerEdits = {};
state.scoreExpEdits = {};

function ensureAnswerPagesForScoreV11() {
  if (!state.solve) return [{ text: state.solve?.answer || "", strokes: state.solve?.answerInkStrokes || [] }];
  if (Array.isArray(state.solve.answerPages) && state.solve.answerPages.length) return state.solve.answerPages;
  return [{ text: state.solve.answer || "", strokes: state.solve.answerInkStrokes || [] }];
}
function renderScoreAnswerPageV11(index=0) {
  const pages = ensureAnswerPagesForScoreV11();
  state.scoreAnswerPageIndex = clampV11(index, 0, pages.length - 1);
  const page = pages[state.scoreAnswerPageIndex] || {};
  $("scoreAnswerPageBadge") && ($("scoreAnswerPageBadge").textContent = `답안 ${state.scoreAnswerPageIndex + 1}/${pages.length}쪽`);
  $("ownAnswerView") && ($("ownAnswerView").textContent = page.text || "(키보드 답안 없음)");
  const img = $("ownAnswerInkView");
  if (img) {
    const temp = makeAnswerPageImageV11(page);
    if (temp) { img.src = temp; img.classList.remove("hidden"); }
    else img.classList.add("hidden");
  }
  setTimeout(() => resetScoreAnswerCanvasV11(), 80);
}
function makeAnswerPageImageV11(page) {
  if (!page || !Array.isArray(page.strokes) || !page.strokes.length) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 900; canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = "#eef2f7"; ctx.lineWidth = 2;
  for (let y=70; y<canvas.height; y+=70) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  for (const stroke of page.strokes) {
    if (!stroke.points || !stroke.points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#111827";
    ctx.lineWidth = Number(stroke.size || 3) * 2.3;
    ctx.beginPath();
    stroke.points.forEach((pt,i)=> {
      const x = pt.x * canvas.width, y = pt.y * canvas.height;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.restore();
  }
  return canvas.toDataURL("image/png");
}

/* 해설/답안 수정 필기 캔버스 */
function scoreKeyV11(kind) {
  const p = currentProblem?.();
  const pid = p?.id || "unknown";
  if (kind === "answer") return `${pid}:answer:${state.scoreAnswerPageIndex || 0}`;
  return `${pid}:exp:${state.expPage || 0}`;
}
function loadScoreEditsV11() {
  try { state.scoreAnswerEdits = JSON.parse(localStorage.getItem("essayScoreAnswerEditsV11") || "{}"); } catch { state.scoreAnswerEdits = {}; }
  try { state.scoreExpEdits = JSON.parse(localStorage.getItem("essayScoreExpEditsV11") || "{}"); } catch { state.scoreExpEdits = {}; }
}
function saveScoreEditsV11() {
  try { localStorage.setItem("essayScoreAnswerEditsV11", JSON.stringify(state.scoreAnswerEdits || {})); } catch {}
  try { localStorage.setItem("essayScoreExpEditsV11", JSON.stringify(state.scoreExpEdits || {})); } catch {}
}
function setupScoreCanvasV11(canvasId, wrapId, kind) {
  let canvas = $(canvasId), wrap = $(wrapId);
  if (!canvas || !wrap) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  drawScoreCanvasV11(canvas, kind);

  let current = null;
  const toolGetter = () => kind === "answer" ? state.scoreAnswerEditTool : state.scoreExpEditTool;
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const tool = toolGetter();
    current = {
      tool,
      size: tool === "eraser" ? 22 : 4,
      points: [{ x: clampV11((event.clientX-rect.left)/rect.width,0,1), y: clampV11((event.clientY-rect.top)/rect.height,0,1) }]
    };
    const store = kind === "answer" ? state.scoreAnswerEdits : state.scoreExpEdits;
    const key = scoreKeyV11(kind);
    if (!store[key]) store[key] = [];
    store[key].push(current);
    drawScoreCanvasV11(canvas, kind);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!current) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    current.points.push({ x: clampV11((event.clientX-rect.left)/rect.width,0,1), y: clampV11((event.clientY-rect.top)/rect.height,0,1) });
    drawScoreCanvasV11(canvas, kind);
  });
  const end = (event) => { if (current) { event.preventDefault(); current = null; saveScoreEditsV11(); } };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);
}
function drawScoreCanvasV11(canvas, kind) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);
  const store = kind === "answer" ? state.scoreAnswerEdits : state.scoreExpEdits;
  const strokes = store?.[scoreKeyV11(kind)] || [];
  strokes.forEach(stroke => {
    if (!stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : (kind === "answer" ? "#ef4444" : "#0ea5e9");
    ctx.lineWidth = Number(stroke.size || 4);
    ctx.beginPath();
    stroke.points.forEach((pt,i)=> {
      const x=pt.x*rect.width, y=pt.y*rect.height;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.restore();
  });
}
function setScoreToolV11(kind, tool) {
  if (kind === "answer") {
    state.scoreAnswerEditTool = tool === "eraser" ? "eraser" : "pen";
    $("scoreAnswerPenBtn")?.classList.toggle("ink-active", state.scoreAnswerEditTool === "pen");
    $("scoreAnswerEraserBtn")?.classList.toggle("ink-active", state.scoreAnswerEditTool === "eraser");
  } else {
    state.scoreExpEditTool = tool === "eraser" ? "eraser" : "pen";
    $("scoreExpPenBtn")?.classList.toggle("ink-active", state.scoreExpEditTool === "pen");
    $("scoreExpEraserBtn")?.classList.toggle("ink-active", state.scoreExpEditTool === "eraser");
  }
}
function clearScoreEditV11(kind) {
  if (!confirm(kind === "answer" ? "현재 답안 수정필기를 지울까?" : "현재 해설 필기를 지울까?")) return;
  const store = kind === "answer" ? state.scoreAnswerEdits : state.scoreExpEdits;
  delete store[scoreKeyV11(kind)];
  saveScoreEditsV11();
  if (kind === "answer") resetScoreAnswerCanvasV11();
  else resetScoreExplanationCanvasV11();
}
function resetScoreAnswerCanvasV11() { setupScoreCanvasV11("scoreAnswerCanvas", "scoreAnswerEditWrap", "answer"); }
function resetScoreExplanationCanvasV11() { setupScoreCanvasV11("scoreExplanationCanvas", "scoreExplanationEditWrap", "exp"); }

/* 기존 해설 페이지 넘김에도 필기 캔버스 동기화 */
const showExplanationPage_v11 = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPage_v11(index);
  setTimeout(() => resetScoreExplanationCanvasV11(), 120);
};

const openScore_v11 = openScore;
openScore = function() {
  openScore_v11();
  loadScoreEditsV11();
  renderScoreAnswerPageV11(0);
  setTimeout(() => {
    resetScoreAnswerCanvasV11();
    resetScoreExplanationCanvasV11();
  }, 160);
};

/* 버튼 연결 */
setTimeout(() => {
  setupSplitHandleV11();

  $("fitBtn") && ($("fitBtn").onclick = fitImage);
  $("zoomInBtn") && ($("zoomInBtn").onclick = () => zoomByV11(0.15));
  $("zoomOutBtn") && ($("zoomOutBtn").onclick = () => zoomByV11(-0.15));
  $("prevQuestionPageBtn") && ($("prevQuestionPageBtn").onclick = () => showQuestionPage((state.qPage || 0) - 1));
  $("nextQuestionPageBtn") && ($("nextQuestionPageBtn").onclick = () => showQuestionPage((state.qPage || 0) + 1));

  $("prevScoreAnswerPageBtn") && ($("prevScoreAnswerPageBtn").onclick = () => renderScoreAnswerPageV11((state.scoreAnswerPageIndex || 0) - 1));
  $("nextScoreAnswerPageBtn") && ($("nextScoreAnswerPageBtn").onclick = () => renderScoreAnswerPageV11((state.scoreAnswerPageIndex || 0) + 1));
  $("scoreAnswerPenBtn") && ($("scoreAnswerPenBtn").onclick = () => setScoreToolV11("answer", "pen"));
  $("scoreAnswerEraserBtn") && ($("scoreAnswerEraserBtn").onclick = () => setScoreToolV11("answer", "eraser"));
  $("clearScoreAnswerInkBtn") && ($("clearScoreAnswerInkBtn").onclick = () => clearScoreEditV11("answer"));

  $("scoreExpPenBtn") && ($("scoreExpPenBtn").onclick = () => setScoreToolV11("exp", "pen"));
  $("scoreExpEraserBtn") && ($("scoreExpEraserBtn").onclick = () => setScoreToolV11("exp", "eraser"));
  $("clearScoreExpInkBtn") && ($("clearScoreExpInkBtn").onclick = () => clearScoreEditV11("exp"));
}, 700);

window.addEventListener("resize", () => setTimeout(() => {
  setupSplitHandleV11();
  try { fitImage(); } catch {}
  try { resetScoreAnswerCanvasV11(); resetScoreExplanationCanvasV11(); } catch {}
}, 180));


/* === v12 최종 보정: 해설폭/펜크기/상단축소/문제 손가락 슬라이드 === */
state.scoreAnswerSize = 4;
state.scoreExpSize = 4;

function clampV12(v, min, max) { return Math.max(min, Math.min(max, v)); }
function getPointV12(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampV12((event.clientX - rect.left) / rect.width, 0, 1),
    y: clampV12((event.clientY - rect.top) / rect.height, 0, 1)
  };
}

/* 문제 이미지 손가락 슬라이드: 캔버스가 터치를 먹어도 직접 스크롤 */
function resetProblemInkLayerV12() {
  let canvas = $("inkCanvas");
  if (!canvas) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  try { resizeInkCanvasV10?.(); drawInkV10?.(); } catch {}
  try { resizeInkCanvasV9?.(); drawInkV9?.(); } catch {}

  let pan = null;
  canvas.addEventListener("pointerdown", event => {
    const scroller = $("questionImageScroller");
    if (event.pointerType === "touch") {
      if (!scroller) return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      pan = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const key = (typeof problemInkKeyV10 === "function" ? problemInkKeyV10() : (typeof problemInkKeyV9 === "function" ? problemInkKeyV9() : ""));
    if (!key) return;
    if (!state.inkData) state.inkData = {};
    if (!state.inkData[key]) state.inkData[key] = [];
    const tool = state.inkTool === "eraser" ? "eraser" : "pen";
    const stroke = {
      tool,
      size: Number(state.inkSize || 3) * (tool === "eraser" ? 5 : 1),
      points: [getPointV12(event, canvas)]
    };
    state.currentStroke = stroke;
    state.inkData[key].push(stroke);
    try { drawInkV10?.(); } catch {}
    try { drawInkV9?.(); } catch {}
  });

  canvas.addEventListener("pointermove", event => {
    const scroller = $("questionImageScroller");
    if (event.pointerType === "touch") {
      if (!pan || !scroller) return;
      event.preventDefault();
      scroller.scrollLeft = pan.left - (event.clientX - pan.x);
      scroller.scrollTop = pan.top - (event.clientY - pan.y);
      return;
    }

    if (!state.currentStroke) return;
    event.preventDefault();
    state.currentStroke.points.push(getPointV12(event, canvas));
    try { drawInkV10?.(); } catch {}
    try { drawInkV9?.(); } catch {}
  });

  const end = event => {
    if (event.pointerType === "touch") {
      pan = null;
      return;
    }
    if (!state.currentStroke) return;
    event.preventDefault();
    state.currentStroke = null;
    try { saveProblemInkV10?.(); } catch {
      try { localStorage.setItem("essayPsatBaseInk_v2", JSON.stringify(state.inkData || {})); } catch {}
    }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("penToolBtn") && ($("penToolBtn").onclick = () => { state.inkTool = "pen"; setInkTool?.("pen"); });
  $("eraserToolBtn") && ($("eraserToolBtn").onclick = () => { state.inkTool = "eraser"; setInkTool?.("eraser"); });
  $("clearInkBtn") && ($("clearInkBtn").onclick = () => {
    const key = (typeof problemInkKeyV10 === "function" ? problemInkKeyV10() : (typeof problemInkKeyV9 === "function" ? problemInkKeyV9() : ""));
    if (!key) return;
    if (!confirm("현재 문제의 현재 쪽 필기를 지울까?")) return;
    if (!state.inkData) state.inkData = {};
    state.inkData[key] = [];
    try { localStorage.setItem("essayPsatBaseInk_v2", JSON.stringify(state.inkData || {})); } catch {}
    try { drawInkV10?.(); } catch {}
    try { drawInkV9?.(); } catch {}
  });
  $("inkSizeInput") && ($("inkSizeInput").oninput = event => { state.inkSize = Number(event.target.value || 3); });
}

/* 해설 이미지 폭 맞춤 + 캔버스 높이 동기화 */
function fitScoreExplanationV12() {
  const wrap = $("scoreExplanationEditWrap");
  const img = $("explanationImageView");
  if (!wrap || !img) return;
  const run = () => {
    if (!img.naturalWidth) return;
    const available = Math.max(1, wrap.clientWidth);
    const scale = available / img.naturalWidth;
    const h = Math.max(180, Math.round(img.naturalHeight * scale));
    img.style.width = available + "px";
    img.style.height = h + "px";
    wrap.style.height = Math.min(Math.max(h, 220), Math.floor(window.innerHeight * 0.62)) + "px";
    resetScoreExplanationCanvasV12();
  };
  img.onload = run;
  run();
  setTimeout(run, 120);
}

/* 채점 화면 필기: 펜크기 반영 */
function setupScoreCanvasV12(canvasId, wrapId, kind) {
  let canvas = $(canvasId), wrap = $(wrapId);
  if (!canvas || !wrap) return;
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  drawScoreCanvasV12(canvas, kind);

  let current = null;
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const tool = kind === "answer" ? state.scoreAnswerEditTool : state.scoreExpEditTool;
    const size = kind === "answer" ? state.scoreAnswerSize : state.scoreExpSize;
    current = {
      tool: tool === "eraser" ? "eraser" : "pen",
      size: Number(size || 4) * (tool === "eraser" ? 5 : 1),
      points: [getPointV12(event, canvas)]
    };
    const store = kind === "answer" ? state.scoreAnswerEdits : state.scoreExpEdits;
    const key = scoreKeyV11(kind);
    if (!store[key]) store[key] = [];
    store[key].push(current);
    drawScoreCanvasV12(canvas, kind);
  });

  canvas.addEventListener("pointermove", event => {
    if (!current) return;
    event.preventDefault();
    current.points.push(getPointV12(event, canvas));
    drawScoreCanvasV12(canvas, kind);
  });

  const end = event => {
    if (!current) return;
    event.preventDefault();
    current = null;
    try { saveScoreEditsV11?.(); } catch {}
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);
}

function drawScoreCanvasV12(canvas, kind) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);

  const store = kind === "answer" ? state.scoreAnswerEdits : state.scoreExpEdits;
  const strokes = store?.[scoreKeyV11(kind)] || [];
  strokes.forEach(stroke => {
    if (!stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : (kind === "answer" ? "#ef4444" : "#0ea5e9");
    ctx.lineWidth = Number(stroke.size || 4);
    ctx.beginPath();
    stroke.points.forEach((pt,i)=> {
      const x = pt.x * rect.width, y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.restore();
  });
}

function resetScoreAnswerCanvasV12() { setupScoreCanvasV12("scoreAnswerCanvas", "scoreAnswerEditWrap", "answer"); }
function resetScoreExplanationCanvasV12() { setupScoreCanvasV12("scoreExplanationCanvas", "scoreExplanationEditWrap", "exp"); }

function connectV12Buttons() {
  $("scoreAnswerSizeInput") && ($("scoreAnswerSizeInput").oninput = e => { state.scoreAnswerSize = Number(e.target.value || 4); });
  $("scoreExpSizeInput") && ($("scoreExpSizeInput").oninput = e => { state.scoreExpSize = Number(e.target.value || 4); });

  $("scoreAnswerPenBtn") && ($("scoreAnswerPenBtn").onclick = () => { state.scoreAnswerEditTool = "pen"; setScoreToolV11?.("answer","pen"); });
  $("scoreAnswerEraserBtn") && ($("scoreAnswerEraserBtn").onclick = () => { state.scoreAnswerEditTool = "eraser"; setScoreToolV11?.("answer","eraser"); });
  $("scoreExpPenBtn") && ($("scoreExpPenBtn").onclick = () => { state.scoreExpEditTool = "pen"; setScoreToolV11?.("exp","pen"); });
  $("scoreExpEraserBtn") && ($("scoreExpEraserBtn").onclick = () => { state.scoreExpEditTool = "eraser"; setScoreToolV11?.("exp","eraser"); });
}

/* 기존 함수 위에 최종 덮어쓰기 */
const openCurrentProblem_v12 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v12();
  setTimeout(() => {
    resetProblemInkLayerV12();
    try { fitImage?.(); } catch {}
  }, 180);
};

const showExplanationPage_v12 = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPage_v12(index);
  setTimeout(() => {
    fitScoreExplanationV12();
    resetScoreExplanationCanvasV12();
  }, 180);
};

const openScore_v12 = openScore;
openScore = function() {
  openScore_v12();
  setTimeout(() => {
    connectV12Buttons();
    fitScoreExplanationV12();
    resetScoreAnswerCanvasV12();
    resetScoreExplanationCanvasV12();
  }, 220);
};

setTimeout(() => {
  connectV12Buttons();
  resetProblemInkLayerV12();
}, 800);

window.addEventListener("resize", () => setTimeout(() => {
  try { fitScoreExplanationV12(); } catch {}
  try { resetProblemInkLayerV12(); } catch {}
}, 200));


/* === v13: 손가락은 이동만, 필기는 스타일러스펜 전용 === */
function clampV13(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pointV13(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampV13((event.clientX - rect.left) / rect.width, 0, 1),
    y: clampV13((event.clientY - rect.top) / rect.height, 0, 1)
  };
}
function isStylusOrMouseV13(event) {
  return event.pointerType === "pen" || event.pointerType === "mouse";
}
function currentProblemInkKeyV13() {
  if (typeof problemInkKeyV10 === "function") return problemInkKeyV10();
  if (typeof problemInkKeyV9 === "function") return problemInkKeyV9();
  const p = currentProblem?.();
  return p ? `${p.id}:${state.qPage || 0}` : "";
}
function drawProblemInkV13() {
  try { if (typeof drawInkV10 === "function") { drawInkV10(); return; } } catch {}
  try { if (typeof drawInkV9 === "function") { drawInkV9(); return; } } catch {}
}
function resizeProblemInkCanvasV13() {
  try { if (typeof resizeInkCanvasV10 === "function") { resizeInkCanvasV10(); return; } } catch {}
  try { if (typeof resizeInkCanvasV9 === "function") { resizeInkCanvasV9(); return; } } catch {}
}
function saveProblemInkV13() {
  try { if (typeof saveProblemInkV10 === "function") { saveProblemInkV10(); return; } } catch {}
  try { localStorage.setItem("essayPsatBaseInk_v2", JSON.stringify(state.inkData || {})); } catch {}
}

/* 문제 이미지: 손가락 드래그로 스크롤, S펜으로만 필기 */
function resetProblemInkLayerV13() {
  let canvas = $("inkCanvas");
  if (!canvas) return;

  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  resizeProblemInkCanvasV13();
  drawProblemInkV13();

  let pan = null;

  canvas.addEventListener("pointerdown", (event) => {
    const scroller = $("questionImageScroller");

    if (event.pointerType === "touch") {
      if (!scroller) return;
      event.preventDefault();
      canvas.classList.add("is-panning");
      canvas.setPointerCapture?.(event.pointerId);
      pan = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.scrollLeft,
        top: scroller.scrollTop
      };
      return;
    }

    if (!isStylusOrMouseV13(event)) return;

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    const key = currentProblemInkKeyV13();
    if (!key) return;

    if (!state.inkData) state.inkData = {};
    if (!state.inkData[key]) state.inkData[key] = [];

    const tool = state.inkTool === "eraser" ? "eraser" : "pen";
    const stroke = {
      tool,
      size: Number(state.inkSize || 3) * (tool === "eraser" ? 5 : 1),
      points: [pointV13(event, canvas)]
    };
    state.currentStroke = stroke;
    state.inkData[key].push(stroke);
    drawProblemInkV13();
  });

  canvas.addEventListener("pointermove", (event) => {
    const scroller = $("questionImageScroller");

    if (event.pointerType === "touch") {
      if (!pan || !scroller) return;
      event.preventDefault();
      scroller.scrollLeft = pan.left - (event.clientX - pan.x);
      scroller.scrollTop = pan.top - (event.clientY - pan.y);
      return;
    }

    if (!state.currentStroke || !isStylusOrMouseV13(event)) return;
    event.preventDefault();
    state.currentStroke.points.push(pointV13(event, canvas));
    drawProblemInkV13();
  });

  const end = (event) => {
    if (event.pointerType === "touch") {
      canvas.classList.remove("is-panning");
      pan = null;
      return;
    }
    if (!state.currentStroke) return;
    if (isStylusOrMouseV13(event)) event.preventDefault();
    state.currentStroke = null;
    saveProblemInkV13();
  };

  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("penToolBtn") && ($("penToolBtn").onclick = () => {
    state.inkTool = "pen";
    try { if (typeof setInkTool === "function") setInkTool("pen"); } catch {}
  });
  $("eraserToolBtn") && ($("eraserToolBtn").onclick = () => {
    state.inkTool = "eraser";
    try { if (typeof setInkTool === "function") setInkTool("eraser"); } catch {}
  });
  $("clearInkBtn") && ($("clearInkBtn").onclick = () => {
    const key = currentProblemInkKeyV13();
    if (!key) return;
    if (!confirm("현재 문제의 현재 쪽 필기를 지울까?")) return;
    if (!state.inkData) state.inkData = {};
    state.inkData[key] = [];
    saveProblemInkV13();
    drawProblemInkV13();
  });
  $("inkSizeInput") && ($("inkSizeInput").oninput = (event) => {
    state.inkSize = Number(event.target.value || 3);
  });
}

/* 답안 필기: 손가락은 필기 금지, S펜/마우스만 필기 */
function resetAnswerInkLayerV13() {
  let canvas = $("answerInkCanvas");
  if (!canvas) return;

  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  try { if (typeof resizeAnswerCanvasV10 === "function") resizeAnswerCanvasV10(); if (typeof drawAnswerInkV10 === "function") drawAnswerInkV10(); } catch {}
  try { if (typeof resizeAnswerCanvasV9 === "function") resizeAnswerCanvasV9(); if (typeof drawAnswerInkV9 === "function") drawAnswerInkV9(); } catch {}

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (!isStylusOrMouseV13(event)) return;

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    const tool = state.answerInkTool === "eraser" ? "eraser" : "pen";
    const stroke = {
      tool,
      size: Number(state.answerInkSize || 3) * (tool === "eraser" ? 5 : 1),
      points: [pointV13(event, canvas)]
    };
    state.answerInkCurrentStroke = stroke;
    if (!Array.isArray(state.answerInkStrokes)) state.answerInkStrokes = [];
    state.answerInkStrokes.push(stroke);

    try { if (typeof drawAnswerInkV10 === "function") drawAnswerInkV10(); } catch {}
    try { if (typeof drawAnswerInkV9 === "function") drawAnswerInkV9(); } catch {}
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    if (!state.answerInkCurrentStroke || !isStylusOrMouseV13(event)) return;

    event.preventDefault();
    state.answerInkCurrentStroke.points.push(pointV13(event, canvas));

    try { if (typeof drawAnswerInkV10 === "function") drawAnswerInkV10(); } catch {}
    try { if (typeof drawAnswerInkV9 === "function") drawAnswerInkV9(); } catch {}
  });

  const end = (event) => {
    if (!state.answerInkCurrentStroke) return;
    if (isStylusOrMouseV13(event)) event.preventDefault();
    state.answerInkCurrentStroke = null;
    try { if (typeof saveCurrentAnswerPageV10 === "function") saveCurrentAnswerPageV10(); else if (typeof saveAnswerDraftInk === "function") saveAnswerDraftInk(); } catch {}
  };

  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);

  $("answerPenBtn") && ($("answerPenBtn").onclick = () => {
    state.answerInkTool = "pen";
    try { if (typeof setAnswerInkTool === "function") setAnswerInkTool("pen"); } catch {}
  });
  $("answerEraserBtn") && ($("answerEraserBtn").onclick = () => {
    state.answerInkTool = "eraser";
    try { if (typeof setAnswerInkTool === "function") setAnswerInkTool("eraser"); } catch {}
  });
  $("clearAnswerInkBtn") && ($("clearAnswerInkBtn").onclick = () => {
    if (!confirm("현재 답안쪽 필기를 지울까?")) return;
    state.answerInkStrokes = [];
    try { if (typeof drawAnswerInkV10 === "function") drawAnswerInkV10(); } catch {}
    try { if (typeof drawAnswerInkV9 === "function") drawAnswerInkV9(); } catch {}
    try { if (typeof saveCurrentAnswerPageV10 === "function") saveCurrentAnswerPageV10(); else if (typeof saveAnswerDraftInk === "function") saveAnswerDraftInk(); } catch {}
  });
  $("answerInkSizeInput") && ($("answerInkSizeInput").oninput = (event) => {
    state.answerInkSize = Number(event.target.value || 3);
  });
}

/* 채점/해설 수정필기도 손가락 금지, S펜/마우스만 */
function setupScoreCanvasV13(canvasId, wrapId, kind) {
  let canvas = $(canvasId), wrap = $(wrapId);
  if (!canvas || !wrap) return;

  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  try { if (typeof drawScoreCanvasV12 === "function") drawScoreCanvasV12(canvas, kind); else if (typeof drawScoreCanvasV11 === "function") drawScoreCanvasV11(canvas, kind); } catch {}

  let current = null;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    if (!isStylusOrMouseV13(event)) return;

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);

    const tool = kind === "answer" ? state.scoreAnswerEditTool : state.scoreExpEditTool;
    const size = kind === "answer" ? state.scoreAnswerSize : state.scoreExpSize;

    current = {
      tool: tool === "eraser" ? "eraser" : "pen",
      size: Number(size || 4) * (tool === "eraser" ? 5 : 1),
      points: [pointV13(event, canvas)]
    };

    const store = kind === "answer" ? state.scoreAnswerEdits : state.scoreExpEdits;
    const key = scoreKeyV11(kind);
    if (!store[key]) store[key] = [];
    store[key].push(current);

    try { if (typeof drawScoreCanvasV12 === "function") drawScoreCanvasV12(canvas, kind); else if (typeof drawScoreCanvasV11 === "function") drawScoreCanvasV11(canvas, kind); } catch {}
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    if (!current || !isStylusOrMouseV13(event)) return;

    event.preventDefault();
    current.points.push(pointV13(event, canvas));

    try { if (typeof drawScoreCanvasV12 === "function") drawScoreCanvasV12(canvas, kind); else if (typeof drawScoreCanvasV11 === "function") drawScoreCanvasV11(canvas, kind); } catch {}
  });

  const end = (event) => {
    if (!current) return;
    if (isStylusOrMouseV13(event)) event.preventDefault();
    current = null;
    try { if (typeof saveScoreEditsV11 === "function") saveScoreEditsV11(); } catch {}
  };

  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", end);
}

function resetScoreAnswerCanvasV13() { setupScoreCanvasV13("scoreAnswerCanvas", "scoreAnswerEditWrap", "answer"); }
function resetScoreExplanationCanvasV13() { setupScoreCanvasV13("scoreExplanationCanvas", "scoreExplanationEditWrap", "exp"); }

/* 기존 함수 위에 최종 덮어쓰기 */
const openCurrentProblem_v13 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v13();
  setTimeout(() => {
    resetProblemInkLayerV13();
    resetAnswerInkLayerV13();
  }, 220);
};

const showQuestionPage_v13 = showQuestionPage;
showQuestionPage = function(index) {
  showQuestionPage_v13(index);
  setTimeout(() => resetProblemInkLayerV13(), 180);
};

const openScore_v13 = openScore;
openScore = function() {
  openScore_v13();
  setTimeout(() => {
    resetScoreAnswerCanvasV13();
    resetScoreExplanationCanvasV13();
  }, 260);
};

const showExplanationPage_v13 = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPage_v13(index);
  setTimeout(() => resetScoreExplanationCanvasV13(), 220);
};

setTimeout(() => {
  resetProblemInkLayerV13();
  resetAnswerInkLayerV13();
}, 900);

window.addEventListener("resize", () => setTimeout(() => {
  try { resetProblemInkLayerV13(); } catch {}
  try { resetAnswerInkLayerV13(); } catch {}
  try { resetScoreAnswerCanvasV13(); resetScoreExplanationCanvasV13(); } catch {}
}, 240));


/* === v14: 해설/채점 화면 필기 최종 수정 ===
   - 손가락은 절대 필기하지 않음
   - 손가락은 해설/답안 화면 이동만 함
   - S펜(pointerType pen)만 필기
   - 해설 이미지 전체 높이에 맞춰 캔버스 생성
*/
function clampV14(v, min, max) { return Math.max(min, Math.min(max, v)); }
function isRealPenV14(event) {
  return event.pointerType === "pen";
}
function scorePointV14(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampV14((event.clientX - rect.left) / rect.width, 0, 1),
    y: clampV14((event.clientY - rect.top) / rect.height, 0, 1)
  };
}
function scoreKeyV14(kind) {
  if (typeof scoreKeyV11 === "function") return scoreKeyV11(kind);
  const p = currentProblem?.();
  const pid = p?.id || "unknown";
  if (kind === "answer") return `${pid}:answer:${state.scoreAnswerPageIndex || 0}`;
  return `${pid}:exp:${state.expPage || 0}`;
}
function getScoreStoreV14(kind) {
  if (kind === "answer") {
    if (!state.scoreAnswerEdits) state.scoreAnswerEdits = {};
    return state.scoreAnswerEdits;
  }
  if (!state.scoreExpEdits) state.scoreExpEdits = {};
  return state.scoreExpEdits;
}
function saveScoreEditsV14() {
  try { localStorage.setItem("essayScoreAnswerEditsV11", JSON.stringify(state.scoreAnswerEdits || {})); } catch {}
  try { localStorage.setItem("essayScoreExpEditsV11", JSON.stringify(state.scoreExpEdits || {})); } catch {}
}
function drawScoreCanvasV14(canvas, kind) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const store = getScoreStoreV14(kind);
  const strokes = store[scoreKeyV14(kind)] || [];
  strokes.forEach(stroke => {
    if (!stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : (kind === "answer" ? "#ef4444" : "#0ea5e9");
    ctx.lineWidth = Number(stroke.size || 4);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  });
}
function sizeScoreCanvasV14(canvas, wrap, kind) {
  const dpr = window.devicePixelRatio || 1;

  let width = Math.max(1, wrap.clientWidth || wrap.getBoundingClientRect().width || 1);
  let height = Math.max(220, wrap.scrollHeight || wrap.getBoundingClientRect().height || 220);

  if (kind === "exp") {
    const img = $("explanationImageView");
    if (img && img.naturalWidth) {
      width = Math.max(1, wrap.clientWidth || window.innerWidth - 24);
      const scale = width / img.naturalWidth;
      height = Math.max(220, Math.round(img.naturalHeight * scale));

      img.style.width = width + "px";
      img.style.height = height + "px";
      wrap.style.height = Math.min(height, Math.floor(window.innerHeight * 0.62)) + "px";
    }
  } else {
    const pre = $("ownAnswerView");
    const ink = $("ownAnswerInkView");
    height = Math.max(
      220,
      pre ? pre.scrollHeight + 40 : 0,
      ink && !ink.classList.contains("hidden") ? ink.offsetHeight + 60 : 0,
      wrap.clientHeight || 0
    );
    wrap.style.height = Math.min(height, Math.floor(window.innerHeight * 0.48)) + "px";
  }

  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
}
function setupScoreCanvasV14(canvasId, wrapId, kind) {
  let canvas = $(canvasId);
  const wrap = $(wrapId);
  if (!canvas || !wrap) return;

  // 이전 버전 리스너를 완전히 제거
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  sizeScoreCanvasV14(canvas, wrap, kind);
  drawScoreCanvasV14(canvas, kind);

  let current = null;
  let pan = null;

  const block = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  canvas.addEventListener("pointerdown", (event) => {
    block(event);

    if (!isRealPenV14(event)) {
      canvas.classList.add("is-panning");
      canvas.setPointerCapture?.(event.pointerId);
      pan = {
        x: event.clientX,
        y: event.clientY,
        left: wrap.scrollLeft,
        top: wrap.scrollTop
      };
      return;
    }

    canvas.setPointerCapture?.(event.pointerId);

    const tool = kind === "answer" ? state.scoreAnswerEditTool : state.scoreExpEditTool;
    const size = kind === "answer" ? state.scoreAnswerSize : state.scoreExpSize;
    const stroke = {
      tool: tool === "eraser" ? "eraser" : "pen",
      size: Number(size || 4) * (tool === "eraser" ? 5 : 1),
      points: [scorePointV14(event, canvas)]
    };

    const store = getScoreStoreV14(kind);
    const key = scoreKeyV14(kind);
    if (!store[key]) store[key] = [];
    store[key].push(stroke);
    current = stroke;
    drawScoreCanvasV14(canvas, kind);
  }, true);

  canvas.addEventListener("pointermove", (event) => {
    block(event);

    if (!isRealPenV14(event)) {
      if (!pan) return;
      wrap.scrollLeft = pan.left - (event.clientX - pan.x);
      wrap.scrollTop = pan.top - (event.clientY - pan.y);
      return;
    }

    if (!current) return;
    current.points.push(scorePointV14(event, canvas));
    drawScoreCanvasV14(canvas, kind);
  }, true);

  const end = (event) => {
    block(event);

    if (!isRealPenV14(event)) {
      pan = null;
      canvas.classList.remove("is-panning");
      return;
    }

    if (!current) return;
    current = null;
    saveScoreEditsV14();
  };

  canvas.addEventListener("pointerup", end, true);
  canvas.addEventListener("pointercancel", end, true);
  canvas.addEventListener("pointerleave", end, true);
}
function resetScoreAnswerCanvasV14() {
  setupScoreCanvasV14("scoreAnswerCanvas", "scoreAnswerEditWrap", "answer");
}
function resetScoreExplanationCanvasV14() {
  setupScoreCanvasV14("scoreExplanationCanvas", "scoreExplanationEditWrap", "exp");
}
function connectScoreToolsV14() {
  $("scoreAnswerSizeInput") && ($("scoreAnswerSizeInput").oninput = e => {
    state.scoreAnswerSize = Number(e.target.value || 4);
  });
  $("scoreExpSizeInput") && ($("scoreExpSizeInput").oninput = e => {
    state.scoreExpSize = Number(e.target.value || 4);
  });

  $("scoreAnswerPenBtn") && ($("scoreAnswerPenBtn").onclick = () => {
    state.scoreAnswerEditTool = "pen";
    try { setScoreToolV11?.("answer", "pen"); } catch {}
  });
  $("scoreAnswerEraserBtn") && ($("scoreAnswerEraserBtn").onclick = () => {
    state.scoreAnswerEditTool = "eraser";
    try { setScoreToolV11?.("answer", "eraser"); } catch {}
  });
  $("scoreExpPenBtn") && ($("scoreExpPenBtn").onclick = () => {
    state.scoreExpEditTool = "pen";
    try { setScoreToolV11?.("exp", "pen"); } catch {}
  });
  $("scoreExpEraserBtn") && ($("scoreExpEraserBtn").onclick = () => {
    state.scoreExpEditTool = "eraser";
    try { setScoreToolV11?.("exp", "eraser"); } catch {}
  });
  $("clearScoreAnswerInkBtn") && ($("clearScoreAnswerInkBtn").onclick = () => {
    if (!confirm("현재 답안 수정필기를 지울까?")) return;
    const store = getScoreStoreV14("answer");
    delete store[scoreKeyV14("answer")];
    saveScoreEditsV14();
    resetScoreAnswerCanvasV14();
  });
  $("clearScoreExpInkBtn") && ($("clearScoreExpInkBtn").onclick = () => {
    if (!confirm("현재 해설 필기를 지울까?")) return;
    const store = getScoreStoreV14("exp");
    delete store[scoreKeyV14("exp")];
    saveScoreEditsV14();
    resetScoreExplanationCanvasV14();
  });
}

/* 해설 이미지 로드 후 캔버스 재배치 */
function fitExplanationAndCanvasV14() {
  const img = $("explanationImageView");
  if (!img) return;
  const run = () => {
    resetScoreExplanationCanvasV14();
  };
  img.onload = run;
  run();
  setTimeout(run, 150);
  setTimeout(run, 400);
}

/* 이전 버전보다 늦게 실행해서 이전 리스너를 확실히 덮어씀 */
const openScore_v14 = openScore;
openScore = function() {
  openScore_v14();
  setTimeout(() => {
    connectScoreToolsV14();
    resetScoreAnswerCanvasV14();
    fitExplanationAndCanvasV14();
  }, 750);
};

const showExplanationPage_v14 = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPage_v14(index);
  setTimeout(() => {
    connectScoreToolsV14();
    fitExplanationAndCanvasV14();
  }, 750);
};

setTimeout(() => {
  connectScoreToolsV14();
  resetScoreAnswerCanvasV14();
  fitExplanationAndCanvasV14();
}, 1200);

window.addEventListener("resize", () => setTimeout(() => {
  resetScoreAnswerCanvasV14();
  fitExplanationAndCanvasV14();
}, 250));

/* === v15: 폰 split-screen 방식 드래그 + 버튼 한 줄 === */
function clampV15(v,min,max){return Math.max(min,Math.min(max,v));}
function setSplitRatioV15(ratio){
  ratio=clampV15(ratio,18,78);
  const shell=$("solveShell"); if(!shell) return;
  shell.style.gridTemplateRows=`${ratio}dvh 34px calc(${100-ratio}dvh - 34px)`;
  localStorage.setItem("essaySplitRatioV15",String(ratio));
  localStorage.setItem("essaySplitRatioV11",String(ratio));
  setTimeout(()=>{try{fitImage();}catch{} try{resizeAnswerCanvasV10();drawAnswerInkV10();}catch{} try{resizeAnswerCanvasV9();drawAnswerInkV9();}catch{}},50);
}
function setupSplitHandleV15(){
  const handle=$("splitHandle"); if(!handle || handle.dataset.v15ready) return;
  handle.dataset.v15ready="1";
  setSplitRatioV15(Number(localStorage.getItem("essaySplitRatioV15")||localStorage.getItem("essaySplitRatioV11")||48));
  let active=false;
  const moveTo=(clientY)=>setSplitRatioV15(clientY/Math.max(1,window.innerHeight)*100);
  handle.addEventListener("pointerdown",(e)=>{e.preventDefault();e.stopPropagation();active=true;handle.classList.add("dragging");handle.setPointerCapture?.(e.pointerId);moveTo(e.clientY);},true);
  handle.addEventListener("pointermove",(e)=>{if(!active)return;e.preventDefault();e.stopPropagation();moveTo(e.clientY);},true);
  const end=(e)=>{if(!active)return;e.preventDefault();e.stopPropagation();active=false;handle.classList.remove("dragging");};
  handle.addEventListener("pointerup",end,true);handle.addEventListener("pointercancel",end,true);handle.addEventListener("lostpointercapture",end,true);
  handle.addEventListener("touchstart",(e)=>{e.preventDefault();active=true;handle.classList.add("dragging");if(e.touches&&e.touches[0])moveTo(e.touches[0].clientY);},{passive:false,capture:true});
  handle.addEventListener("touchmove",(e)=>{if(!active)return;e.preventDefault();if(e.touches&&e.touches[0])moveTo(e.touches[0].clientY);},{passive:false,capture:true});
  handle.addEventListener("touchend",()=>{active=false;handle.classList.remove("dragging");},{passive:false,capture:true});
}
function compactRuntimeLabelsV15(){
  [["prevAnswerPageBtn","이전"],["nextAnswerPageBtn","다음"],["addAnswerPageBtn","추가"],["keyboardToggleBtn","키보드"],["answerPenBtn","펜"],["answerEraserBtn","지우개"],["clearAnswerInkBtn","필기삭제"],["scoreAnswerPenBtn","수정펜"],["scoreAnswerEraserBtn","수정지우개"],["clearScoreAnswerInkBtn","수정삭제"],["scoreExpPenBtn","해설펜"],["scoreExpEraserBtn","해설지우개"],["clearScoreExpInkBtn","해설삭제"]].forEach(([id,t])=>{const el=$(id); if(el) el.textContent=t;});
  const k=$("keyboardToggleBtn"); if(k && state.answerInputMode==="keyboard") k.textContent="손글씨";
}
const openCurrentProblem_v15=openCurrentProblem;
openCurrentProblem=function(){openCurrentProblem_v15();setTimeout(()=>{setupSplitHandleV15();compactRuntimeLabelsV15();},250);};
const openScore_v15=openScore;
openScore=function(){openScore_v15();setTimeout(()=>{compactRuntimeLabelsV15();},250);};
setTimeout(()=>{setupSplitHandleV15();compactRuntimeLabelsV15();},1000);
window.addEventListener("resize",()=>setTimeout(()=>{setupSplitHandleV15();setSplitRatioV15(Number(localStorage.getItem("essaySplitRatioV15")||48));},200));

/* === v16: 빨간 핸들 손가락 세로 조절 강제 === */
function clampV16(v,min,max){return Math.max(min,Math.min(max,v));}
function setSplitRatioV16(r){
  r=clampV16(r,16,82);
  const shell=$("solveShell"); if(!shell)return;
  shell.style.gridTemplateRows=`${r}dvh 42px calc(${100-r}dvh - 42px)`;
  localStorage.setItem("essaySplitRatioV16",String(r));
  localStorage.setItem("essaySplitRatioV15",String(r));
  setTimeout(()=>{try{fitImage()}catch{} try{resizeAnswerCanvasV10();drawAnswerInkV10()}catch{} try{resizeAnswerCanvasV9();drawAnswerInkV9()}catch{}},30);
}
function setupSplitHandleV16(){
  let h=$("splitHandle"); if(!h)return;
  const fresh=h.cloneNode(true); h.replaceWith(fresh); h=fresh;
  h.id="splitHandle"; h.classList.add("v16-resize-handle","phone-drag-handle");
  setSplitRatioV16(Number(localStorage.getItem("essaySplitRatioV16")||localStorage.getItem("essaySplitRatioV15")||48));
  let active=false, pid=null;
  const ratio=(y)=>{const vv=window.visualViewport; const vh=vv?.height||window.innerHeight||1; const top=vv?.offsetTop||0; return (y-top)/vh*100};
  const start=(y,id)=>{active=true;pid=id;h.classList.add("dragging");setSplitRatioV16(ratio(y));};
  const move=(y)=>{if(active)setSplitRatioV16(ratio(y));};
  const end=()=>{active=false;pid=null;h.classList.remove("dragging");};
  h.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();try{h.setPointerCapture(e.pointerId)}catch{};start(e.clientY,e.pointerId)},true);
  h.addEventListener("pointermove",e=>{if(!active||pid!==e.pointerId)return;e.preventDefault();e.stopPropagation();move(e.clientY)},true);
  h.addEventListener("pointerup",e=>{e.preventDefault();e.stopPropagation();end()},true);
  h.addEventListener("pointercancel",e=>{e.preventDefault();e.stopPropagation();end()},true);
  h.addEventListener("touchstart",e=>{e.preventDefault();e.stopPropagation();if(e.touches&&e.touches[0])start(e.touches[0].clientY,"touch")},{passive:false,capture:true});
  h.addEventListener("touchmove",e=>{if(!active)return;e.preventDefault();e.stopPropagation();if(e.touches&&e.touches[0])move(e.touches[0].clientY)},{passive:false,capture:true});
  h.addEventListener("touchend",e=>{e.preventDefault();e.stopPropagation();end()},{passive:false,capture:true});
}
function forceOneLineLabelsV16(){
 [["prevAnswerPageBtn","이전"],["nextAnswerPageBtn","다음"],["addAnswerPageBtn","추가"],["keyboardToggleBtn",state.answerInputMode==="keyboard"?"손글씨":"키보드"],["answerPenBtn","펜"],["answerEraserBtn","지우개"],["clearAnswerInkBtn","삭제"],["prevExplanationPageBtn","이전"],["nextExplanationPageBtn","다음"],["scoreExpPenBtn","펜"],["scoreExpEraserBtn","지우개"],["clearScoreExpInkBtn","삭제"]].forEach(([id,t])=>{const e=$(id);if(e)e.textContent=t});
}
const openCurrentProblem_v16=openCurrentProblem;
openCurrentProblem=function(){openCurrentProblem_v16();setTimeout(()=>{setupSplitHandleV16();forceOneLineLabelsV16()},350)};
const openScore_v16=openScore;
openScore=function(){openScore_v16();setTimeout(forceOneLineLabelsV16,350)};
setTimeout(()=>{setupSplitHandleV16();forceOneLineLabelsV16()},1200);
window.addEventListener("resize",()=>setTimeout(()=>setSplitRatioV16(Number(localStorage.getItem("essaySplitRatioV16")||48)),160));

/* === v17: 버튼식 크기조절 확정판 === */
function clampV17(v,min,max){return Math.max(min,Math.min(max,v));}
function setSplitRatioV17(r){
  r=clampV17(r,18,82);
  const shell=$("solveShell");
  if(!shell) return;
  shell.style.gridTemplateRows=`${r}dvh 46px calc(${100-r}dvh - 46px)`;
  localStorage.setItem("essaySplitRatioV17",String(r));
  localStorage.setItem("essaySplitRatioV16",String(r));
  localStorage.setItem("essaySplitRatioV15",String(r));
  setTimeout(()=>{
    try{fitImage()}catch{}
    try{resizeAnswerCanvasV10();drawAnswerInkV10()}catch{}
    try{resizeAnswerCanvasV9();drawAnswerInkV9()}catch{}
  },50);
}
function currentSplitRatioV17(){
  return Number(localStorage.getItem("essaySplitRatioV17") || localStorage.getItem("essaySplitRatioV16") || 48);
}
function connectResizeButtonsV17(){
  const handle=$("splitHandle");
  if(!handle) return;

  // 기존 드래그 리스너가 꼬여도 버튼은 onclick으로 독립 작동
  const saved=currentSplitRatioV17();
  setSplitRatioV17(saved);

  const problemMore=$("problemMoreBtn");
  const half=$("halfSplitBtn");
  const answerMore=$("answerMoreBtn");

  if(problemMore) {
    problemMore.onclick=(e)=>{e.preventDefault();e.stopPropagation();setSplitRatioV17(clampV17(currentSplitRatioV17()+10,18,82));};
  }
  if(half) {
    half.onclick=(e)=>{e.preventDefault();e.stopPropagation();setSplitRatioV17(48);};
  }
  if(answerMore) {
    answerMore.onclick=(e)=>{e.preventDefault();e.stopPropagation();setSplitRatioV17(clampV17(currentSplitRatioV17()-10,18,82));};
  }

  // 그래도 드래그도 최대한 유지
  let active=false;
  const ratio=(y)=>{
    const vv=window.visualViewport;
    const vh=vv?.height||window.innerHeight||1;
    const top=vv?.offsetTop||0;
    return (y-top)/vh*100;
  };
  const start=(y)=>{active=true;handle.classList.add("dragging");setSplitRatioV17(ratio(y));};
  const move=(y)=>{if(active)setSplitRatioV17(ratio(y));};
  const end=()=>{active=false;handle.classList.remove("dragging");};

  const pill=handle.querySelector(".v17-pill") || handle;
  pill.onpointerdown=(e)=>{e.preventDefault();e.stopPropagation();try{pill.setPointerCapture(e.pointerId)}catch{};start(e.clientY);};
  pill.onpointermove=(e)=>{if(!active)return;e.preventDefault();e.stopPropagation();move(e.clientY);};
  pill.onpointerup=(e)=>{e.preventDefault();e.stopPropagation();end();};
  pill.onpointercancel=(e)=>{e.preventDefault();e.stopPropagation();end();};
}
const openCurrentProblem_v17=openCurrentProblem;
openCurrentProblem=function(){
  openCurrentProblem_v17();
  setTimeout(connectResizeButtonsV17,350);
};
setTimeout(connectResizeButtonsV17,1200);
window.addEventListener("resize",()=>setTimeout(()=>setSplitRatioV17(currentSplitRatioV17()),160));

/* === v18: 크기조절 버튼 실제 반영 수정 ===
   원인: CSS의 grid-template-rows: ... !important 가 inline style을 덮어서
   v17 버튼을 눌러도 화면이 안 변했음.
   해결: style.setProperty(..., "important")로 강제 반영.
*/
function clampV18(v, min, max) { return Math.max(min, Math.min(max, v)); }

function setSplitRatioV18(r) {
  r = clampV18(Number(r) || 48, 18, 82);
  const shell = $("solveShell");
  if (!shell) return;

  const rows = `${r}dvh 46px calc(${100 - r}dvh - 46px)`;
  shell.style.setProperty("grid-template-rows", rows, "important");

  localStorage.setItem("essaySplitRatioV18", String(r));
  localStorage.setItem("essaySplitRatioV17", String(r));
  localStorage.setItem("essaySplitRatioV16", String(r));

  setTimeout(() => {
    try { fitImage(); } catch {}
    try { resizeAnswerCanvasV10(); drawAnswerInkV10(); } catch {}
    try { resizeAnswerCanvasV9(); drawAnswerInkV9(); } catch {}
  }, 40);
}

function currentSplitRatioV18() {
  return Number(
    localStorage.getItem("essaySplitRatioV18") ||
    localStorage.getItem("essaySplitRatioV17") ||
    localStorage.getItem("essaySplitRatioV16") ||
    48
  );
}

function connectResizeButtonsV18() {
  const problemMore = $("problemMoreBtn");
  const half = $("halfSplitBtn");
  const answerMore = $("answerMoreBtn");
  const handle = $("splitHandle");

  setSplitRatioV18(currentSplitRatioV18());

  if (problemMore) {
    problemMore.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSplitRatioV18(currentSplitRatioV18() + 12);
    };
  }
  if (half) {
    half.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSplitRatioV18(48);
    };
  }
  if (answerMore) {
    answerMore.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSplitRatioV18(currentSplitRatioV18() - 12);
    };
  }

  // 파란 막대 드래그도 같은 강제 방식으로 처리
  const pill = document.querySelector("#splitHandle .v17-pill, #splitHandle .drag-pill");
  if (handle && pill && !pill.dataset.v18ready) {
    pill.dataset.v18ready = "1";
    let active = false;

    const toRatio = (y) => {
      const vv = window.visualViewport;
      const vh = vv?.height || window.innerHeight || 1;
      const top = vv?.offsetTop || 0;
      return ((y - top) / vh) * 100;
    };

    pill.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      active = true;
      handle.classList.add("dragging");
      try { pill.setPointerCapture(e.pointerId); } catch {}
      setSplitRatioV18(toRatio(e.clientY));
    }, true);

    pill.addEventListener("pointermove", (e) => {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      setSplitRatioV18(toRatio(e.clientY));
    }, true);

    const end = (e) => {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      active = false;
      handle.classList.remove("dragging");
    };

    pill.addEventListener("pointerup", end, true);
    pill.addEventListener("pointercancel", end, true);
  }
}

const openCurrentProblem_v18 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v18();
  setTimeout(connectResizeButtonsV18, 500);
};

setTimeout(connectResizeButtonsV18, 1500);
window.addEventListener("resize", () => {
  setTimeout(() => setSplitRatioV18(currentSplitRatioV18()), 160);
});

/* === v19: 중간바/크기조절 기능 비활성화 === */
function forceNoMiddleBarV19() {
  const h = $("splitHandle");
  if (h) h.remove();

  const shell = $("solveShell");
  if (shell) {
    shell.style.setProperty("grid-template-rows", "48dvh 52dvh", "important");
    shell.style.setProperty("grid-template-columns", "1fr", "important");
  }

  setTimeout(() => {
    try { fitImage(); } catch {}
    try { resizeAnswerCanvasV10(); drawAnswerInkV10(); } catch {}
    try { resizeAnswerCanvasV9(); drawAnswerInkV9(); } catch {}
  }, 80);
}

function setupSplitHandleV11() {}
function setupSplitHandleV15() {}
function setupSplitHandleV16() {}
function connectResizeButtonsV17() {}
function connectResizeButtonsV18() {}
function setSplitRatioV11() { forceNoMiddleBarV19(); }
function setSplitRatioV15() { forceNoMiddleBarV19(); }
function setSplitRatioV16() { forceNoMiddleBarV19(); }
function setSplitRatioV17() { forceNoMiddleBarV19(); }
function setSplitRatioV18() { forceNoMiddleBarV19(); }

const openCurrentProblem_v19 = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblem_v19();
  setTimeout(forceNoMiddleBarV19, 300);
};

setTimeout(forceNoMiddleBarV19, 1000);
window.addEventListener("resize", () => setTimeout(forceNoMiddleBarV19, 160));

/* === v20: 문제등록 이미지 선택 방식 - 이전 선택 그대로 유지 === */
function v20PageArray(target) {
  return target === "explanation" ? state.explanationPages : state.questionPages;
}
function selectedIndexFor(target) {
  return target === "explanation" ? state.selectedExplanationPage : state.selectedQuestionPage;
}
function setSelectedIndex(target, index) {
  if (target === "explanation") state.selectedExplanationPage = Number(index);
  else state.selectedQuestionPage = Number(index);
}
function normalizeSelectionV20(target) {
  const arr = v20PageArray(target);
  let selected = selectedIndexFor(target);
  if (!arr.length) {
    setSelectedIndex(target, -1);
    return -1;
  }
  if (selected < 0 || selected >= arr.length) {
    selected = 0;
    setSelectedIndex(target, selected);
  }
  return selected;
}
function addBlankPage(target) {
  const arr = v20PageArray(target);
  arr.push("");
  setSelectedIndex(target, arr.length - 1);
  setPasteTarget(target);
  renderPageLists();
  toast(`${target === "explanation" ? "해설" : "문제"} 빈 페이지 추가 · 새 페이지 선택 유지`);
}
async function addImageFiles(files, target) {
  const arrFiles = Array.from(files || []).filter(file => file && file.type && file.type.startsWith("image/"));
  if (!arrFiles.length) {
    toast("이미지 파일이 없어");
    return;
  }

  const arr = v20PageArray(target);
  const originalSelected = selectedIndexFor(target);
  let insertAt = originalSelected;

  if (insertAt < 0 || insertAt >= arr.length) {
    insertAt = arr.length;
  }

  let added = 0, size = 0;
  for (const file of arrFiles) {
    const data = await imageBlobToDataUrl(file);

    if (added === 0 && insertAt >= 0 && insertAt < arr.length) {
      // 선택한 페이지가 빈 페이지든 기존 이미지든 그 자리에 그대로 넣기
      arr[insertAt] = data;
    } else if (insertAt >= 0 && insertAt < arr.length) {
      // 여러 장이면 선택한 페이지 뒤에 순서대로 추가
      arr.splice(insertAt + added, 0, data);
    } else {
      arr.push(data);
      if (added === 0) insertAt = arr.length - 1;
    }

    size += dataUrlBytes(data);
    added++;
  }

  // 핵심: 사용자가 선택했던 페이지를 그대로 유지
  if (insertAt >= 0 && insertAt < arr.length) setSelectedIndex(target, insertAt);
  else setSelectedIndex(target, arr.length ? arr.length - 1 : -1);

  setPasteTarget(target);
  renderPageLists();
  toast(`${target === "explanation" ? "해설" : "문제"} 이미지 ${added}장 추가 · 선택 페이지 유지`);
}
function movePage(target, index, dir) {
  const arr = v20PageArray(target), next = index + dir;
  if (next < 0 || next >= arr.length) return;

  [arr[index], arr[next]] = [arr[next], arr[index]];

  const selected = selectedIndexFor(target);
  if (selected === index) setSelectedIndex(target, next);
  else if (selected === next) setSelectedIndex(target, index);

  renderPageLists();
}
function deletePage(target, index) {
  const arr = v20PageArray(target);
  arr.splice(index, 1);

  let selected = selectedIndexFor(target);
  if (!arr.length) selected = -1;
  else if (selected === index) selected = Math.min(index, arr.length - 1);
  else if (selected > index) selected -= 1;

  setSelectedIndex(target, selected);
  renderPageLists();
}
function renderPageList(id, arr, target) {
  const box = $(id);
  if (!box) return;
  box.innerHTML = "";
  if (!arr.length) {
    box.innerHTML = '<p class="hint">아직 페이지가 없어. “빈 페이지 추가”를 누른 뒤 스샷을 붙여넣어.</p>';
    return;
  }

  normalizeSelectionV20(target);
  const selected = selectedIndexFor(target);

  arr.forEach((src, index) => {
    const div = document.createElement("div");
    div.className = "page-item" + (selected === index ? " selected-page" : "");
    div.addEventListener("click", () => {
      setSelectedIndex(target, index);
      setPasteTarget(target);
      renderPageLists();
    });

    const isReal = isRealPage(src);
    const thumb = isReal
      ? `<img src="${src}" alt="${index + 1}쪽" />`
      : `<div class="blank-thumb">빈 페이지<br/>붙여넣기</div>`;

    div.innerHTML = `${thumb}<div><strong>${index + 1}쪽${selected === index ? " · 선택됨" : ""}</strong><p class="hint">${selected === index ? "여기에 이미지가 들어갑니다" : (isReal ? "이미지 페이지" : "빈 페이지")}</p><div class="page-actions"></div></div>`;

    const actions = div.querySelector(".page-actions");
    actions.append(makeButton("선택", () => {
      setSelectedIndex(target, index);
      setPasteTarget(target);
      renderPageLists();
    }, "secondary small"));
    actions.append(makeButton("위", () => movePage(target, index, -1), "secondary small"));
    actions.append(makeButton("아래", () => movePage(target, index, 1), "secondary small"));
    actions.append(makeButton("삭제", () => deletePage(target, index), "danger small"));
    box.append(div);
  });
}
function renderPageLists() {
  renderPageList("questionPageList", state.questionPages, "question");
  renderPageList("explanationPageList", state.explanationPages, "explanation");
}
function fillForm(p) {
  $("formTitle").textContent = "문제 수정";
  $("editId").value = p.id;
  $("subjectInput").value = p.subject || "형법";
  $("sessionInput").value = p.session || "";
  $("titleInput").value = p.title || "";
  $("scoreInput").value = p.maxScore || 20;
  $("timeInput").value = p.timeLimit || 30;
  $("pointsInput").value = p.pointsText || (p.points || []).join("\n");
  $("modelTextInput").value = p.modelText || "";
  state.questionPages = [...(p.questionPages || [])];
  state.explanationPages = [...(p.explanationPages || [])];

  // 수정 화면에서는 기존 첫 페이지 선택. 이후 사용자가 선택한 페이지는 계속 유지.
  setSelectedIndex("question", state.questionPages.length ? 0 : -1);
  setSelectedIndex("explanation", state.explanationPages.length ? 0 : -1);
  setPasteTarget("question");
  renderPageLists();
  showView("addView");
  window.scrollTo(0, 0);
}
function resetForm() {
  $("formTitle").textContent = "문제 등록";
  $("problemForm").reset();
  $("editId").value = "";
  $("scoreInput").value = 20;
  $("timeInput").value = 30;
  $("qualityInput").value = "sharp";
  state.questionPages = [];
  state.explanationPages = [];
  setSelectedIndex("question", -1);
  setSelectedIndex("explanation", -1);
  setPasteTarget("question");
  renderPageLists();
}
setTimeout(() => {
  const cq = $("clearQuestionBtn");
  if (cq) cq.onclick = () => {
    state.questionPages = [];
    setSelectedIndex("question", -1);
    renderPageLists();
  };
  const ce = $("clearExplanationBtn");
  if (ce) ce.onclick = () => {
    state.explanationPages = [];
    setSelectedIndex("explanation", -1);
    renderPageLists();
  };
}, 500);


/* === v21: 바로전 대분류/이미지저장방식 유지 + 붙여넣기 자동 다음페이지 === */
const V21_PREF_KEY = "essayPsatBaseV21LastFormPrefs";

function getV21Prefs() {
  try {
    return JSON.parse(localStorage.getItem(V21_PREF_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function saveV21Prefs() {
  const subject = $("subjectInput")?.value || "형법";
  const quality = $("qualityInput")?.value || "sharp";
  localStorage.setItem(V21_PREF_KEY, JSON.stringify({ subject, quality }));
}
function applyV21Prefs() {
  const prefs = getV21Prefs();
  if ($("subjectInput")) $("subjectInput").value = prefs.subject || $("subjectInput").value || "형법";
  if ($("qualityInput")) $("qualityInput").value = prefs.quality || $("qualityInput").value || "sharp";
}
function ensureNextBlankPageV21(target) {
  const arr = target === "explanation" ? state.explanationPages : state.questionPages;
  let selected = selectedIndexFor(target);
  if (selected < 0) {
    arr.push("");
    setSelectedIndex(target, 0);
    setPasteTarget(target);
    return;
  }
  const next = selected + 1;

  if (next < arr.length) {
    setSelectedIndex(target, next);
    setPasteTarget(target);
    return;
  }

  arr.push("");
  setSelectedIndex(target, arr.length - 1);
  setPasteTarget(target);
}
async function addImageFilesV21(files, target, options = {}) {
  const arrFiles = Array.from(files || []).filter(file => file && file.type && file.type.startsWith("image/"));
  if (!arrFiles.length) {
    toast("이미지 파일이 없어");
    return;
  }

  const arr = v20PageArray(target);
  const originalSelected = selectedIndexFor(target);
  let insertAt = originalSelected;

  if (insertAt < 0 || insertAt >= arr.length) insertAt = arr.length;

  let added = 0;
  for (const file of arrFiles) {
    const data = await imageBlobToDataUrl(file);

    if (added === 0 && insertAt >= 0 && insertAt < arr.length) {
      arr[insertAt] = data;
    } else if (insertAt >= 0 && insertAt < arr.length) {
      arr.splice(insertAt + added, 0, data);
    } else {
      arr.push(data);
      if (added === 0) insertAt = arr.length - 1;
    }
    added++;
  }

  if (options.autoNextAfterPaste) {
    // 첫 붙여넣기 완료 후 자동으로 다음 페이지로
    if (insertAt >= 0 && insertAt < arr.length) setSelectedIndex(target, insertAt);
    else setSelectedIndex(target, arr.length ? arr.length - 1 : -1);
    ensureNextBlankPageV21(target);
  } else {
    if (insertAt >= 0 && insertAt < arr.length) setSelectedIndex(target, insertAt);
    else setSelectedIndex(target, arr.length ? arr.length - 1 : -1);
  }

  setPasteTarget(target);
  renderPageLists();
  toast(`${target === "explanation" ? "해설" : "문제"} 이미지 ${added}장 추가`);
}
async function addImageFiles(files, target) {
  return addImageFilesV21(files, target, { autoNextAfterPaste: false });
}
async function pasteImageFromClipboardEvent(event, explicitTarget = "") {
  const items = event.clipboardData?.items ? Array.from(event.clipboardData.items) : [];
  const files = items.filter(item => item.type?.startsWith("image/")).map(item => item.getAsFile()).filter(Boolean);
  if (!files.length) return false;
  if (event.preventDefault) event.preventDefault();
  const target = explicitTarget || event.currentTarget?.dataset?.pasteTarget || state.activePasteTarget || "question";
  toast("스크린샷 처리 중...");
  await addImageFilesV21(files, target, { autoNextAfterPaste: true });
  return true;
}
async function tryButtonPaste(target) {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    toast("이 브라우저는 버튼 붙여넣기를 지원하지 않아. 영역 클릭 후 Ctrl+V를 눌러줘.");
    return;
  }
  try {
    const items = await navigator.clipboard.read();
    const files = [];
    for (const item of items) {
      const type = (item.types || []).find(type => type.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      files.push(new File([blob], `${target}_${Date.now()}_${files.length}.png`, { type }));
    }
    if (!files.length) {
      toast("클립보드에 이미지가 없어");
      return;
    }
    toast("스크린샷 처리 중...");
    await addImageFilesV21(files, target, { autoNextAfterPaste: true });
  } catch (error) {
    console.error(error);
    toast("붙여넣기 권한이 막혔어. 영역 클릭 후 Ctrl+V를 눌러줘.");
  }
}
function fillForm(p) {
  $("formTitle").textContent = "문제 수정";
  $("editId").value = p.id;
  $("subjectInput").value = p.subject || getV21Prefs().subject || "형법";
  $("sessionInput").value = p.session || "";
  $("titleInput").value = p.title || "";
  $("scoreInput").value = p.maxScore || 20;
  $("timeInput").value = p.timeLimit || 30;
  $("pointsInput").value = p.pointsText || (p.points || []).join("\n");
  $("modelTextInput").value = p.modelText || "";
  $("qualityInput").value = getV21Prefs().quality || $("qualityInput").value || "sharp";
  state.questionPages = [...(p.questionPages || [])];
  state.explanationPages = [...(p.explanationPages || [])];
  setSelectedIndex("question", state.questionPages.length ? 0 : -1);
  setSelectedIndex("explanation", state.explanationPages.length ? 0 : -1);
  setPasteTarget("question");
  renderPageLists();
  showView("addView");
  window.scrollTo(0, 0);
}
function resetForm() {
  $("formTitle").textContent = "문제 등록";
  $("problemForm").reset();
  $("editId").value = "";
  $("scoreInput").value = 20;
  $("timeInput").value = 30;
  applyV21Prefs();
  state.questionPages = [];
  state.explanationPages = [];
  setSelectedIndex("question", -1);
  setSelectedIndex("explanation", -1);
  setPasteTarget("question");
  renderPageLists();
}
const saveProblemV21Original = saveProblem;
saveProblem = async function(event) {
  saveV21Prefs();
  return saveProblemV21Original(event);
};
function setupV21PreferenceTracking() {
  applyV21Prefs();
  $("subjectInput")?.addEventListener("change", saveV21Prefs);
  $("qualityInput")?.addEventListener("change", saveV21Prefs);
}
setTimeout(setupV21PreferenceTracking, 300);


/* === v22: 문제등록/문제풀기 옆 순번 표시 === */
function renderPageList(id, arr, target) {
  const box = $(id);
  if (!box) return;
  box.innerHTML = "";

  if (!arr.length) {
    box.innerHTML = '<p class="hint">아직 페이지가 없어. “빈 페이지 추가”를 누른 뒤 스샷을 붙여넣어.</p>';
    return;
  }

  normalizeSelectionV20(target);
  const selected = selectedIndexFor(target);

  arr.forEach((src, index) => {
    const div = document.createElement("div");
    div.className = "page-item" + (selected === index ? " selected-page" : "");
    div.addEventListener("click", () => {
      setSelectedIndex(target, index);
      setPasteTarget(target);
      renderPageLists();
    });

    const isReal = isRealPage(src);
    const thumb = isReal
      ? `<img src="${src}" alt="${index + 1}쪽" />`
      : `<div class="blank-thumb">빈 페이지<br/>붙여넣기</div>`;

    div.innerHTML =
      `<span class="reg-side-no">${index + 1}</span>` +
      `${thumb}<div><strong>${index + 1}쪽${selected === index ? " · 선택됨" : ""}</strong>` +
      `<p class="hint">${selected === index ? "여기에 이미지가 들어갑니다" : (isReal ? "이미지 페이지" : "빈 페이지")}</p>` +
      `<div class="page-actions"></div></div>`;

    const actions = div.querySelector(".page-actions");
    actions.append(makeButton("선택", () => {
      setSelectedIndex(target, index);
      setPasteTarget(target);
      renderPageLists();
    }, "secondary small"));
    actions.append(makeButton("위", () => movePage(target, index, -1), "secondary small"));
    actions.append(makeButton("아래", () => movePage(target, index, 1), "secondary small"));
    actions.append(makeButton("삭제", () => deletePage(target, index), "danger small"));

    box.append(div);
  });
}

function renderPageLists() {
  renderPageList("questionPageList", state.questionPages, "question");
  renderPageList("explanationPageList", state.explanationPages, "explanation");
}

function ensureSolveSideNumbersV22() {
  const zone = $("problemZone");
  if (!zone) return;

  let qNo = $("solveSideQuestionNo");
  if (!qNo) {
    qNo = document.createElement("div");
    qNo.id = "solveSideQuestionNo";
    qNo.className = "solve-side-no";
    zone.appendChild(qNo);
  }

  let setNo = $("solveSideSetNo");
  if (!setNo) {
    setNo = document.createElement("div");
    setNo.id = "solveSideSetNo";
    setNo.className = "solve-set-side-no";
    zone.appendChild(setNo);
  }
}

function updateSolveSideNumbersV22() {
  ensureSolveSideNumbersV22();

  const p = currentProblem?.();
  const pages = realPages(p?.questionPages || []);
  const qNo = $("solveSideQuestionNo");
  const setNo = $("solveSideSetNo");

  if (qNo) {
    qNo.textContent = pages.length ? `문제 ${state.qPage + 1}/${pages.length}` : "문제 없음";
  }

  if (setNo) {
    const idx = state.solve ? Number(state.solve.index || 0) + 1 : 1;
    const total = state.solve?.ids?.length || 1;
    setNo.textContent = `순번 ${idx}/${total}`;
  }
}

const showQuestionPageV22Original = showQuestionPage;
showQuestionPage = function(index) {
  showQuestionPageV22Original(index);
  setTimeout(updateSolveSideNumbersV22, 20);
};

const openCurrentProblemV22Original = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblemV22Original();
  setTimeout(updateSolveSideNumbersV22, 80);
};


/* === v23: 문제풀기 목록에도 순번 표시 === */
function addSolveListNumbersV23() {
  const list = $("solveList");
  if (!list) return;
  Array.from(list.children).forEach((card, index) => {
    if (!card.classList?.contains("problem-card")) return;
    card.classList.add("has-solve-number");

    let badge = card.querySelector(".solve-list-card-number");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "solve-list-card-number";
      card.prepend(badge);
    }
    badge.textContent = String(index + 1);
  });
}

const renderSolveListV23Original = renderSolveList;
renderSolveList = function() {
  renderSolveListV23Original();
  addSolveListNumbersV23();
};

function ensureBigSolveOrderBadgeV23() {
  const zone = $("problemZone");
  if (!zone) return null;

  let badge = $("solveOrderBigBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "solveOrderBigBadge";
    badge.className = "solve-order-big-badge";
    badge.innerHTML = '<span id="solveOrderTextV23"></span><span id="solvePageTextV23"></span>';
    zone.appendChild(badge);
  }
  return badge;
}

function updateBigSolveOrderBadgeV23() {
  ensureBigSolveOrderBadgeV23();

  const p = currentProblem?.();
  const pages = realPages(p?.questionPages || []);
  const orderText = $("solveOrderTextV23");
  const pageText = $("solvePageTextV23");

  if (orderText) {
    const idx = state.solve ? Number(state.solve.index || 0) + 1 : 1;
    const total = state.solve?.ids?.length || 1;
    orderText.textContent = `순번 ${idx}/${total}`;
  }

  if (pageText) {
    pageText.textContent = pages.length ? `쪽 ${state.qPage + 1}/${pages.length}` : "쪽 없음";
  }
}

const showQuestionPageV23Original = showQuestionPage;
showQuestionPage = function(index) {
  showQuestionPageV23Original(index);
  setTimeout(updateBigSolveOrderBadgeV23, 30);
};

const openCurrentProblemV23Original = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblemV23Original();
  setTimeout(updateBigSolveOrderBadgeV23, 100);
};


/* === v24: 채점화면 해설 스크롤/필기 위치 수정 + 풀이화면 순번배지 삭제 === */
function removeSolveBadgesV24() {
  ["solveSideQuestionNo", "solveSideSetNo", "solveOrderBigBadge"].forEach(id => {
    const el = $(id);
    if (el) el.remove();
  });
}
function ensureSolveSideNumbersV22() { removeSolveBadgesV24(); }
function updateSolveSideNumbersV22() { removeSolveBadgesV24(); }
function ensureBigSolveOrderBadgeV23() { removeSolveBadgesV24(); return null; }
function updateBigSolveOrderBadgeV23() { removeSolveBadgesV24(); }

function v24Clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function ensureScoreExpStoreV24() {
  try {
    if (!state.scoreExpEdits) {
      state.scoreExpEdits = JSON.parse(localStorage.getItem("essayScoreExpEditsV11") || "{}");
    }
  } catch {
    state.scoreExpEdits = {};
  }
}
function scoreExpKeyV24() {
  if (typeof scoreKeyV14 === "function") return scoreKeyV14("exp");
  if (typeof scoreKeyV11 === "function") return scoreKeyV11("exp");
  const p = currentProblem?.();
  return `${p?.id || "unknown"}:exp:${state.expPage || 0}`;
}
function saveScoreExpV24() {
  try { localStorage.setItem("essayScoreExpEditsV11", JSON.stringify(state.scoreExpEdits || {})); } catch {}
}
function sizeScoreExplanationCanvasV24() {
  const wrap = $("scoreExplanationEditWrap");
  const img = $("explanationImageView");
  const canvas = $("scoreExplanationCanvas");
  if (!wrap || !img || !canvas) return false;

  if (img.classList.contains("hidden") || !img.src) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.setProperty("width", "1px", "important");
    canvas.style.setProperty("height", "1px", "important");
    return false;
  }

  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;
  const wrapW = Math.max(1, Math.floor(wrap.clientWidth || wrap.getBoundingClientRect().width || window.innerWidth - 24));
  const displayW = wrapW;
  const displayH = Math.max(220, Math.round(displayW * naturalH / naturalW));
  const dpr = window.devicePixelRatio || 1;

  img.style.setProperty("width", displayW + "px", "important");
  img.style.setProperty("height", displayH + "px", "important");
  img.style.setProperty("max-width", "none", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("margin", "0", "important");

  canvas.width = Math.max(1, Math.round(displayW * dpr));
  canvas.height = Math.max(1, Math.round(displayH * dpr));
  canvas.style.setProperty("width", displayW + "px", "important");
  canvas.style.setProperty("height", displayH + "px", "important");
  canvas.style.setProperty("left", "0px", "important");
  canvas.style.setProperty("top", "0px", "important");

  wrap.style.setProperty("height", Math.min(displayH, Math.floor(window.innerHeight * 0.62)) + "px", "important");
  return true;
}
function scoreExpPointV24(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: v24Clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: v24Clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
  };
}
function drawScoreExplanationCanvasV24() {
  ensureScoreExpStoreV24();

  const canvas = $("scoreExplanationCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const strokes = (state.scoreExpEdits || {})[scoreExpKeyV24()] || [];
  for (const stroke of strokes) {
    if (!stroke.points || !stroke.points.length) continue;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#0ea5e9";
    ctx.lineWidth = Number(stroke.size || state.scoreExpSize || 4);
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
}
function resetScoreExplanationCanvasV24() {
  ensureScoreExpStoreV24();

  let canvas = $("scoreExplanationCanvas");
  const wrap = $("scoreExplanationEditWrap");
  const img = $("explanationImageView");
  if (!canvas || !wrap || !img) return;

  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  if (!img.classList.contains("hidden") && img.src && !(img.complete && img.naturalWidth)) {
    img.onload = () => setTimeout(resetScoreExplanationCanvasV24, 30);
    return;
  }

  sizeScoreExplanationCanvasV24();
  drawScoreExplanationCanvasV24();

  let current = null;
  let pan = null;

  const block = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  canvas.addEventListener("pointerdown", (event) => {
    block(event);
    canvas.setPointerCapture?.(event.pointerId);

    if (event.pointerType !== "pen") {
      canvas.classList.add("is-panning");
      const shell = document.querySelector(".score-shell");
      pan = {
        x: event.clientX,
        y: event.clientY,
        left: wrap.scrollLeft,
        top: wrap.scrollTop,
        shellTop: shell ? shell.scrollTop : 0
      };
      return;
    }

    const tool = state.scoreExpEditTool === "eraser" ? "eraser" : "pen";
    const size = Number(state.scoreExpSize || $("scoreExpSizeInput")?.value || 4) * (tool === "eraser" ? 5 : 1);
    current = {
      tool,
      size,
      points: [scoreExpPointV24(event, canvas)]
    };

    const key = scoreExpKeyV24();
    if (!state.scoreExpEdits[key]) state.scoreExpEdits[key] = [];
    state.scoreExpEdits[key].push(current);
    drawScoreExplanationCanvasV24();
  }, true);

  canvas.addEventListener("pointermove", (event) => {
    block(event);

    if (event.pointerType !== "pen") {
      if (!pan) return;
      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
      const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      const desiredTop = pan.top - dy;
      const desiredLeft = pan.left - dx;

      wrap.scrollTop = v24Clamp(desiredTop, 0, maxTop);
      wrap.scrollLeft = v24Clamp(desiredLeft, 0, maxLeft);

      // 해설 이미지 끝에서 계속 손가락으로 밀면 채점화면 전체도 같이 이동
      if (desiredTop < 0 || desiredTop > maxTop || maxTop < 2) {
        const shell = document.querySelector(".score-shell");
        if (shell) shell.scrollTop = pan.shellTop - dy;
      }
      return;
    }

    if (!current) return;
    current.points.push(scoreExpPointV24(event, canvas));
    drawScoreExplanationCanvasV24();
  }, true);

  const end = (event) => {
    block(event);

    if (event.pointerType !== "pen") {
      pan = null;
      canvas.classList.remove("is-panning");
      return;
    }

    if (!current) return;
    current = null;
    saveScoreExpV24();
  };

  canvas.addEventListener("pointerup", end, true);
  canvas.addEventListener("pointercancel", end, true);
  canvas.addEventListener("pointerleave", end, true);
}
function connectScoreExpToolsV24() {
  $("scoreExpSizeInput") && ($("scoreExpSizeInput").oninput = e => {
    state.scoreExpSize = Number(e.target.value || 4);
  });
  $("scoreExpPenBtn") && ($("scoreExpPenBtn").onclick = () => {
    state.scoreExpEditTool = "pen";
    try { setScoreToolV11?.("exp", "pen"); } catch {}
  });
  $("scoreExpEraserBtn") && ($("scoreExpEraserBtn").onclick = () => {
    state.scoreExpEditTool = "eraser";
    try { setScoreToolV11?.("exp", "eraser"); } catch {}
  });
  $("clearScoreExpInkBtn") && ($("clearScoreExpInkBtn").onclick = () => {
    if (!confirm("현재 해설 필기를 지울까?")) return;
    ensureScoreExpStoreV24();
    delete state.scoreExpEdits[scoreExpKeyV24()];
    saveScoreExpV24();
    resetScoreExplanationCanvasV24();
  });
}

/* 이전 버전 함수명으로 호출되는 곳까지 v24 로직으로 연결 */
function fitExplanationAndCanvasV14() { resetScoreExplanationCanvasV24(); }
function resetScoreExplanationCanvasV14() { resetScoreExplanationCanvasV24(); }
function resetScoreExplanationCanvasV11() { resetScoreExplanationCanvasV24(); }

const showExplanationPageV24Original = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPageV24Original(index);
  setTimeout(() => {
    connectScoreExpToolsV24();
    resetScoreExplanationCanvasV24();
    removeSolveBadgesV24();
  }, 120);
  setTimeout(resetScoreExplanationCanvasV24, 420);
};

const openScoreV24Original = openScore;
openScore = function() {
  openScoreV24Original();
  setTimeout(() => {
    connectScoreExpToolsV24();
    resetScoreExplanationCanvasV24();
    removeSolveBadgesV24();
  }, 220);
  setTimeout(resetScoreExplanationCanvasV24, 620);
};

const openCurrentProblemV24Original = openCurrentProblem;
openCurrentProblem = function() {
  openCurrentProblemV24Original();
  setTimeout(removeSolveBadgesV24, 50);
  setTimeout(removeSolveBadgesV24, 250);
};

setTimeout(() => {
  connectScoreExpToolsV24();
  resetScoreExplanationCanvasV24();
  removeSolveBadgesV24();
}, 1300);

window.addEventListener("resize", () => setTimeout(resetScoreExplanationCanvasV24, 220));


/* === v25: 문제풀이 출제 범위 추가 === */
function solveScopeV25() {
  return $("solveScope")?.value || "all";
}
function scopeLabelV25(scope = solveScopeV25()) {
  return ({
    all: "전체 랜덤",
    review: "복습필요 문제만",
    slow: "오래 걸린 문제만",
    unseen: "안 푼 문제만",
    solved: "푼 문제만"
  })[scope] || "전체 랜덤";
}
function isSlowProblemV25(problem) {
  const last = lastAttempt(problem.id);
  if (!last) return false;
  const elapsed = Number(last.elapsedMs || 0);
  const limit = Number(problem.timeLimit || 0) * 60000;
  if (limit > 0) return elapsed >= limit;
  return elapsed >= 30 * 60000;
}
function scopeMatchesV25(problem, scope = solveScopeV25()) {
  const attempts = attemptsOf(problem.id);
  const last = lastAttempt(problem.id);
  if (scope === "review") return String(last?.needReview) === "true";
  if (scope === "slow") return isSlowProblemV25(problem);
  if (scope === "unseen") return attempts.length === 0;
  if (scope === "solved") return attempts.length > 0;
  return true;
}
function filterProblemsByScopeV25(list, scope = solveScopeV25()) {
  return (list || []).filter(problem => scopeMatchesV25(problem, scope));
}
function renderScopeSummaryV25(list) {
  const root = $("solveScope")?.closest("section.card");
  if (!root) return;
  let box = $("solveScopeSummaryV25");
  if (!box) {
    box = document.createElement("div");
    box.id = "solveScopeSummaryV25";
    box.className = "scope-summary-v25";
    root.appendChild(box);
  }
  const scope = solveScopeV25();
  box.textContent = `${scopeLabelV25(scope)} · 표시 ${list.length}문제`;
}
const filterProblemsV25Original = filterProblems;
filterProblems = function(args = {}) {
  const base = filterProblemsV25Original(args);
  if (args && args.applyScope === false) return base;
  if (args && args.scope) return filterProblemsByScopeV25(base, args.scope);
  return base;
};
const problemCardV25Original = problemCard;
problemCard = function(problem, opts = {}) {
  const card = problemCardV25Original(problem, opts);
  if (opts.solve) {
    const badges = card.querySelector(".badges");
    if (badges && !badges.querySelector(".scope-badge-v25")) {
      const scope = solveScopeV25();
      const span = document.createElement("span");
      span.className = "badge scope-badge-v25";
      span.textContent = scopeLabelV25(scope);
      badges.appendChild(span);
    }
  }
  return card;
};
function renderSolveList() {
  const list = $("solveList");
  const arr = filterProblems({
    subject: $("solveSubject").value,
    session: $("solveSession").value,
    scope: solveScopeV25()
  });
  if (!list) return;
  list.innerHTML = "";
  renderScopeSummaryV25(arr);
  if (!arr.length) {
    list.innerHTML = '<p class="hint">조건에 맞는 문제가 없어.</p>';
    return;
  }
  arr.forEach(problem => list.append(problemCard(problem, { solve: true })));
}
function startRandom(reviewOnly = false) {
  let arr = filterProblems({
    subject: $("solveSubject").value,
    session: $("solveSession").value,
    scope: reviewOnly ? "review" : solveScopeV25()
  });
  if (!arr.length) {
    toast(reviewOnly ? "복습필요 문제가 없어" : `${scopeLabelV25()} 조건에 맞는 문제가 없어`);
    return;
  }
  const picks = chooseRandom(arr, Number($("randomCount").value || 1));
  startSolve(picks.map(problem => problem.id), $("solveMode").value || "outline");
}
function bindSolveScopeV25() {
  const select = $("solveScope");
  if (select && !select.dataset.v25Ready) {
    select.dataset.v25Ready = "1";
    select.addEventListener("input", renderAll);
    select.addEventListener("change", renderAll);
  }
  try { renderSolveList(); } catch {}
}
setTimeout(bindSolveScopeV25, 500);


/* === v26: 텍스트 해설에도 스타일러스 필기 === */
function scoreModelTextKeyV26() {
  const p = currentProblem?.();
  return `${p?.id || "unknown"}:modelText`;
}

function sizeScoreModelTextCanvasV26() {
  ensureScoreExpStoreV24();

  const wrap = $("scoreModelTextEditWrap");
  const text = $("modelTextView");
  const canvas = $("scoreModelTextCanvas");
  if (!wrap || !text || !canvas) return false;

  const hasText = !!String(text.textContent || "").trim();
  wrap.classList.toggle("text-empty-v26", !hasText);

  if (!hasText) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.setProperty("width", "1px", "important");
    canvas.style.setProperty("height", "1px", "important");
    return false;
  }

  const wrapW = Math.max(
    1,
    Math.floor(wrap.clientWidth || wrap.getBoundingClientRect().width || window.innerWidth - 24)
  );

  text.style.setProperty("width", wrapW + "px", "important");
  text.style.setProperty("min-height", "220px", "important");

  const contentH = Math.max(
    220,
    Math.ceil(text.scrollHeight || text.getBoundingClientRect().height || 220)
  );
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.round(wrapW * dpr));
  canvas.height = Math.max(1, Math.round(contentH * dpr));
  canvas.style.setProperty("width", wrapW + "px", "important");
  canvas.style.setProperty("height", contentH + "px", "important");
  canvas.style.setProperty("left", "0px", "important");
  canvas.style.setProperty("top", "0px", "important");

  text.style.setProperty("height", contentH + "px", "important");
  wrap.style.setProperty(
    "height",
    Math.min(contentH, Math.floor(window.innerHeight * 0.58)) + "px",
    "important"
  );
  return true;
}

function scoreModelTextPointV26(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: v24Clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: v24Clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
  };
}

function drawScoreModelTextCanvasV26() {
  ensureScoreExpStoreV24();

  const canvas = $("scoreModelTextCanvas");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const strokes = (state.scoreExpEdits || {})[scoreModelTextKeyV26()] || [];
  for (const stroke of strokes) {
    if (!stroke.points || !stroke.points.length) continue;

    ctx.save();
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle =
      stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#0ea5e9";
    ctx.lineWidth = Number(stroke.size || state.scoreExpSize || 4);
    ctx.beginPath();

    stroke.points.forEach((pt, index) => {
      const x = pt.x * rect.width;
      const y = pt.y * rect.height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.restore();
  }
}

function resetScoreModelTextCanvasV26() {
  ensureScoreExpStoreV24();

  let canvas = $("scoreModelTextCanvas");
  const wrap = $("scoreModelTextEditWrap");
  const text = $("modelTextView");
  if (!canvas || !wrap || !text) return;

  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  if (!sizeScoreModelTextCanvasV26()) return;
  drawScoreModelTextCanvasV26();

  let current = null;
  let pan = null;

  const block = event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  canvas.addEventListener("pointerdown", event => {
    block(event);
    canvas.setPointerCapture?.(event.pointerId);

    if (event.pointerType !== "pen") {
      canvas.classList.add("is-panning");
      const shell = document.querySelector(".score-shell");
      pan = {
        x: event.clientX,
        y: event.clientY,
        left: wrap.scrollLeft,
        top: wrap.scrollTop,
        shellTop: shell ? shell.scrollTop : 0
      };
      return;
    }

    const tool = state.scoreExpEditTool === "eraser" ? "eraser" : "pen";
    const size =
      Number(state.scoreExpSize || $("scoreExpSizeInput")?.value || 4) *
      (tool === "eraser" ? 5 : 1);

    current = {
      tool,
      size,
      points: [scoreModelTextPointV26(event, canvas)]
    };

    const key = scoreModelTextKeyV26();
    if (!state.scoreExpEdits[key]) state.scoreExpEdits[key] = [];
    state.scoreExpEdits[key].push(current);
    drawScoreModelTextCanvasV26();
  }, true);

  canvas.addEventListener("pointermove", event => {
    block(event);

    if (event.pointerType !== "pen") {
      if (!pan) return;

      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
      const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      const desiredTop = pan.top - dy;
      const desiredLeft = pan.left - dx;

      wrap.scrollTop = v24Clamp(desiredTop, 0, maxTop);
      wrap.scrollLeft = v24Clamp(desiredLeft, 0, maxLeft);

      if (desiredTop < 0 || desiredTop > maxTop || maxTop < 2) {
        const shell = document.querySelector(".score-shell");
        if (shell) shell.scrollTop = pan.shellTop - dy;
      }
      return;
    }

    if (!current) return;
    current.points.push(scoreModelTextPointV26(event, canvas));
    drawScoreModelTextCanvasV26();
  }, true);

  const end = event => {
    block(event);

    if (event.pointerType !== "pen") {
      pan = null;
      canvas.classList.remove("is-panning");
      return;
    }

    if (!current) return;
    current = null;
    saveScoreExpV24();
  };

  canvas.addEventListener("pointerup", end, true);
  canvas.addEventListener("pointercancel", end, true);
  canvas.addEventListener("pointerleave", end, true);
}

function connectScoreExplanationToolsV26() {
  $("scoreExpSizeInput") && ($("scoreExpSizeInput").oninput = event => {
    state.scoreExpSize = Number(event.target.value || 4);
  });

  $("scoreExpPenBtn") && ($("scoreExpPenBtn").onclick = () => {
    state.scoreExpEditTool = "pen";
    try { setScoreToolV11?.("exp", "pen"); } catch {}
  });

  $("scoreExpEraserBtn") && ($("scoreExpEraserBtn").onclick = () => {
    state.scoreExpEditTool = "eraser";
    try { setScoreToolV11?.("exp", "eraser"); } catch {}
  });

  $("clearScoreExpInkBtn") && ($("clearScoreExpInkBtn").onclick = () => {
    if (!confirm("현재 문제의 이미지·텍스트 해설 필기를 모두 지울까?")) return;

    ensureScoreExpStoreV24();
    delete state.scoreExpEdits[scoreExpKeyV24()];
    delete state.scoreExpEdits[scoreModelTextKeyV26()];
    saveScoreExpV24();

    resetScoreExplanationCanvasV24();
    resetScoreModelTextCanvasV26();
  });
}

function refreshScoreExplanationInkV26() {
  connectScoreExplanationToolsV26();
  resetScoreModelTextCanvasV26();
}

const openScoreV26Original = openScore;
openScore = function() {
  openScoreV26Original();

  setTimeout(refreshScoreExplanationInkV26, 280);
  setTimeout(refreshScoreExplanationInkV26, 720);
  setTimeout(refreshScoreExplanationInkV26, 1300);
};

const showExplanationPageV26Original = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPageV26Original(index);

  setTimeout(refreshScoreExplanationInkV26, 180);
  setTimeout(refreshScoreExplanationInkV26, 520);
};

window.addEventListener("resize", () => {
  setTimeout(resetScoreModelTextCanvasV26, 250);
});

setTimeout(refreshScoreExplanationInkV26, 1500);


/* === v27: 텍스트 해설만 있을 때 이미지칸 제거 + 새 문제 답안필기 초기화 === */
function explanationStateV27() {
  const p = currentProblem?.();
  const pages = realPages(p?.explanationPages || []);
  const text = String(p?.modelText || "").trim();
  return { p, pages, text, hasImages: pages.length > 0, hasText: !!text };
}

function clearCanvasPixelsV27(id) {
  const canvas = $(id);
  if (!canvas) return;
  try {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
  } catch {}
}

function ensureNoExplanationV27() {
  let hint = $("scoreNoExplanationV27");
  if (hint) return hint;
  hint = document.createElement("p");
  hint.id = "scoreNoExplanationV27";
  hint.className = "hidden";
  hint.textContent = "등록된 해설이 없어.";
  const textWrap = $("scoreModelTextEditWrap");
  textWrap?.insertAdjacentElement("afterend", hint);
  return hint;
}

function syncExplanationLayoutV27() {
  const { pages, hasImages, hasText } = explanationStateV27();
  const imageWrap = $("scoreExplanationEditWrap");
  const image = $("explanationImageView");
  const imageCanvas = $("scoreExplanationCanvas");
  const textWrap = $("scoreModelTextEditWrap");
  const badge = $("explanationPageBadge");
  const prev = $("prevExplanationPageBtn");
  const next = $("nextExplanationPageBtn");
  const hint = ensureNoExplanationV27();

  if (imageWrap) {
    imageWrap.classList.toggle("v27-no-image", !hasImages);
    imageWrap.style.setProperty("display", hasImages ? "" : "none", hasImages ? "" : "important");
  }

  if (!hasImages) {
    image?.classList.add("hidden");
    if (image) image.removeAttribute("src");
    if (imageCanvas) {
      imageCanvas.width = 1;
      imageCanvas.height = 1;
      imageCanvas.style.setProperty("width", "1px", "important");
      imageCanvas.style.setProperty("height", "1px", "important");
    }
    clearCanvasPixelsV27("scoreExplanationCanvas");
  }

  const hidePageButtons = !hasImages || pages.length <= 1;
  prev?.classList.toggle("v27-hidden-explanation-control", hidePageButtons);
  next?.classList.toggle("v27-hidden-explanation-control", hidePageButtons);

  if (badge) {
    if (!hasImages && hasText) badge.textContent = "텍스트 해설";
    else if (!hasImages && !hasText) badge.textContent = "해설 없음";
  }

  if (textWrap) {
    textWrap.classList.toggle("v27-text-only", !hasImages && hasText);
    textWrap.classList.toggle("text-empty-v26", !hasText);
    textWrap.style.setProperty("display", hasText ? "block" : "none", "important");
    if (hasText) {
      textWrap.scrollTop = 0;
      textWrap.scrollLeft = 0;
    }
  }

  hint?.classList.toggle("hidden", hasImages || hasText);

  if (hasText) {
    setTimeout(() => {
      try { resetScoreModelTextCanvasV26(); } catch {}
    }, 40);
  }
}

function resetAnswerForNewProblemV27() {
  state.answerInkCurrentStroke = null;
  state.answerInkStrokes = [];

  if (state.solve) {
    state.solve.answer = "";
    state.solve.answerInkStrokes = [];
    state.solve.answerInkData = "";
    state.solve.answerPages = [{ text: "", strokes: [] }];
    state.solve.answerPageIndex = 0;
  }

  const text = $("answerText");
  if (text) text.value = "";

  clearCanvasPixelsV27("answerInkCanvas");
  clearCanvasPixelsV27("scoreAnswerCanvas");
  clearCanvasPixelsV27("scoreExplanationCanvas");
  clearCanvasPixelsV27("scoreModelTextCanvas");

  try { drawAnswerInkV10(); } catch {
    try { drawAnswerInk(); } catch {}
  }
  try { renderAnswerPageBadgeV10(); } catch {}
}

const startSolveV27Original = startSolve;
startSolve = function(ids, mode) {
  state.answerInkCurrentStroke = null;
  state.answerInkStrokes = [];
  clearCanvasPixelsV27("answerInkCanvas");
  startSolveV27Original(ids, mode);
};

async function saveAndNextV27() {
  await saveAttempt();
  if (!state.solve) return;

  if (state.solve.index >= state.solve.ids.length - 1) {
    finishSolve(true);
    return;
  }

  state.solve.index += 1;
  state.solve.elapsedBase = 0;
  state.solve.startedProblemAt = Date.now();
  resetAnswerForNewProblemV27();

  $("scoreOverlay")?.classList.add("hidden");
  openCurrentProblem();

  setTimeout(() => {
    try { loadAnswerPageV10(0); } catch {}
    try { resetAnswerInkLayerV13(); } catch {
      try { resetAnswerInkLayerV10(); } catch {}
    }
    try { drawInk(); } catch {}
  }, 100);
}

saveAndNext = saveAndNextV27;

// 기존 addEventListener가 이전 함수를 잡았더라도 이 캡처 핸들러가 먼저 실행
if (!document.documentElement.dataset.v27SaveNextReady) {
  document.documentElement.dataset.v27SaveNextReady = "1";
  document.addEventListener("click", event => {
    const button = event.target?.closest?.("#saveAndNextBtn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    saveAndNextV27();
  }, true);
}

const openScoreV27Original = openScore;
openScore = function() {
  openScoreV27Original();
  syncExplanationLayoutV27();
  setTimeout(syncExplanationLayoutV27, 80);
  setTimeout(syncExplanationLayoutV27, 320);
  setTimeout(syncExplanationLayoutV27, 800);
};

const showExplanationPageV27Original = showExplanationPage;
showExplanationPage = function(index) {
  showExplanationPageV27Original(index);
  syncExplanationLayoutV27();
  setTimeout(syncExplanationLayoutV27, 100);
  setTimeout(syncExplanationLayoutV27, 420);
};

setTimeout(() => {
  ensureNoExplanationV27();
  syncExplanationLayoutV27();
}, 1500);


/* === v28: 답안 제출 후 내 답안 수정필기 안정화 === */
function scoreAnswerKeyV28() {
  try {
    if (typeof scoreKeyV14 === "function") return scoreKeyV14("answer");
    if (typeof scoreKeyV11 === "function") return scoreKeyV11("answer");
  } catch {}
  const p = currentProblem?.();
  return `${p?.id || "unknown"}:answer:${state.scoreAnswerPageIndex || 0}`;
}

function ensureScoreAnswerStoreV28() {
  if (!state.scoreAnswerEdits) {
    try {
      state.scoreAnswerEdits = JSON.parse(
        localStorage.getItem("essayScoreAnswerEditsV11") || "{}"
      );
    } catch {
      state.scoreAnswerEdits = {};
    }
  }
}

function saveScoreAnswerStoreV28() {
  ensureScoreAnswerStoreV28();
  try {
    localStorage.setItem(
      "essayScoreAnswerEditsV11",
      JSON.stringify(state.scoreAnswerEdits || {})
    );
  } catch {}
}

function clampV28(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sizeScoreAnswerCanvasV28(canvas) {
  const wrap = $("scoreAnswerEditWrap");
  const pre = $("ownAnswerView");
  const ink = $("ownAnswerInkView");
  if (!canvas || !wrap || !pre) return false;

  const width = Math.max(
    1,
    Math.floor(wrap.clientWidth || wrap.getBoundingClientRect().width || window.innerWidth - 24)
  );

  pre.style.setProperty("width", width + "px", "important");
  pre.style.setProperty("min-height", "240px", "important");

  const preBottom = Math.max(
    240,
    Math.ceil((pre.offsetTop || 0) + (pre.scrollHeight || pre.getBoundingClientRect().height || 240))
  );

  let inkBottom = 0;
  if (ink && !ink.classList.contains("hidden")) {
    const inkHeight = Math.max(
      ink.offsetHeight || 0,
      ink.getBoundingClientRect().height || 0,
      ink.naturalWidth && ink.naturalHeight
        ? Math.round(width * ink.naturalHeight / ink.naturalWidth)
        : 0
    );
    if (inkHeight) {
      ink.style.setProperty("width", width + "px", "important");
      ink.style.setProperty("height", inkHeight + "px", "important");
    }
    inkBottom = Math.ceil((ink.offsetTop || preBottom) + inkHeight);
  }

  const contentHeight = Math.max(260, preBottom, inkBottom);
  const visibleHeight = Math.min(
    contentHeight,
    Math.max(260, Math.floor(window.innerHeight * 0.58))
  );

  wrap.style.setProperty("height", visibleHeight + "px", "important");

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(contentHeight * dpr));
  canvas.style.setProperty("width", width + "px", "important");
  canvas.style.setProperty("height", contentHeight + "px", "important");
  canvas.style.setProperty("left", "0px", "important");
  canvas.style.setProperty("top", "0px", "important");

  return true;
}

function scoreAnswerPointV28(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampV28((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: clampV28((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1)
  };
}

function drawScoreAnswerCanvasV28() {
  ensureScoreAnswerStoreV28();

  const canvas = $("scoreAnswerCanvas");
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const strokes = state.scoreAnswerEdits[scoreAnswerKeyV28()] || [];
  for (const stroke of strokes) {
    if (!stroke.points || !stroke.points.length) continue;

    ctx.save();
    ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle =
      stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#ef4444";
    ctx.lineWidth = Number(stroke.size || 4);
    ctx.beginPath();

    stroke.points.forEach((point, index) => {
      const x = point.x * rect.width;
      const y = point.y * rect.height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // 점만 찍어도 표시되도록 보정
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      ctx.lineTo(point.x * rect.width + 0.01, point.y * rect.height + 0.01);
    }

    ctx.stroke();
    ctx.restore();
  }
}

function addCoalescedScoreAnswerPointsV28(event, canvas, stroke) {
  const events =
    typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : [event];

  for (const item of events) {
    stroke.points.push(scoreAnswerPointV28(item, canvas));
  }
}

function resetScoreAnswerCanvasV28() {
  ensureScoreAnswerStoreV28();

  let canvas = $("scoreAnswerCanvas");
  const wrap = $("scoreAnswerEditWrap");
  if (!canvas || !wrap) return;

  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  canvas = fresh;

  if (!sizeScoreAnswerCanvasV28(canvas)) return;
  drawScoreAnswerCanvasV28();

  let current = null;
  let activePenId = null;
  let pan = null;

  const block = event => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  canvas.addEventListener("pointerdown", event => {
    block(event);
    canvas.setPointerCapture?.(event.pointerId);

    if (event.pointerType !== "pen") {
      canvas.classList.add("is-panning");
      pan = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: wrap.scrollLeft,
        top: wrap.scrollTop
      };
      return;
    }

    activePenId = event.pointerId;
    const tool =
      state.scoreAnswerEditTool === "eraser" ? "eraser" : "pen";
    const size =
      Number(state.scoreAnswerSize || $("scoreAnswerSizeInput")?.value || 4) *
      (tool === "eraser" ? 5 : 1);

    current = {
      tool,
      size,
      points: [scoreAnswerPointV28(event, canvas)]
    };

    const key = scoreAnswerKeyV28();
    if (!state.scoreAnswerEdits[key]) state.scoreAnswerEdits[key] = [];
    state.scoreAnswerEdits[key].push(current);
    drawScoreAnswerCanvasV28();
  }, true);

  canvas.addEventListener("pointermove", event => {
    block(event);

    if (event.pointerType !== "pen") {
      if (!pan || pan.pointerId !== event.pointerId) return;
      wrap.scrollLeft = pan.left - (event.clientX - pan.x);
      wrap.scrollTop = pan.top - (event.clientY - pan.y);
      return;
    }

    if (!current || activePenId !== event.pointerId) return;
    addCoalescedScoreAnswerPointsV28(event, canvas, current);
    drawScoreAnswerCanvasV28();
  }, true);

  const end = event => {
    block(event);

    if (event.pointerType !== "pen") {
      if (pan?.pointerId === event.pointerId) pan = null;
      canvas.classList.remove("is-panning");
      return;
    }

    if (!current || activePenId !== event.pointerId) return;
    addCoalescedScoreAnswerPointsV28(event, canvas, current);
    current = null;
    activePenId = null;
    saveScoreAnswerStoreV28();
    drawScoreAnswerCanvasV28();
  };

  // pointerleave에서는 끝내지 않음: 빠르게 쓸 때 선이 끊기는 문제 방지
  canvas.addEventListener("pointerup", end, true);
  canvas.addEventListener("pointercancel", end, true);
  canvas.addEventListener("lostpointercapture", end, true);

  $("scoreAnswerSizeInput") && ($("scoreAnswerSizeInput").oninput = event => {
    state.scoreAnswerSize = Number(event.target.value || 4);
  });

  $("scoreAnswerPenBtn") && ($("scoreAnswerPenBtn").onclick = () => {
    state.scoreAnswerEditTool = "pen";
    try { setScoreToolV11?.("answer", "pen"); } catch {}
  });

  $("scoreAnswerEraserBtn") && ($("scoreAnswerEraserBtn").onclick = () => {
    state.scoreAnswerEditTool = "eraser";
    try { setScoreToolV11?.("answer", "eraser"); } catch {}
  });

  $("clearScoreAnswerInkBtn") && ($("clearScoreAnswerInkBtn").onclick = () => {
    if (!confirm("현재 답안 수정필기를 지울까?")) return;
    delete state.scoreAnswerEdits[scoreAnswerKeyV28()];
    saveScoreAnswerStoreV28();
    resetScoreAnswerCanvasV28();
  });
}

function scheduleScoreAnswerCanvasV28() {
  [30, 140, 360, 820, 1500].forEach(delay => {
    setTimeout(() => {
      try { resetScoreAnswerCanvasV28(); } catch {}
    }, delay);
  });
}

/* 답안 페이지 전환 후에도 정확한 페이지 필기 캔버스로 재연결 */
if (typeof renderScoreAnswerPageV11 === "function") {
  const renderScoreAnswerPageV28Original = renderScoreAnswerPageV11;
  renderScoreAnswerPageV11 = function(index = 0) {
    renderScoreAnswerPageV28Original(index);
    scheduleScoreAnswerCanvasV28();
  };
}

/* 채점 화면이 열린 뒤 이전 버전의 지연 재설정까지 모두 덮어씀 */
const openScoreV28Original = openScore;
openScore = function() {
  openScoreV28Original();

  const ink = $("ownAnswerInkView");
  if (ink) {
    ink.onload = () => scheduleScoreAnswerCanvasV28();
  }
  scheduleScoreAnswerCanvasV28();
};

/* '답안 수정'으로 풀이화면 복귀 시 숨겨졌던 원본 답안 캔버스를 재계산 */
function restoreEditableAnswerV28() {
  try {
    const index = Number(
      state.solve?.answerPageIndex ??
      state.answerPageIndex ??
      0
    );

    if (typeof loadAnswerPageV10 === "function") {
      loadAnswerPageV10(index);
    }

    if (typeof resetAnswerInkLayerV13 === "function") {
      resetAnswerInkLayerV13();
    } else if (typeof resetAnswerInkLayerV10 === "function") {
      resetAnswerInkLayerV10();
    }

    if (typeof resizeAnswerCanvasV10 === "function") resizeAnswerCanvasV10();
    else if (typeof resizeAnswerCanvasV9 === "function") resizeAnswerCanvasV9();
    else if (typeof resizeAnswerCanvas === "function") resizeAnswerCanvas();

    if (typeof drawAnswerInkV10 === "function") drawAnswerInkV10();
    else if (typeof drawAnswerInkV9 === "function") drawAnswerInkV9();
    else if (typeof drawAnswerInk === "function") drawAnswerInk();
  } catch {}
}

if (!document.documentElement.dataset.v28BackToAnswerReady) {
  document.documentElement.dataset.v28BackToAnswerReady = "1";

  document.addEventListener("click", event => {
    if (!event.target?.closest?.("#backToAnswerBtn")) return;

    // 기존 버튼 동작은 그대로 실행시키고, 화면이 열린 다음 필기층만 재구성
    [30, 120, 320, 700].forEach(delay => {
      setTimeout(restoreEditableAnswerV28, delay);
    });
  }, true);
}

window.addEventListener("resize", () => {
  if (!$("scoreOverlay")?.classList.contains("hidden")) {
    setTimeout(resetScoreAnswerCanvasV28, 220);
  }
});

setTimeout(() => {
  if (!$("scoreOverlay")?.classList.contains("hidden")) {
    scheduleScoreAnswerCanvasV28();
  }
}, 1800);


/* === v47: v44 검증된 확대이동 + 기본 native scroll + 확대 경계 scroll-chain === */
(function essayIsolatedExplanationViewerV47(){
  const V={
    scale:1,min:1,max:5,
    panX:0,panY:0,
    pointers:new Map(),
    mode:"",
    startScale:1,startDist:1,
    startPanX:0,startPanY:0,
    startX:0,startY:0,
    focusLocalX:0,focusLocalY:0,
    scrollStartTop:0,
    scrollStartY:0,
    outerStartTop:0,
    raf:0,
    baseW:0,baseH:0,
    inkStroke:null,
    answerTimer:0,
    textTimer:0
  };

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const shell=()=>document.querySelector("#scoreOverlay .score-shell");
  const legacyWrap=()=>document.getElementById("scoreExplanationEditWrap");
  const viewer=()=>document.getElementById("scoreExplanationViewerV47");
  const viewport=()=>document.getElementById("scoreExplanationViewportV47");
  const stage=()=>document.getElementById("scoreExplanationStageV47");
  const image=()=>document.getElementById("scoreExplanationImageV47");
  const ink=()=>document.getElementById("scoreExplanationInkV47");

  function currentPagesV47(){
    try{
      const p=currentProblem?.();
      return typeof realPages==="function"
        ? realPages(p?.explanationPages||[])
        : (p?.explanationPages||[]).filter(x=>typeof x==="string"&&x.startsWith("data:image/"));
    }catch{
      return [];
    }
  }

  function currentSrcV47(){
    const pages=currentPagesV47();
    if(!pages.length)return "";
    const idx=clamp(Number(state.expPage||0),0,pages.length-1);
    return pages[idx]||"";
  }

  function inkKeyV47(){
    try{
      if(typeof scoreExpKeyV24==="function")return scoreExpKeyV24();
      if(typeof scoreKeyV11==="function")return scoreKeyV11("exp");
    }catch{}
    const p=currentProblem?.();
    return `${p?.id||"unknown"}:exp:${state.expPage||0}`;
  }

  function inkStoreV47(){
    if(!state.scoreExpEdits || typeof state.scoreExpEdits!=="object"){
      state.scoreExpEdits={};
    }
    return state.scoreExpEdits;
  }

  function strokesV47(){
    return inkStoreV47()[inkKeyV47()]||[];
  }

  function saveInkV47(){
    try{
      localStorage.setItem(
        "essayScoreExpEditsV11",
        JSON.stringify(state.scoreExpEdits||{})
      );
    }catch{}
  }

  function ensureViewerV47(){
    let v=viewer();
    if(v)return v;

    const old=legacyWrap();
    if(!old)return null;

    v=document.createElement("div");
    v.id="scoreExplanationViewerV47";
    v.innerHTML=`
      <div id="scoreExplanationViewportV47">
        <div id="scoreExplanationStageV47">
          <img id="scoreExplanationImageV47" alt="해설 이미지" />
          <canvas id="scoreExplanationInkV47" aria-label="해설 필기"></canvas>
        </div>
      </div>
    `;
    old.insertAdjacentElement("afterend",v);

    bindPointerV47();
    return v;
  }

  function setLegacyDisabledV47(){
    /*
      기존 해설 영역은 완전히 숨긴다.
      예전 v11~v34 이벤트/캔버스가 화면 터치를 받을 수 없다.
    */
    const old=legacyWrap();
    if(old){
      old.style.setProperty("display","none","important");
      old.style.setProperty("pointer-events","none","important");
      old.setAttribute("aria-hidden","true");
    }

    const oldCanvas=document.getElementById("scoreExplanationCanvas");
    if(oldCanvas){
      oldCanvas.style.setProperty("display","none","important");
      oldCanvas.style.setProperty("pointer-events","none","important");
      // 숨은 legacy canvas가 큰 bitmap을 유지하지 않게 함.
      if(oldCanvas.width>8)oldCanvas.width=1;
      if(oldCanvas.height>8)oldCanvas.height=1;
    }
  }

  function makeShellV47(){
    const s=shell();
    if(!s)return;
    s.style.setProperty("height","100dvh","important");
    s.style.setProperty("max-height","100dvh","important");
    s.style.setProperty("overflow-y","auto","important");
    s.style.setProperty("overflow-x","hidden","important");
    s.style.setProperty("-webkit-overflow-scrolling","touch","important");
    s.style.setProperty("touch-action","pan-y","important");
    s.style.setProperty("overscroll-behavior-y","auto","important");
    s.style.setProperty("padding-bottom","160px","important");
  }

  function fitBaseV47(force=false){
    ensureViewerV47();
    const vp=viewport(),img=image(),st=stage();
    if(!vp||!img||!st||!img.naturalWidth)return false;

    const w=Math.max(
      1,
      Math.floor(
        vp.clientWidth ||
        vp.getBoundingClientRect().width ||
        window.innerWidth-24
      )
    );

    if(force||!V.baseW||!V.baseH||Math.abs(V.baseW-w)>2){
      V.baseW=w;
      V.baseH=Math.max(
        1,
        Math.round(w*img.naturalHeight/Math.max(1,img.naturalWidth))
      );
    }

    st.style.width=V.baseW+"px";
    st.style.height=V.baseH+"px";
    img.style.width=V.baseW+"px";
    img.style.height=V.baseH+"px";
    img.style.maxWidth="none";
    img.style.maxHeight="none";

    sizeInkBackingV47(false);
    return true;
  }

  function backingScaleV47(){
    const pixels=Math.max(1,V.baseW*V.baseH);
    return Math.max(.30,Math.min(1,Math.sqrt(1_800_000/pixels)));
  }

  function sizeInkBackingV47(force=false){
    const c=ink();
    if(!c||!V.baseW||!V.baseH)return;
    const hasInk=strokesV47().length>0;

    c.style.width=V.baseW+"px";
    c.style.height=V.baseH+"px";

    if(!hasInk&&!force){
      c.width=1;
      c.height=1;
      c.dataset.scaleV47="0";
      return;
    }

    const d=backingScaleV47();
    const bw=Math.max(1,Math.round(V.baseW*d));
    const bh=Math.max(1,Math.round(V.baseH*d));
    if(c.width!==bw||c.height!==bh||Number(c.dataset.scaleV47||0)!==d){
      c.width=bw;
      c.height=bh;
      c.dataset.scaleV47=String(d);
    }
    drawInkV47();
  }

  function drawInkV47(){
    const c=ink();
    if(!c||!V.baseW||!V.baseH)return;
    const arr=strokesV47();
    if(!arr.length){
      if(c.width>1||c.height>1){
        const ctx=c.getContext("2d");
        ctx.clearRect(0,0,c.width,c.height);
      }
      return;
    }

    const d=Number(c.dataset.scaleV47||backingScaleV47());
    const ctx=c.getContext("2d");
    ctx.setTransform(d,0,0,d,0,0);
    ctx.clearRect(0,0,V.baseW,V.baseH);

    for(const stroke of arr){
      if(!stroke?.points?.length)continue;
      ctx.save();
      ctx.globalCompositeOperation=
        stroke.tool==="eraser"?"destination-out":"source-over";
      ctx.lineCap="round";
      ctx.lineJoin="round";
      ctx.strokeStyle=
        stroke.tool==="eraser"?"rgba(0,0,0,1)":"#0ea5e9";
      ctx.lineWidth=Number(stroke.size||4);
      ctx.beginPath();
      stroke.points.forEach((pt,n)=>{
        const x=pt.x*V.baseW;
        const y=pt.y*V.baseH;
        if(n===0)ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  function limitsV47(){
    const vp=viewport();
    if(!vp)return {minX:0,maxX:0,minY:0,maxY:0};

    const cw=V.baseW*V.scale;
    const ch=V.baseH*V.scale;
    const vw=vp.clientWidth;
    const vh=vp.clientHeight;

    return {
      minX:Math.min(0,vw-cw),
      maxX:0,
      minY:Math.min(0,vh-ch),
      maxY:0
    };
  }

  function clampPanV47(){
    const l=limitsV47();
    V.panX=clamp(V.panX,l.minX,l.maxX);
    V.panY=clamp(V.panY,l.minY,l.maxY);
  }

  function applyTransformV47(){
    V.raf=0;
    const v=viewer(),vp=viewport(),st=stage();
    if(!v||!vp||!st||!V.baseW||!V.baseH)return;

    if(V.scale<=1.001){
      V.scale=1;
      V.panX=0;
      V.panY=0;
      v.classList.remove("v47-zoomed");

      // 100%에서는 손가락 1개를 브라우저 native 세로 스크롤에 맡긴다.
      vp.style.height=V.baseH+"px";
      vp.style.setProperty("touch-action","pan-y","important");
      st.style.transform="translate3d(0,0,0) scale(1)";
    }else{
      v.classList.add("v47-zoomed");
      const vh=Math.max(
        280,
        Math.floor((window.visualViewport?.height||window.innerHeight)*.72)
      );
      vp.style.height=Math.min(V.baseH,V.baseH*V.scale,vh)+"px";
      // 확대 후 새 손가락 제스처는 이미지 상하좌우 pan이 전담.
      vp.style.setProperty("touch-action","none","important");
      clampPanV47();
      st.style.transform=
        `translate3d(${V.panX}px,${V.panY}px,0) scale(${V.scale})`;
    }
  }

  function scheduleTransformV47(){
    if(!V.raf)V.raf=requestAnimationFrame(applyTransformV47);
  }

  function pointerListV47(){
    return [...V.pointers.values()];
  }

  function distanceV47(){
    const p=pointerListV47();
    if(p.length<2)return 1;
    return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1;
  }

  function midpointV47(){
    const p=pointerListV47();
    if(p.length<2)return {x:0,y:0};
    return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};
  }

  function startPinchV47(){
    const vp=viewport();
    if(!vp)return;
    const m=midpointV47();
    const r=vp.getBoundingClientRect();

    V.mode="pinch";
    V.startDist=distanceV47();
    V.startScale=V.scale;
    V.startPanX=V.panX;
    V.startPanY=V.panY;

    const localX=m.x-r.left;
    const localY=m.y-r.top;
    V.focusLocalX=(localX-V.panX)/Math.max(.0001,V.scale);
    V.focusLocalY=(localY-V.panY)/Math.max(.0001,V.scale);
  }

  function startPanV47(){
    const p=pointerListV47()[0];
    if(!p)return;
    V.mode="pan";
    V.startX=p.x;
    V.startY=p.y;
    V.startPanX=V.panX;
    V.startPanY=V.panY;
    V.outerStartTop=shell()?.scrollTop||0;
  }

  function startOuterScrollV47(){
    const p=pointerListV47()[0];
    const s=shell();
    if(!p||!s)return;
    V.mode="outer-scroll";
    V.scrollStartY=p.y;
    V.scrollStartTop=s.scrollTop;
  }

  function penPointV47(event){
    const st=stage();
    const r=st.getBoundingClientRect();
    return {
      x:clamp((event.clientX-r.left)/Math.max(1,r.width),0,1),
      y:clamp((event.clientY-r.top)/Math.max(1,r.height),0,1)
    };
  }

  function handlePenDownV47(event){
    event.preventDefault();
    event.stopPropagation();

    const tool=state.scoreExpEditTool==="eraser"?"eraser":"pen";
    const size=Number(
      state.scoreExpSize ||
      document.getElementById("scoreExpSizeInput")?.value ||
      4
    )*(tool==="eraser"?5:1);

    V.inkStroke={
      tool,
      size,
      points:[penPointV47(event)]
    };

    const store=inkStoreV47();
    const key=inkKeyV47();
    if(!store[key])store[key]=[];
    store[key].push(V.inkStroke);

    sizeInkBackingV47(true);
    drawInkV47();
  }

  function bindPointerV47(){
    const vp=viewport();
    if(!vp||vp.dataset.boundV47)return;
    vp.dataset.boundV47="1";

    /*
      v47 원칙
      - 100% + 손가락 1개: preventDefault/포인터캡처 없음 -> Chrome native 세로 스크롤
      - 손가락 2개: v44 방식 pinch
      - 확대 후 손가락 1개: v44 방식 상하좌우 pan
      - 확대 이미지 세로 끝을 넘기면 남은 드래그를 바깥 score-shell scrollTop으로 전달
    */
    vp.addEventListener("pointerdown",event=>{
      if(event.pointerType==="pen"){
        try{vp.setPointerCapture(event.pointerId)}catch{}
        handlePenDownV47(event);
        return;
      }
      if(event.pointerType!=="touch")return;

      V.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});

      if(V.pointers.size>=2){
        event.preventDefault();
        event.stopPropagation();
        try{vp.setPointerCapture(event.pointerId)}catch{}
        // 첫 번째 손가락도 가능하면 capture해서 pinch 중 pointercancel을 줄임.
        for(const id of V.pointers.keys())try{vp.setPointerCapture(id)}catch{}
        startPinchV47();
        return;
      }

      if(V.scale>1.001){
        event.preventDefault();
        event.stopPropagation();
        try{vp.setPointerCapture(event.pointerId)}catch{}
        startPanV47();
      }else{
        // 기본배율: 아무것도 막지 않는다. 브라우저 관성 세로 스크롤 사용.
        V.mode="native-scroll";
      }
    },true);

    vp.addEventListener("pointermove",event=>{
      if(event.pointerType==="pen"){
        if(!V.inkStroke)return;
        event.preventDefault();
        event.stopPropagation();
        V.inkStroke.points.push(penPointV47(event));
        drawInkV47();
        return;
      }
      if(event.pointerType!=="touch"||!V.pointers.has(event.pointerId))return;
      V.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});

      if(V.pointers.size>=2){
        event.preventDefault();
        event.stopPropagation();
        if(V.mode!=="pinch")startPinchV47();

        const next=clamp(
          V.startScale*(distanceV47()/Math.max(1,V.startDist)),
          V.min,V.max
        );
        V.scale=next<1.02?1:next;

        const m=midpointV47();
        const r=vp.getBoundingClientRect();
        const lx=m.x-r.left;
        const ly=m.y-r.top;
        V.panX=lx-V.focusLocalX*V.scale;
        V.panY=ly-V.focusLocalY*V.scale;
        clampPanV47();
        scheduleTransformV47();
        return;
      }

      // 100% 한 손가락은 native scroll에 완전히 맡김.
      if(V.scale<=1.001)return;

      event.preventDefault();
      event.stopPropagation();
      const p=pointerListV47()[0];
      if(!p)return;
      if(V.mode!=="pan")startPanV47();

      const rawX=V.startPanX+(p.x-V.startX);
      const rawY=V.startPanY+(p.y-V.startY);
      const lim=limitsV47();
      const clampedX=clamp(rawX,lim.minX,lim.maxX);
      const clampedY=clamp(rawY,lim.minY,lim.maxY);

      V.panX=clampedX;
      V.panY=clampedY;

      // 이미지 상/하단을 넘긴 세로 드래그만 바깥 자가채점 화면으로 넘긴다.
      const overflowY=rawY-clampedY;
      const s=shell();
      if(s && Math.abs(overflowY)>.01){
        s.scrollTop=Math.max(0,V.outerStartTop-overflowY);
      }
      scheduleTransformV47();
    },true);

    function endPointerV47(event){
      if(event.pointerType==="pen"){
        if(V.inkStroke){
          event.preventDefault();
          V.inkStroke=null;
          saveInkV47();
        }
        return;
      }
      if(event.pointerType!=="touch"||!V.pointers.has(event.pointerId))return;

      // native 1-finger scroll에서는 preventDefault 하지 않는다.
      const wasNative=(V.scale<=1.001 && V.pointers.size===1);
      if(!wasNative)event.preventDefault();
      V.pointers.delete(event.pointerId);

      if(V.pointers.size>=2){
        startPinchV47();
      }else if(V.pointers.size===1){
        if(V.scale>1.001)startPanV47();
        else V.mode="native-scroll";
      }else{
        V.mode="";
      }

      if(V.scale<=1.001){
        V.scale=1;
        V.panX=0;
        V.panY=0;
        scheduleTransformV47();
      }
    }

    vp.addEventListener("pointerup",endPointerV47,true);
    vp.addEventListener("pointercancel",endPointerV47,true);
    vp.addEventListener("lostpointercapture",endPointerV47,true);
  }

  function loadCurrentImageV47(force=false){
    ensureViewerV47();
    setLegacyDisabledV47();
    makeShellV47();

    const v=viewer(),img=image();
    if(!v||!img)return;

    const src=currentSrcV47();
    if(!src){
      v.style.setProperty("display","none","important");
      return;
    }

    v.style.setProperty("display","block","important");

    const finish=()=>{
      if(!img.naturalWidth)return;
      fitBaseV47(force);
      drawInkV47();
      scheduleTransformV47();
    };

    if(img.src!==src){
      img.onload=finish;
      img.src=src;
    }else{
      finish();
    }
  }

  function resetViewerV47(){
    V.scale=1;
    V.panX=0;
    V.panY=0;
    V.pointers.clear();
    V.mode="";
    loadCurrentImageV47(true);
  }

  /* legacy 해설 캔버스/gesture를 더 이상 만들지 않도록 전부 무력화 */
  function noLegacyExpV47(){
    setLegacyDisabledV47();
    loadCurrentImageV47(false);
  }

  try{resetScoreExplanationCanvasV24=noLegacyExpV47}catch{}
  try{sizeScoreExplanationCanvasV24=()=>false}catch{}
  try{drawScoreExplanationCanvasV24=()=>{}}catch{}
  try{resetScoreExplanationCanvasV14=noLegacyExpV47}catch{}
  try{resetScoreExplanationCanvasV13=noLegacyExpV47}catch{}
  try{resetScoreExplanationCanvasV12=noLegacyExpV47}catch{}
  try{resetScoreExplanationCanvasV11=noLegacyExpV47}catch{}
  try{fitExplanationAndCanvasV14=noLegacyExpV47}catch{}
  try{fitScoreExplanationV12=noLegacyExpV47}catch{}

  /*
    v28은 채점 화면을 열면서 답안 캔버스를 5번 재생성한다.
    이 반복 작업도 한 번으로 줄여 스크롤 시작 직후의 버벅임 제거.
  */
  if(typeof resetScoreAnswerCanvasV28==="function"){
    const realAnswerResetV47=resetScoreAnswerCanvasV28;
    scheduleScoreAnswerCanvasV28=function(){
      clearTimeout(V.answerTimer);
      V.answerTimer=setTimeout(()=>{
        try{realAnswerResetV47()}catch{}
      },40);
    };
  }

  /*
    텍스트 해설 캔버스도 여러 차례 다시 그리지 않도록 debounce.
  */
  if(typeof resetScoreModelTextCanvasV26==="function"){
    const realTextResetV47=resetScoreModelTextCanvasV26;
    resetScoreModelTextCanvasV26=function(){
      clearTimeout(V.textTimer);
      V.textTimer=setTimeout(()=>{
        try{realTextResetV47()}catch{}
      },60);
    };
  }

  /* 해설 펜/지우개 버튼은 새 viewer state만 사용 */
  document.addEventListener("click",event=>{
    const pen=event.target?.closest?.("#scoreExpPenBtn");
    if(pen){
      state.scoreExpEditTool="pen";
      return;
    }
    const eraser=event.target?.closest?.("#scoreExpEraserBtn");
    if(eraser){
      state.scoreExpEditTool="eraser";
      return;
    }
    const clear=event.target?.closest?.("#clearScoreExpInkBtn");
    if(clear){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if(!confirm("현재 해설 필기를 지울까?"))return;
      const store=inkStoreV47();
      delete store[inkKeyV47()];
      saveInkV47();
      sizeInkBackingV47(false);
      drawInkV47();
    }
  },true);

  /* 문제풀이 화면 핀치는 v34 설명부와 분리해서 유지 */
  function ensureSolvePinchV47(){
    const h=document.getElementById("questionImageScroller");
    if(!h||h.dataset.solvePinchV47)return;
    h.dataset.solvePinchV47="1";

    let startDist=0,startZoom=1;
    h.addEventListener("touchstart",e=>{
      if(e.touches.length<2)return;
      e.preventDefault();
      startDist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      )||1;
      startZoom=Number(state.zoom||1);
    },{passive:false,capture:true});

    h.addEventListener("touchmove",e=>{
      if(e.touches.length<2||!startDist)return;
      e.preventDefault();
      const d=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      )||1;
      state.zoom=clamp(startZoom*(d/startDist),.35,6);
      try{applyZoom()}catch{}
      try{resizeInkCanvas()}catch{}
      try{drawInk()}catch{}
    },{passive:false,capture:true});

    const end=()=>{startDist=0};
    h.addEventListener("touchend",end,{passive:true});
    h.addEventListener("touchcancel",end,{passive:true});
  }

  const openScoreBeforeV47=openScore;
  openScore=function(){
    V.scale=1;
    V.panX=0;
    V.panY=0;
    openScoreBeforeV47();
    ensureViewerV47();
    setLegacyDisabledV47();
    makeShellV47();
    loadCurrentImageV47(true);
    setTimeout(()=>loadCurrentImageV47(false),120);
  };

  const showExplanationPageBeforeV47=showExplanationPage;
  showExplanationPage=function(index){
    V.scale=1;
    V.panX=0;
    V.panY=0;
    showExplanationPageBeforeV47(index);
    loadCurrentImageV47(true);
    setTimeout(()=>loadCurrentImageV47(false),100);
  };

  const openCurrentProblemBeforeV47=openCurrentProblem;
  openCurrentProblem=function(){
    openCurrentProblemBeforeV47();
    setTimeout(ensureSolvePinchV47,80);
  };

  window.addEventListener("resize",()=>{
    setTimeout(()=>loadCurrentImageV47(true),180);
  });

  setTimeout(()=>{
    ensureViewerV47();
    setLegacyDisabledV47();
    ensureSolvePinchV47();
    loadCurrentImageV47(true);
  },700);
})();


/* === v35: 답안 페이지 추가/이동 먹통 수정 ===
   페이지 전환 때 canvas.toDataURL()을 실행하지 않는다.
   페이지별 text/strokes만 즉시 메모리에 저장하고 draft 저장은 debounce 처리.
*/
(function answerPageFreezeFixV35() {
  let persistTimerV35 = 0;
  let pageBusyV35 = false;

  function answerPagesReadyV35() {
    if (!state.solve) return false;

    if (!Array.isArray(state.solve.answerPages) || !state.solve.answerPages.length) {
      state.solve.answerPages = [{
        text: $("answerText")?.value || state.solve.answer || "",
        strokes: Array.isArray(state.answerInkStrokes) ? state.answerInkStrokes : []
      }];
    }

    if (!Number.isFinite(Number(state.solve.answerPageIndex))) {
      state.solve.answerPageIndex = 0;
    }

    state.solve.answerPageIndex = Math.max(
      0,
      Math.min(
        Number(state.solve.answerPageIndex) || 0,
        state.solve.answerPages.length - 1
      )
    );

    return true;
  }

  function rebuildCombinedAnswerV35() {
    if (!state.solve || !Array.isArray(state.solve.answerPages)) return;

    state.solve.answer = state.solve.answerPages
      .map((page, i) => `[${i + 1}쪽]\n${page?.text || ""}`)
      .join("\n\n");
  }

  function saveCurrentAnswerPageLightV35() {
    if (!answerPagesReadyV35()) return;

    const index = state.solve.answerPageIndex || 0;
    const page = state.solve.answerPages[index];
    if (!page) return;

    // 페이지 전환에서는 벡터 필기 데이터만 저장.
    // 무거운 canvas PNG 변환은 하지 않는다.
    page.text = $("answerText")?.value || "";
    page.strokes = Array.isArray(state.answerInkStrokes)
      ? state.answerInkStrokes
      : [];

    state.solve.answerInkStrokes = page.strokes;
    rebuildCombinedAnswerV35();

    try {
      renderAnswerPageBadgeV10();
    } catch {}
  }

  function persistDraftV35() {
    if (!state.solve) return;

    clearTimeout(persistTimerV35);

    persistTimerV35 = setTimeout(() => {
      if (!state.solve) return;

      try {
        // 초안에는 대용량 PNG를 넣지 않는다.
        // answerPages의 좌표 데이터로 이어풀기가 가능하다.
        const draft = {
          ...state.solve,
          answerInkData: ""
        };

        localStorage.setItem(
          "essayPsatBaseDraft",
          JSON.stringify(draft)
        );

        try {
          if (typeof renderContinue === "function") renderContinue();
        } catch {}
      } catch (err) {
        console.warn("v35 draft save failed", err);
      }
    }, 120);
  }

  function clearAnswerCanvasPixelsV35() {
    const canvas = $("answerInkCanvas");
    if (!canvas) return;

    try {
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch {}
  }

  function loadAnswerPageFastV35(index) {
    if (!answerPagesReadyV35()) return;

    const max = state.solve.answerPages.length - 1;
    const next = Math.max(0, Math.min(Number(index) || 0, max));

    state.solve.answerPageIndex = next;

    const page = state.solve.answerPages[next] || {
      text: "",
      strokes: []
    };

    const answerText = $("answerText");
    if (answerText) answerText.value = page.text || "";

    state.answerInkCurrentStroke = null;
    state.answerInkStrokes = Array.isArray(page.strokes)
      ? page.strokes
      : [];

    clearAnswerCanvasPixelsV35();

    try {
      renderAnswerPageBadgeV10();
    } catch {}

    requestAnimationFrame(() => {
      try {
        if (typeof resizeAnswerCanvasV10 === "function") {
          resizeAnswerCanvasV10();
        } else if (typeof resizeAnswerCanvasV9 === "function") {
          resizeAnswerCanvasV9();
        } else if (typeof resizeAnswerCanvas === "function") {
          resizeAnswerCanvas();
        }
      } catch {}

      try {
        if (typeof drawAnswerInkV10 === "function") {
          drawAnswerInkV10();
        } else if (typeof drawAnswerInkV9 === "function") {
          drawAnswerInkV9();
        } else if (typeof drawAnswerInk === "function") {
          drawAnswerInk();
        }
      } catch {}
    });
  }

  function addAnswerPageFastV35() {
    if (!state.solve || pageBusyV35) return;

    pageBusyV35 = true;

    try {
      saveCurrentAnswerPageLightV35();

      state.solve.answerPages.push({
        text: "",
        strokes: []
      });

      loadAnswerPageFastV35(
        state.solve.answerPages.length - 1
      );

      rebuildCombinedAnswerV35();
      persistDraftV35();
    } finally {
      // 연속 탭에 의한 중복 실행만 잠깐 방지
      setTimeout(() => {
        pageBusyV35 = false;
      }, 80);
    }
  }

  function moveAnswerPageFastV35(delta) {
    if (!state.solve || pageBusyV35) return;

    pageBusyV35 = true;

    try {
      saveCurrentAnswerPageLightV35();

      const current = Number(
        state.solve.answerPageIndex || 0
      );

      loadAnswerPageFastV35(current + Number(delta || 0));
      persistDraftV35();
    } finally {
      setTimeout(() => {
        pageBusyV35 = false;
      }, 60);
    }
  }

  // 기존 v10 save 함수도 경량 저장으로 교체.
  // 답안 입력 중/페이지 전환 중 PNG 인코딩 방지.
  saveCurrentAnswerPageV10 = function() {
    saveCurrentAnswerPageLightV35();
    persistDraftV35();
  };

  // 기존 함수 이름도 교체해서 다른 버전 코드가 호출해도 동일 동작.
  addAnswerPageV10 = addAnswerPageFastV35;
  nextAnswerPageV10 = moveAnswerPageFastV35;

  function bindAnswerPageButtonsV35() {
    const prev = $("prevAnswerPageBtn");
    const next = $("nextAnswerPageBtn");
    const add = $("addAnswerPageBtn");

    if (prev) {
      prev.onclick = (event) => {
        event?.preventDefault?.();
        moveAnswerPageFastV35(-1);
      };
    }

    if (next) {
      next.onclick = (event) => {
        event?.preventDefault?.();
        moveAnswerPageFastV35(1);
      };
    }

    if (add) {
      add.onclick = (event) => {
        event?.preventDefault?.();
        addAnswerPageFastV35();
      };
    }
  }

  // 혹시 이전 버전의 addEventListener가 남아 있어도
  // 페이지 버튼은 capture 단계에서 v35가 먼저 처리.
  if (!document.documentElement.dataset.v35AnswerPageCapture) {
    document.documentElement.dataset.v35AnswerPageCapture = "1";

    document.addEventListener("click", event => {
      const button = event.target?.closest?.(
        "#prevAnswerPageBtn, #nextAnswerPageBtn, #addAnswerPageBtn"
      );
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (button.id === "addAnswerPageBtn") {
        addAnswerPageFastV35();
      } else if (button.id === "prevAnswerPageBtn") {
        moveAnswerPageFastV35(-1);
      } else if (button.id === "nextAnswerPageBtn") {
        moveAnswerPageFastV35(1);
      }
    }, true);
  }

  // 문제 화면이 다시 열릴 때 버튼이 교체/재연결돼도 v35를 마지막에 적용.
  const openCurrentProblemV35Original = openCurrentProblem;
  openCurrentProblem = function() {
    openCurrentProblemV35Original();

    [80, 220, 500, 900].forEach(delay => {
      setTimeout(() => {
        bindAnswerPageButtonsV35();

        if (state.solve) {
          answerPagesReadyV35();
          loadAnswerPageFastV35(
            state.solve.answerPageIndex || 0
          );
        }
      }, delay);
    });
  };

  // 앱 최초 로딩 시도
  [500, 1000, 1800].forEach(delay => {
    setTimeout(bindAnswerPageButtonsV35, delay);
  });
})();


/* === v36: Essay 폰/태블릿 Firebase 실시간 동기화 === */
(function essayFirebaseSyncV36() {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDrjifzM4Gjbs7EpHCKarrI_E96FrDZLKo",
    authDomain: "psat-sync.firebaseapp.com",
    databaseURL: "https://psat-sync-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "psat-sync",
    storageBucket: "psat-sync.firebasestorage.app",
    messagingSenderId: "18268452172",
    appId: "1:18268452172:web:6700a64f9828e496da4be9"
  };

  // PSAT과 같은 계정이지만 데이터 경로는 완전히 분리
  const ROOT = "essayData";
  const CHUNK_SIZE = 220000;
  const WRITE_TIMEOUT_MS = 25000;
  const RETRIES = 3;
  const EMAIL_KEY = "essay-firebase-email-v36";

  // 기기 간 공유할 Essay 로컬 필기/이어풀기 데이터
  const LOCAL_KEYS = [
    "essayPsatBaseInk_v2",
    "essayScoreAnswerEditsV11",
    "essayScoreExpEditsV11",
    "essayPsatBaseDraft"
  ];

  let fbApp = null;
  let fbAuth = null;
  let fbDb = null;
  let fbUser = null;

  let applyingRemote = false;
  let pushing = false;
  let pushTimer = null;
  let localTimer = null;
  let lastLocalSignature = "";

  let remoteProblemsRef = null;
  let remoteAttemptsRef = null;
  let remoteLocalRef = null;
  let remoteTimer = null;
  let uiBound = false;

  const v36el = (id) => document.getElementById(id);

  function setStatusV36(message, ok = false, error = false) {
    const node = v36el("essayFirebaseStatusV36");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("essay-sync-ok-v36", !!ok);
    node.classList.toggle("essay-sync-error-v36", !!error);
  }

  function friendlyErrorV36(err) {
    const code = String(err?.code || "");
    const msg = String(err?.message || err || "");

    if (code.includes("permission-denied") || /permission_denied/i.test(msg)) {
      return "Firebase 권한 거부 · Rules에 essayData 추가 필요";
    }
    if (code.includes("network-request-failed")) return "인터넷 연결 확인";
    if (code.includes("invalid-credential") || code.includes("wrong-password")) {
      return "이메일 또는 비밀번호 확인";
    }
    if (/timeout/i.test(msg)) return "업로드 시간초과";
    return msg || "동기화 오류";
  }

  function initFirebaseV36() {
    if (fbApp) return;
    if (!window.firebase) throw new Error("Firebase SDK 로딩 실패");

    try {
      fbApp = firebase.initializeApp(FIREBASE_CONFIG, "essay-v36");
    } catch (err) {
      fbApp = firebase.app("essay-v36");
    }

    fbAuth = fbApp.auth();
    fbDb = fbApp.database();
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  }

  function safeKeyV36(id) {
    return encodeURIComponent(String(id || ""))
      .replace(/\./g, "%2E")
      .replace(/#/g, "%23")
      .replace(/\$/g, "%24")
      .replace(/\[/g, "%5B")
      .replace(/\]/g, "%5D")
      .replace(/\//g, "%2F");
  }

  function sleepV36(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function withTimeoutV36(promise, ms, label) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function retryWriteV36(fn, label) {
    let lastError = null;

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        return await withTimeoutV36(fn(), WRITE_TIMEOUT_MS, label);
      } catch (err) {
        lastError = err;
        if (attempt < RETRIES) {
          setStatusV36(`${label} 재시도 ${attempt}/${RETRIES - 1}`);
          await sleepV36(700 * attempt);
        }
      }
    }

    throw lastError;
  }

  function splitTextV36(text) {
    const parts = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      parts.push(text.slice(i, i + CHUNK_SIZE));
    }
    return parts.length ? parts : [""];
  }

  function hashTextV36(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16) + ":" + text.length;
  }

  async function uploadRowV36(path, row, index, total, label) {
    const key = safeKeyV36(row.id);
    const ref = fbDb.ref(`${ROOT}/${fbUser.uid}/${path}/${key}`);
    const jsonText = JSON.stringify(row);
    const fingerprint = hashTextV36(jsonText);

    const oldSnap = await withTimeoutV36(
      ref.once("value"),
      WRITE_TIMEOUT_MS,
      `${label} ${index}/${total} 확인`
    );
    const old = oldSnap.val();

    if (
      old &&
      old.__essayV36 === 1 &&
      old.complete === true &&
      old.fingerprint === fingerprint
    ) {
      return "skip";
    }

    const chunks = splitTextV36(jsonText);

    await retryWriteV36(
      () => ref.set({
        __essayV36: 1,
        complete: false,
        fingerprint,
        chunkCount: chunks.length,
        totalChars: jsonText.length,
        chunks: {}
      }),
      `${label} ${index}/${total} 준비`
    );

    for (let i = 0; i < chunks.length; i++) {
      setStatusV36(`${label} ${index}/${total} · 조각 ${i + 1}/${chunks.length}`);

      await retryWriteV36(
        () => ref.child(`chunks/${i}`).set(chunks[i]),
        `${label} ${index}/${total} 조각 ${i + 1}`
      );
    }

    await retryWriteV36(
      () => ref.update({
        complete: true,
        finishedAt: Date.now()
      }),
      `${label} ${index}/${total} 완료`
    );

    return "uploaded";
  }

  async function removeDeletedRowsV36(path, rows) {
    const ref = fbDb.ref(`${ROOT}/${fbUser.uid}/${path}`);
    const snap = await withTimeoutV36(
      ref.once("value"),
      WRITE_TIMEOUT_MS,
      `${path} 목록 확인`
    );

    const cloud = snap.val() || {};
    const keep = new Set(rows.map(row => safeKeyV36(row.id)));

    for (const key of Object.keys(cloud)) {
      if (!keep.has(key)) {
        await retryWriteV36(
          () => ref.child(key).remove(),
          `${path} 삭제 반영`
        );
      }
    }
  }

  async function uploadStoreV36(path, storeName, label) {
    const rows = await getAll(storeName);
    await removeDeletedRowsV36(path, rows);

    for (let i = 0; i < rows.length; i++) {
      setStatusV36(`${label} 업로드 중 · ${i + 1}/${rows.length}`);
      await uploadRowV36(path, rows[i], i + 1, rows.length, label);
    }

    return rows.length;
  }

  function readSharedLocalV36() {
    const data = {};
    for (const key of LOCAL_KEYS) {
      data[key] = localStorage.getItem(key) || "";
    }
    return data;
  }

  function localSignatureV36(data = readSharedLocalV36()) {
    return hashTextV36(JSON.stringify(data));
  }

  async function uploadLocalDataV36(force = false) {
    if (!fbUser || !fbDb || applyingRemote) return;

    const data = readSharedLocalV36();
    const signature = localSignatureV36(data);

    if (!force && signature === lastLocalSignature) return;

    const row = {
      id: "sharedLocal",
      data,
      updatedAt: Date.now()
    };

    await uploadRowV36("local", row, 1, 1, "필기/이어풀기");
    lastLocalSignature = signature;
  }

  async function pushAllV36() {
    if (!fbUser || !fbDb) throw new Error("먼저 로그인해줘");
    if (applyingRemote) return;

    if (pushing) {
      setStatusV36("이미 업로드 진행 중이야");
      return;
    }

    pushing = true;

    try {
      setStatusV36("이 기기 데이터 확인 중...");

      const problemCount = await uploadStoreV36(
        "problems",
        STORE_PROBLEMS,
        "문제"
      );

      const attemptCount = await uploadStoreV36(
        "attempts",
        STORE_ATTEMPTS,
        "풀이기록"
      );

      await uploadLocalDataV36(true);

      await retryWriteV36(
        () => fbDb.ref(`${ROOT}/${fbUser.uid}/_meta`).set({
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
          problemCount,
          attemptCount,
          version: 36
        }),
        "마지막 저장"
      );

      setStatusV36(`클라우드 저장 완료 · ${problemCount}문제`, true);
    } finally {
      pushing = false;
    }
  }

  function decodeRowV36(value) {
    if (!value) return null;

    if (value.__essayV36 !== 1) {
      return value;
    }

    if (value.complete !== true) return null;

    const count = Number(value.chunkCount || 0);
    const chunks = value.chunks || {};
    let text = "";

    for (let i = 0; i < count; i++) {
      if (typeof chunks[i] !== "string") return null;
      text += chunks[i];
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn("Essay v36 cloud row parse failed", err);
      return null;
    }
  }

  function decodeCollectionV36(obj) {
    if (!obj || typeof obj !== "object") return [];

    const rows = [];
    for (const value of Object.values(obj)) {
      const row = decodeRowV36(value);
      if (row && row.id) rows.push(row);
    }
    return rows;
  }

  async function replaceStoreV36(storeName, rows) {
    await clearStore(storeName);
    for (const row of rows) {
      await put(storeName, row);
    }
  }

  async function applySharedLocalV36(localObj) {
    const rows = decodeCollectionV36(localObj);
    const row = rows.find(item => item.id === "sharedLocal");
    if (!row?.data) return;

    for (const key of LOCAL_KEYS) {
      const value = row.data[key];
      if (typeof value === "string") {
        if (value) localStorage.setItem(key, value);
        else localStorage.removeItem(key);
      }
    }

    // 현재 메모리 상태에도 바로 반영
    try {
      state.inkData = JSON.parse(
        localStorage.getItem("essayPsatBaseInk_v2") || "{}"
      );
    } catch {}

    try {
      state.scoreAnswerEdits = JSON.parse(
        localStorage.getItem("essayScoreAnswerEditsV11") || "{}"
      );
    } catch {}

    try {
      state.scoreExpEdits = JSON.parse(
        localStorage.getItem("essayScoreExpEditsV11") || "{}"
      );
    } catch {}

    lastLocalSignature = localSignatureV36();
  }

  /* === v46: 공부 화면을 건드리지 않는 증분 동기화 === */
  let pendingUiRefreshV46 = false;
  let pendingLocalSnapshotV46 = null;
  let safeRefreshTimerV46 = null;
  const rowPushTimersV46 = new Map();
  const ownRemoteKeysV46 = new Map();

  function studyScreenActiveV46() {
    const solve = document.getElementById("solveOverlay");
    const score = document.getElementById("scoreOverlay");
    return !!(
      (solve && !solve.classList.contains("hidden")) ||
      (score && !score.classList.contains("hidden"))
    );
  }

  function ownKeyV46(path, key) {
    return `${path}:${key}`;
  }

  function markOwnRemoteV46(path, key) {
    ownRemoteKeysV46.set(ownKeyV46(path, key), Date.now() + 5000);
  }

  function consumeOwnRemoteV46(path, key) {
    const k = ownKeyV46(path, key);
    const until = Number(ownRemoteKeysV46.get(k) || 0);
    if (until > Date.now()) {
      ownRemoteKeysV46.delete(k);
      return true;
    }
    if (until) ownRemoteKeysV46.delete(k);
    return false;
  }

  async function flushDeferredSyncV46() {
    clearTimeout(safeRefreshTimerV46);
    safeRefreshTimerV46 = null;

    if (studyScreenActiveV46()) {
      safeRefreshTimerV46 = setTimeout(flushDeferredSyncV46, 900);
      return;
    }

    if (pendingLocalSnapshotV46) {
      const snap = pendingLocalSnapshotV46;
      pendingLocalSnapshotV46 = null;
      applyingRemote = true;
      try {
        await applySharedLocalV36({ [snap.key]: snap.val() });
      } finally {
        applyingRemote = false;
      }
    }

    if (pendingUiRefreshV46) {
      pendingUiRefreshV46 = false;
      await loadData();
      try { renderAll(); } catch {}
    }
  }

  function requestSafeUiRefreshV46() {
    pendingUiRefreshV46 = true;
    clearTimeout(safeRefreshTimerV46);
    safeRefreshTimerV46 = setTimeout(flushDeferredSyncV46, 300);
  }

  async function applyRemoteRowV46(storeName, path, snap, removed = false) {
    if (!snap?.key) return;
    if (consumeOwnRemoteV46(path, snap.key)) return;

    applyingRemote = true;
    try {
      if (removed) {
        await originalDelV36(storeName, snap.key);
      } else {
        const row = decodeRowV36(snap.val());
        if (!row?.id) return;
        await originalPutV36(storeName, row);
      }
    } finally {
      applyingRemote = false;
    }

    // DB만 갱신하고, 풀이/해설 중에는 절대 renderAll 하지 않는다.
    requestSafeUiRefreshV46();
  }

  async function applyRemoteLocalV46(snap, removed = false) {
    if (!snap?.key) return;
    if (consumeOwnRemoteV46("local", snap.key)) return;

    if (removed) {
      pendingLocalSnapshotV46 = null;
      return;
    }

    const row = decodeRowV36(snap.val());
    if (!row?.data) return;

    // 같은 데이터면 아무것도 하지 않는다(자기 업로드 echo 방지).
    const remoteSig = hashTextV36(JSON.stringify(row.data));
    if (remoteSig === localSignatureV36()) return;

    if (studyScreenActiveV46()) {
      pendingLocalSnapshotV46 = snap;
      clearTimeout(safeRefreshTimerV46);
      safeRefreshTimerV46 = setTimeout(flushDeferredSyncV46, 900);
      return;
    }

    applyingRemote = true;
    try {
      await applySharedLocalV36({ [snap.key]: snap.val() });
    } finally {
      applyingRemote = false;
    }
  }

  function cloudPathForStoreV46(name) {
    if (name === STORE_PROBLEMS) return "problems";
    if (name === STORE_ATTEMPTS) return "attempts";
    return "";
  }

  function labelForStoreV46(name) {
    return name === STORE_PROBLEMS ? "문제" : "풀이기록";
  }

  function scheduleRowPushV46(name, value) {
    if (!fbUser || !fbDb || applyingRemote || pushing || !value?.id) return;
    const path = cloudPathForStoreV46(name);
    if (!path) return;

    const timerKey = `${path}:${value.id}`;
    clearTimeout(rowPushTimersV46.get(timerKey));
    rowPushTimersV46.set(timerKey, setTimeout(async () => {
      rowPushTimersV46.delete(timerKey);
      try {
        markOwnRemoteV46(path, value.id);
        await uploadRowV36(path, value, 1, 1, labelForStoreV46(name));
        setStatusV36(`자동 동기화됨 · ${labelForStoreV46(name)} 1건`, true);
      } catch (err) {
        setStatusV36(
          `자동 업로드 실패 · ${friendlyErrorV36(err)}`,
          false,
          true
        );
      }
    }, 450));
  }

  function scheduleRowDeleteV46(name, key) {
    if (!fbUser || !fbDb || applyingRemote || pushing || !key) return;
    const path = cloudPathForStoreV46(name);
    if (!path) return;

    const timerKey = `${path}:${key}`;
    clearTimeout(rowPushTimersV46.get(timerKey));
    rowPushTimersV46.set(timerKey, setTimeout(async () => {
      rowPushTimersV46.delete(timerKey);
      try {
        markOwnRemoteV46(path, key);
        await retryWriteV36(
          () => fbDb.ref(`${ROOT}/${fbUser.uid}/${path}/${key}`).remove(),
          `${labelForStoreV46(name)} 삭제`
        );
      } catch (err) {
        setStatusV36(
          `자동 삭제동기화 실패 · ${friendlyErrorV36(err)}`,
          false,
          true
        );
      }
    }, 350));
  }

  async function pullAllV36() {
    if (!fbUser || !fbDb) throw new Error("먼저 로그인해줘");
    if (pushing) return false;

    applyingRemote = true;

    try {
      setStatusV36("클라우드 데이터 받는 중...");

      const [pSnap, aSnap, lSnap] = await Promise.all([
        withTimeoutV36(
          fbDb.ref(`${ROOT}/${fbUser.uid}/problems`).once("value"),
          WRITE_TIMEOUT_MS,
          "문제 받기"
        ),
        withTimeoutV36(
          fbDb.ref(`${ROOT}/${fbUser.uid}/attempts`).once("value"),
          WRITE_TIMEOUT_MS,
          "풀이기록 받기"
        ),
        withTimeoutV36(
          fbDb.ref(`${ROOT}/${fbUser.uid}/local`).once("value"),
          WRITE_TIMEOUT_MS,
          "필기 받기"
        )
      ]);

      if (!pSnap.exists() && !aSnap.exists() && !lSnap.exists()) {
        setStatusV36("클라우드 Essay 데이터가 아직 없어");
        return false;
      }

      const problems = decodeCollectionV36(pSnap.val());
      const attempts = decodeCollectionV36(aSnap.val());

      await replaceStoreV36(STORE_PROBLEMS, problems);
      await replaceStoreV36(STORE_ATTEMPTS, attempts);
      await applySharedLocalV36(lSnap.val());

      if (studyScreenActiveV46()) {
        pendingUiRefreshV46 = true;
        clearTimeout(safeRefreshTimerV46);
        safeRefreshTimerV46 = setTimeout(flushDeferredSyncV46, 900);
      } else {
        await loadData();
        try { renderAll(); } catch {}
      }

      setStatusV36(`동기화됨 · ${problems.length}문제`, true);
      return true;
    } finally {
      applyingRemote = false;
    }
  }

  function stopRemoteV36() {
    if (remoteProblemsRef) remoteProblemsRef.off();
    if (remoteAttemptsRef) remoteAttemptsRef.off();
    if (remoteLocalRef) remoteLocalRef.off();

    remoteProblemsRef = null;
    remoteAttemptsRef = null;
    remoteLocalRef = null;
  }

  async function startRemoteV36() {
    stopRemoteV36();
    if (!fbUser || !fbDb) return;

    remoteProblemsRef = fbDb.ref(`${ROOT}/${fbUser.uid}/problems`);
    remoteAttemptsRef = fbDb.ref(`${ROOT}/${fbUser.uid}/attempts`);
    remoteLocalRef = fbDb.ref(`${ROOT}/${fbUser.uid}/local`);

    /*
      v36의 value 리스너 3개 → 전체 pullAll/renderAll 반복 구조 제거.
      로그인 시 전체 pull은 1회만 하고, 그 뒤에는 바뀐 child 1개만 반영.
    */
    const [p0, a0, l0] = await Promise.all([
      remoteProblemsRef.once("value"),
      remoteAttemptsRef.once("value"),
      remoteLocalRef.once("value")
    ]);

    const knownP = new Set(Object.keys(p0.val() || {}));
    const knownA = new Set(Object.keys(a0.val() || {}));
    const knownL = new Set(Object.keys(l0.val() || {}));

    remoteProblemsRef.on("child_added", snap => {
      if (knownP.delete(snap.key)) return;
      applyRemoteRowV46(STORE_PROBLEMS, "problems", snap, false).catch(() => {});
    });
    remoteProblemsRef.on("child_changed", snap => {
      applyRemoteRowV46(STORE_PROBLEMS, "problems", snap, false).catch(() => {});
    });
    remoteProblemsRef.on("child_removed", snap => {
      applyRemoteRowV46(STORE_PROBLEMS, "problems", snap, true).catch(() => {});
    });

    remoteAttemptsRef.on("child_added", snap => {
      if (knownA.delete(snap.key)) return;
      applyRemoteRowV46(STORE_ATTEMPTS, "attempts", snap, false).catch(() => {});
    });
    remoteAttemptsRef.on("child_changed", snap => {
      applyRemoteRowV46(STORE_ATTEMPTS, "attempts", snap, false).catch(() => {});
    });
    remoteAttemptsRef.on("child_removed", snap => {
      applyRemoteRowV46(STORE_ATTEMPTS, "attempts", snap, true).catch(() => {});
    });

    remoteLocalRef.on("child_added", snap => {
      if (knownL.delete(snap.key)) return;
      applyRemoteLocalV46(snap, false).catch(() => {});
    });
    remoteLocalRef.on("child_changed", snap => {
      applyRemoteLocalV46(snap, false).catch(() => {});
    });
    remoteLocalRef.on("child_removed", snap => {
      applyRemoteLocalV46(snap, true).catch(() => {});
    });
  }

  /* 수동 전체 일치 확인/온라인 복구 때만 full push 사용 */
  function schedulePushV36() {
    if (!fbUser || applyingRemote || pushing) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushAllV36().catch(err => {
        setStatusV36(
          `전체 동기화 실패 · ${friendlyErrorV36(err)}`,
          false,
          true
        );
      });
    }, 1600);
  }

  async function afterLoginV36(user) {
    fbUser = user;

    localStorage.setItem(EMAIL_KEY, user.email || "");
    // PSAT 앱과 같은 origin이라 기존 이메일도 재사용 가능
    localStorage.setItem("psat-firebase-email-v46", user.email || "");

    if (v36el("essayFirebaseEmailV36") && user.email) {
      v36el("essayFirebaseEmailV36").value = user.email;
    }

    v36el("essayFirebaseLogoutBtnV36")?.classList.remove("hidden");
    setStatusV36(`로그인됨 · ${user.email || ""}`, true);

    const meta = await withTimeoutV36(
      fbDb.ref(`${ROOT}/${user.uid}/_meta`).once("value"),
      WRITE_TIMEOUT_MS,
      "Essay 클라우드 확인"
    );

    if (meta.exists()) {
      await pullAllV36();
    } else {
      // 첫 연결이면 현재 기기의 Essay 데이터를 기준으로 최초 업로드
      await pushAllV36();
    }

    await startRemoteV36();
    lastLocalSignature = localSignatureV36();
  }

  function bindUiV36() {
    if (uiBound) return;
    uiBound = true;

    const email = v36el("essayFirebaseEmailV36");
    if (email) {
      email.value =
        localStorage.getItem(EMAIL_KEY) ||
        localStorage.getItem("psat-firebase-email-v46") ||
        "";
    }

    v36el("essayFirebaseLoginBtnV36")?.addEventListener("click", async () => {
      try {
        const e = v36el("essayFirebaseEmailV36")?.value.trim() || "";
        const p = v36el("essayFirebasePasswordV36")?.value || "";

        if (!e || !p) throw new Error("이메일/비밀번호 입력");

        initFirebaseV36();
        setStatusV36("로그인 중...");

        const credential = await fbAuth.signInWithEmailAndPassword(e, p);
        await afterLoginV36(credential.user);

        toast("Essay 실시간 동기화 시작");
      } catch (err) {
        const message = friendlyErrorV36(err);
        setStatusV36(`로그인 실패 · ${message}`, false, true);
        toast(message);
      }
    });

    v36el("essayFirebaseLogoutBtnV36")?.addEventListener("click", async () => {
      try {
        stopRemoteV36();
        if (fbAuth) await fbAuth.signOut();
        fbUser = null;
        v36el("essayFirebaseLogoutBtnV36")?.classList.add("hidden");
        setStatusV36("로그아웃됨");
      } catch (err) {
        setStatusV36(friendlyErrorV36(err), false, true);
      }
    });

    v36el("essayFirebasePushBtnV36")?.addEventListener("click", async () => {
      try {
        await pushAllV36();
        toast("Essay 데이터 업로드 완료");
      } catch (err) {
        const message = friendlyErrorV36(err);
        setStatusV36(`업로드 실패 · ${message}`, false, true);
        toast(message);
      }
    });

    v36el("essayFirebasePullBtnV36")?.addEventListener("click", async () => {
      try {
        await pullAllV36();
        toast("Essay 클라우드 데이터 받기 완료");
      } catch (err) {
        const message = friendlyErrorV36(err);
        setStatusV36(`받기 실패 · ${message}`, false, true);
        toast(message);
      }
    });
  }

  // v46: IndexedDB 변경은 해당 1건만 자동 업로드
  const originalPutV36 = put;
  put = async function(name, value) {
    const result = await originalPutV36(name, value);
    scheduleRowPushV46(name, value);
    return result;
  };

  const originalDelV36 = del;
  del = async function(name, key) {
    const result = await originalDelV36(name, key);
    scheduleRowDeleteV46(name, key);
    return result;
  };

  const originalClearStoreV36 = clearStore;
  clearStore = async function(name) {
    const result = await originalClearStoreV36(name);
    // 전체 삭제는 드문 작업이라 full consistency push로 처리.
    if (!applyingRemote) schedulePushV36();
    return result;
  };

  // 문제필기/채점필기/이어풀기는 localStorage이므로 변화 감시 후 따로 자동 업로드
  function startLocalWatcherV36() {
    lastLocalSignature = localSignatureV36();

    clearInterval(localTimer);
    localTimer = setInterval(() => {
      if (!fbUser || applyingRemote || pushing) return;

      const signature = localSignatureV36();
      if (signature === lastLocalSignature) return;

      markOwnRemoteV46("local", "sharedLocal");
      uploadLocalDataV36(true)
        .then(() => {
          setStatusV36("필기/이어풀기 동기화됨", true);
        })
        .catch(err => {
          setStatusV36(
            `필기 자동동기화 실패 · ${friendlyErrorV36(err)}`,
            false,
            true
          );
        });
    }, 2600);
  }

  function startV36() {
    bindUiV36();

    try {
      initFirebaseV36();

      fbAuth.onAuthStateChanged(user => {
        if (!user) {
          fbUser = null;
          setStatusV36("Firebase 연결됨 · 로그인 필요");
          return;
        }

        if (fbUser?.uid === user.uid) return;

        afterLoginV36(user).catch(err => {
          setStatusV36(
            `자동 동기화 실패 · ${friendlyErrorV36(err)}`,
            false,
            true
          );
        });
      });

      startLocalWatcherV36();
    } catch (err) {
      setStatusV36(
        `Firebase 초기화 실패 · ${friendlyErrorV36(err)}`,
        false,
        true
      );
    }
  }

  window.addEventListener("online", () => {
    if (fbUser) schedulePushV36();
  });

  setTimeout(startV36, 500);
})();
