const SUPABASE_URL=window.PRIMO_SUPABASE_CONFIG?.url;
const SUPABASE_KEY=window.PRIMO_SUPABASE_CONFIG?.anonKey;
const APP_ID=window.PRIMO_SUPABASE_CONFIG?.appId||"primo_soccer_2026_kids";
const MONTHS=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const CATEGORIES=[["Futbaby 2-3 Anos","futbaby23"],["Futbaby 4-5 Anos","futbaby45"],["Sub 6-7-8 anos","sub678"],["Sub 8-9-10 anos","sub8910"],["Meninas","meninas"],["Sub 11-12-13-14 anos","sub1114"]];
const SCHEDULES={"Futbaby 2-3 Anos":["Segunda 11:00 • Futbaby 2-3 anos","Quinta 17:30 • Futbaby 2-3 anos (Capi)","Sexta 17:30 • Futbaby 2-3 anos (Capi)","Sábado 09:30 • Futbaby 2-3 anos (Capi)","Sábado 11:30 • Futbaby 2-3 anos (Capi)"],"Futbaby 4-5 Anos":["Segunda 10:00 • Futbaby 4-5 anos","Terça 10:00 • Futbaby 4-5 anos","Quarta 10:00 • Futbaby 4-5 anos","Quarta 17:30 • Futbaby 4-5 anos","Sexta 09:15 • Futbaby 4-5 anos","Sábado 10:30 • Futbaby 4-5 anos (Capi)"],"Sub 6-7-8 anos":["Terça 10:45 • Sub 6-7-8 anos","Quinta 10:45 • Sub 6-7-8","Sexta 19:10 • Sub 6-7-8 (Capi)"],"Sub 8-9-10 anos":["Segunda 09:15 • Sub 8-9-10 anos","Quarta 09:15 • Sub 8-9-10 anos","Sexta 18:15 • Sub 8-9-10 (Capi)"],"Meninas":["Quarta 10:45 • Meninas"],"Sub 11-12-13-14 anos":["Terça 15:30 • Sub 11-12-13 anos","Quarta 15:30 • Sub 11-12-13-14"]};
const STORAGE_KEY="primo_soccer_2026_kids_state_v3",MONTH_KEY="primo_soccer_2026_kids_month_v3";
let currentMonth=localStorage.getItem(MONTH_KEY)||"MAIO",state=loadLocal(),sb=null,saveTimer=null,activeCategory=CATEGORIES[0][0];
function defaultState(){return{students:[],months:{},currentMonth,schemaVersion:3}}
function loadLocal(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||defaultState()}catch(e){return defaultState()}}
function norm(){if(!state||typeof state!=="object")state=defaultState();if(!Array.isArray(state.students))state.students=[];if(!state.months)state.months={};state.currentMonth=currentMonth;if(!state.months[currentMonth])state.months[currentMonth]={participants:{}}}
function saveLocal(){norm();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(MONTH_KEY,currentMonth)}
function uid(){return"KID-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase()}
function esc(t){return String(t??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function ageFromBirth(b){if(!b)return"";const d=new Date(b+"T00:00:00"),now=new Date();let a=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))a--;return a}
function initials(n){return String(n||"A").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"A"}
function studentById(id){return state.students.find(s=>s.id===id)}
function monthObj(m=currentMonth){norm();if(!state.months[m])state.months[m]={participants:{}};return state.months[m]}
function participant(id,create=true,m=currentMonth){const mo=monthObj(m);if(!mo.participants[id]&&create)mo.participants[id]={studentId:id,schedules:[],weeks:Array.from({length:5},()=>({}))};return mo.participants[id]||null}
function emptyScore(){return{pd:0,pe:0,uniforme:0,fruta:0,comportamento:0}}
function getScore(id,w,sch){const p=participant(id);if(!p.weeks[w])p.weeks[w]={};if(!p.weeks[w][sch])p.weeks[w][sch]=emptyScore();return p.weeks[w][sch]}
function scoreTotal(sc){return(+sc.pd||0)+(+sc.pe||0)+(+sc.uniforme||0)+(+sc.fruta||0)+(+sc.comportamento||0)}
function totalStudent(id,m=currentMonth){const p=monthObj(m).participants[id];if(!p)return 0;return(p.weeks||[]).reduce((a,w)=>a+Object.values(w||{}).reduce((b,sc)=>b+scoreTotal(sc),0),0)}
function activeStudents(m=currentMonth){const ids=new Set(Object.entries(monthObj(m).participants||{}).filter(([id,p])=>p.schedules&&p.schedules.length).map(([id])=>id));return state.students.filter(s=>s.active!==false&&ids.has(s.id))}
function activeByCategory(cat=activeCategory){return activeStudents().filter(s=>s.category===cat)}
function ranked(cat=null){return activeStudents().filter(s=>!cat||s.category===cat).map(s=>({...s,total:totalStudent(s.id)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function avatarHtml(s){
  return s.photo
    ? `<span class="avatar"><img src="${s.photo}" onclick="openPhoto('${s.photo}')"></span>`
    : `<span class="avatar">${initials(s.name)}</span>`;
}
function photoPickerHtml(s){
  return `<label class="avatarInputLabel">
    ${s.photo?`<img src="${s.photo}" onclick="event.preventDefault(); openPhoto('${s.photo}')">`:initials(s.name)}
    <input class="photoInput" type="file" accept="image/*" onchange="loadPhoto(event,'${s.id}')">
  </label>`;
}
function loadPhoto(e,id){const file=e.target.files&&e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height,max=420;if(w>h&&w>max){h=Math.round(h*max/w);w=max}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max}const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);const s=studentById(id);if(s){s.photo=c.toDataURL("image/jpeg",.82);scheduleSave();renderAll()}};img.src=r.result};r.readAsDataURL(file)}
function setSync(msg,type="warn"){const el=document.getElementById("syncStatus");el.textContent=msg;el.style.color=type==="ok"?"#8ff0b3":type==="error"?"#ff8b8b":"#ffe082"}
function scheduleSave(){saveLocal();clearTimeout(saveTimer);saveTimer=setTimeout(saveCloud,700)}
function setCategory(cat){activeCategory=cat;renderAll()}
function openCategory(cat){activeCategory=cat;showPage("disputa")}
function showPage(page){
  ["dashboard","cadastro","agenda","disputa","ranking","imprimir","config","pais"].forEach(p=>{
    const pg = document.getElementById("page-"+p);
    const tb = document.getElementById("tab-"+p);
    if(pg) pg.classList.toggle("hidden",p!==page);
    if(tb) tb.classList.toggle("active",p===page);
  });
  renderAll();
}
function renderAll(){
  norm();
  renderMonth();
  renderSelectors();
  renderDashboard();
  renderStudents();
  renderAgenda();
  renderScore();
  renderRankings();
  renderPrintSelect();
  if(typeof applyDashboardCover==="function") applyDashboardCover();
}
function renderMonth(){const sel=document.getElementById("monthSelect");if(!sel.dataset.ready){sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");sel.dataset.ready="1";sel.onchange=()=>{currentMonth=sel.value;if(!state.months[currentMonth])state.months[currentMonth]={participants:{}};scheduleSave();renderAll()}}sel.value=currentMonth;document.getElementById("heroMonth").textContent=currentMonth}

const MULTI_SCHEDULE_CATEGORIES = ["Futbaby 4-5 Anos","Sub 6-7-8 anos","Sub 8-9-10 anos","Sub 11-12-13-14 anos"];
function canHaveTwoSchedules(cat){return MULTI_SCHEDULE_CATEGORIES.includes(cat)}
function annualTotalStudent(id){return MONTHS.reduce((sum,m)=>sum+totalStudent(id,m),0)}
function rankedAnnual(cat=null){return state.students.filter(s=>s.active!==false&&(!cat||s.category===cat)).map(s=>({...s,total:annualTotalStudent(s.id)})).filter(s=>s.total>0).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function studentOptionLabel(s){const p=participant(s.id,false);const count=p?.schedules?.length||0;const icon=count>=2?"🔥":count===1?"✅":"⚽";return `${icon} ${s.name} • ${s.category}`}
function restoreSelectValue(id,value){const el=document.getElementById(id);if(el&&value&&[...el.options].some(o=>o.value===value))el.value=value}

function renderSelectors(){
  const currentStudent=document.getElementById("studentPicker")?.value||"";
  const currentSchedule=document.getElementById("schedulePicker")?.value||"";
  const currentScoreSchedule=document.getElementById("scoreSchedule")?.value||"";
  const currentWeek=document.getElementById("scoreWeek")?.value||"";
  document.getElementById("studentCategory").innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");
  ["agendaCategory","disputeCategory"].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");el.value=activeCategory});
  const sp=document.getElementById("studentPicker");
  if(sp){sp.innerHTML=state.students.filter(s=>s.active!==false&&s.category===activeCategory).map(s=>`<option value="${s.id}">${esc(studentOptionLabel(s))}</option>`).join("")||`<option value="">Cadastre alunos nesta categoria</option>`;restoreSelectValue("studentPicker",currentStudent)}
  const sch=SCHEDULES[activeCategory]||[];
  const ap=document.getElementById("schedulePicker");if(ap){ap.innerHTML=sch.map(s=>`<option value="${s}">${s}</option>`).join("");restoreSelectValue("schedulePicker",currentSchedule)}
  const ss=document.getElementById("scoreSchedule");if(ss){ss.innerHTML=sch.map(s=>`<option value="${s}">${s}</option>`).join("");restoreSelectValue("scoreSchedule",currentScoreSchedule)}
  const sw=document.getElementById("scoreWeek");if(sw){sw.innerHTML=[0,1,2,3,4].map(i=>`<option value="${i}">Semana ${i+1}</option>`).join("");restoreSelectValue("scoreWeek",currentWeek)}
  renderCopyMonthPicker();
}
function renderDashboard(){document.getElementById("categoryButtons").innerHTML=CATEGORIES.map(c=>`<button class="btn-${c[1]}" onclick="openCategory('${c[0]}')">${c[0]}</button>`).join("");document.getElementById("dashActive").textContent=activeStudents().length;document.getElementById("dashBank").textContent=state.students.filter(s=>s.active!==false).length;document.getElementById("dashPoints").textContent=activeStudents().reduce((a,s)=>a+totalStudent(s.id),0)}
function addStudent(){const name=document.getElementById("studentName").value.trim(),birth=document.getElementById("studentBirth").value,category=document.getElementById("studentCategory").value;if(!name)return alert("Digite o nome do aluno.");state.students.push({id:uid(),name,birth,category,active:true,photo:"",createdAt:new Date().toISOString()});document.getElementById("studentName").value="";document.getElementById("studentBirth").value="";scheduleSave();renderAll();alert("Aluno cadastrado!")}
function renderStudents(){
  const body = document.getElementById("studentsTable");
  if(!body) return;
  const active = state.students.filter(s=>s.active!==false);
  if(!active.length){
    body.innerHTML = `<tr><td colspan="7">Nenhum aluno cadastrado.</td></tr>`;
    return;
  }

  let html = "";
  CATEGORIES.forEach(cat=>{
    const list = active.filter(s=>s.category===cat[0]);
    if(!list.length) return;

    html += `<tr class="categoryDivider cat-${cat[1]}"><td colspan="7">🏆 ${cat[0]} • ${list.length} aluno(s)</td></tr>`;
    html += list.map((s,i)=>`<tr>
      <td>${i+1}</td>
      <td>${photoPickerHtml(s)}</td>
      <td><input value="${esc(s.name)}" oninput="editStudent('${s.id}','name',this.value)"></td>
      <td><input type="date" value="${s.birth||""}" oninput="editStudent('${s.id}','birth',this.value)"></td>
      <td>${ageFromBirth(s.birth)} anos</td>
      <td><select onchange="editStudent('${s.id}','category',this.value)">
        ${CATEGORIES.map(c=>`<option value="${c[0]}" ${s.category===c[0]?"selected":""}>${c[0]}</option>`).join("")}
      </select></td>
      <td><button class="danger" onclick="deleteStudent('${s.id}')">Excluir</button></td>
    </tr>`).join("");
  });

  body.innerHTML = html || `<tr><td colspan="7">Nenhum aluno cadastrado.</td></tr>`;
}
function editStudent(id,field,value){const s=studentById(id);if(s){s[field]=value;scheduleSave();renderAll()}}
function deleteStudent(id){if(!confirm("Excluir aluno e todos os pontos dele?"))return;state.students=state.students.filter(s=>s.id!==id);Object.values(state.months||{}).forEach(m=>{if(m.participants)delete m.participants[id]});scheduleSave();renderAll()}
function addToSchedule(){
  const id=document.getElementById("studentPicker").value,sch=document.getElementById("schedulePicker").value;if(!id||!sch)return;
  const student=studentById(id);if(!student)return;
  const p=participant(id);const maxSchedules=canHaveTwoSchedules(student.category)?2:1;
  if(p.schedules.includes(sch))return alert("Esse aluno já está nesse horário.");
  if(p.schedules.length>=maxSchedules)return alert(canHaveTwoSchedules(student.category)?"Esse aluno já está em 2 horários nesta semana.":"Essa categoria permite apenas 1 horário por aluno.");
  const studentsInSlot=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));if(studentsInSlot.length>=6)return alert("Esse horário já está com 6 vagas preenchidas.");
  p.schedules.push(sch);scheduleSave();renderAll();const picker=document.getElementById("studentPicker");if(picker)picker.value=id;
}
function renderAgenda(){
  const schList=SCHEDULES[activeCategory]||[];
  document.getElementById("agendaGrid").innerHTML=schList.map(sch=>{
    const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
    return`<div class="slotCard"><div class="slotTitle"><span>${sch}</span><span class="badge">${list.length}/6</span></div>${list.map(s=>{const count=participant(s.id,false)?.schedules?.length||0;const icon=count>=2?"🔥":count===1?"✅":"⚽";const cls=count>=2?"multiSchedule":"singleSchedule";return `<div class="item ${cls}"><span>${icon} ${esc(s.name)}</span><button class="danger" onclick="removeFromSchedule('${s.id}','${sch}')">Remover</button></div>`}).join("")||"<p>Nenhum aluno.</p>"}</div>`;
  }).join("");
}
function removeFromSchedule(id,sch){const p=participant(id,false);if(p){p.schedules=p.schedules.filter(x=>x!==sch);scheduleSave();renderAll()}}
function scoreStepperHtml(id,week,sch,field,value){
  const safeId=JSON.stringify(id), safeSch=JSON.stringify(sch), safeField=JSON.stringify(field);
  return `<div class="quickScore" data-field="${field}">
    <button type="button" class="scoreMinus" onclick='adjustScore(${safeId},${week},${safeSch},${safeField},-1,this)'>−</button>
    <input class="scoreInput quickScoreInput" type="number" value="${value}" oninput='setScore(${safeId},${week},${safeSch},${safeField},this.value,this)'>
    <button type="button" class="scorePlus" onclick='adjustScore(${safeId},${week},${safeSch},${safeField},1,this)'>+</button>
  </div>`;
}
function renderScore(){
  const sch=document.getElementById("scoreSchedule").value||(SCHEDULES[activeCategory]||[])[0]||"",week=+document.getElementById("scoreWeek").value||0;
  document.getElementById("scoreTitle").textContent=`${activeCategory} • ${sch} • Semana ${week+1}`;
  const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
  document.getElementById("scoreTable").innerHTML=list.map((s,i)=>{const score=getScore(s.id,week,sch);return`<tr><td>${i+1}</td><td class="sticky"><div class="playerCell">${avatarHtml(s)}<strong>${esc(s.name)}</strong></div></td><td>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</td><td>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</td>${["uniforme","fruta","comportamento"].map(field=>`<td><select class="bonusSelect" onchange='setScore(${JSON.stringify(s.id)},${week},${JSON.stringify(sch)},${JSON.stringify(field)},this.value,this)'><option value="0" ${score[field]==0?"selected":""}>0</option><option value="5" ${score[field]==5?"selected":""}>5</option></select></td>`).join("")}<td class="totalCell"><strong>${scoreTotal(score)}</strong></td></tr>`}).join("")||`<tr><td colspan="8">Nenhum aluno neste horário. Vá em Agenda e adicione alunos neste horário.</td></tr>`
}
function setScore(id,week,sch,field,value,el){const sc=getScore(id,week,sch);sc[field]=+value||0;const row=el.closest("tr");if(row)row.querySelector(".totalCell strong").textContent=scoreTotal(sc);scheduleSave();renderRankings()}
function adjustScore(id,week,sch,field,delta,el){const sc=getScore(id,week,sch);sc[field]=(+sc[field]||0)+delta;const wrap=el.closest(".quickScore");const input=wrap?.querySelector("input");if(input)input.value=sc[field];const row=el.closest("tr");if(row)row.querySelector(".totalCell strong").textContent=scoreTotal(sc);scheduleSave();renderRankings()}
function clearTrainingScore(){const sch=document.getElementById("scoreSchedule").value,week=+document.getElementById("scoreWeek").value;if(!confirm("Limpar pontuação deste treino?"))return;activeByCategory().forEach(s=>{const p=participant(s.id,false);if(p?.weeks?.[week]?.[sch])p.weeks[week][sch]=emptyScore()});scheduleSave();renderAll()}
function rankRow(s,i){return`<div class="rankRow"><div class="rankLeft"><span>${i===0?"🥇":i===1?"🥈":i===2?"🥉":"⚽"}</span>${avatarHtml(s)}<span>${i+1}º - ${esc(s.name)}</span></div><strong>${s.total} pts</strong></div>`}
function renderRankings(){
  const categoryRanking=document.getElementById("categoryRanking");
  if(categoryRanking){const monthList=ranked(activeCategory),yearList=rankedAnnual(activeCategory);categoryRanking.innerHTML=`<h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthList.map(rankRow).join("")||"<p>Nenhum aluno ativo nesta categoria.</p>"}<h3 class="annualTitle">📅 Pontuação geral do ano</h3>${yearList.map(rankRow).join("")||"<p>Nenhuma pontuação anual nesta categoria.</p>"}`}
  const rg=document.getElementById("rankingGeneral");if(rg)rg.innerHTML="";
  const all=document.getElementById("allCategoryRankings");
  if(all){all.innerHTML=CATEGORIES.map(c=>{const monthly=ranked(c[0]),annual=rankedAnnual(c[0]);return`<div class="catCard cat-${c[1]}"><h2>${c[0]}</h2><h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthly.map(rankRow).join("")||"<p>Nenhum aluno ativo no mês.</p>"}<h3 class="annualTitle">📅 Pontuação geral do ano</h3>${annual.map(rankRow).join("")||"<p>Nenhuma pontuação anual.</p>"}</div>`}).join("")}
}
function renderCopyMonthPicker(){const picker=document.getElementById("copyMonthPicker");const available=MONTHS.filter(m=>m!==currentMonth&&Object.values(state.months?.[m]?.participants||{}).some(p=>p.schedules&&p.schedules.some(s=>(SCHEDULES[activeCategory]||[]).includes(s))));picker.innerHTML=available.map(m=>`<option value="${m}">${m}</option>`).join("")||`<option value="">Nenhum mês com agenda</option>`}
function copyAgendaFromMonth(){const source=document.getElementById("copyMonthPicker").value;if(!source)return alert("Nenhum mês com agenda para copiar.");const sourceMo=monthObj(source),targetMo=monthObj(currentMonth),schList=SCHEDULES[activeCategory]||[];const entries=Object.entries(sourceMo.participants||{}).filter(([id,p])=>{const st=studentById(id);return st&&st.category===activeCategory&&p.schedules&&p.schedules.some(s=>schList.includes(s))});if(!entries.length)return alert("Esse mês não possui agenda nessa categoria.");entries.forEach(([id,p])=>{targetMo.participants[id]={studentId:id,schedules:p.schedules.filter(s=>schList.includes(s)),weeks:Array.from({length:5},()=>({}))}});scheduleSave();renderAll();alert("Agenda da categoria copiada com pontuação zerada.")}
function clearCategoryAgenda(){if(!confirm("Limpar agenda desta categoria no mês atual?"))return;const schList=SCHEDULES[activeCategory]||[];activeByCategory().forEach(s=>{const p=participant(s.id,false);if(p)p.schedules=p.schedules.filter(x=>!schList.includes(x))});scheduleSave();renderAll()}
function renderPrintSelect(){const el=document.getElementById("printCategory");if(el)el.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("")}
function preparePrint(type){const cat=document.getElementById("printCategory").value;const list=type==="general"?ranked():ranked(cat);const title=type==="general"?"RANKING GERAL DO MÊS":cat;document.getElementById("printArea").innerHTML=`<div class="printCard"><img src="primo-logo.png" class="printLogo"><h1>PRIMO SOCCER<br>KIDS / INFANTO / JUVENIL<br>2026</h1><h2>${title} • ${currentMonth}</h2>${list.map((s,i)=>`<div class="printRow"><span>${i+1}º</span><span class="printPhoto">${s.photo?`<img src="${s.photo}">`:initials(s.name)}</span><span>${esc(s.name)}</span><strong>${s.total} pts</strong></div>`).join("")||"<p>Nenhum aluno.</p>"}</div>`}
async function initCloud(){try{setSync("Conectando ao banco online...");if(!window.supabase)throw new Error("Biblioteca Supabase não carregou");sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);const{data,error}=await sb.from("primo_app_state").select("data").eq("app_id",APP_ID).maybeSingle();if(error)throw error;if(data&&data.data&&Object.keys(data.data).length){const keep=currentMonth;state=data.data;currentMonth=keep;saveLocal()}else await saveCloud();setSync("Dados online conectados.","ok");renderAll()}catch(e){console.error(e);setSync("Erro online: confirme SQL e config.","error")}}
async function saveCloud(){if(!sb){if(!window.supabase)return;sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}try{norm();const{error}=await sb.from("primo_app_state").upsert({app_id:APP_ID,data:state,updated_at:new Date().toISOString()},{onConflict:"app_id"});if(error)throw error;setSync("Dados salvos online.","ok")}catch(e){console.error(e);setSync("Erro ao salvar online.","error")}}
async function syncNow(){await saveCloud();alert("Sincronizado")}
async function loadCloud(){await initCloud()}

// ===== Logo + Link dos Pais v4 =====
let parentCategory = CATEGORIES[0][0];

function isParentMode(){
  const p = new URLSearchParams(location.search);
  return p.get("pais")==="1" || p.get("parents")==="1" || location.hash==="#pais";
}

function copyParentLink(){
  const url = location.origin + location.pathname + "?pais=1";
  const el = document.getElementById("parentLinkText");
  if(el) el.textContent = url;
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>alert("Link dos pais copiado!")).catch(()=>alert(url));
  } else {
    alert(url);
  }
}

function setParentCategory(cat){
  parentCategory = cat;
  renderParentMode();
}

function renderParentMode(){
  const m=document.getElementById("parentMonth");if(m)m.textContent=currentMonth;
  const tabs=document.getElementById("parentCategoryTabs");if(tabs){tabs.innerHTML=CATEGORIES.map(c=>{const active=c[0]===parentCategory?"active":"";return `<button class="btn-${c[1]} ${active}" onclick="setParentCategory('${c[0]}')">${c[0]}</button>`}).join("")}
  const area=document.getElementById("parentRankingArea");if(area){const monthList=ranked(parentCategory),yearList=rankedAnnual(parentCategory);area.innerHTML=`<div class="card"><h2 class="rankTitle"><img src="primo-logo.png" class="rankLogo"> ${parentCategory}</h2><h3>🏆 Pontuação mensal • ${currentMonth}</h3><div class="rankList">${monthList.map(rankRow).join("")||"<p>Nenhum resultado nesta categoria.</p>"}</div><h3 class="annualTitle">📅 Pontuação geral do ano</h3><div class="rankList">${yearList.map(rankRow).join("")||"<p>Nenhuma pontuação anual nesta categoria.</p>"}</div></div>`}
}
const renderRankingsBase = renderRankings;
renderRankings = function(){
  renderRankingsBase();
  if(isParentMode()) renderParentMode();
};



function initParentModeIfNeeded(){
  if(!isParentMode()) return;
  document.body.classList.add("parentMode");
  showPage("pais");
  renderParentMode();
}

/* ===== PATCH FINAL JOÃO - IMPRESSÃO INTERNA + FOTO AMPLIADA + CAPA ESTÁVEL ===== */

function applyDashboardCover(){
  const hero = document.getElementById("appHero");
  if(!hero) return;

  const cover = state?.settings?.dashboardCoverCustom || "visual-kids-oficial.jpeg";

  hero.style.backgroundImage =
    `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.20) 42%,rgba(2,8,23,.94)), url("${cover}")`;
}

function uploadCover(event){
  const file = event.target.files && event.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1200;
      let w = img.width;
      let h = img.height;

      if(w > maxW){
        h = Math.round(h * maxW / w);
        w = maxW;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);

      state.settings = state.settings || {};
      state.settings.dashboardCoverCustom = canvas.toDataURL("image/jpeg",0.86);

      scheduleSave();
      applyDashboardCover();
      alert("Capa do Dashboard atualizada!");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function clearCover(){
  if(!confirm("Remover capa personalizada?")) return;

  state.settings = state.settings || {};
  delete state.settings.dashboardCover;
  delete state.settings.dashboardCoverV9;
  delete state.settings.dashboardCoverCustom;

  scheduleSave();
  applyDashboardCover();
}

function openPhoto(src){
  let modal = document.getElementById("photoModal");

  if(!modal){
    modal = document.createElement("div");
    modal.id = "photoModal";
    modal.innerHTML = '<img id="photoModalImg" alt="Foto ampliada">';
    modal.onclick = () => modal.classList.remove("show");
    document.body.appendChild(modal);
  }

  const img = document.getElementById("photoModalImg");
  img.src = src;
  modal.classList.add("show");
}

function preparePrint(type){
  const cat = document.getElementById("printCategory").value;
  const list = type==="general" ? ranked() : ranked(cat);
  const title = type==="general" ? "RANKING GERAL DO MÊS" : cat;

  document.getElementById("printArea").innerHTML = `
    <div class="printCard printOnlyCard">
      <img src="primo-logo.png" class="printLogo">
      <h1>PRIMO SOCCER<br>KIDS / INFANTO / JUVENIL<br>2026</h1>
      <h2>${title} • ${currentMonth}</h2>
      <div class="printTableOnly">
        ${list.map((s,i)=>`
          <div class="printRow">
            <span>${i+1}º</span>
            <span class="printPhoto">
              ${s.photo?`<img src="${s.photo}" onclick="openPhoto('${s.photo}')">`:initials(s.name)}
            </span>
            <span>${esc(s.name)}</span>
            <strong>${s.total} pts</strong>
          </div>
        `).join("") || "<p>Nenhum aluno.</p>"}
      </div>
    </div>`;
}



/* ===== V13 PRINT POR CATEGORIA ===== */
preparePrint = function(type){
  const cat=document.getElementById("printCategory").value;
  const color=document.getElementById("printColor")?.value||"azul";
  const list=type==="annual"?rankedAnnual(cat):ranked(cat);
  const title=type==="annual"?`RANKING ANUAL • ${cat}`:`${cat} • ${currentMonth}`;
  document.getElementById("printArea").innerHTML=`<div class="printCard printOnlyCard print-${color}"><img src="primo-logo.png" class="printLogo"><h1>PRIMO SOCCER<br>KIDS / INFANTO / JUVENIL<br>2026</h1><h2>${title}</h2><div class="printTableOnly">${list.map((s,i)=>`<div class="printRow"><span>${i+1}º</span><span class="printPhoto">${s.photo?`<img src="${s.photo}" onclick="openPhoto('${s.photo}')">`:initials(s.name)}</span><span>${esc(s.name)}</span><strong>${s.total} pts</strong></div>`).join("")||"<p>Nenhum aluno.</p>"}</div></div>`;
};

renderAll();showPage("dashboard");initCloud();setTimeout(()=>{ if(typeof initParentModeIfNeeded==="function") initParentModeIfNeeded(); applyDashboardCover(); },700);
