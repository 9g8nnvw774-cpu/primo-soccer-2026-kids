const DB_OVERRIDE=(()=>{try{return JSON.parse(localStorage.getItem("primo_kids_db_config")||"{}")}catch(e){return {}}})();
function normalizeSupabaseUrl(u){u=String(u||"").trim(); if(!u)return ""; if(!/^https?:\/\//i.test(u))u="https://"+u; return u.replace(/\/+$/,"");}
const SUPABASE_URL=normalizeSupabaseUrl(DB_OVERRIDE.url||window.PRIMO_SUPABASE_CONFIG?.url);
const SUPABASE_KEY=String(DB_OVERRIDE.anonKey||window.PRIMO_SUPABASE_CONFIG?.anonKey||"").trim();
const APP_ID=String(DB_OVERRIDE.appId||window.PRIMO_SUPABASE_CONFIG?.appId||"primo_soccer_kids_league_2026").trim();
const MONTHS=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const CATEGORIES=[["Futbaby 2-3 Anos","futbaby23"],["Futbaby 4-5 Anos","futbaby45"],["Sub 6-7-8 anos","sub678"],["Sub 8-9-10 anos","sub8910"],["Meninas","meninas"],["Sub 11-12-13-14 anos","sub1114"]];
const DEFAULT_SCHEDULES={"Futbaby 2-3 Anos":["Segunda 11:00 • Futbaby 2-3 anos","Quinta 17:30 • Futbaby 2-3 anos (Capi)","Sexta 17:30 • Futbaby 2-3 anos (Capi)","Sábado 09:30 • Futbaby 2-3 anos (Capi)","Sábado 11:30 • Futbaby 2-3 anos (Capi)"],"Futbaby 4-5 Anos":["Segunda 10:00 • Futbaby 4-5 anos","Terça 10:00 • Futbaby 4-5 anos","Quarta 10:00 • Futbaby 4-5 anos","Quarta 17:30 • Futbaby 4-5 anos","Sexta 09:15 • Futbaby 4-5 anos","Sábado 10:30 • Futbaby 4-5 anos (Capi)"],"Sub 6-7-8 anos":["Terça 10:45 • Sub 6-7-8 anos","Quinta 10:45 • Sub 6-7-8","Sexta 19:10 • Sub 6-7-8 (Capi)"],"Sub 8-9-10 anos":["Segunda 09:15 • Sub 8-9-10 anos","Quarta 09:15 • Sub 8-9-10 anos","Sexta 18:15 • Sub 8-9-10 (Capi)"],"Meninas":["Quarta 10:45 • Meninas"],"Sub 11-12-13-14 anos":["Terça 15:30 • Sub 11-12-13 anos","Quarta 15:30 • Sub 11-12-13-14"]};
const STORAGE_KEY="primo_soccer_2026_kids_state_v3",MONTH_KEY="primo_soccer_2026_kids_month_v3";
const APP_TITLE_HTML = "<span>PRIMO SOCCER</span><span>KIDS / INFANTO / JUVENIL</span><span>2026</span>";
const APP_TITLE_TEXT = "PRIMO SOCCER KIDS / INFANTO / JUVENIL 2026";
const DEFAULT_RULES = `🏆 Regras do campeonato
• Pontuação por treino: P/D + P/E + bônus.
• Bônus: uniforme, fruta e comportamento.
• Ranking mensal por categoria.
• Respeito, disciplina e presença contam para evolução do atleta.`;
let currentMonth=localStorage.getItem(MONTH_KEY)||MONTHS[new Date().getMonth()],state=loadLocal(),sb=null,saveTimer=null,activeCategory=CATEGORIES[0][0];
function defaultState(){return{students:[],months:{},currentMonth,settings:{rules:DEFAULT_RULES,customSchedules:{}},schemaVersion:4}}
function loadLocal(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||defaultState()}catch(e){return defaultState()}}
function norm(){if(!state||typeof state!=="object")state=defaultState();if(!Array.isArray(state.students))state.students=[];state.students.forEach(s=>{if(!s.id)s.id=uid();if(!s.studentCode)s.studentCode=s.id});if(!state.months)state.months={};Object.values(state.months).forEach(m=>{if(m){if(!m.participants)m.participants={};if(!m.finishedTrainings)m.finishedTrainings={}}});if(!state.settings)state.settings={};if(!state.settings.rules)state.settings.rules=DEFAULT_RULES;if(!state.settings.customSchedules)state.settings.customSchedules={};state.currentMonth=currentMonth;if(!state.months[currentMonth])state.months[currentMonth]={participants:{},finishedTrainings:{}};if(!state.months[currentMonth].finishedTrainings)state.months[currentMonth].finishedTrainings={}}
function schedulesFor(cat){const base=DEFAULT_SCHEDULES[cat]||[];const custom=state?.settings?.customSchedules?.[cat]||[];return [...base,...custom].filter((v,i,a)=>v&&a.indexOf(v)===i)}
function appTitleBlock(cls="appTitleBlock"){return `<div class="${cls}">${APP_TITLE_HTML}</div>`}
function rulesHtml(){return esc(state?.settings?.rules||DEFAULT_RULES).replace(/\n/g,"<br>")}
function applyAppTitle(){document.title=APP_TITLE_TEXT;document.querySelectorAll("[data-app-title]").forEach(el=>el.innerHTML=APP_TITLE_HTML)}
function saveLocal(){norm();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(MONTH_KEY,currentMonth)}
function uid(){return"KID-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase()}
function esc(t){return String(t??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function ageFromBirth(b){if(!b)return"";const d=new Date(b+"T00:00:00"),now=new Date();let a=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))a--;return a}
function initials(n){return String(n||"A").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"A"}
function studentById(id){return state.students.find(s=>s.id===id)}
function monthObj(m=currentMonth){norm();if(!state.months[m])state.months[m]={participants:{},finishedTrainings:{}};if(!state.months[m].participants)state.months[m].participants={};if(!state.months[m].finishedTrainings)state.months[m].finishedTrainings={};return state.months[m]}
function participant(id,create=true,m=currentMonth){const mo=monthObj(m);if(!mo.participants[id]&&create)mo.participants[id]={studentId:id,schedules:[],weeks:Array.from({length:5},()=>({}))};return mo.participants[id]||null}
function emptyScore(){return{pd:0,pe:0,uniforme:0,fruta:0,comportamento:0}}
function getScore(id,w,sch){const p=participant(id);if(!p.weeks[w])p.weeks[w]={};if(!p.weeks[w][sch])p.weeks[w][sch]=emptyScore();return p.weeks[w][sch]}
function scoreTotal(sc){return(+sc.pd||0)+(+sc.pe||0)+(+sc.uniforme||0)+(+sc.fruta||0)+(+sc.comportamento||0)}
function totalStudent(id,m=currentMonth){const p=monthObj(m).participants[id];if(!p)return 0;return(p.weeks||[]).reduce((a,w)=>a+Object.values(w||{}).reduce((b,sc)=>b+scoreTotal(sc),0),0)}
function activeStudents(m=currentMonth){const ids=new Set(Object.entries(monthObj(m).participants||{}).filter(([id,p])=>p.schedules&&p.schedules.length).map(([id])=>id));return state.students.filter(s=>s.active!==false&&ids.has(s.id))}
function activeByCategory(cat=activeCategory){return activeStudents().filter(s=>s.category===cat)}
function ranked(cat=null){return activeStudents().filter(s=>!cat||s.category===cat).map(s=>({...s,total:totalStudent(s.id)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function rankedByMonth(cat=null,m=currentMonth){return activeStudents(m).filter(s=>!cat||s.category===cat).map(s=>({...s,total:totalStudent(s.id,m)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function avatarHtml(s){
  return s.photo
    ? `<span class="avatar"><img src="${s.photo}" onclick="openPhoto('${s.photo}')"></span>`
    : `<span class="avatar">${initials(s.name)}</span>`;
}
function photoPickerHtml(s){
  const inputId = `photo-${s.id}`;
  return `<div class="avatarInputLabel" title="Toque para alterar a foto" onclick="document.getElementById('${inputId}').click()">
    ${s.photo?`<img src="${s.photo}" alt="Foto do aluno">`:initials(s.name)}
    <input id="${inputId}" class="photoInput" type="file" accept="image/*" onchange="loadPhoto(event,'${s.id}')">
  </div>`;
}
function photoFileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error("Não foi possível ler a foto."));
    r.onload=()=>resolve(r.result);
    r.readAsDataURL(file);
  });
}
function loadImgFromSrc(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Foto inválida ou formato não suportado."));
    img.src=src;
  });
}
async function fileToCompressedPhoto(file,max=420,quality=.78){
  if(!file)return "";
  const src=await photoFileToDataUrl(file);
  let source;
  try{
    if(window.createImageBitmap){
      const blob=await (await fetch(src)).blob();
      source=await createImageBitmap(blob,{imageOrientation:"from-image"});
    }
  }catch(e){ source=null; }
  if(!source) source=await loadImgFromSrc(src);
  let w=source.width,h=source.height;
  if(!w||!h)throw new Error("Foto sem dimensão válida.");
  const ratio=Math.min(1,max/Math.max(w,h));
  w=Math.max(1,Math.round(w*ratio)); h=Math.max(1,Math.round(h*ratio));
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  const ctx=c.getContext("2d",{alpha:false});
  ctx.fillStyle="#06117a"; ctx.fillRect(0,0,w,h);
  ctx.drawImage(source,0,0,w,h);
  if(source.close)source.close();
  return c.toDataURL("image/jpeg",quality);
}
async function loadPhoto(e,id){
  const input=e.target, file=input.files&&input.files[0];
  if(!file)return;
  try{
    setSync("Salvando foto do aluno...","warn");
    const photo=await fileToCompressedPhoto(file);
    const st=studentById(id);
    if(st){
      st.photo=photo;
      saveLocal();
      renderAll();
      await saveCloudNow();
      setSync("Foto salva online.","ok");
    }
  }catch(err){console.error(err);alert("Não consegui salvar essa foto. Tente outra imagem.");setSync("Erro ao salvar foto.","error")}
  finally{ if(input) input.value=""; }
}
function setSync(msg,type="warn"){const el=document.getElementById("syncStatus");el.textContent=msg;el.style.color=type==="ok"?"#8ff0b3":type==="error"?"#ff8b8b":"#ffe082"}
function scheduleSave(delay=350){saveLocal();clearTimeout(saveTimer);saveTimer=setTimeout(saveCloudNow,delay)}
async function saveCloudNow(){
  try{
    return await saveCloud();
  }catch(e){
    console.error(e);
    return false;
  }
}
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
function renderAll(){fillDbConfigScreen();
  norm();
  renderMonth();
  renderSelectors();
  renderDashboard();
  renderStudents();
  renderAgenda();
  renderScore();
  renderRankings();
  renderPrintSelect();
  renderRules();
  renderCustomScheduleControls();
  applyAppTitle();
  if(typeof applyDashboardCover==="function") applyDashboardCover();
}
function renderMonth(){const sel=document.getElementById("monthSelect");if(!sel.dataset.ready){sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");sel.dataset.ready="1";sel.onchange=()=>{currentMonth=sel.value;if(!state.months[currentMonth])state.months[currentMonth]={participants:{}};scheduleSave();renderAll()}}sel.value=currentMonth;document.getElementById("heroMonth").textContent=currentMonth}

const MULTI_SCHEDULE_CATEGORIES = ["Futbaby 4-5 Anos","Sub 6-7-8 anos","Sub 8-9-10 anos","Sub 11-12-13-14 anos"];
function canHaveTwoSchedules(cat){return MULTI_SCHEDULE_CATEGORIES.includes(cat)}
function annualTotalStudent(id){return MONTHS.reduce((sum,m)=>sum+totalStudent(id,m),0)}
function rankedAnnual(cat=null){return state.students.filter(s=>s.active!==false&&(!cat||s.category===cat)).map(s=>({...s,total:annualTotalStudent(s.id)})).filter(s=>s.total>0).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))}
function studentOptionLabel(s){const p=participant(s.id,false);const count=p?.schedules?.length||0;const icon=count>=2?"🔥":count===1?"✅":"⚽";return `${icon} ${s.name} • ${s.category}`}
function restoreSelectValue(id,value){const el=document.getElementById(id);if(el&&value&&[...el.options].some(o=>o.value===value))el.value=value}
function scheduleDay(sch){return String(sch||"").split(" ")[0]||""}
function trainingKey(cat,week,sch){return `${cat}__S${week+1}__${sch}`}
function isTrainingFinished(cat,week,sch){return !!monthObj().finishedTrainings?.[trainingKey(cat,week,sch)]}

let disputeFocusMode=false;
function enterDisputeFocus(){
  disputeFocusMode=true;
  document.body.classList.add("disputeFocus");
  document.body.style.overflow="hidden";
  const wrap=document.querySelector("#page-disputa .scoreTableWrap");
  if(wrap)wrap.scrollTop=0;
  if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().catch(()=>{});}
  renderScore();
}
function exitDisputeFocus(){
  disputeFocusMode=false;
  document.body.classList.remove("disputeFocus");
  document.body.style.overflow="";
  if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen().catch(()=>{});}
}
function scoreKey(id,week,sch){return `${id}__${week}__${sch}`}
function scoreCardHtml(s,i,week,sch,score){
  const key=esc(scoreKey(s.id,week,sch));
  const id=JSON.stringify(s.id), safeSch=JSON.stringify(sch);
  const bonus=(field,label,icon)=>`<button type="button" class="bonusMini ${(+score[field]||0)>0?"active":""}" onclick='toggleBonus(${id},${week},${safeSch},${JSON.stringify(field)},this)' title="${label}"><span>${icon}</span><small data-bonus="${field}">${+score[field]||0}</small></button>`;
  return `<div class="scorePlayerCard scorePlayerCompact" data-score-key="${key}">
    <div class="compactMain">
      <span class="scorePos">${i+1}</span>
      ${avatarHtml(s)}
      <div class="compactName"><strong>${esc(s.name)}</strong><small>ID: ${esc(s.studentCode||s.id)}</small></div>
      <div class="compactControls">
        <div class="compactField"><label>PD</label>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</div>
        <div class="compactField"><label>PE</label>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</div>
      </div>
      <div class="compactBonus">
        ${bonus("comportamento","Comportamento","🙂")}
        ${bonus("fruta","Fruta","🍎")}
        ${bonus("uniforme","Uniforme","👕")}
      </div>
      <div class="scoreTotalBadge"><span data-total>${scoreTotal(score)}</span><small>pts</small></div>
    </div>
  </div>`;
}
function updateScoreDisplays(id,week,sch){
  const sc=getScore(id,week,sch), key=scoreKey(id,week,sch);
  document.querySelectorAll(`[data-score-key="${CSS.escape(key)}"]`).forEach(el=>{
    const total=el.querySelector("[data-total]"); if(total)total.textContent=scoreTotal(sc);
    el.querySelectorAll(".quickScore").forEach(q=>{const f=q.dataset.field;if(f&&q.querySelector("input"))q.querySelector("input").value=sc[f]||0});
    el.querySelectorAll(".bonusMini").forEach(btn=>{const f=btn.querySelector("small")?.dataset.bonus;if(f){btn.classList.toggle("active",(+sc[f]||0)>0);btn.querySelector("small").textContent=+sc[f]||0}});
    el.querySelectorAll(".bonusChip").forEach(btn=>{const f=btn.querySelector("strong")?.dataset.bonus;if(f){btn.classList.toggle("active",(+sc[f]||0)>0);btn.querySelector("strong").textContent=+sc[f]||0}});
  });
}
function toggleBonus(id,week,sch,field,el){
  if(el&&el.blur)el.blur();
  const sc=getScore(id,week,sch);
  sc[field]=(+sc[field]||0)>0?0:5;
  updateScoreDisplays(id,week,sch);
  scheduleSave(250);
  renderRankings();
}

function renderSelectors(){
  const currentStudent=document.getElementById("studentPicker")?.value||"";
  const currentSchedule=document.getElementById("schedulePicker")?.value||"";
  const currentScoreSchedule=document.getElementById("scoreSchedule")?.value||"";
  const currentScoreDay=document.getElementById("scoreDay")?.value||"";
  const currentWeek=document.getElementById("scoreWeek")?.value||"";
  document.getElementById("studentCategory").innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");
  ["agendaCategory","disputeCategory"].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");el.value=activeCategory});
  const sp=document.getElementById("studentPicker");
  if(sp){sp.innerHTML=state.students.filter(s=>s.active!==false&&s.category===activeCategory).map(s=>`<option value="${s.id}">${esc(studentOptionLabel(s))}</option>`).join("")||`<option value="">Cadastre alunos nesta categoria</option>`;restoreSelectValue("studentPicker",currentStudent)}
  const sch=schedulesFor(activeCategory);
  const ap=document.getElementById("schedulePicker");if(ap){ap.innerHTML=sch.map(s=>`<option value="${s}">${s}</option>`).join("");restoreSelectValue("schedulePicker",currentSchedule)}
  const daySel=document.getElementById("scoreDay");
  const days=[...new Set(sch.map(scheduleDay).filter(Boolean))];
  if(daySel){daySel.innerHTML=[`<option value="">Todos os dias</option>`,...days.map(d=>`<option value="${d}">${d}</option>`)].join("");restoreSelectValue("scoreDay",currentScoreDay)}
  const selectedDay=daySel?.value||"";
  const scoreSchedules=selectedDay?sch.filter(x=>scheduleDay(x)===selectedDay):sch;
  const ss=document.getElementById("scoreSchedule");if(ss){ss.innerHTML=scoreSchedules.map(s=>`<option value="${s}">${s}</option>`).join("")||`<option value="">Nenhum horário neste dia</option>`;restoreSelectValue("scoreSchedule",currentScoreSchedule)}
  const sw=document.getElementById("scoreWeek");if(sw){sw.innerHTML=[0,1,2,3,4].map(i=>`<option value="${i}">Semana ${i+1}</option>`).join("");restoreSelectValue("scoreWeek",currentWeek)}
  renderCopyMonthPicker();
}
function renderDashboard(){document.getElementById("categoryButtons").innerHTML=CATEGORIES.map(c=>`<button class="btn-${c[1]}" onclick="openCategory('${c[0]}')">${c[0]}</button>`).join("");document.getElementById("dashActive").textContent=activeStudents().length;document.getElementById("dashBank").textContent=state.students.filter(s=>s.active!==false).length;document.getElementById("dashPoints").textContent=activeStudents().reduce((a,s)=>a+totalStudent(s.id),0);renderRules()}

function renderRules(){
  const dash=document.getElementById("championshipRules");
  if(dash)dash.innerHTML=rulesHtml();
  const editor=document.getElementById("rulesEditor");
  if(editor&&document.activeElement!==editor)editor.value=state?.settings?.rules||DEFAULT_RULES;
}
function saveRules(){
  const editor=document.getElementById("rulesEditor");
  state.settings=state.settings||{};
  state.settings.rules=(editor?.value||DEFAULT_RULES).trim()||DEFAULT_RULES;
  scheduleSave();renderRules();alert("Regras atualizadas!");
}
function renderCustomScheduleControls(){
  const catSel=document.getElementById("newScheduleCategory");
  if(catSel&&!catSel.dataset.ready){catSel.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("");catSel.dataset.ready="1"}
  const list=document.getElementById("customScheduleList");
  if(list){const items=Object.entries(state?.settings?.customSchedules||{}).flatMap(([cat,arr])=>(arr||[]).map((sch,i)=>({cat,sch,i})));list.innerHTML=items.map(x=>`<div class="item"><span><strong>${esc(x.cat)}</strong><br>${esc(x.sch)}</span><button class="danger" onclick="removeCustomSchedule('${esc(x.cat)}',${x.i})">Excluir</button></div>`).join("")||"<p>Nenhum horário extra cadastrado.</p>"}
}
function addCustomSchedule(){
  const cat=document.getElementById("newScheduleCategory")?.value||activeCategory;
  const day=document.getElementById("newScheduleDay")?.value||"";
  const time=document.getElementById("newScheduleTime")?.value||"";
  const label=(document.getElementById("newScheduleLabel")?.value||cat).trim();
  if(!day||!time)return alert("Escolha o dia e o horário.");
  const sch=`${day} ${time} • ${label}`;
  state.settings=state.settings||{};state.settings.customSchedules=state.settings.customSchedules||{};
  state.settings.customSchedules[cat]=state.settings.customSchedules[cat]||[];
  if(state.settings.customSchedules[cat].includes(sch)||schedulesFor(cat).includes(sch))return alert("Esse horário já existe.");
  state.settings.customSchedules[cat].push(sch);
  activeCategory=cat;
  scheduleSave();renderAll();alert("Novo horário adicionado!");
}
function removeCustomSchedule(cat,index){
  if(!confirm("Excluir esse horário extra?"))return;
  const arr=state?.settings?.customSchedules?.[cat];if(!arr)return;
  const sch=arr[index];arr.splice(index,1);
  Object.values(state.months||{}).forEach(m=>Object.values(m.participants||{}).forEach(p=>{if(p.schedules)p.schedules=p.schedules.filter(x=>x!==sch)}));
  scheduleSave();renderAll();
}

async function addStudent(){
  const name=document.getElementById("studentName").value.trim(),birth=document.getElementById("studentBirth").value,category=document.getElementById("studentCategory").value;
  if(!name)return alert("Digite o nome do aluno.");
  const file=document.getElementById("studentPhoto")?.files?.[0];
  const id=uid();
  let photo="";
  try{ if(file){ setSync("Preparando foto do aluno...","warn"); photo=await fileToCompressedPhoto(file); } }catch(e){ console.error(e); alert("Aluno cadastrado, mas essa foto não pôde ser usada. Tente alterar a foto depois tocando nela."); }
  state.students.push({id,studentCode:id,name,birth,category,active:true,photo,createdAt:new Date().toISOString()});
  document.getElementById("studentName").value="";document.getElementById("studentBirth").value="";if(document.getElementById("studentPhoto"))document.getElementById("studentPhoto").value="";
  saveLocal();renderAll();const ok=await saveCloudNow();
  alert(ok?"Aluno cadastrado e salvo online!":"Aluno cadastrado neste celular. Banco online não confirmou ainda. Toque em Sincronizar agora quando conectar.");
}
function renderStudents(){
  const body = document.getElementById("studentsTable");
  if(!body) return;
  const active = state.students.filter(s=>s.active!==false);
  if(!active.length){
    body.innerHTML = `<tr><td colspan="8">Nenhum aluno cadastrado.</td></tr>`;
    return;
  }

  let html = "";
  CATEGORIES.forEach(cat=>{
    const list = active.filter(s=>s.category===cat[0]);
    if(!list.length) return;

    html += `<tr class="categoryDivider cat-${cat[1]}"><td colspan="8">🏆 ${cat[0]} • ${list.length} aluno(s)</td></tr>`;
    html += list.map((s,i)=>`<tr>
      <td>${i+1}</td>
      <td><code class="studentIdCode">${esc(s.studentCode||s.id)}</code></td>
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

  body.innerHTML = html || `<tr><td colspan="8">Nenhum aluno cadastrado.</td></tr>`;
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
  const schList=schedulesFor(activeCategory);
  document.getElementById("agendaGrid").innerHTML=schList.map(sch=>{
    const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
    return`<div class="slotCard"><div class="slotTitle"><span>${sch}</span><span class="badge">${list.length}/6</span></div><button class="success compactGo" onclick='goToDisputeSlot(${JSON.stringify(sch)})'>Ir para disputa desta turma</button>${list.map(s=>{const count=participant(s.id,false)?.schedules?.length||0;const icon=count>=2?"🔥":count===1?"✅":"⚽";const cls=count>=2?"multiSchedule":"singleSchedule";return `<div class="item ${cls}"><span>${icon} ${esc(s.name)}</span><button class="danger" onclick="removeFromSchedule('${s.id}','${sch}')">Remover</button></div>`}).join("")||"<p>Nenhum aluno.</p>"}</div>`;
  }).join("");
}
function goToDisputeSlot(sch){const ss=document.getElementById("scoreSchedule");if(ss)ss.value=sch;showPage("disputa");setTimeout(()=>{const s2=document.getElementById("scoreSchedule");if(s2)s2.value=sch;enterDisputeFocus();renderScore();},80)}
function removeFromSchedule(id,sch){const p=participant(id,false);if(p){p.schedules=p.schedules.filter(x=>x!==sch);scheduleSave();renderAll()}}
function scoreStepperHtml(id,week,sch,field,value){
  const safeId=JSON.stringify(id), safeSch=JSON.stringify(sch), safeField=JSON.stringify(field);
  return `<div class="quickScore" data-field="${field}">
    <button type="button" class="scoreMinus" onpointerdown="event.preventDefault()" onclick='adjustScore(${safeId},${week},${safeSch},${safeField},-1,this)'>−</button>
    <input class="scoreInput quickScoreInput" type="number" value="${value}" oninput='setScore(${safeId},${week},${safeSch},${safeField},this.value,this)'>
    <button type="button" class="scorePlus" onpointerdown="event.preventDefault()" onclick='adjustScore(${safeId},${week},${safeSch},${safeField},1,this)'>+</button>
  </div>`;
}
function renderScore(){
  const sch=document.getElementById("scoreSchedule")?.value||(schedulesFor(activeCategory))[0]||"",week=+document.getElementById("scoreWeek")?.value||0;
  const title=document.getElementById("scoreTitle");
  if(title)title.textContent=`${activeCategory} • ${sch||"Selecione um horário"} • Semana ${week+1}`;
  const finished=isTrainingFinished(activeCategory,week,sch);
  const finishBox=document.getElementById("finishStatus");
  if(finishBox)finishBox.innerHTML=finished?`✅ Treino finalizado e salvo no banco online.`:`Treino em andamento. Ao terminar, toque em <strong>Finalizar treino</strong> para gravar no banco online.`;
  const list=activeByCategory().filter(s=>(participant(s.id,false)?.schedules||[]).includes(sch));
  const table=document.getElementById("scoreTable");
  const cards=document.getElementById("scoreCards");
  if(cards)cards.innerHTML=list.map((s,i)=>scoreCardHtml(s,i,week,sch,getScore(s.id,week,sch))).join("")||`<div class="emptyScoreNotice">Nenhum aluno neste dia/horário. Vá em Agenda e adicione alunos neste horário.</div>`;
  if(table)table.innerHTML=list.map((s,i)=>{const score=getScore(s.id,week,sch);const key=esc(scoreKey(s.id,week,sch));return`<tr data-score-key="${key}"><td>${i+1}</td><td class="sticky"><div class="playerCell">${avatarHtml(s)}<strong>${esc(s.name)}</strong></div><small class="studentMiniId">ID: ${esc(s.studentCode||s.id)}</small></td><td>${scoreStepperHtml(s.id,week,sch,"pd",score.pd)}</td><td>${scoreStepperHtml(s.id,week,sch,"pe",score.pe)}</td>${["uniforme","fruta","comportamento"].map(field=>`<td><select class="bonusSelect" onchange='setScore(${JSON.stringify(s.id)},${week},${JSON.stringify(sch)},${JSON.stringify(field)},this.value,this)'><option value="0" ${score[field]==0?"selected":""}>0</option><option value="5" ${score[field]==5?"selected":""}>5</option></select></td>`).join("")}<td class="totalCell"><strong data-total>${scoreTotal(score)}</strong></td></tr>`}).join("")||`<tr><td colspan="8">Nenhum aluno neste dia/horário. Vá em Agenda e adicione alunos neste horário.</td></tr>`
}
function setScore(id,week,sch,field,value,el){const sc=getScore(id,week,sch);sc[field]=+value||0;updateScoreDisplays(id,week,sch);scheduleSave(250);renderRankings()}
function adjustScore(id,week,sch,field,delta,el){if(el&&el.blur)el.blur();const sc=getScore(id,week,sch);sc[field]=Math.max(0,(+sc[field]||0)+delta);updateScoreDisplays(id,week,sch);scheduleSave(250);renderRankings()}
function clearTrainingScore(){const sch=document.getElementById("scoreSchedule").value,week=+document.getElementById("scoreWeek").value;if(!confirm("Limpar pontuação deste treino?"))return;activeByCategory().forEach(s=>{const p=participant(s.id,false);if(p?.weeks?.[week]?.[sch])p.weeks[week][sch]=emptyScore()});scheduleSave();renderAll()}
async function finishTraining(){const sch=document.getElementById("scoreSchedule")?.value,week=+document.getElementById("scoreWeek")?.value||0;if(!sch)return alert("Selecione um horário para finalizar.");const mo=monthObj();mo.finishedTrainings=mo.finishedTrainings||{};mo.finishedTrainings[trainingKey(activeCategory,week,sch)]={category:activeCategory,week:week+1,schedule:sch,month:currentMonth,finishedAt:new Date().toISOString()};saveLocal();setSync("Finalizando e salvando treino online...","warn");const ok=await saveCloudNow();renderScore();renderRankings();if(isParentMode())renderParentMode();alert(ok?"Treino finalizado e salvo no banco online!":"Treino salvo neste celular, mas houve erro no banco online. Toque em Sincronizar agora quando a internet melhorar.");}
function rankRow(s,i){return`<div class="rankRow"><div class="rankLeft"><span>${i===0?"🥇":i===1?"🥈":i===2?"🥉":"⚽"}</span>${avatarHtml(s)}<span>${i+1}º - ${esc(s.name)}</span></div><strong>${s.total} pts</strong></div>`}
function renderRankings(){
  const categoryRanking=document.getElementById("categoryRanking");
  if(categoryRanking){const monthList=ranked(activeCategory),yearList=rankedAnnual(activeCategory);categoryRanking.innerHTML=`<h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthList.map(rankRow).join("")||"<p>Nenhum aluno ativo nesta categoria.</p>"}<h3 class="annualTitle">📅 Pontuação geral do ano</h3>${yearList.map(rankRow).join("")||"<p>Nenhuma pontuação anual nesta categoria.</p>"}`}
  const rg=document.getElementById("rankingGeneral");if(rg)rg.innerHTML="";
  const all=document.getElementById("allCategoryRankings");
  if(all){all.innerHTML=CATEGORIES.map(c=>{const monthly=ranked(c[0]),annual=rankedAnnual(c[0]);return`<div class="catCard cat-${c[1]}"><h2>${c[0]}</h2><h3>🏆 Pontuação mensal • ${currentMonth}</h3>${monthly.map(rankRow).join("")||"<p>Nenhum aluno ativo no mês.</p>"}<h3 class="annualTitle">📅 Pontuação geral do ano</h3>${annual.map(rankRow).join("")||"<p>Nenhuma pontuação anual.</p>"}</div>`}).join("")}
}
function renderCopyMonthPicker(){const picker=document.getElementById("copyMonthPicker");const available=MONTHS.filter(m=>m!==currentMonth&&Object.values(state.months?.[m]?.participants||{}).some(p=>p.schedules&&p.schedules.some(s=>(schedulesFor(activeCategory)).includes(s))));picker.innerHTML=available.map(m=>`<option value="${m}">${m}</option>`).join("")||`<option value="">Nenhum mês com agenda</option>`}
function copyAgendaFromMonth(){const source=document.getElementById("copyMonthPicker").value;if(!source)return alert("Nenhum mês com agenda para copiar.");const sourceMo=monthObj(source),targetMo=monthObj(currentMonth),schList=schedulesFor(activeCategory);const entries=Object.entries(sourceMo.participants||{}).filter(([id,p])=>{const st=studentById(id);return st&&st.category===activeCategory&&p.schedules&&p.schedules.some(s=>schList.includes(s))});if(!entries.length)return alert("Esse mês não possui agenda nessa categoria.");entries.forEach(([id,p])=>{targetMo.participants[id]={studentId:id,schedules:p.schedules.filter(s=>schList.includes(s)),weeks:Array.from({length:5},()=>({}))}});scheduleSave();renderAll();alert("Agenda da categoria copiada com pontuação zerada.")}
function clearCategoryAgenda(){if(!confirm("Limpar agenda desta categoria no mês atual?"))return;const schList=schedulesFor(activeCategory);activeByCategory().forEach(s=>{const p=participant(s.id,false);if(p)p.schedules=p.schedules.filter(x=>!schList.includes(x))});scheduleSave();renderAll()}
function renderPrintSelect(){const el=document.getElementById("printCategory");if(el)el.innerHTML=CATEGORIES.map(c=>`<option value="${c[0]}">${c[0]}</option>`).join("")}
function preparePrint(type){const cat=document.getElementById("printCategory").value;const list=type==="general"?ranked():ranked(cat);const title=type==="general"?"RANKING GERAL DO MÊS":cat;document.getElementById("printArea").innerHTML=`<div class="printCard"><img src="primo-logo.png" class="printLogo"><h1>${APP_TITLE_HTML}</h1><h2>${title} • ${currentMonth}</h2>${list.map((s,i)=>`<div class="printRow"><span>${i+1}º</span><span class="printPhoto">${s.photo?`<img src="${s.photo}">`:initials(s.name)}</span><span>${esc(s.name)}</span><strong>${s.total} pts</strong></div>`).join("")||"<p>Nenhum aluno.</p>"}</div>`}
function withTimeout(promise,ms,msg){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(msg||"Tempo de conexão esgotado")),ms))])}
function cloudReady(){return !!(SUPABASE_URL&&SUPABASE_KEY&&APP_ID)}
function supabaseHeaders(){return {"apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY,"Content-Type":"application/json","Accept":"application/json","Prefer":"return=representation"}}
function cloudUrl(){return String(SUPABASE_URL||"").replace(/\/$/,"")}
function cloudErrText(e){
  if(!e)return "erro desconhecido";
  if(typeof e==="string")return e;
  return e.message||e.error_description||e.details||e.hint||e.code||JSON.stringify(e);
}
async function loadCloudRest(){
  const url=cloudUrl()+"/rest/v1/primo_app_state?select=data,updated_at&app_id=eq."+encodeURIComponent(APP_ID)+"&limit=1";
  const r=await withTimeout(fetch(url,{method:"GET",headers:supabaseHeaders(),cache:"no-store"}),12000,"Banco demorou para responder via REST");
  const txt=await r.text();
  let json=null;try{json=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok)throw new Error("REST leitura "+r.status+": "+(json?cloudErrText(json):txt));
  return Array.isArray(json)?json[0]:json;
}
async function saveCloudRest(){
  norm();
  const payload={app_id:APP_ID,data:state,updated_at:new Date().toISOString()};
  const url=cloudUrl()+"/rest/v1/primo_app_state?on_conflict=app_id";
  const r=await withTimeout(fetch(url,{method:"POST",headers:{...supabaseHeaders(),"Prefer":"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)}),12000,"Banco demorou para salvar via REST");
  const txt=await r.text();
  let json=null;try{json=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok)throw new Error("REST salvar "+r.status+": "+(json?cloudErrText(json):txt));
  return json;
}
async function loadCloudClient(){
  if(!window.supabase)throw new Error("Biblioteca Supabase não carregou");
  sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{apikey:SUPABASE_KEY}}});
  const result=await withTimeout(sb.from("primo_app_state").select("data,updated_at").eq("app_id",APP_ID).maybeSingle(),12000,"Banco demorou para responder pelo client");
  if(result.error)throw result.error;
  return result.data;
}
async function saveCloudClient(){
  if(!window.supabase)throw new Error("Biblioteca Supabase não carregou");
  if(!sb)sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{apikey:SUPABASE_KEY}}});
  norm();
  const payload={app_id:APP_ID,data:state,updated_at:new Date().toISOString()};
  const result=await withTimeout(sb.from("primo_app_state").upsert(payload,{onConflict:"app_id"}),12000,"Banco demorou para salvar pelo client");
  if(result.error)throw result.error;
  return true;
}
async function initCloud(){
  let errors=[];
  try{
    setSync("Conectando ao banco online...");
    if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error("URL ou Publishable Key ausente no supabase-config.js");
    // V28: usa REST direto. Evita travar por CDN/cache do Supabase Client no iPhone/PWA.
    const data=await loadCloudRest();
    if(data&&data.data&&Object.keys(data.data).length){
      state=data.data; norm(); currentMonth=state.currentMonth||currentMonth; saveLocal();
    }else{
      await saveCloudRest();
    }
    setSync("✅ Banco online conectado.","ok");renderAll();
  }catch(e){
    errors.push(cloudErrText(e));
    console.error("Erro Supabase REST:",errors,e,{SUPABASE_URL,APP_ID});
    const detail=errors.join(" | ").slice(0,260);
    setSync("❌ Banco não conectou. REST: " + detail,"error");
    saveLocal();renderAll();
  }
}
async function saveCloud(){
  if(!cloudReady())return false;
  const stamp=new Date().toISOString();
  try{
    state.updatedAt=stamp;norm();
    await saveCloudRest();
    localStorage.setItem("primo_kids_last_cloud_ok",stamp);
    setSync("✅ Dados salvos online.","ok");return true;
  }catch(e){
    console.error("Erro ao salvar Supabase REST:",e,{SUPABASE_URL,APP_ID});
    setSync("❌ Não salvou online: REST "+cloudErrText(e).slice(0,180),"error");return false;
  }
}
function saveDbConfigFromScreen(){
  const url=document.getElementById("dbUrl")?.value?.trim();
  const anonKey=document.getElementById("dbKey")?.value?.trim();
  const appId=document.getElementById("dbAppId")?.value?.trim()||"primo_soccer_kids_league_2026";
  if(!url||!anonKey)return alert("Cole a Project URL e a Publishable Key do Supabase.");
  localStorage.setItem("primo_kids_db_config",JSON.stringify({url,anonKey,appId}));
  alert("Configuração salva neste aparelho. Agora feche e abra o app novamente para carregar com o banco correto.");
}
function fillDbConfigScreen(){
  const u=document.getElementById("dbUrl"), k=document.getElementById("dbKey"), a=document.getElementById("dbAppId");
  if(u)u.value=SUPABASE_URL||""; if(k)k.value=SUPABASE_KEY||""; if(a)a.value=APP_ID||"primo_soccer_kids_league_2026";
}
async function syncNow(){setSync("Sincronizando agora...");const ok=await saveCloud();alert(ok?"Sincronizado no banco online.":"Não conectou ao banco. Veja a mensagem verde/vermelha na tela para saber o erro exato.")}
async function loadCloud(){await initCloud()}

// ===== Logo + Link dos Pais v5 - seletor de todos os meses =====
let parentCategory = CATEGORIES[0][0];
let parentSelectedMonth = (()=>{
  try{
    const p = new URLSearchParams(location.search);
    const fromUrl = (p.get("mes") || p.get("month") || "").toUpperCase();
    const saved = localStorage.getItem("primo_kids_parent_month") || "";
    return MONTHS.includes(fromUrl) ? fromUrl : (MONTHS.includes(saved) ? saved : currentMonth);
  }catch(e){ return currentMonth; }
})();

function isParentMode(){
  const p = new URLSearchParams(location.search);
  return p.get("pais")==="1" || p.get("parents")==="1" || location.hash==="#pais";
}

function copyParentLink(){
  const url = location.origin + location.pathname + "?pais=1&mes=" + encodeURIComponent(parentSelectedMonth || currentMonth) + "&t=" + Date.now();
  const el = document.getElementById("parentLinkText");
  if(el) el.textContent = url;
  if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=>alert("Link dos pais copiado!"));
  } else {
    alert(url);
  }
}

function setParentCategory(cat){
  parentCategory = cat;
  renderParentMode();
}

function setParentMonth(m){
  if(!MONTHS.includes(m)) return;
  parentSelectedMonth = m;
  localStorage.setItem("primo_kids_parent_month", m);
  renderParentMode();
}

function renderParentMonthSelect(){
  ["parentMonthSelect","parentHeroMonthSelect"].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");
    sel.value=parentSelectedMonth;
  });
}

function ensureParentHeroMonthSelect(){
  if(!isParentMode()) return;
  let box=document.querySelector(".parentHeroMonthBox");
  const monthTitle=document.querySelector(".officialMonth");
  if(!box){
    box=document.createElement("div");
    box.className="parentHeroMonthBox";
    box.innerHTML='<select id="parentHeroMonthSelect" onchange="setParentMonth(this.value)" aria-label="Selecionar mês da disputa"></select>';
    if(monthTitle && monthTitle.parentNode) monthTitle.insertAdjacentElement("afterend", box);
  }
  let sel=document.getElementById("parentHeroMonthSelect");
  if(!sel){
    sel=document.createElement("select");
    sel.id="parentHeroMonthSelect";
    sel.setAttribute("aria-label","Selecionar mês da disputa");
    sel.onchange=()=>setParentMonth(sel.value);
    box.appendChild(sel);
  }
  box.style.setProperty("display","block","important");
  box.style.setProperty("visibility","visible","important");
  box.style.setProperty("opacity","1","important");
  sel.style.setProperty("display","block","important");
  sel.innerHTML=MONTHS.map(m=>`<option value="${m}">${m}</option>`).join("");
  sel.value=parentSelectedMonth;
}

function renderParentMode(){
  if(!MONTHS.includes(parentSelectedMonth)) parentSelectedMonth=currentMonth;
  const m=document.getElementById("parentMonth");if(m)m.textContent=parentSelectedMonth;
  const hm=document.getElementById("heroMonth");if(hm)hm.textContent=parentSelectedMonth;
  ensureParentHeroMonthSelect();
  renderParentMonthSelect();
  const tabs=document.getElementById("parentCategoryTabs");if(tabs){tabs.innerHTML=CATEGORIES.map(c=>{const active=c[0]===parentCategory?"active":"";return `<button class="btn-${c[1]} ${active}" onclick="setParentCategory('${c[0]}')">${c[0]}</button>`}).join("")}
  const area=document.getElementById("parentRankingArea");if(area){const monthList=rankedByMonth(parentCategory,parentSelectedMonth),yearList=rankedAnnual(parentCategory);area.innerHTML=`<div class="card rulesCard parentRulesOnly"><h2>REGRAS DO CAMPEONATO</h2><p id="parentRulesInline">${rulesHtml()}</p></div><div class="card"><h2 class="rankTitle"><img src="primo-logo.png" class="rankLogo"> ${parentCategory}</h2><h3>🏆 Pontuação mensal • ${parentSelectedMonth}</h3><div class="rankList">${monthList.map(rankRow).join("")||"<p>Nenhum resultado nesta categoria neste mês.</p>"}</div><h3 class="annualTitle">📅 Pontuação geral do ano</h3><div class="rankList">${yearList.map(rankRow).join("")||"<p>Nenhuma pontuação anual nesta categoria.</p>"}</div></div>`}
}
const renderRankingsBase = renderRankings;
renderRankings = function(){
  renderRankingsBase();
  if(isParentMode()) renderParentMode();
};

function initParentModeIfNeeded(){
  if(!isParentMode()) return;
  document.body.classList.add("parentMode");
  if(!localStorage.getItem("primo_kids_parent_month")) parentSelectedMonth=currentMonth;
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
      <h1>${APP_TITLE_HTML}</h1>
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
  document.getElementById("printArea").innerHTML=`<div class="printCard printOnlyCard print-${color}"><img src="primo-logo.png" class="printLogo"><h1>${APP_TITLE_HTML}</h1><h2>${title}</h2><div class="printTableOnly">${list.map((s,i)=>`<div class="printRow"><span>${i+1}º</span><span class="printPhoto">${s.photo?`<img src="${s.photo}" onclick="openPhoto('${s.photo}')">`:initials(s.name)}</span><span>${esc(s.name)}</span><strong>${s.total} pts</strong></div>`).join("")||"<p>Nenhum aluno.</p>"}</div></div>`;
};

window.addEventListener("beforeunload",()=>{try{saveLocal()}catch(e){}});
if(typeof isParentMode==="function" && isParentMode()){
  document.body.classList.add("parentMode");
  renderAll();
  initParentModeIfNeeded();
  renderParentMode();
}else{
  renderAll();
  showPage("dashboard");
}
initCloud();
setTimeout(()=>{ if(typeof initParentModeIfNeeded==="function") initParentModeIfNeeded(); if(typeof renderParentMode==="function" && isParentMode()) renderParentMode(); applyDashboardCover(); },300);
setInterval(()=>{if(isParentMode())loadCloud();},10000);
