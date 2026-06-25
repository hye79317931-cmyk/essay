const APP_VERSION="essay-psat-base-v7";const DB_NAME="essayPsatBaseDB_v1";const DB_VERSION=1;const STORE_PROBLEMS="problems";const STORE_ATTEMPTS="attempts";const $=id=>document.getElementById(id);const $$=sel=>Array.from(document.querySelectorAll(sel));let db;const state={problems:[],attempts:[],questionPages:[],explanationPages:[],selectedQuestionPage:-1,selectedExplanationPage:-1,activePasteTarget:"question",solve:null,timer:null,qPage:0,expPage:0,zoom:1,installPrompt:null};function uuid(){return crypto.randomUUID&&crypto.randomUUID()||`id_${Date.now()}_${Math.random().toString(16).slice(2)}`}function nowIso(){return new Date().toISOString()}function toast(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add("hidden"),2300)}function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function fmtTime(ms){ms=Math.max(0,Math.floor(ms||0));const sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}function pointsFromText(text){return String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean)}function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE_PROBLEMS))d.createObjectStore(STORE_PROBLEMS,{keyPath:"id"});if(!d.objectStoreNames.contains(STORE_ATTEMPTS))d.createObjectStore(STORE_ATTEMPTS,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name)}function getAll(name){return new Promise((resolve,reject)=>{const req=store(name).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}function put(name,value){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error)})}function del(name,key){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}function clearStore(name){return new Promise((resolve,reject)=>{const req=store(name,"readwrite").clear();req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}async function loadData(){state.problems=(await getAll(STORE_PROBLEMS)).sort((a,b)=>(a.order||0)-(b.order||0));state.attempts=(await getAll(STORE_ATTEMPTS)).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))}function setPasteTarget(target){state.activePasteTarget=target;$("questionPasteZone")?.classList.toggle("active-paste",target==="question");$("explanationPasteZone")?.classList.toggle("active-paste",target==="explanation")}function dataUrlBytes(dataUrl){const comma=dataUrl.indexOf(",");const base64=comma>=0?dataUrl.slice(comma+1):dataUrl;return Math.round(base64.length*.75)}function formatBytes(bytes){if(!bytes)return"0B";const u=["B","KB","MB"];let v=bytes,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return`${v.toFixed(i?1:0)}${u[i]}`}function imageBlobToDataUrl(blob){return new Promise((resolve,reject)=>{const mode=$("qualityInput").value||"sharp";if(mode==="original"){const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const maxDim=mode==="bulk"?1500:2400,scale=Math.min(1,maxDim/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL("image/jpeg",mode==="bulk"?.72:.88))};img.onerror=reject;img.src=reader.result};reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}async function addImageFiles(files,target){const arr=Array.from(files||[]).filter(file=>file&&file.type&&file.type.startsWith("image/"));if(!arr.length){toast("이미지 파일이 없어");return}let added=0,size=0;for(const file of arr){const data=await imageBlobToDataUrl(file);if(target==="explanation")state.explanationPages.push(data);else state.questionPages.push(data);size+=dataUrlBytes(data);added++}renderPageLists();setPasteTarget(target);toast(`${target==="explanation"?"해설":"문제"} 이미지 ${added}장 추가 · ${formatBytes(size)}`)}async function pasteImageFromClipboardEvent(event,explicitTarget=""){const items=event.clipboardData?.items?Array.from(event.clipboardData.items):[];const files=items.filter(entry=>entry.type&&entry.type.startsWith("image/")).map(entry=>entry.getAsFile()).filter(Boolean);if(!files.length)return false;event.preventDefault();const target=explicitTarget||event.target.closest?.("[data-paste-target]")?.dataset?.pasteTarget||state.activePasteTarget||"question";toast("스크린샷 처리 중...");await addImageFiles(files,target);return true}async function pasteImageWithClipboardApi(target){setPasteTarget(target);if(!navigator.clipboard||!navigator.clipboard.read){toast("이 브라우저는 버튼 붙여넣기를 지원하지 않아. 영역 클릭 후 Ctrl+V를 눌러줘.");return}try{const items=await navigator.clipboard.read();const files=[];for(const item of items){const type=item.types.find(t=>t.startsWith("image/"));if(!type)continue;const blob=await item.getType(type);files.push(new File([blob],`${target}_${Date.now()}_${files.length}.png`,{type}))}if(!files.length){toast("클립보드에 이미지가 없어");return}toast("스크린샷 처리 중...");await addImageFiles(files,target)}catch(err){console.warn(err);toast("붙여넣기 권한이 막혔어. 영역 클릭 후 Ctrl+V를 눌러줘.")}}function setupPasteZone(zoneId,inputId,target){const zone=$(zoneId),input=$(inputId);zone.addEventListener("click",()=>{setPasteTarget(target);zone.focus()});zone.addEventListener("focus",()=>setPasteTarget(target));zone.addEventListener("paste",event=>pasteImageFromClipboardEvent(event,target));input.addEventListener("change",async()=>{await addImageFiles(input.files,target);input.value=""})}function makeButton(text,fn,cls=""){const b=document.createElement("button");b.type="button";b.textContent=text;if(cls)b.className=cls;b.addEventListener("click",fn);return b}function movePage(target,index,dir){const arr=target==="explanation"?state.explanationPages:state.questionPages,next=index+dir;if(next<0||next>=arr.length)return;[arr[index],arr[next]]=[arr[next],arr[index]];renderPageLists()}function deletePage(target,index){const arr=target==="explanation"?state.explanationPages:state.questionPages;arr.splice(index,1);renderPageLists()}function renderPageList(id,arr,target){const box=$(id);box.innerHTML="";if(!arr.length){box.innerHTML='<p class="hint">아직 이미지가 없어.</p>';return}arr.forEach((src,index)=>{const div=document.createElement("div");div.className="page-item";div.innerHTML=`<img src="${src}" alt="${index+1}쪽" /><div><strong>${index+1}쪽</strong><p class="hint">${target==="explanation"?"해설":"문제"} 페이지</p><div class="page-actions"></div></div>`;const actions=div.querySelector(".page-actions");actions.append(makeButton("위",()=>movePage(target,index,-1),"secondary small"));actions.append(makeButton("아래",()=>movePage(target,index,1),"secondary small"));actions.append(makeButton("삭제",()=>deletePage(target,index),"danger small"));box.append(div)})}function renderPageLists(){renderPageList("questionPageList",state.questionPages,"question");renderPageList("explanationPageList",state.explanationPages,"explanation")}function titleOf(p){return p.title||`${p.session?p.session+" ":""}${p.subject||""} 문제`}function attemptsOf(id){return state.attempts.filter(a=>a.problemId===id)}function lastAttempt(id){return attemptsOf(id).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))[0]}function metaOf(p){const last=lastAttempt(p.id);return`${p.subject||"-"} · ${p.session||"회차 없음"} · 문제 ${realPages(p.questionPages||[]).length}쪽 · 해설 ${realPages(p.explanationPages||[]).length}쪽 · ${p.maxScore||0}점 · 제한 ${p.timeLimit||0}분 · 기록 ${attemptsOf(p.id).length}회${last?" · 최근 "+fmtTime(last.elapsedMs):""}`}function filterProblems({subject="",session="",search=""}={}){const s=session.trim().toLowerCase(),q=search.trim().toLowerCase();return state.problems.filter(p=>{if(subject&&p.subject!==subject)return false;if(s&&!String(p.session||"").toLowerCase().includes(s))return false;if(q){const blob=[p.title,p.session,p.subject,p.pointsText,p.modelText].join(" ").toLowerCase();if(!blob.includes(q))return false}return true})}function showView(id){$$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));$$(".view").forEach(v=>v.classList.toggle("active",v.id===id));renderAll()}function problemCard(p,opts={}){const last=lastAttempt(p.id),div=document.createElement("div");div.className="problem-card";div.innerHTML=`<h3>${esc(titleOf(p))}</h3><p class="meta">${esc(metaOf(p))}</p><div class="badges"><span class="badge">${esc(p.subject||"-")}</span><span class="badge">${esc(p.session||"회차 없음")}</span><span class="badge">문제 ${realPages(p.questionPages||[]).length}쪽</span><span class="badge">해설 ${realPages(p.explanationPages||[]).length}쪽</span>${last?`<span class="badge">최근점수 ${last.score??"-"}</span>`:""}</div><div class="card-actions"></div>`;const actions=div.querySelector(".card-actions");if(opts.solve)actions.append(makeButton("풀기",()=>startSolve([p.id],$("solveMode").value||"outline")));if(opts.review)actions.append(makeButton("다시 풀기",()=>startSolve([p.id],"outline")));if(opts.list){actions.append(makeButton("수정",()=>fillForm(p),"secondary"));actions.append(makeButton("복제",async()=>{const copy={...p,id:uuid(),title:`${titleOf(p)} 복사본`,createdAt:nowIso(),updatedAt:nowIso(),order:Date.now()};await put(STORE_PROBLEMS,copy);await loadData();renderAll();toast("복제 완료")},"secondary"));actions.append(makeButton("삭제",async()=>{if(!confirm("이 문제와 풀이기록을 삭제할까?"))return;await del(STORE_PROBLEMS,p.id);for(const a of attemptsOf(p.id))await del(STORE_ATTEMPTS,a.id);await loadData();renderAll();toast("삭제 완료")},"danger small"))}return div}function renderSolveList(){const list=$("solveList"),arr=filterProblems({subject:$("solveSubject").value,session:$("solveSession").value});list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">조건에 맞는 문제가 없어.</p>';return}arr.forEach(p=>list.append(problemCard(p,{solve:true})))}function renderList(){const list=$("problemList"),arr=filterProblems({subject:$("listSubject").value,session:$("listSession").value,search:$("listSearch").value});list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">등록된 문제가 없어.</p>';return}arr.forEach((p,i)=>{const card=problemCard(p,{list:true});card.querySelector("h3").textContent=`${i+1}. ${titleOf(p)}`;list.append(card)})}function renderReview(){const list=$("reviewList");let arr=filterProblems({subject:$("reviewSubject").value,session:$("reviewSession").value});if($("reviewType").value==="needed")arr=arr.filter(p=>String(lastAttempt(p.id)?.needReview)==="true");else arr=arr.filter(p=>attemptsOf(p.id).length);list.innerHTML="";if(!arr.length){list.innerHTML='<p class="hint">복습 대상이 없어.</p>';return}arr.forEach(p=>list.append(problemCard(p,{review:true})))}function renderStats(){const done=new Set(state.attempts.map(a=>a.problemId)).size,review=state.problems.filter(p=>String(lastAttempt(p.id)?.needReview)==="true").length;$("statsGrid").innerHTML=`<div class="stat-card">등록 문제<strong>${state.problems.length}</strong></div><div class="stat-card">풀이 완료<strong>${done}</strong></div><div class="stat-card">풀이 기록<strong>${state.attempts.length}</strong></div><div class="stat-card">복습 필요<strong>${review}</strong></div>`}function renderContinue(){$("continueBtn").classList.toggle("hidden",!localStorage.getItem("essayPsatBaseDraft"))}function renderAll(){renderSolveList();renderList();renderReview();renderStats();renderContinue();renderPageLists()}async function saveProblem(event){event.preventDefault();const id=$("editId").value||uuid(),existing=state.problems.find(p=>p.id===id);if(!realPages(state.questionPages).length){toast("문제 이미지를 최소 1쪽 넣어줘");return}const problem={id,subject:$("subjectInput").value,session:$("sessionInput").value.trim(),title:$("titleInput").value.trim(),maxScore:Number($("scoreInput").value||0),timeLimit:Number($("timeInput").value||0),questionPages:realPages(state.questionPages),explanationPages:realPages(state.explanationPages),pointsText:$("pointsInput").value.trim(),points:pointsFromText($("pointsInput").value),modelText:$("modelTextInput").value.trim(),order:existing?.order??Date.now(),createdAt:existing?.createdAt||nowIso(),updatedAt:nowIso()};await put(STORE_PROBLEMS,problem);await loadData();toast($("editId").value?"수정 저장 완료":"저장 완료");resetForm();renderAll()}function fillForm(p){$("formTitle").textContent="문제 수정";$("editId").value=p.id;$("subjectInput").value=p.subject||"형법";$("sessionInput").value=p.session||"";$("titleInput").value=p.title||"";$("scoreInput").value=p.maxScore||20;$("timeInput").value=p.timeLimit||30;$("pointsInput").value=p.pointsText||(p.points||[]).join("\n");$("modelTextInput").value=p.modelText||"";state.questionPages=[...(p.questionPages||[])];state.explanationPages=[...(p.explanationPages||[])];renderPageLists();showView("addView");window.scrollTo(0,0)}function resetForm(){$("formTitle").textContent="문제 등록";$("problemForm").reset();$("editId").value="";$("scoreInput").value=20;$("timeInput").value=30;$("qualityInput").value="sharp";state.questionPages=[];state.explanationPages=[];setPasteTarget("question");renderPageLists()}function chooseRandom(arr,n){return[...arr].sort(()=>Math.random()-.5).slice(0,Math.min(n,arr.length))}function startRandom(reviewOnly=false){let arr=filterProblems({subject:$("solveSubject").value,session:$("solveSession").value});if(reviewOnly)arr=arr.filter(p=>String(lastAttempt(p.id)?.needReview)==="true");if(!arr.length){toast(reviewOnly?"복습필요 문제가 없어":"조건에 맞는 문제가 없어");return}const picks=chooseRandom(arr,Number($("randomCount").value||1));startSolve(picks.map(p=>p.id),$("solveMode").value||"outline")}function currentProblem(){return state.problems.find(p=>p.id===state.solve?.ids[state.solve.index])}function startSolve(ids,mode){state.solve={ids,index:0,mode,startedAt:Date.now(),startedProblemAt:Date.now(),elapsedBase:0,answer:""};state.qPage=0;localStorage.setItem("essayPsatBaseDraft",JSON.stringify(state.solve));openCurrentProblem()}function openCurrentProblem(){const p=currentProblem();if(!p){finishSolve(false);return}state.qPage=0;$("solveOverlay").classList.remove("hidden");$("solveTitle").textContent=titleOf(p);$("solveMeta").textContent=metaOf(p);$("setBadge").textContent=`${state.solve.index+1}/${state.solve.ids.length} · ${state.solve.mode==="outline"?"목차연습":"실전답안"}`;$("answerLabel").textContent=state.solve.mode==="outline"?"내 목차/쟁점":"내 답안";$("answerText").value=state.solve.answer||"";showQuestionPage(0);clearInterval(state.timer);state.timer=setInterval(updateTimer,500);updateTimer()}function showQuestionPage(index){const p=currentProblem(),pages=realPages(p?.questionPages||[]);state.qPage=Math.max(0,Math.min(index,pages.length-1));$("questionImageView").src=pages[state.qPage]||"";$("questionPageBadge").textContent=pages.length?`문제 ${state.qPage+1}/${pages.length}쪽`:"문제 없음";fitImage();saveDraft()}function elapsedNow(){return state.solve?(state.solve.elapsedBase||0)+Date.now()-state.solve.startedProblemAt:0}function updateTimer(){const p=currentProblem(),elapsed=elapsedNow();$("timerText").textContent=fmtTime(elapsed);const limit=Number(p?.timeLimit||0)*6e4;$("limitText").textContent=limit?elapsed<=limit?`남은 ${fmtTime(limit-elapsed)}`:`초과 ${fmtTime(elapsed-limit)}`:""}function saveDraft(){if(!state.solve)return;state.solve.answer=$("answerText")?.value??state.solve.answer;localStorage.setItem("essayPsatBaseDraft",JSON.stringify(state.solve));renderContinue()}function pauseSolve(){if(!state.solve)return;state.solve.elapsedBase=elapsedNow();state.solve.answer=$("answerText").value;clearInterval(state.timer);state.timer=null;saveDraft();$("solveOverlay").classList.add("hidden");toast("이어풀기 저장 완료")}function continueSolve(){try{const saved=JSON.parse(localStorage.getItem("essayPsatBaseDraft")||"null");if(!saved||!saved.ids?.length){toast("이어풀 문제가 없어");return}state.solve=saved;state.solve.startedProblemAt=Date.now();openCurrentProblem()}catch{toast("이어풀 문제가 없어")}}function submitAnswer(){if(!state.solve)return;state.solve.elapsedBase=elapsedNow();state.solve.answer=$("answerText").value;clearInterval(state.timer);state.timer=null;openScore()}function openScore(){const p=currentProblem();if(!p)return;state.expPage=0;$("scoreOverlay").classList.remove("hidden");$("scoreMeta").textContent=`${titleOf(p)} · 풀이시간 ${fmtTime(state.solve.elapsedBase)}`;$("ownAnswerView").textContent=state.solve.answer||"(작성한 답안 없음)";$("modelTextView").textContent=p.modelText||"";$("attemptScoreInput").value="";$("attemptScoreInput").max=p.maxScore||"";$("completionInput").value=state.solve.mode==="outline"?"목차만":"완성";$("needReviewInput").value="true";renderChecklist(p);showExplanationPage(0)}function showExplanationPage(index){const p=currentProblem(),pages=realPages(p?.explanationPages||[]);state.expPage=Math.max(0,Math.min(index,pages.length-1));if(pages.length){$("explanationImageView").src=pages[state.expPage];$("explanationImageView").classList.remove("hidden");$("explanationPageBadge").textContent=`해설 ${state.expPage+1}/${pages.length}쪽`}else{$("explanationImageView").classList.add("hidden");$("explanationPageBadge").textContent="해설 이미지 없음"}}function renderChecklist(p){const box=$("pointChecklist"),points=p.points?.length?p.points:pointsFromText(p.pointsText);box.innerHTML="";if(!points.length){box.innerHTML='<p class="hint">채점포인트 없음</p>';return}points.forEach((point,i)=>{const row=document.createElement("label");row.className="check-item";row.innerHTML=`<input type="checkbox" data-point="${i}" /> <span>${esc(point)}</span>`;box.append(row)})}async function saveAttempt(){const p=currentProblem();if(!p||!state.solve)return null;const attempt={id:uuid(),problemId:p.id,subject:p.subject,session:p.session,mode:state.solve.mode,answer:state.solve.answer||"",elapsedMs:state.solve.elapsedBase,score:$("attemptScoreInput").value===""?null:Number($("attemptScoreInput").value),maxScore:p.maxScore||0,difficulty:$("difficultyResultInput").value,needReview:$("needReviewInput").value,completion:$("completionInput").value,memo:$("memoInput").value.trim(),checkedPoints:$$("#pointChecklist input").map(x=>x.checked),completedAt:nowIso()};await put(STORE_ATTEMPTS,attempt);await loadData();toast("풀이 기록 저장 완료");return attempt}async function saveAndNext(){await saveAttempt();if(!state.solve)return;if(state.solve.index>=state.solve.ids.length-1){finishSolve(true);return}state.solve.index++;state.solve.answer="";state.solve.elapsedBase=0;state.solve.startedProblemAt=Date.now();$("scoreOverlay").classList.add("hidden");openCurrentProblem()}function finishSolve(clearDraft=true){clearInterval(state.timer);state.timer=null;state.solve=null;$("solveOverlay").classList.add("hidden");$("scoreOverlay").classList.add("hidden");if(clearDraft)localStorage.removeItem("essayPsatBaseDraft");renderAll()}function fitImage(){state.zoom=1;applyZoom();setTimeout(()=>{const img=$("questionImageView"),scroller=$("questionImageScroller");if(!img.naturalWidth||!scroller.clientWidth)return;state.zoom=Math.max(.2,Math.min(1,(scroller.clientWidth-20)/img.naturalWidth));applyZoom()},30)}function applyZoom(){$("questionImageView").style.width=`${Math.round(state.zoom*100)}%`}async function exportBackup(){const payload={app:APP_VERSION,exportedAt:nowIso(),problems:state.problems,attempts:state.attempts};const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`essay_psat_base_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}async function importBackup(file){if(!file)return;const data=JSON.parse(await file.text());if(!Array.isArray(data.problems)){toast("백업 파일이 아니야");return}if(!confirm("백업 데이터를 현재 앱에 합쳐서 불러올까? 같은 ID는 덮어쓰기 돼."))return;for(const p of data.problems)await put(STORE_PROBLEMS,p);for(const a of data.attempts||[])await put(STORE_ATTEMPTS,a);await loadData();renderAll();toast("복원 완료")}async function wipeAll(){if(!confirm("모든 문제와 기록을 삭제할까? 백업 없으면 복구 불가."))return;await clearStore(STORE_PROBLEMS);await clearStore(STORE_ATTEMPTS);localStorage.removeItem("essayPsatBaseDraft");await loadData();resetForm();renderAll();toast("전체 삭제 완료")}function setupInstall(){window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();state.installPrompt=event;$("installBtn").classList.remove("hidden")});$("installBtn").addEventListener("click",async()=>{if(!state.installPrompt){toast("Chrome 메뉴에서 홈화면 추가를 눌러줘");return}state.installPrompt.prompt();await state.installPrompt.userChoice.catch(()=>null);state.installPrompt=null;$("installBtn").classList.add("hidden")})}function setupEvents(){setupInstall();$$(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));["solveSubject","solveSession","solveMode","randomCount","listSubject","listSession","listSearch","reviewSubject","reviewSession","reviewType"].forEach(id=>{$(id).addEventListener("input",renderAll);$(id).addEventListener("change",renderAll)});setupPasteZone("questionPasteZone","questionFileInput","question");setupPasteZone("explanationPasteZone","explanationFileInput","explanation");document.addEventListener("paste",event=>pasteImageFromClipboardEvent(event));$("pasteQuestionBtn").addEventListener("click",()=>pasteImageWithClipboardApi("question"));$("pasteExplanationBtn").addEventListener("click",()=>pasteImageWithClipboardApi("explanation"));$("addQuestionFileBtn").addEventListener("click",()=>addBlankPage("question"));$("addExplanationFileBtn").addEventListener("click",()=>addBlankPage("explanation"));$("clearQuestionBtn").addEventListener("click",()=>{state.questionPages=[];renderPageLists()});$("clearExplanationBtn").addEventListener("click",()=>{state.explanationPages=[];renderPageLists()});$("problemForm").addEventListener("submit",saveProblem);$("resetBtn").addEventListener("click",resetForm);$("randomStartBtn").addEventListener("click",()=>startRandom(false));$("reviewRandomStartBtn").addEventListener("click",()=>startRandom(true));$("continueBtn").addEventListener("click",continueSolve);$("answerText").addEventListener("input",saveDraft);$("exitSolveBtn").addEventListener("click",pauseSolve);$("submitAnswerBtn").addEventListener("click",submitAnswer);$("prevQuestionPageBtn").addEventListener("click",()=>showQuestionPage(state.qPage-1));$("nextQuestionPageBtn").addEventListener("click",()=>showQuestionPage(state.qPage+1));$("fitBtn").addEventListener("click",fitImage);$("zoomInBtn").addEventListener("click",()=>{state.zoom=Math.min(3,state.zoom+.15);applyZoom()});$("zoomOutBtn").addEventListener("click",()=>{state.zoom=Math.max(.2,state.zoom-.15);applyZoom()});$("questionImageView").addEventListener("load",fitImage);$("backToAnswerBtn").addEventListener("click",()=>{$("scoreOverlay").classList.add("hidden");if(state.solve){state.solve.startedProblemAt=Date.now();clearInterval(state.timer);state.timer=setInterval(updateTimer,500);$("solveOverlay").classList.remove("hidden")}});$("prevExplanationPageBtn").addEventListener("click",()=>showExplanationPage(state.expPage-1));$("nextExplanationPageBtn").addEventListener("click",()=>showExplanationPage(state.expPage+1));$("saveAttemptBtn").addEventListener("click",saveAttempt);$("saveAndNextBtn").addEventListener("click",saveAndNext);$("finishBtn").addEventListener("click",async()=>{await saveAttempt();finishSolve(true)});$("exportBtn").addEventListener("click",exportBackup);$("importInput").addEventListener("change",async()=>{try{await importBackup($("importInput").files[0])}catch(e){console.error(e);toast("복원 실패")}$("importInput").value=""});$("wipeBtn").addEventListener("click",wipeAll)}async function init(){db=await openDB();await loadData();await normalizeStoredProblems();setupEvents();resetForm();renderAll();if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js?v=7").catch(()=>{})}init().catch(err=>{console.error(err);alert(`앱 초기화 실패: ${err.message}`)});

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
