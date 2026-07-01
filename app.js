const APP_VERSION="essay-psat-base-v18";const DB_NAME="essayPsatBaseDB_v1";const DB_VERSION=1;const STORE_PROBLEMS="problems";const STORE_ATTEMPTS="attempts";const $=id=>document.getElementById(id);const $$=sel=>Array.from(document.querySelectorAll(sel));let db;const state={problems:[],attempts:[],questionPages:[],explanationPages:[],selectedQuestionPage:-1,selectedExplanationPage:-1,activePasteTarget:"question",solve:null,timer:null,qPage:0,expPage:0,zoom:1,installPrompt:null};function uuid(){return crypto.randomUUID&&crypto.randomUUID()||`id_${Date.now()}_${Math.random().toString(16).slice(2)}`}function nowIso(){return new Date().toISOString()}function toast(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add("hidden"),2300)}function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function fmtTime(ms){ms=Math.max(0,Math.floor(ms||0));const sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}function pointsFromText(text){return String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean)}function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE_PROBLEMS))d.createObjectStore(STORE_PROBLEMS,{keyPath:"id"});if(!d.objectStoreNames.contains(STORE_ATTEMPTS))d.createObjectStore(STORE_ATTEMPTS,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name)}function getAll(name){return new Promise((resolve,reject)=>{const req=store(name).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}function put(name,value){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error)})}function del(name,key){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}function clearStore(name){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").clear();req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}async function loadData(){state.problems=(await getAll(STORE_PROBLEMS)).sort((a,b)=>(a.order||0)-(b.order||0));state.attempts=(await getAll(STORE_ATTEMPTS)).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))}function setPasteTarget(target){state.activePasteTarget=target;$("questionPasteZone")?.classList.toggle("active-paste",target==="question");$("explanationPasteZone")?.classList.toggle("active-paste",target==="explanation")}function dataUrlBytes(dataUrl){const comma=dataUrl.indexOf(",");const base64=comma>=0?dataUrl.slice(comma+1):dataUrl;return Math.round(base64.length*.75)}function formatBytes(bytes){if(!bytes)return"0B";const u=["B","KB","MB"];let v=bytes,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return`${v.toFixed(i?1:0)}${u[i]}`}function imageBlobToDataUrl(blob){return new Promise((resolve,reject)=>{const mode=$("qualityInput").value||"sharp";if(mode==="original"){const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const maxDim=mode==="bulk"?1500:2400,scale=Math.min(1,maxDim/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL("image/jpeg",mode==="bulk"?.72:.88))};img.onerror=reject;img.src=reader.result};reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}async function addImageFiles(files,target){const arr=Array.from(files||[]).filter(file=>file&&file.type&&file.type.startsWith("image/"));if(!arr.length){toast("이미지 파일이 없어");return}let added=0,size=0;for(const file of arr){const data=await imageBlobToDataUrl(file);if(target==="explanation")state.explanationPages.push(data);else state.questionPages.push(data);size+=dataUrlBytes(data);added++}renderPageLists();setPasteTarget(target);toast(`${target==="explanation"?"해설":"문제"} 이미지 ${added}장 추가 · ${formatBytes(size)}`)}async function pasteImageFromClipboardEvent(event,explicitTarget=""){const items=event.clipboardData?.items?Array.from(event.clipboardData.items):[];const files=items.filter(entry=>entry.type&&entry.type.startsWith("image/")).map(entry=>entry.getAsFile()).filter(Boolean);if(!files.length)return false;event.preventDefault();const target=explicitTarget||event.target.closest?.("[data-paste-target]")?.dataset?.pasteTarget||state.activePasteTarget||"question";toast("스크린샷 처리 중...");await addImageFiles(files,target);return true}async function pasteImageWithClipboardApi(target){setPasteTarget(target);if(!navigator.clipboard||!navigator.clipboard.read){toast("이 브라우저는 버튼 붙여넣기를 지원하지 않아. 영역 클릭 후 Ctrl+V를 눌러줘.");return}try{const items=await navigator.clipboard.read();const files=[];for(const item of items){const type=item.types.find(t=>t.startsWith("image/"));if(!type)continue;const blob=await item.getType(type);files.push(new File([blob],`${target}_${Date.now()}_${files.length}.png`,{type}))}if(!files.length){toast("클립보드에 이미지가 없어");return}toast("스크린샷 처리 중...");await addImageFiles(files,target)}catch(err){console.warn(err);toast("붙여넣기 권한이 막혔어. 영역 클릭 후 Ctrl+V를 눌러줘.")}}function setupPasteZone(zoneId,inputId,target){const zone=$(zoneId),input=$(inputId);zone.addEventListener("click",()=>{setPasteTarget(target);zone.focus()});zone.addEventListener("focus",()=>setPasteTarget(target));zone.addEventListener("paste",event=>pasteImageFromClipboardEvent(event,target));input.addEventListener("change",async()=>{await addImageFiles(input.files,target);input.value=""})}function makeButton(text,fn,cls=""){const b=document.createElement("button");b.type="button";b.textContent=text;if(cls)b.className=cls;b.addEventListener("click",fn);return b}function movePage(target,index,dir){const arr=target==="explanation"?state.explanationPages:state.questionPages,next=index+dir;if(next<0||next>=arr.length)return;[arr[index],arr[next]]=[arr[next],arr[index]];renderPageLists()}function deletePage(target,index){const arr=target==="explanation"?state.explanationPages:state.questionPages;arr.splice(index,1);renderPageLists()}function renderPageList(id,arr,target){const box=$(id);box.innerHTML="";if(!arr.length){box.innerHTML='<p class="hint">아직 이미지가 없어.</p>';return}arr.forEach((src,index)=>{const div=document.createElement("div");div.className="page-item";div.innerHTML=`<img src="${src}" alt="${index+1}쪽" /><div><strong>${index+1}쪽</strong><p class="hint">${target==="explanation"?"해설":"문제"} 페이지</p><div class="page-actions"></div></div>`;const actions=div.querySelector(".page-actions");actions.append(makeButton("위",()=>movePage(target,index,-1),"secondary small"));actions.append(makeButton("아래",()=>movePage(target,index,1),"secondary small"));actions.append(makeButton("삭제",()=>deletePage(target,index),"danger small"));box.append(div)})}function renderPageLists(){renderPageList("questionPageList",state.questionPages,"question");renderPageList("explanationPageList",state.explanationPages,"explanation")}function titleOf(p){return p.title||`${p.session?p.session+" ":""}${p.subject||""} 문제`}function attemptsOf(id){return state.attempts.filter(a=>a.problemId===id)}function lastAttempt(id){return attemptsOf(id).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))[0]}function metaOf(p){const last=lastAttempt(p.id);return`${p.subject||"-"} · ${p.session||"회차 없음"} · 문제 ${realPages(p.questionPages||[]).length}쪽 · 해설 ${realPages(p.explanationPages||[]).length}쪽 · ${p.maxScore||0}점 · 제한 ${p.timeLimit||0}분 · 기록 ${attemptsOf(p.id).length}회${last?" · 최근 "+fmtTime(last.elapsedMs):""}`}function filterProblems({subject="",session="",search=""}={}){const s=session.trim().toLowerCase(),q=search.trim().toLowerCase();return state.problems.filter(p=>{if(subject&&p.subject!==subject)return false;if(s&&!String(p.session||"").toLowerCase().includes(s))return false;if(q){const blob=[p.title,p.session,p.subject,p.pointsText,p.modelText].join(" ").toLowerCase();if(!blob.includes(q))return false}return true})}function showView(id){$$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));renderAll()}function problemCard(p,opts={}){const last=lastAttempt(p.id),div=document.createElement("div");div.className="problem-card";div.innerHTML=`<h3>${esc(titleOf(p))}</h3><p class="meta">${esc(metaOf(p))}</p><div class="badges"><span class="badge">${esc(p.subject||"-")}</span><span class="badge">${esc(p.session||"회차 없음")}</span><span class="badge">문제 ${realPages(p.questionPages||[]).length}쪽</span><span class="badge">해설 ${realPages(p.explanationPages||[]).length}쪽</span>${last?`<span class="badge">최근점수 ${last.score??"-"}</span>`:""}</div><div class="card-actions"></div>`;const actions=div.querySelector(".card-actions");if(opts.solve)actions.append(makeButton("풀기",()=>startSolve([p.id],$("solveMode").value||"outline")));if(opts.review)actions.append(makeButton("다시 풀기",()=>startSolve([p.id],"outline")));if(opts.list){actions.append(makeButton("수정",()=>fillForm(p),"secondary"));actions.append(makeButton("복제",async()=>{const copy={...p,id:uuid(),title:`${titleOf(p)} 복사본`,createdAt:nowIso(),updatedAt:nowIso(),order:Date.now()};await put(STORE_PROBLEMS,copy);await loadData();renderAll();toast("복제 완료")},"secondary"));actions.append(makeButton("삭제",async()=>{if(!confirm("이 문제와 풀이기록을 삭제할까?"))return;await del(STORE_PROBLEMS,p.id);for(const a of attemptsOf(p.id))await del(STORE_ATTEMPTS,a.id);await loadData();renderAll();toast("삭제 완료")},"danger small"))}return div}function renderSolveList(){const list=$("solveList"),arr=filterProblems({subject:$("solveSubject").value,session:$("solveSession").value});list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">조건에 맞는 문제가 없어.</p>';return}arr.forEach(p=>list.append(problemCard(p,{solve:true})))}function renderList(){const list=$("problemList"),arr=filterProblems({subject:$("listSubject").value,session:$("listSession").value,search:$("listSearch").value});list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">등록된 문제가 없어.</p>';return}arr.forEach((p,i)=>{const card=problemCard(p,{list:true});card.querySelector("h3").textContent=`${i+1}. ${titleOf(p)}`;list.append(card)})}function renderReview(){const list=$("reviewList");let arr=filterProblems({subject:$("reviewSubject").value,session:$("reviewSession").value});if($("reviewType").value==="needed")arr=arr.filter(p=>String(lastAttempt(p.id)?.needReview)==="true");else arr=arr.filter(p=>attemptsOf(p.id).length);list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">복습 대상이 없어.</p>';return}arr.forEach(p=>list.append(problemCard(p,{review:true})))}function renderStats(){const done=new Set(state.attempts.map(a=>a.problemId)).size,review=state.problems.filter(p=>String(lastAttempt(p.id)?.needReview)==="true").length;$("statsGrid").innerHTML=`<div class="stat-card">등록 문제<strong>${state.problems.length}</strong></div><div class="stat-card">풀이 완료<strong>${done}</strong></div><div class="stat-card">풀이 기록<strong>${state.attempts.length}</strong></div><div class="stat-card">복습 필요<strong>${review}</strong></div>`}function renderContinue(){$("continueBtn").classList.toggle("hidden",!localStorage.getItem("essayPsatBaseDraft"))}function renderAll(){renderSolveList();renderList();renderReview();renderStats();renderContinue();renderPageLists()}async function saveProblem(event){event.preventDefault();const id=$("editId").value||uuid(),existing=state.problems.find(p=>p.id===id);if(!realPages(state.questionPages).length){toast("문제 이미지를 최소 1쪽 넣어줘");return}const problem={id,subject:$("subjectInput").value,session:$("sessionInput").value.trim(),title:$("titleInput").value.trim(),maxScore:Number($("scoreInput").value||0),timeLimit:Number($("timeInput").value||0),questionPages:realPages(state.questionPages),explanationPages:realPages(state.explanationPages),pointsText:$("pointsInput").value.trim(),points:pointsFromText($("pointsInput").value),modelText:$("modelTextInput").value.trim(),order:existing?.order??Date.now(),createdAt:existing?.createdAt||nowIso(),updatedAt:nowIso()};await put(STORE_PROBLEMS,problem);await loadData();toast($("editId").value?"수정 저장 완료":"저장 완료");resetForm();renderAll()}function fillForm(p){$("formTitle").textContent="문제 수정";$("editId").value=p.id;$("subjectInput").value=p.subject||"형법";$("sessionInput").value=p.session||"";$("titleInput").value=p.title||"";$("scoreInput").value=p.maxScore||20;$("timeInput").value=p.timeLimit||30;$("pointsInput").value=p.pointsText||(p.points||[]).join("\n");$("modelTextInput").value=p.modelText||"";state.questionPages=[...(p.questionPages||[])];state.explanationPages=[...(p.explanationPages||[])];renderPageLists();showView("addView");window.scrollTo(0,0)}function resetForm(){$("formTitle").textContent="문제 등록";$("problemForm").reset();$("editId").value="";$("scoreInput").value=20;$("timeInput").value=30;$("qualityInput").value="sharp";state.questionPages=[];state.explanationPages=[];setPasteTarget("question");renderPageLists()}function chooseRandom(arr,n){return[...arr].sort(()=>Math.random()-.5).slice(0,Math.min(n,arr.length))}function startRandom(reviewOnly=false){let arr=filterProblems({subject:$("solveSubject").value,session:$("solveSession").value});if(reviewOnly)arr=arr.filter(p=>String(lastAttempt(p.id)?.needReview)==="true");if(!arr.length){toast(reviewOnly?"복습필요 문제가 없어":"조건에 맞는 문제가 없어");return}const picks=chooseRandom(arr,Number($("randomCount").value||1));startSolve(picks.map(p=>p.id),$("solveMode").value||"outline")}function currentProblem(){return state.problems.find(p=>p.id===state.solve?.ids[state.solve.index])}function startSolve(ids,mode){state.solve={ids,index:0,mode,startedAt:Date.now(),startedProblemAt:Date.now(),elapsedBase:0,answer:""};state.qPage=0;localStorage.setItem("essayPsatBaseDraft",JSON.stringify(state.solve));openCurrentProblem()}function openCurrentProblem(){const p=currentProblem();if(!p){finishSolve(false);return}state.qPage=0;$("solveOverlay").classList.remove("hidden");$("solveTitle").textContent=titleOf(p);$("solveMeta").textContent=metaOf(p);$("setBadge").textContent=`${state.solve.index+1}/${state.solve.ids.length} · ${state.solve.mode==="outline"?"목차연습":"실전답안"}`;$("answerLabel").textContent=state.solve.mode==="outline"?"내 목차/쟁점":"내 답안";$("answerText").value=state.solve.answer||"";showQuestionPage(0);clearInterval(state.timer);state.timer=setInterval(updateTimer,500);updateTimer()}function showQuestionPage(index){const p=currentProblem(),pages=realPages(p?.questionPages||[]);state.qPage=Math.max(0,Math.min(index,pages.length-1));$("questionImageView").src=pages[state.qPage]||"";$("questionPageBadge").textContent=pages.length?`문제 ${state.qPage+1}/${pages.length}쪽`:"문제 없음";fitImage();saveDraft()}function elapsedNow(){return state.solve?(state.solve.elapsedBase||0)+Date.now()-state.solve.startedProblemAt:0}function updateTimer(){const p=currentProblem(),elapsed=elapsedNow();$("timerText").textContent=fmtTime(elapsed);const limit=Number(p?.timeLimit||0)*6e4;$("limitText").textContent=limit?elapsed<=limit?`남은 ${fmtTime(limit-elapsed)}`:`초과 ${fmtTime(elapsed-limit)}`:""}function saveDraft(){if(!state.solve)return;state.solve.answer=$("answerText")?.value??state.solve.answer;localStorage.setItem("essayPsatBaseDraft",JSON.stringify(state.solve));renderContinue()}function pauseSolve(){if(!state.solve)return;state.solve.elapsedBase=elapsedNow();state.solve.answer=$("answerText").value;clearInterval(state.timer);state.timer=null;saveDraft();$("solveOverlay").classList.add("hidden");toast("이어풀기 저장 완료")}function continueSolve(){try{const saved=JSON.parse(localStorage.getItem("essayPsatBaseDraft")||"null");if(!saved||!saved.ids?.length){toast("이어풀 문제가 없어");return}state.solve=saved;state.solve.startedProblemAt=Date.now();openCurrentProblem()}catch{toast("이어풀 문제가 없어")}}function submitAnswer(){if(!state.solve)return;state.solve.elapsedBase=elapsedNow();state.solve.answer=$("answerText").value;clearInterval(state.timer);state.timer=null;openScore()}function openScore(){const p=currentProblem();if(!p)return;state.expPage=0;$("scoreOverlay").classList.remove("hidden");$("scoreMeta").textContent=`${titleOf(p)} · 풀이시간 ${fmtTime(state.solve.elapsedBase)}`;$("ownAnswerView").textContent=state.solve.answer||"(작성한 답안 없음)";$("modelTextView").textContent=p.modelText||"";$("attemptScoreInput").value="";$("attemptScoreInput").max=p.maxScore||"";$("completionInput").value=state.solve.mode==="outline"?"목차만":"완성";$("needReviewInput").value="true";renderChecklist(p);showExplanationPage(0)}function showExplanationPage(index){const p=currentProblem(),pages=realPages(p?.explanationPages||[]);state.expPage=Math.max(0,Math.min(index,pages.length-1));if(pages.length){$("explanationImageView").src=pages[state.expPage];$("explanationImageView").classList.remove("hidden");$("explanationPageBadge").textContent=`해설 ${state.expPage+1}/${pages.length}쪽`}else{$("explanationImageView").classList.add("hidden");$("explanationPageBadge").textContent="해설 이미지 없음"}}function renderChecklist(p){const box=$("pointChecklist"),points=p.points?.length?p.points:pointsFromText(p.pointsText);box.innerHTML="";if(!points.length){box.innerHTML='<p class="hint">채점포인트 없음</p>';return}points.forEach((point,i)=>{const row=document.createElement("label");row.className="check-item";row.innerHTML=`<input type="checkbox" data-point="${i}" /> <span>${esc(point)}</span>`;box.append(row)})}async function saveAttempt(){const p=currentProblem();if(!p||!state.solve)return null;const attempt={id:uuid(),problemId:p.id,subject:p.subject,session:p.session,mode:state.solve.mode,answer:state.solve.answer||"",elapsedMs:state.solve.elapsedBase,score:$("attemptScoreInput").value===""?null:Number($("attemptScoreInput").value),maxScore:p.maxScore||0,difficulty:$("difficultyResultInput").value,needReview:$("needReviewInput").value,completion:$("completionInput").value,memo:$("memoInput").value.trim(),checkedPoints:$$("#pointChecklist input").map(x=>x.checked),completedAt:nowIso()};await put(STORE_ATTEMPTS,attempt);await loadData();toast("풀이 기록 저장 완료");return attempt}async function saveAndNext(){await saveAttempt();if(!state.solve)return;if(state.solve.index>=state.solve.ids.length-1){finishSolve(true);return}state.solve.index++;state.solve.answer="";state.solve.elapsedBase=0;state.solve.startedProblemAt=Date.now();$("scoreOverlay").classList.add("hidden");openCurrentProblem()}function finishSolve(clearDraft=true){clearInterval(state.timer);state.timer=null;state.solve=null;$("solveOverlay").classList.add("hidden");$("scoreOverlay").classList.add("hidden");if(clearDraft)localStorage.removeItem("essayPsatBaseDraft");renderAll()}function fitImage(){state.zoom=1;applyZoom();setTimeout(()=>{const img=$("questionImageView"),scroller=$("questionImageScroller");if(!img.naturalWidth||!scroller.clientWidth)return;state.zoom=Math.max(.2,Math.min(1,(scroller.clientWidth-20)/img.naturalWidth));applyZoom()},30)}function applyZoom(){$("questionImageView").style.width=`${Math.round(state.zoom*100)}%`}async function exportBackup(){const payload={app:APP_VERSION,exportedAt:nowIso(),problems:state.problems,attempts:state.attempts};const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`essay_psat_base_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}async function importBackup(file){if(!file)return;const data=JSON.parse(await file.text());if(!Array.isArray(data.problems)){toast("백업 파일이 아니야");return}if(!confirm("백업 데이터를 현재 앱에 합쳐서 불러올까? 같은 ID는 덮어쓰기 돼."))return;for(const p of data.problems)await put(STORE_PROBLEMS,p);for(const a of data.attempts||[])await put(STORE_ATTEMPTS,a);await loadData();renderAll();toast("복원 완료")}async function wipeAll(){if(!confirm("모든 문제와 기록을 삭제할까? 백업 없으면 복구 불가."))return;await clearStore(STORE_PROBLEMS);await clearStore(STORE_ATTEMPTS);localStorage.removeItem("essayPsatBaseDraft");await loadData();resetForm();renderAll();toast("전체 삭제 완료")}function setupInstall(){window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();state.installPrompt=event;$("installBtn").classList.remove("hidden")});$("installBtn").addEventListener("click",async()=>{if(!state.installPrompt){toast("Chrome 메뉴에서 홈화면 추가를 눌러줘");return}state.installPrompt.prompt();await state.installPrompt.userChoice.catch(()=>null);state.installPrompt=null;$("installBtn").classList.add("hidden")})}function setupEvents(){setupInstall();$$(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));["solveSubject","solveSession","solveMode","randomCount","listSubject","listSession","listSearch","reviewSubject","reviewSession","reviewType"].forEach(id=>{$(id).addEventListener("input",renderAll);$(id).addEventListener("change",renderAll)});setupPasteZone("questionPasteZone","questionFileInput","question");setupPasteZone("explanationPasteZone","explanationFileInput","explanation");document.addEventListener("paste",event=>pasteImageFromClipboardEvent(event));$("pasteQuestionBtn").addEventListener("click",()=>pasteImageWithClipboardApi("question"));$("pasteExplanationBtn").addEventListener("click",()=>pasteImageWithClipboardApi("explanation"));$("addQuestionFileBtn").addEventListener("click",()=>addBlankPage("question"));$("addExplanationFileBtn").addEventListener("click",()=>addBlankPage("explanation"));$("clearQuestionBtn").addEventListener("click",()=>{state.questionPages=[];renderPageLists()});$("clearExplanationBtn").addEventListener("click",()=>{state.explanationPages=[];renderPageLists()});$("problemForm").addEventListener("submit",saveProblem);$("resetBtn").addEventListener("click",resetForm);$("randomStartBtn").addEventListener("click",()=>startRandom(false));$("reviewRandomStartBtn").addEventListener("click",()=>startRandom(true));$("continueBtn").addEventListener("click",continueSolve);$("answerText").addEventListener("input",saveDraft);$("exitSolveBtn").addEventListener("click",pauseSolve);$("submitAnswerBtn").addEventListener("click",submitAnswer);$("prevQuestionPageBtn").addEventListener("click",()=>showQuestionPage(state.qPage-1));$("nextQuestionPageBtn").addEventListener("click",()=>showQuestionPage(state.qPage+1));$("fitBtn").addEventListener("click",fitImage);$("zoomInBtn").addEventListener("click",()=>{state.zoom=Math.min(3,state.zoom+.15);applyZoom()});$("zoomOutBtn").addEventListener("click",()=>{state.zoom=Math.max(.2,state.zoom-.15);applyZoom()});$("questionImageView").addEventListener("load",fitImage);$("backToAnswerBtn").addEventListener("click",()=>{$("scoreOverlay").classList.add("hidden");if(state.solve){state.solve.startedProblemAt=Date.now();clearInterval(state.timer);state.timer=setInterval(updateTimer,500);$("solveOverlay").classList.remove("hidden")}});$("prevExplanationPageBtn").addEventListener("click",()=>showExplanationPage(state.expPage-1));$("nextExplanationPageBtn").addEventListener("click",()=>showExplanationPage(state.expPage+1));$("saveAttemptBtn").addEventListener("click",saveAttempt);$("saveAndNextBtn").addEventListener("click",saveAndNext);$("finishBtn").addEventListener("click",async()=>{await saveAttempt();finishSolve(true)});$("exportBtn").addEventListener("click",exportBackup);$("importInput").addEventListener("change",async()=>{try{await importBackup($("importInput").files[0])}catch(e){console.error(e);toast("복원 실패")}$("importInput").value=""});$("wipeBtn").addEventListener("click",wipeAll)}async function init(){db=await openDB();await loadData();await normalizeStoredProblems();setupEvents();resetForm();renderAll();if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js?v=18").catch(()=>{})}init().catch(err=>{console.error(err);alert(`앱 초기화 실패: ${err.message}`)});

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
