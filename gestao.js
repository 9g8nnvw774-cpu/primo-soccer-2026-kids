/* =====================================================================
   V87 - GESTÃO: planos, mensalidades, agenda/vagas e valores
   - Os dados financeiros ficam na tabela primo_finance (separada).
     Só o login do dono lê/grava (RLS + função is_primo_admin).
   - Nada daqui vai para o link dos pais.
   - Depende de script.js (state, schedulesFor, authedFetch, etc.).
   ===================================================================== */
(function(){
"use strict";
if(typeof window==="undefined")return;

const G_VERSION="87";
const FIN_TABLE="primo_finance";
const PENDING_KEY="primo_gestao_pendente_v1";
const DIAS=[["Segunda","SEG"],["Terça","TER"],["Quarta","QUA"],["Quinta","QUI"],["Sexta","SEX"],["Sábado","SÁB"],["Domingo","DOM"]];
const PLANOS=["Anual","Semestral","Mensal"];
const PLANO_MESES={Anual:12,Semestral:6,Mensal:1};
const FORMAS=["Pix","Dinheiro","Cartão","Transferência"];
const DEFAULT_SETTINGS={
  prices:{
    Anual:{"1x":160,"2x":270,pont1x:null,pont2x:250},
    Semestral:{"1x":170,"2x":280,pont1x:null,pont2x:260},
    Mensal:{"1x":190,"2x":300,pont1x:null,pont2x:null}
  },
  avulsa:55, uniforme:100, ownPct:72, profNome:"Outro professor",
  repasse:[
    {dia:"Quinta",hora:"17:30",pct:14},{dia:"Sexta",hora:"17:30",pct:14},{dia:"Sexta",hora:"18:15",pct:14},
    {dia:"Sexta",hora:"19:15",pct:14},{dia:"Sábado",hora:"09:30",pct:14},{dia:"Sábado",hora:"10:15",pct:14},
    {dia:"Sábado",hora:"11:00",pct:14}
  ]
};

let FIN=null;              // {version, settings, plans:{id:plan}, payments:{"2026-10":{id:pay}}}
let finStatus="idle";      // idle | loading | ok | missing | denied | error
let finErr="";
let saveTimer=null;
let ui={tab:"resumo",ym:"",payFilter:"todos",planFilter:"todos",search:"",day:null,sort:"asc"};

/* ---------- utilidades ---------- */
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const clone=o=>JSON.parse(JSON.stringify(o));
const e=t=>(typeof esc==="function"?esc(t):String(t??""));
function todayISO(){const d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function ymToday(){return todayISO().slice(0,7);}
function ymAdd(ym,n){let [y,m]=ym.split("-").map(Number);m+=n;while(m>12){m-=12;y++;}while(m<1){m+=12;y--;}return y+"-"+pad(m);}
function ymLabel(ym){const [y,m]=ym.split("-");return MONTHS[+m-1]+" "+y;}
function isoFromDate(t){return t.getFullYear()+"-"+pad(t.getMonth()+1)+"-"+pad(t.getDate());}
function addMonthsISO(iso,n){const [y,m,d]=iso.split("-").map(Number);const t=new Date(y,m-1+n,1);const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();t.setDate(Math.min(d,last));return isoFromDate(t);}
function addDaysISO(iso,n){const [y,m,d]=iso.split("-").map(Number);return isoFromDate(new Date(y,m-1,d+n));}
function daysUntil(iso){const [y,m,d]=iso.split("-").map(Number);const [a,b,c]=todayISO().split("-").map(Number);return Math.round((new Date(y,m-1,d)-new Date(a,b-1,c))/864e5);}
function brDate(iso){if(!iso)return "—";const [y,m,d]=iso.split("-");return d+"/"+m+"/"+y;}
function brShort(iso){if(!iso)return "—";const [,m,d]=iso.split("-");return d+"/"+m;}
function brl(v){v=Math.round((+v||0)*100)/100;return "R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2});}
function normName(t){return String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
function shortCat(c){return String(c||"").replace(/\s*anos?$/i,"");}
function diaShort(dia){const f=DIAS.find(d=>d[0]===dia);return f?f[1]:String(dia||"").slice(0,3).toUpperCase();}
function students(){return (state&&Array.isArray(state.students)?state.students:[]).filter(s=>s.active!==false);}
function canWrite(){return finStatus==="ok"&&!!FIN;}
function gVisible(){const pg=$("page-gestao");return !!pg&&!pg.classList.contains("hidden");}

/* ---------- dados ---------- */
function finNorm(d){
  const f=(d&&typeof d==="object")?clone(d):{};
  f.version=1;
  const s=f.settings||{};
  const prices={};
  PLANOS.forEach(p=>{prices[p]=Object.assign({},DEFAULT_SETTINGS.prices[p],(s.prices||{})[p]||{});});
  f.settings=Object.assign({},clone(DEFAULT_SETTINGS),s,{prices});
  if(!Array.isArray(f.settings.repasse))f.settings.repasse=clone(DEFAULT_SETTINGS.repasse);
  if(!f.plans||typeof f.plans!=="object")f.plans={};
  if(!f.payments||typeof f.payments!=="object")f.payments={};
  if(!/^\d{4}-\d{2}$/.test(f.settings.inicioControle||""))f.settings.inicioControle=ymToday();
  return f;
}
const VIEW=()=>FIN||finNorm(null);   // leitura quando o financeiro ainda não carregou
function readPending(){try{const p=JSON.parse(localStorage.getItem(PENDING_KEY)||"null");return p&&p.app===APP_ID?p.data:null;}catch(err){return null;}}
function writePending(){try{localStorage.setItem(PENDING_KEY,JSON.stringify({app:APP_ID,at:new Date().toISOString(),data:FIN}));}catch(err){}}
function clearPending(){try{localStorage.removeItem(PENDING_KEY);}catch(err){}}

async function finLoad(force){
  if(typeof isParentMode==="function"&&isParentMode())return;
  if(typeof isAdminAuthenticated!=="function"||!isAdminAuthenticated())return;
  if(finStatus==="loading")return;
  if(FIN&&finStatus==="ok"&&!force)return;
  finStatus="loading";finErr="";refresh();
  try{
    // 1) o login atual é o dono?
    const rc=await authedFetch(cloudUrl()+"/rest/v1/rpc/is_primo_admin",{method:"POST",body:"{}"});
    if(rc.status===404){finStatus="missing";FIN=null;return;}
    const okTxt=await rc.text();
    if(!rc.ok)throw new Error("Verificação "+rc.status+": "+okTxt.slice(0,140));
    if(okTxt.trim()!=="true"){finStatus="denied";FIN=null;return;}
    // 2) carrega o financeiro
    const url=cloudUrl()+"/rest/v1/"+FIN_TABLE+"?select=data,updated_at&app_id=eq."+encodeURIComponent(APP_ID)+"&limit=1";
    const r=await authedFetch(url,{method:"GET",headers:{"Accept":"application/json"}});
    const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null;}catch(err){}
    if(r.status===404||(j&&(j.code==="PGRST205"||j.code==="42P01"))){finStatus="missing";FIN=null;return;}
    if(!r.ok)throw new Error("Leitura "+r.status+": "+((j&&j.message)||txt).slice(0,140));
    const row=Array.isArray(j)?j[0]:j;
    const pend=readPending();
    FIN=finNorm(pend||(row&&row.data));
    finStatus="ok";
    if(pend)finSaveNow();
  }catch(err){
    finStatus="error";finErr=String(err&&err.message||err);
    const pend=readPending(); if(pend){FIN=finNorm(pend);}   // mostra o que ficou no celular, só leitura
  }finally{refresh();}
}
function finChanged(){
  if(!canWrite())return;
  FIN.updatedAt=new Date().toISOString();
  writePending();
  clearTimeout(saveTimer);saveTimer=setTimeout(finSaveNow,450);
}
let _retry=null;
async function finSaveNow(){
  if(!canWrite())return false;
  clearTimeout(saveTimer);
  try{
    const r=await authedFetch(cloudUrl()+"/rest/v1/"+FIN_TABLE+"?on_conflict=app_id",{method:"POST",
      headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({app_id:APP_ID,data:FIN,updated_at:new Date().toISOString()})});
    if(!r.ok){const t=await r.text();throw new Error("Salvar "+r.status+": "+t.slice(0,140));}
    clearPending();
    if(typeof setSync==="function")setSync("✅ Gestão salva online.","ok");
    return true;
  }catch(err){
    console.warn("Gestão não salvou agora:",err);
    if(typeof setSync==="function")setSync("💾 Gestão salva neste celular. Sincronizo quando a internet voltar.","warn");
    clearTimeout(_retry);_retry=setTimeout(()=>{if(readPending())finSaveNow();},8000);
    return false;
  }
}
window.addEventListener("online",()=>{if(readPending()&&canWrite())finSaveNow();});

/* ---------- regras de preço / plano ---------- */
function planOf(id){const f=FIN||null;return f&&f.plans[id]||null;}
function priceInfo(pl,F){
  F=F||VIEW();
  const t=F.settings.prices[pl&&pl.plano];
  if(!t)return null;
  const desc=+pl.desc||0;
  const base=+t[pl.freq]||0;
  const pRaw=t["pont"+pl.freq];
  const hasPont=pRaw!==null&&pRaw!==""&&pRaw!==undefined&&!isNaN(+pRaw);
  const full=Math.max(0,base-desc);
  const pont=hasPont?Math.max(0,+pRaw-desc):null;
  return {base,full,pont,onTime:pont!=null?pont:full,bolsa:full===0&&(pont==null||pont===0)};
}
function planEnd(pl){
  if(!pl||!pl.inicio||!PLANO_MESES[pl.plano]||pl.plano==="Mensal")return null;
  return addDaysISO(addMonthsISO(pl.inicio,PLANO_MESES[pl.plano]),-1);
}
function planState(pl){
  const end=planEnd(pl); if(!end)return {end:null,lvl:"",txt:pl&&pl.plano==="Mensal"?"renova todo mês":"sem data de início"};
  const d=daysUntil(end);
  if(d<0)return {end,lvl:"r",txt:"venceu em "+brDate(end)};
  if(d<=30)return {end,lvl:"y",txt:"vence em "+brDate(end)+" ("+d+" dia"+(d===1?"":"s")+")"};
  return {end,lvl:"g",txt:"até "+brDate(end)};
}
function planLine(pl,F){
  const pi=priceInfo(pl,F); if(!pi)return "plano inválido";
  if(pi.bolsa)return `${pl.plano} ${pl.freq} · bolsa 100%`;
  return `${pl.plano} ${pl.freq} · ${brl(pi.onTime)}${pi.pont!=null&&pi.pont!==pi.full?` (${brl(pi.full)} após venc.)`:""} · dia ${pl.venc||10}`;
}
function valorDevido(pi,due,payDate){return (pi.pont!=null&&payDate<=due)?pi.pont:pi.full;}

/* ---------- mensalidades do mês ---------- */
function chargesFor(ym){
  const F=VIEW(),today=todayISO(),out=[];
  if(ym<F.settings.inicioControle)return out;
  students().forEach(s=>{
    const pl=F.plans[s.id];
    if(!pl){out.push({s,status:"semplano",valor:0});return;}
    if(pl.inicio&&pl.inicio.slice(0,7)>ym)return;                    // plano ainda não começou
    const pi=priceInfo(pl,F); if(!pi){out.push({s,pl,status:"semplano",valor:0});return;}
    let due=ym+"-"+pad(+pl.venc||10);
    if(pl.inicio&&pl.inicio.slice(0,7)===ym&&pl.inicio>due)due=pl.inicio;   // 1ª mensalidade: vence no dia da matrícula
    const pay=(F.payments[ym]||{})[s.id]||null;
    let status;
    if(pi.bolsa)status="bolsa";
    else if(pay&&pay.pagoEm)status="pago";
    else if(today>due)status="atrasado";
    else status="avencer";
    const valor=status==="pago"?(+pay.valor||0):status==="atrasado"?pi.full:status==="bolsa"?0:pi.onTime;
    const end=planEnd(pl);
    out.push({s,pl,pi,due,pay,status,valor,planoVencido:!!(end&&end.slice(0,7)<ym)});
  });
  const ord={atrasado:0,avencer:1,semplano:2,pago:3,bolsa:4};
  return out.sort((a,b)=>(ord[a.status]-ord[b.status])||a.s.name.localeCompare(b.s.name));
}
function totals(list){
  const t={previsto:0,recebido:0,aReceber:0,atrasado:0,nAtrasado:0,nPago:0,nAvencer:0,nSem:0,nBolsa:0};
  list.forEach(c=>{
    if(c.status==="semplano"){t.nSem++;return;}
    if(c.status==="bolsa"){t.nBolsa++;return;}
    t.previsto+=c.valor;
    if(c.status==="pago"){t.recebido+=c.valor;t.nPago++;}
    if(c.status==="avencer"){t.aReceber+=c.valor;t.nAvencer++;}
    if(c.status==="atrasado"){t.atrasado+=c.valor;t.nAtrasado++;}
  });
  return t;
}

/* ---------- agenda / vagas / repasse ---------- */
function schedParts(sch){
  const s=String(sch||"");const dia=s.split(" ")[0];const m=s.match(/(\d{1,2}):(\d{2})/);
  return {dia,hora:m?pad(+m[1])+":"+m[2]:""};
}
function pctFor(sch,F){
  F=F||VIEW();const k=schedParts(sch);
  const r=(F.settings.repasse||[]).find(x=>x.dia===k.dia&&x.hora===k.hora);
  return r?{pct:+r.pct||0,outro:true}:{pct:+F.settings.ownPct||0,outro:false};
}
function studentScheds(id){try{const p=participant(id,false);return (p&&p.schedules)||[];}catch(err){return [];}}
function valorMensal(s,F){F=F||VIEW();const pl=F.plans[s.id];if(!pl)return 0;const pi=priceInfo(pl,F);return pi?pi.onTime:0;}
function lucroAluno(s,valor,F){
  F=F||VIEW();const sch=studentScheds(s.id);
  if(!sch.length)return valor*(+F.settings.ownPct||0)/100;
  return sch.reduce((t,x)=>t+valor/sch.length*pctFor(x,F).pct/100,0);
}
function agendaCells(){
  const F=VIEW(),cells={};
  CATEGORIES.forEach(([cat])=>{
    const studs=students().filter(s=>s.category===cat);
    schedulesFor(cat).forEach(sch=>{
      const k=schedParts(sch); if(!k.hora)return;
      const list=studs.filter(s=>studentScheds(s.id).includes(sch));
      const cap=slotCapacity(cat,sch), pf=pctFor(sch,F);
      let rec=0;
      const alunos=list.map(s=>{const v=valorMensal(s,F)/Math.max(1,studentScheds(s.id).length);rec+=v;return {s,v,dois:studentScheds(s.id).length>1};});
      const key=k.dia+"|"+k.hora;
      const c=cells[key]||(cells[key]={dia:k.dia,hora:k.hora,turmas:[],n:0,cap:0,rec:0,lucro:0,outro:false});
      c.turmas.push({sch,cat,cap,alunos,rec,lucro:rec*pf.pct/100,pct:pf.pct,outro:pf.outro});
      c.n+=list.length;c.cap+=cap;c.rec+=rec;c.lucro+=rec*pf.pct/100;c.outro=c.outro||pf.outro;
    });
  });
  Object.values(cells).forEach(c=>{const free=c.cap-c.n;c.free=free;c.lvl=free<=0?"r":free<=2?"y":"g";});
  return cells;
}
function vagaTxt(free){return free<0?`${-free} acima`:free===0?"lotado":free===1?"1 vaga":`${free} vagas`;}

/* ---------- render principal ---------- */
function refresh(){if(gVisible())gRender();renderPlanFormState();}
function gRender(){
  const root=$("gestaoRoot"); if(!root)return;
  const tabs=[["resumo","Resumo"],["mensal","Mensalidades"],["planos","Planos"],["agenda","Agenda"],["valores","Valores"],["ajustes","Ajustes"]];
  root.innerHTML=`
    <div class="gHead"><h2>Gestão</h2><p>Planos, mensalidades, vagas e valores · só você vê esta aba</p></div>
    ${statusCard()}
    <div class="gChips" role="tablist">${tabs.map(([k,l])=>`<button type="button" data-act="tab" data-v="${k}" class="${ui.tab===k?"on":""}">${l}</button>`).join("")}</div>
    <div id="gBody">${({resumo:viewResumo,mensal:viewMensal,planos:viewPlanos,agenda:viewAgenda,valores:viewValores,ajustes:viewAjustes}[ui.tab]||viewResumo)()}</div>`;
}
function statusCard(){
  if(finStatus==="ok")return "";
  if(finStatus==="loading"||finStatus==="idle")return `<div class="gNote">Carregando a gestão…</div>`;
  if(finStatus==="missing")return `<div class="gAlert r"><b>Falta configurar o banco da Gestão</b>Rode o arquivo <b>1_SUPABASE_GESTAO.sql</b> no Supabase (SQL Editor) e toque em tentar de novo.<button type="button" class="gBtn" data-act="reload">Tentar de novo</button></div>`;
  if(finStatus==="denied")return `<div class="gAlert r"><b>Seu login não está liberado no financeiro</b>O e-mail do arquivo 1_SUPABASE_GESTAO.sql precisa ser o mesmo do login do app. Corrija, rode de novo e toque abaixo.<button type="button" class="gBtn" data-act="reload">Tentar de novo</button></div>`;
  return `<div class="gAlert y"><b>Sem conexão com a Gestão</b>${e(finErr)}${readPending()?"<br>Mostrando os dados salvos neste celular (só leitura).":""}<button type="button" class="gBtn" data-act="reload">Tentar de novo</button></div>`;
}

/* RESUMO */
function viewResumo(){
  const F=VIEW(),list=chargesFor(ui.ym),t=totals(list),cells=Object.values(agendaCells());
  const lucro=list.filter(c=>c.status!=="semplano"&&c.status!=="bolsa").reduce((s,c)=>s+lucroAluno(c.s,c.valor,F),0);
  const freeT=cells.reduce((s,c)=>s+Math.max(0,c.free),0),capT=cells.reduce((s,c)=>s+c.cap,0),nT=cells.reduce((s,c)=>s+c.n,0);
  const comPlano=students().filter(s=>F.plans[s.id]).length;
  const pctRec=t.previsto?Math.round(t.recebido/t.previsto*100):0;
  const alerts=[];
  const atr=list.filter(c=>c.status==="atrasado");
  if(atr.length)alerts.push(["r","⏰",`${atr.length} mensalidade(s) em atraso · ${brl(t.atrasado)}`,atr.slice(0,6).map(c=>c.s.name).join(", ")+(atr.length>6?"…":""),"mensal","atrasado"]);
  const venc=students().map(s=>({s,pl:F.plans[s.id]})).filter(x=>x.pl).map(x=>({...x,st:planState(x.pl)})).filter(x=>x.st.lvl==="r"||x.st.lvl==="y");
  if(venc.length)alerts.push(["y","📅",`${venc.length} plano(s) vencendo ou vencido(s)`,venc.slice(0,6).map(x=>x.s.name).join(", ")+(venc.length>6?"…":""),"planos","vencendo"]);
  const sem=students().filter(s=>!F.plans[s.id]);
  if(sem.length)alerts.push(["y","⚠️",`${sem.length} aluno(s) sem plano lançado`,sem.slice(0,6).map(s=>s.name).join(", ")+(sem.length>6?"…":""),"planos","semplano"]);
  const mat=students().filter(s=>{const pl=F.plans[s.id];return pl&&pl.matricula&&!pl.matricula.pagoEm;});
  if(mat.length)alerts.push(["i","👕",`${mat.length} uniforme/matrícula a receber`,mat.slice(0,6).map(s=>s.name).join(", "),"mensal","todos"]);
  cells.filter(c=>c.n>0&&c.n<=2).sort((a,b)=>a.rec-b.rec).slice(0,4).forEach(c=>alerts.push(["i","📉",`${c.dia} ${c.hora}: só ${c.n} aluno(s)`,`rende ${brl(c.rec)}/mês · seu lucro ${brl(c.lucro)}`,"agenda",c.dia]));
  return `
   ${monthNav()}
   <div class="gCard">
     <div class="gKpis">
       <div class="gKpi big"><span>Previsto em ${e(ymLabel(ui.ym))}</span><b>${brl(t.previsto)}</b><div class="gBar"><i style="width:${pctRec}%"></i></div><small>${pctRec}% recebido</small></div>
       <div class="gKpi ok"><span>Recebido</span><b>${brl(t.recebido)}</b><small>${t.nPago} pagamento(s)</small></div>
       <div class="gKpi bad"><span>Em atraso</span><b>${brl(t.atrasado)}</b><small>${t.nAtrasado} aluno(s)</small></div>
       <div class="gKpi"><span>A vencer</span><b>${brl(t.aReceber)}</b><small>${t.nAvencer} aluno(s)</small></div>
       <div class="gKpi"><span>Seu lucro estimado</span><b>${brl(lucro)}</b><small>${F.settings.ownPct}% seus horários · ${(F.settings.repasse[0]||{}).pct??14}% outro prof.</small></div>
       <div class="gKpi"><span>Alunos com plano</span><b>${comPlano}/${students().length}</b><small>${t.nBolsa} bolsista(s)</small></div>
       <div class="gKpi"><span>Vagas livres</span><b>${freeT}</b><small>${nT} de ${capT} ocupadas</small></div>
     </div>
   </div>
   <div class="gCard"><h3>Pontos de atenção</h3>
     ${alerts.map(a=>`<button type="button" class="gAlertRow ${a[0]}" data-act="goto" data-tab="${a[4]}" data-f="${e(a[5])}"><span class="ic">${a[1]}</span><span><b>${e(a[2])}</b>${e(a[3])}</span></button>`).join("")||`<p class="gNote">Tudo em dia. 👏</p>`}
   </div>`;
}
function monthNav(){return `<div class="gMonth"><button type="button" data-act="ym" data-v="-1" aria-label="Mês anterior">‹</button><b>${e(ymLabel(ui.ym))}</b><button type="button" data-act="ym" data-v="1" aria-label="Próximo mês">›</button></div>`;}

/* MENSALIDADES */
const ST_LBL={pago:"Pago",atrasado:"Atrasado",avencer:"A vencer",semplano:"Sem plano",bolsa:"Bolsa"};
function viewMensal(){
  const F=VIEW(),all=chargesFor(ui.ym),t=totals(all);
  const cnt=k=>all.filter(c=>c.status===k).length;
  const chips=[["todos","Todos",all.length],["atrasado","Atrasados",cnt("atrasado")],["avencer","A vencer",cnt("avencer")],["pago","Pagos",cnt("pago")],["semplano","Sem plano",cnt("semplano")]];
  const list=ui.payFilter==="todos"?all:all.filter(c=>c.status===ui.payFilter);
  const mats=students().map(s=>({s,pl:F.plans[s.id]})).filter(x=>x.pl&&x.pl.matricula&&!x.pl.matricula.pagoEm);
  if(ui.ym<F.settings.inicioControle)return `${monthNav()}<p class="gNote">O controle de mensalidades começa em <b>${e(ymLabel(F.settings.inicioControle))}</b>. Dá para mudar em Ajustes.</p>`;
  const abertos=all.filter(c=>c.status==="avencer"||c.status==="atrasado").length;
  return `
   ${monthNav()}
   <div class="gTiles">
     <div class="ok"><span>Recebido</span><b>${brl(t.recebido)}</b></div>
     <div><span>A receber</span><b>${brl(t.aReceber)}</b></div>
     <div class="bad"><span>Em atraso</span><b>${brl(t.atrasado)}</b></div>
   </div>
   <div class="gFilters">${chips.map(([k,l,n])=>`<button type="button" data-act="payf" data-v="${k}" class="${ui.payFilter===k?"on":""}">${l} <em>${n}</em></button>`).join("")}</div>
   ${mats.length&&ui.payFilter==="todos"?`<div class="gCard"><h3>Uniforme / matrícula a receber</h3>${mats.map(x=>`<div class="gRow" data-act="plan" data-id="${e(x.s.id)}"><div><b>${e(x.s.name)}</b><small>${e(shortCat(x.s.category))}</small></div><div class="r"><b>${brl(x.pl.matricula.valor)}</b><span class="gPill y">a receber</span></div></div>`).join("")}</div>`:""}
   ${abertos&&canWrite()&&ui.payFilter!=="pago"?`<button type="button" class="gBtn ghost slim" data-act="bulkpay">Marcar os ${abertos} em aberto como pagos</button>`:""}
   <div class="gCard gList">
     ${list.map(c=>{
       const sub=c.status==="semplano"?"toque para lançar o plano":c.status==="pago"?`pago em ${brShort(c.pay.pagoEm)}${c.pay.forma?" · "+e(c.pay.forma):""}`:c.status==="bolsa"?"bolsa 100%":`vence ${brShort(c.due)}${c.status==="atrasado"&&c.pi.pont!=null&&c.pi.pont!==c.pi.full?" · perdeu pontualidade":""}`;
       return `<div class="gRow" data-act="${c.status==="semplano"?"plan":"pay"}" data-id="${e(c.s.id)}">
         <div><b>${e(c.s.name)}${c.planoVencido?' <span class="gTag y">plano vencido</span>':""}</b><small>${e(shortCat(c.s.category))} · ${sub}</small></div>
         <div class="r"><b>${c.status==="semplano"?"—":brl(c.valor)}</b><span class="gPill ${c.status}">${ST_LBL[c.status]}</span></div></div>`;
     }).join("")||`<p class="gNote">Ninguém nesta lista.</p>`}
   </div>`;
}

/* PLANOS */
function viewPlanos(){
  const F=VIEW();
  const rows=students().map(s=>{const pl=F.plans[s.id];return {s,pl,st:pl?planState(pl):null};});
  const n={todos:rows.length,semplano:rows.filter(r=>!r.pl).length,vencendo:rows.filter(r=>r.st&&(r.st.lvl==="r"||r.st.lvl==="y")).length,ok:rows.filter(r=>r.pl).length};
  let list=rows;
  if(ui.planFilter==="semplano")list=rows.filter(r=>!r.pl);
  if(ui.planFilter==="vencendo")list=rows.filter(r=>r.st&&(r.st.lvl==="r"||r.st.lvl==="y"));
  if(ui.planFilter==="ok")list=rows.filter(r=>r.pl);
  const q=normName(ui.search); if(q)list=list.filter(r=>normName(r.s.name).includes(q));
  list.sort((a,b)=>(!!a.pl-!!b.pl)||a.s.name.localeCompare(b.s.name));
  return `
   <div class="gCard"><div class="gSearch"><input id="gSearch" type="search" placeholder="Buscar aluno" value="${e(ui.search)}" autocomplete="off"></div>
   <div class="gFilters">${[["todos","Todos"],["semplano","Sem plano"],["vencendo","Vencendo"],["ok","Com plano"]].map(([k,l])=>`<button type="button" data-act="planf" data-v="${k}" class="${ui.planFilter===k?"on":""}">${l} <em>${n[k]}</em></button>`).join("")}</div></div>
   <div class="gCard gList">
     ${list.map(r=>`<div class="gRow" data-act="plan" data-id="${e(r.s.id)}"><div><b>${e(r.s.name)}</b><small>${e(shortCat(r.s.category))} · ${r.pl?e(planLine(r.pl,F)):"sem plano"}</small></div>
       <div class="r">${r.pl?`<span class="gPill ${r.st.lvl||"n"}">${e(r.st.lvl===""?(r.pl.plano==="Mensal"?"mensal":"sem início"):r.st.lvl==="g"?"até "+brShort(r.st.end):r.st.lvl==="y"?"vence "+brShort(r.st.end):"vencido")}</span>`:`<span class="gPill semplano">lançar</span>`}</div></div>`).join("")||`<p class="gNote">Nenhum aluno.</p>`}
   </div>
   <div class="gCard"><h3>Importar da planilha</h3><p class="gNote">Cria os planos de uma vez a partir do arquivo <b>importar-gestao.json</b>. Não substitui planos já lançados.</p>
     <label class="gBtn ghost">Escolher arquivo<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>`;
}

/* AGENDA */
function dayList(cells){const set=new Set(Object.values(cells).map(c=>c.dia));return DIAS.filter(([d])=>set.has(d)||["Segunda","Terça","Quarta","Quinta","Sexta"].includes(d)).map(d=>d[0]);}
function viewAgenda(){
  const cells=agendaCells(),days=dayList(cells);
  const hours=[...new Set(Object.values(cells).map(c=>c.hora))].sort();
  if(!ui.day||!days.includes(ui.day))ui.day=days[0];
  const cols=days.length;
  let heat=`<div class="gHeat" style="grid-template-columns:44px repeat(${cols},1fr)"><div></div>${days.map(d=>`<div class="hd">${diaShort(d)}</div>`).join("")}`;
  hours.forEach(h=>{
    heat+=`<div class="tm">${h}</div>`;
    days.forEach(d=>{const c=cells[d+"|"+h];
      heat+=c?`<button type="button" class="cell ${c.lvl}${c.outro?" outro":""}" data-act="cell" data-d="${e(d)}" data-h="${h}"><b>${c.n}/${c.cap}</b><small>${c.outro?"outro prof.":c.turmas.length>1?c.turmas.length+" turmas":e(shortCat(c.turmas[0].cat).replace("Sub 11-12-13-14","S11-14").replace("Futbaby ","FB ").replace("Sub ","S"))}</small></button>`:`<div class="cell none">–</div>`;});
  });
  heat+=`</div>`;
  const dayCells=Object.values(cells).filter(c=>c.dia===ui.day).sort((a,b)=>a.hora.localeCompare(b.hora));
  const dayRec=dayCells.reduce((t,c)=>t+c.rec,0),dayL=dayCells.reduce((t,c)=>t+c.lucro,0);
  return `
   <div class="gCard"><h3>Mapa de vagas <small>agenda de ${e(currentMonth)}</small></h3>${heat}
     <div class="gLegend"><span style="--c:#34d399">3+ vagas</span><span style="--c:#fbbf24">1–2 vagas</span><span style="--c:#f87171">lotado</span><span style="--c:#c084fc">outro professor</span></div></div>
   <div class="gDays">${days.map(d=>`<button type="button" data-act="day" data-v="${e(d)}" class="${ui.day===d?"on":""}">${diaShort(d)}</button>`).join("")}</div>
   <p class="gNote">${dayCells.length} horário(s) · ${brl(dayRec)}/mês · seu lucro ${brl(dayL)}</p>
   ${dayCells.map(cellCard).join("")||`<p class="gNote">Nenhum horário neste dia.</p>`}`;
}
function cellCard(c){
  return `<div class="gCard gSlot" id="gslot-${c.hora.replace(":","")}">
    <div class="gSlotTop"><div><div class="hr">${c.hora}</div><div class="cat">${c.turmas.map(t=>e(shortCat(t.cat))).join(" + ")}</div></div><span class="gPill ${c.lvl}">${c.n}/${c.cap} · ${vagaTxt(c.free)}</span></div>
    <div class="gMoney"><div><span>Receita/mês</span><b>${brl(c.rec)}</b></div><div><span>≈ por aula</span><b>${brl(c.rec/4)}</b></div>
      <div class="w"><span>Seu lucro${c.outro?" (repasse)":""}</span><b class="pos">${brl(c.lucro)}</b></div></div>
    ${c.turmas.map(t=>`<div class="gTurma"><div class="gTurmaHd"><span>${e(t.sch)}</span><span class="gTag ${t.outro?"p":"b"}">${t.pct}%${t.outro?" · "+e(VIEW().settings.profNome):""}</span></div>
      ${t.alunos.map(a=>{const pl=VIEW().plans[a.s.id];return `<div class="gRow sm" data-act="plan" data-id="${e(a.s.id)}"><div><b>${e(a.s.name)}${a.dois?' <span class="gTag b">2x</span>':""}</b><small>${pl?e(pl.plano+" "+pl.freq):"sem plano"}${a.dois?" · metade neste horário":""}</small></div><div class="r"><b>${pl?brl(a.v):"—"}</b></div></div>`;}).join("")||`<p class="gNote">Sem alunos · ${t.cap} vagas livres</p>`}</div>`).join("")}
  </div>`;
}

/* VALORES */
function viewValores(){
  const cells=Object.values(agendaCells()).filter(c=>c.n>0).sort((a,b)=>ui.sort==="asc"?a.rec-b.rec:b.rec-a.rec);
  const max=Math.max(1,...cells.map(c=>c.rec));
  const tot=cells.reduce((t,c)=>t+c.rec,0),luc=cells.reduce((t,c)=>t+c.lucro,0);
  return `<div class="gCard"><h3>Quanto cada horário rende</h3>
    <div class="gTiles two"><div><span>Receita da agenda</span><b>${brl(tot)}</b></div><div class="ok"><span>Seu lucro</span><b>${brl(luc)}</b></div></div>
    <div class="gFilters">${[["asc","Menor receita"],["desc","Maior receita"]].map(([k,l])=>`<button type="button" data-act="sort" data-v="${k}" class="${ui.sort===k?"on":""}">${l}</button>`).join("")}</div>
    ${cells.map(c=>`<div class="gRank" data-act="cell" data-d="${e(c.dia)}" data-h="${c.hora}">
      <div class="top"><b>${e(diaShort(c.dia))} ${c.hora}</b><span>${c.n}/${c.cap} · ${e(c.turmas.map(t=>shortCat(t.cat)).join(" + "))}${c.outro?' <span class="gTag p">'+(c.turmas[0].pct)+'%</span>':""}</span><b class="v">${brl(c.rec)}</b></div>
      <div class="bot"><div class="gBar"><i style="width:${c.rec/max*100}%" class="${c.outro?"p":""}"></i></div><span>seu lucro ${brl(c.lucro)}</span></div></div>`).join("")||`<p class="gNote">Sem alunos na agenda de ${e(currentMonth)}.</p>`}
    <p class="gNote">Aluno 2x conta metade da mensalidade em cada horário. Valores pelo preço com pontualidade. Horários do outro professor contam ${(VIEW().settings.repasse[0]||{}).pct??14}% para você.</p></div>`;
}

/* AJUSTES */
function viewAjustes(){
  const F=VIEW(),S=F.settings,dis=canWrite()?"":"disabled";
  const num=(path,v,ph)=>`<input type="number" inputmode="decimal" data-set="${path}" value="${v==null?"":v}" placeholder="${ph||""}" ${dis}>`;
  return `
   <div class="gCard"><h3>Tabela de preços</h3>
    <div class="gPriceGrid"><span></span><span>1x</span><span>2x</span><span>1x pont.</span><span>2x pont.</span>
      ${PLANOS.map(p=>`<b>${p}</b>${num("prices."+p+".1x",S.prices[p]["1x"])}${num("prices."+p+".2x",S.prices[p]["2x"])}${num("prices."+p+".pont1x",S.prices[p].pont1x,"—")}${num("prices."+p+".pont2x",S.prices[p].pont2x,"—")}`).join("")}
    </div>
    <p class="gNote">"Pont." = valor pagando até o vencimento. Deixe em branco onde não existe desconto de pontualidade.</p>
    <div class="gTwo"><label>Aula avulsa${num("avulsa",S.avulsa)}</label><label>Uniforme / matrícula${num("uniforme",S.uniforme)}</label></div>
   </div>
   <div class="gCard"><h3>Controle de mensalidades</h3>
    <label>Começar a cobrar a partir de<input type="month" data-set="inicioControle" value="${e(S.inicioControle)}" ${dis}></label>
    <p class="gNote">Meses antes disso não aparecem como atrasados.</p>
   </div>
   <div class="gCard"><h3>Lucro e repasse</h3>
    <div class="gTwo"><label>Seu lucro nos seus horários (%)${num("ownPct",S.ownPct)}</label><label>Nome do outro professor<input type="text" data-set="profNome" value="${e(S.profNome)}" ${dis}></label></div>
    <p class="gNote">Horários do outro professor (você fica com a % ao lado):</p>
    ${S.repasse.map((r,i)=>`<div class="gRep"><select data-rep="${i}" data-k="dia" ${dis}>${DIAS.map(([d])=>`<option ${d===r.dia?"selected":""}>${d}</option>`).join("")}</select><input type="time" data-rep="${i}" data-k="hora" value="${e(r.hora)}" ${dis}><input type="number" inputmode="decimal" data-rep="${i}" data-k="pct" value="${r.pct}" ${dis}><button type="button" class="gX" data-act="repdel" data-i="${i}" ${dis} aria-label="Remover">✕</button></div>`).join("")}
    <button type="button" class="gBtn ghost" data-act="repadd" ${dis}>+ Adicionar horário do outro professor</button>
   </div>
   <div class="gCard"><h3>Backup e segurança</h3>
    <button type="button" class="gBtn ghost" data-act="export" ${FIN?"":"disabled"}>Exportar backup da Gestão (.json)</button>
    <p class="gNote">Os valores ficam numa tabela separada que só o seu login acessa. O link dos pais não recebe nada desta aba. Ao tocar em "Sair Admin", os dados são apagados deste celular depois de sincronizar.</p>
   </div>`;
}

/* ---------- folhas (bottom sheet) ---------- */
function ensureOverlay(){
  if($("gOv"))return;
  const ov=document.createElement("div");ov.id="gOv";ov.className="gOv hidden";
  ov.innerHTML=`<div class="gSheet" id="gSheet" role="dialog" aria-modal="true"></div>`;
  ov.addEventListener("click",ev=>{if(ev.target===ov)closeSheet();});
  document.body.appendChild(ov);
  $("gSheet").addEventListener("click",onClick);
  $("gSheet").addEventListener("input",onSheetInput);
  $("gSheet").addEventListener("change",onSheetInput);
}
function openSheet(html){ensureOverlay();$("gSheet").innerHTML=`<div class="grab"></div>`+html;$("gOv").classList.remove("hidden");document.body.classList.add("gNoScroll");}
function closeSheet(){const ov=$("gOv");if(ov)ov.classList.add("hidden");document.body.classList.remove("gNoScroll");}

function planFormHtml(pl,prefix){
  pl=pl||{};const F=VIEW();
  const opt=(arr,v)=>arr.map(x=>`<option ${String(x)===String(v)?"selected":""}>${x}</option>`).join("");
  return `
   <div class="gTwo"><label>Plano<select id="${prefix}Plano">${opt(PLANOS,pl.plano||"Semestral")}</select></label>
   <label>Frequência<select id="${prefix}Freq">${opt(["1x","2x"],pl.freq||"1x")}</select></label></div>
   <div class="gTwo"><label>Desconto (R$)<input id="${prefix}Desc" type="number" inputmode="decimal" value="${pl.desc??""}" placeholder="0"></label>
   <label>Vencimento<select id="${prefix}Venc"><option value="10" ${+pl.venc!==20?"selected":""}>Dia 10</option><option value="20" ${+pl.venc===20?"selected":""}>Dia 20</option></select></label></div>
   <div class="gTwo"><label>Início do plano<input id="${prefix}Inicio" type="date" value="${e(pl.inicio||"")}"></label>
   <label>WhatsApp<input id="${prefix}Zap" type="tel" inputmode="tel" placeholder="do responsável" value="${e(pl.zap||"")}"></label></div>
   <label class="gCheck"><input id="${prefix}Mat" type="checkbox" ${pl.matricula?"checked":""}> Cobrar uniforme/matrícula (${brl(F.settings.uniforme)})</label>
   <div class="gSum" id="${prefix}Sum"></div>`;
}
function readPlanForm(prefix,old){
  const g=id=>$(prefix+id);
  if(!g("Plano"))return null;
  const F=VIEW();
  const pl={plano:g("Plano").value,freq:g("Freq").value,desc:+(g("Desc").value||0)||0,venc:+g("Venc").value||10,inicio:g("Inicio").value||"",zap:(g("Zap").value||"").trim()};
  if(g("Mat").checked)pl.matricula=(old&&old.matricula)?old.matricula:{valor:+F.settings.uniforme||100,pagoEm:null};
  else pl.matricula=null;
  if(old&&old.obs)pl.obs=old.obs;
  return pl;
}
function planSummary(prefix){
  const box=$(prefix+"Sum"); if(!box)return;
  const pl=readPlanForm(prefix,null); if(!pl){box.innerHTML="";return;}
  const pi=priceInfo(pl);const end=planEnd(pl);
  box.innerHTML=pi?`<div><span>Mensalidade</span><b>${pi.bolsa?"Bolsa 100%":brl(pi.onTime)}</b>${pi.pont!=null&&pi.pont!==pi.full?`<small>pagando até o dia ${pl.venc} · depois ${brl(pi.full)}</small>`:`<small>vence todo dia ${pl.venc}</small>`}</div>
    <div><span>Plano vale até</span><b>${pl.plano==="Mensal"?"renova todo mês":end?brDate(end):"—"}</b><small>tabela ${brl(pi.base)}${pl.desc?(pl.desc>0?" − "+brl(pl.desc):" + "+brl(-pl.desc)):""}</small></div>`:"";
}
function openPlan(id){
  const s=studentById(id); if(!s)return;
  const F=VIEW(),pl=F.plans[s.id]||null;
  const hist=[-5,-4,-3,-2,-1,0].map(n=>ymAdd(ymToday(),n)).map(ym=>{const c=chargesFor(ym).find(x=>x.s.id===s.id);return c?`<span class="gPill ${c.status}" title="${e(ymLabel(ym))}">${MONTHS[+ym.slice(5)-1].slice(0,3)}</span>`:"";}).join("");
  const st=pl?planState(pl):null;
  openSheet(`<h3>${e(s.name)}</h3><p class="gNote">${e(s.category)} · ${studentScheds(s.id).map(e).join(" e ")||"sem horário na agenda de "+e(currentMonth)}</p>
   ${pl?`<div class="gStatus"><span class="gPill ${st.lvl||"n"}">${e(st.txt)}</span>${hist?`<div class="gHist">${hist}</div>`:""}</div>`:`<div class="gAlert y"><b>Sem plano</b>Preencha e salve para começar a cobrar.</div>`}
   ${planFormHtml(pl||{inicio:todayISO()},"gp")}
   ${pl&&pl.matricula?`<div class="gRow sm"><div><b>Uniforme/matrícula</b><small>${pl.matricula.pagoEm?"pago em "+brDate(pl.matricula.pagoEm):"a receber"}</small></div><div class="r"><button type="button" class="gBtn mini ${pl.matricula.pagoEm?"ghost":""}" data-act="matpay" data-id="${e(s.id)}" ${canWrite()?"":"disabled"}>${pl.matricula.pagoEm?"Desfazer":"Marcar pago"}</button></div></div>`:""}
   <button type="button" class="gBtn" data-act="plansave" data-id="${e(s.id)}" ${canWrite()?"":"disabled"}>Salvar plano</button>
   ${pl&&planEnd(pl)?`<button type="button" class="gBtn ghost" data-act="renew" data-id="${e(s.id)}" ${canWrite()?"":"disabled"}>Renovar plano (começa ${brDate(addDaysISO(planEnd(pl),1))})</button>`:""}
   ${pl?`<button type="button" class="gBtn ghost" data-act="pay" data-id="${e(s.id)}">Mensalidade de ${e(ymLabel(ui.ym))}</button>`:""}
   ${pl?`<button type="button" class="gBtn danger" data-act="plandel" data-id="${e(s.id)}" ${canWrite()?"":"disabled"}>Remover plano</button>`:""}
   <button type="button" class="gBtn ghost" data-act="close">Fechar</button>
   ${canWrite()?"":`<p class="gNote">A Gestão não está conectada agora, então não dá para salvar.</p>`}`);
  planSummary("gp");
}
function openPay(id){
  const s=studentById(id); if(!s)return;
  const c=chargesFor(ui.ym).find(x=>x.s.id===id);
  if(!c||c.status==="semplano"){openPlan(id);return;}
  const zapBtn=c.pl.zap&&c.status!=="pago"&&c.status!=="bolsa"?`<a class="gBtn zap" target="_blank" rel="noopener" href="${zapLink(c)}">Cobrar no WhatsApp</a>`:"";
  if(c.status==="pago"){
    openSheet(`<h3>${e(s.name)}</h3><p class="gNote">${e(ymLabel(ui.ym))} · ${e(planLine(c.pl))}</p>
     <div class="gSum"><div><span>Pago em</span><b>${brDate(c.pay.pagoEm)}</b><small>${e(c.pay.forma||"")}</small></div><div><span>Valor</span><b>${brl(c.pay.valor)}</b><small>vencimento ${brShort(c.due)}</small></div></div>
     <button type="button" class="gBtn danger" data-act="unpay" data-id="${e(id)}" ${canWrite()?"":"disabled"}>Desfazer pagamento</button>
     <button type="button" class="gBtn ghost" data-act="plan" data-id="${e(id)}">Ver plano</button>
     <button type="button" class="gBtn ghost" data-act="close">Fechar</button>`);
    return;
  }
  const today=todayISO();
  openSheet(`<h3>${e(s.name)}</h3><p class="gNote">${e(ymLabel(ui.ym))} · ${e(planLine(c.pl))}</p>
   <div class="gStatus"><span class="gPill ${c.status}">${ST_LBL[c.status]}</span><span class="gNote">vencimento ${brDate(c.due)}</span></div>
   ${c.status==="bolsa"?`<p class="gNote">Aluno bolsista: nada a cobrar.</p>`:`
   <div class="gTwo"><label>Data do pagamento<input id="gpayDate" type="date" value="${today}"></label>
   <label>Forma<select id="gpayForma">${FORMAS.map(f=>`<option>${f}</option>`).join("")}</select></label></div>
   <label>Valor recebido (R$)<input id="gpayValor" type="number" inputmode="decimal" value="${valorDevido(c.pi,c.due,today)}"></label>
   <p class="gNote" id="gpayHint"></p>
   <button type="button" class="gBtn ok" data-act="paysave" data-id="${e(id)}" ${canWrite()?"":"disabled"}>Confirmar pagamento</button>`}
   ${zapBtn}
   <button type="button" class="gBtn ghost" data-act="plan" data-id="${e(id)}">Ver plano</button>
   <button type="button" class="gBtn ghost" data-act="close">Fechar</button>`);
  payHint(id);
}
function payHint(id){
  const c=chargesFor(ui.ym).find(x=>x.s.id===id);const h=$("gpayHint");if(!c||!h||!c.pi)return;
  const d=$("gpayDate").value||todayISO();
  h.textContent=c.pi.pont!=null&&c.pi.pont!==c.pi.full?(d<=c.due?`Com pontualidade: ${brl(c.pi.pont)} (até ${brShort(c.due)}).`:`Após o vencimento: ${brl(c.pi.full)} (sem desconto de pontualidade).`):"";
}
function zapLink(c){
  let n=String(c.pl.zap||"").replace(/\D/g,""); if(n.length<=11)n="55"+n;
  const first=String(c.s.name).split(" ")[0];
  const msg=c.status==="atrasado"
    ?`Olá! Tudo bem? A mensalidade de ${first} referente a ${ymLabel(ui.ym).toLowerCase()} (vencimento ${brDate(c.due)}) ainda está em aberto: ${brl(c.pi.full)}. Se já pagou, desconsidere. Obrigado! — Primo Soccer`
    :`Olá! Tudo bem? Lembrete da mensalidade de ${first} de ${ymLabel(ui.ym).toLowerCase()}: ${brl(c.pi.onTime)} pagando até ${brDate(c.due)}. Obrigado! — Primo Soccer`;
  return "https://wa.me/"+n+"?text="+encodeURIComponent(msg);
}

/* ---------- ações ---------- */
function setPayment(id,ym,obj){if(!FIN.payments[ym])FIN.payments[ym]={};if(obj)FIN.payments[ym][id]=obj;else delete FIN.payments[ym][id];}
function onClick(ev){
  const b=ev.target.closest("[data-act]"); if(!b||b.disabled)return;
  const act=b.dataset.act,id=b.dataset.id;
  if(act==="import")return;            // tratado no change
  switch(act){
    case "tab":ui.tab=b.dataset.v;gRender();window.scrollTo({top:($("page-gestao")||{}).offsetTop||0});break;
    case "goto":ui.tab=b.dataset.tab;if(ui.tab==="mensal")ui.payFilter=b.dataset.f||"todos";if(ui.tab==="planos")ui.planFilter=b.dataset.f||"todos";if(ui.tab==="agenda")ui.day=b.dataset.f||ui.day;gRender();break;
    case "ym":ui.ym=ymAdd(ui.ym,+b.dataset.v);gRender();break;
    case "payf":ui.payFilter=b.dataset.v;gRender();break;
    case "planf":ui.planFilter=b.dataset.v;gRender();break;
    case "day":ui.day=b.dataset.v;gRender();break;
    case "sort":ui.sort=b.dataset.v;gRender();break;
    case "cell":ui.tab="agenda";ui.day=b.dataset.d;gRender();setTimeout(()=>{const el=$("gslot-"+b.dataset.h.replace(":",""));if(el)el.scrollIntoView({behavior:"smooth",block:"start"});},60);break;
    case "reload":finLoad(true);break;
    case "plan":openPlan(id);break;
    case "pay":openPay(id);break;
    case "close":closeSheet();break;
    case "plansave":{
      if(!canWrite())return;const pl=readPlanForm("gp",FIN.plans[id]);
      if(!pl.inicio&&!confirm("Salvar sem data de início? Sem ela o app não calcula quando o plano vence."))return;
      FIN.plans[id]=pl;finChanged();closeSheet();refresh();break;}
    case "plandel":if(!canWrite()||!confirm("Remover o plano deste aluno? Os pagamentos já lançados continuam no histórico."))return;delete FIN.plans[id];finChanged();closeSheet();refresh();break;
    case "renew":{if(!canWrite())return;const pl=FIN.plans[id];const end=planEnd(pl);if(!end)return;
      if(!confirm(`Renovar ${pl.plano} ${pl.freq} a partir de ${brDate(addDaysISO(end,1))}?`))return;
      pl.inicio=addDaysISO(end,1);finChanged();openPlan(id);refresh();break;}
    case "matpay":{if(!canWrite())return;const m=FIN.plans[id]&&FIN.plans[id].matricula;if(!m)return;m.pagoEm=m.pagoEm?null:todayISO();finChanged();openPlan(id);refresh();break;}
    case "paysave":{
      if(!canWrite())return;const d=$("gpayDate").value||todayISO();const v=+($("gpayValor").value||0);
      if(!(v>0)&&!confirm("Valor zerado. Confirmar mesmo assim?"))return;
      setPayment(id,ui.ym,{valor:v,pagoEm:d,forma:$("gpayForma").value,lancadoEm:new Date().toISOString()});
      finChanged();closeSheet();refresh();break;}
    case "bulkpay":{
      if(!canWrite())return;const abertos=chargesFor(ui.ym).filter(c=>c.status==="avencer"||c.status==="atrasado");
      if(!abertos.length||!confirm(`Marcar ${abertos.length} mensalidade(s) de ${ymLabel(ui.ym)} como pagas no valor com pontualidade?\n\nUse isso só para acertar um mês que você já recebeu.`))return;
      const hoje=todayISO();
      abertos.forEach(c=>setPayment(c.s.id,ui.ym,{valor:c.pi.onTime,pagoEm:c.due<hoje?c.due:hoje,forma:"Lote",lancadoEm:new Date().toISOString()}));
      finChanged();refresh();break;}
    case "unpay":if(!canWrite()||!confirm("Desfazer este pagamento?"))return;setPayment(id,ui.ym,null);finChanged();closeSheet();refresh();break;
    case "repadd":if(!canWrite())return;FIN.settings.repasse.push({dia:"Sábado",hora:"12:00",pct:14});finChanged();gRender();break;
    case "repdel":if(!canWrite())return;FIN.settings.repasse.splice(+b.dataset.i,1);finChanged();gRender();break;
    case "export":exportFin();break;
  }
}
function onSheetInput(ev){
  const t=ev.target;
  if(t.id&&t.id.startsWith("gp")&&t.id!=="gpayDate")planSummary("gp");
  if(t.id==="gpayDate"){const id=$("gSheet").querySelector("[data-act=paysave]");if(id){const c=chargesFor(ui.ym).find(x=>x.s.id===id.dataset.id);if(c&&c.pi)$("gpayValor").value=valorDevido(c.pi,c.due,t.value||todayISO());payHint(id.dataset.id);}}
}
function onRootInput(ev){
  const t=ev.target;
  if(t.id==="gSearch"){ui.search=t.value;const pos=t.selectionStart;gRender();const n=$("gSearch");if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(err){}}return;}
  if(!canWrite())return;
  if(t.dataset.set&&ev.type==="change"){
    const path=t.dataset.set.split(".");let o=FIN.settings;for(let i=0;i<path.length-1;i++)o=o[path[i]];
    const k=path[path.length-1];
    o[k]=t.type==="number"?(t.value===""?null:+t.value):t.value;
    finChanged();
  }
  if(t.dataset.rep!=null&&ev.type==="change"){
    const r=FIN.settings.repasse[+t.dataset.rep];if(!r)return;
    r[t.dataset.k]=t.dataset.k==="pct"?(+t.value||0):t.value;finChanged();
  }
  if(t.dataset.act==="import"&&ev.type==="change")importFile(t);
}

/* ---------- importação / exportação ---------- */
function importFile(input){
  const file=input.files&&input.files[0];input.value="";if(!file)return;
  if(!canWrite())return alert("A Gestão precisa estar conectada para importar.");
  const rd=new FileReader();
  rd.onload=()=>{
    let j;try{j=JSON.parse(rd.result);}catch(err){return alert("Arquivo inválido.");}
    if(!j||j.tipo!=="primo-gestao-import"||!Array.isArray(j.alunos))return alert("Este arquivo não é a importação da Gestão.");
    const byName={};students().forEach(s=>{const k=normName(s.name);(byName[k]=byName[k]||[]).push(s);});
    const found=[],miss=[];let skip=0;
    j.alunos.forEach(a=>{
      const c=byName[normName(a.nome)]||[];
      const s=c.find(x=>x.category===a.categoria)||c[0];
      if(!s){miss.push(a);return;}
      if(FIN.plans[s.id]){skip++;return;}
      found.push({s,a});
    });
    if(!found.length){openSheet(`<h3>Importação</h3><p class="gNote">Nenhum plano novo para criar. ${skip} já tinham plano.</p>${missHtml(miss)}<button type="button" class="gBtn ghost" data-act="close">Fechar</button>`);return;}
    if(!confirm(`Criar ${found.length} plano(s)?\n${skip} aluno(s) já tinham plano (não mexo).\n${miss.length} nome(s) da planilha não achei no app.`))return;
    found.forEach(({s,a})=>{FIN.plans[s.id]={plano:a.plano,freq:a.freq,desc:+a.desc||0,venc:+a.venc||10,inicio:a.inicio||"",zap:"",matricula:null,obs:"Importado da planilha"};});
    finChanged();refresh();
    openSheet(`<h3>Importação concluída</h3><p class="gNote">${found.length} plano(s) criados. Confira a <b>data de início</b> de cada um em Planos (sem ela o app não sabe quando o plano vence).</p>${missHtml(miss)}<button type="button" class="gBtn ghost" data-act="close">Fechar</button>`);
  };
  rd.readAsText(file);
}
function missHtml(miss){return miss.length?`<div class="gAlert y"><b>Não achei no app (${miss.length})</b>${miss.map(a=>e(a.nome)).join(", ")}<br>Confira se o nome está igual no Cadastro e lance o plano manualmente.</div>`:"";}
function exportFin(){
  if(!FIN)return;
  const blob=new Blob([JSON.stringify({app:"Primo Soccer Kids · Gestão",exportedAt:new Date().toISOString(),data:FIN},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`gestao-primo-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

/* ---------- plano no CADASTRO ---------- */
function renderPlanFormState(){
  const box=$("cadPlanBox"); if(!box)return;
  const note=$("cadPlanNote");
  if(note)note.textContent=canWrite()?"":finStatus==="loading"?"Carregando a Gestão…":"A Gestão não está conectada: o aluno será cadastrado sem plano.";
  if(!$("cadPlano")&&box.dataset.ready!=="1"){box.dataset.ready="1";}
  planSummary("cad");
}
function initCadastro(){
  const box=$("cadPlanBox"); if(!box||box.dataset.built==="1")return;
  box.dataset.built="1";
  box.innerHTML=`<h3>Plano e mensalidade</h3>
   <label class="gCheck"><input id="cadTemPlano" type="checkbox" checked> Lançar plano agora</label>
   <div id="cadPlanFields">${planFormHtml({inicio:todayISO(),matricula:true},"cad")}</div>
   <p class="gNote" id="cadPlanNote"></p>`;
  box.addEventListener("input",()=>planSummary("cad"));
  box.addEventListener("change",ev=>{if(ev.target.id==="cadTemPlano")$("cadPlanFields").classList.toggle("hidden",!ev.target.checked);planSummary("cad");});
  planSummary("cad");
}
function resetCadastro(){const box=$("cadPlanBox");if(!box)return;box.dataset.built="";box.innerHTML="";initCadastro();renderPlanFormState();}

/* ---------- integração com o app ---------- */
function hook(){
  ui.ym=ymToday();
  ensureOverlay();
  const root=$("gestaoRoot");
  if(root){root.addEventListener("click",onClick);root.addEventListener("input",onRootInput);root.addEventListener("change",onRootInput);}
  initCadastro();

  // nova aba
  const _show=window.showPage;
  window.showPage=function(page){
    const pg=$("page-gestao"),tb=$("tab-gestao");
    const go=page==="gestao"&&!(typeof isParentMode==="function"&&isParentMode());
    if(pg)pg.classList.toggle("hidden",!go);
    if(tb)tb.classList.toggle("active",go);
    _show.call(this,go?"__gestao__":page);
    if(go){if(!FIN||finStatus!=="ok")finLoad(true);gRender();}
  };
  const _render=window.renderAll;
  window.renderAll=function(){const r=_render.apply(this,arguments);try{if(gVisible())gRender();renderPlanFormState();}catch(err){console.warn(err);}return r;};

  // cadastro: grava o plano junto com o aluno
  const _add=window.addStudent;
  window.addStudent=async function(){
    const want=$("cadTemPlano")&&$("cadTemPlano").checked;
    const name=($("studentName")&&$("studentName").value||"").trim();
    let pl=null;
    if(want&&name){
      if(!canWrite()){if(!confirm("A Gestão não está conectada. Cadastrar o aluno sem plano?"))return;}
      else pl=readPlanForm("cad",null);
    }
    const before=new Set((state.students||[]).map(s=>s.id));
    const r=await _add.apply(this,arguments);
    const added=(state.students||[]).find(s=>!before.has(s.id));
    if(added&&pl&&canWrite()){FIN.plans[added.id]=pl;finChanged();await finSaveNow();resetCadastro();refresh();}
    return r;
  };

  // login: carrega a gestão; sair: sincroniza e limpa o celular
  const _login=window.adminLogin;
  window.adminLogin=async function(){const r=await _login.apply(this,arguments);if(isAdminAuthenticated())finLoad(true);return r;};
  const _logout=window.adminLogout;
  window.adminLogout=async function(){
    let finOk=true,appOk=true;
    if(readPending()&&canWrite())finOk=await finSaveNow();
    try{appOk=await saveCloud();}catch(err){appOk=false;}
    if((!finOk||!appOk)&&!confirm("Há dados que ainda não foram para o banco online (sem internet?).\n\nOK = sair mesmo assim e MANTER os dados neste celular.\nCancelar = continuar logado.")){return;}
    await _logout.apply(this,arguments);
    FIN=null;finStatus="idle";
    if(finOk)clearPending();
    if(appOk){
      try{localStorage.removeItem(STORAGE_KEY);}catch(err){}
      try{state=defaultState();norm();}catch(err){}
      try{renderAll();}catch(err){}
    }
    closeSheet();
  };

  // versão visível em Config
  const _lbl=window.updateConfigLabels;
  window.updateConfigLabels=function(){if(_lbl)_lbl.apply(this,arguments);const v=$("appVersionLabel");if(v)v.textContent="Versão "+G_VERSION;};
  window.updateConfigLabels();

  if(isAdminAuthenticated()&&!isParentMode())setTimeout(()=>finLoad(true),300);
}

window.G={reload:()=>finLoad(true),_debug:()=>({FIN,finStatus,finErr,ui})};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook);else hook();
})();
