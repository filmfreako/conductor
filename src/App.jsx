import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { expensesRef, shiftsRef, earningsRef, tripsRef, addDocument, deleteDocument, subscribeToCollection, subscribeActiveDay, setActiveDay, archiveDay, subscribeArchives } from "./firebase.js";

function compressImage(u,mW=800,q=0.45){return new Promise(r=>{const i=new Image();i.onload=()=>{const c=document.createElement("canvas");let w=i.width,h=i.height;if(w>mW){h=(mW/w)*h;w=mW;}c.width=w;c.height=h;c.getContext("2d").drawImage(i,0,0,w,h);r(c.toDataURL("image/jpeg",q));};i.src=u;})}

const PLATE="QON389",PD=9;
const HOL=["2026-01-01","2026-01-12","2026-03-23","2026-04-02","2026-04-03","2026-05-01","2026-05-18","2026-06-08","2026-06-15","2026-06-29","2026-07-20","2026-08-07","2026-08-17","2026-10-12","2026-11-02","2026-11-16","2026-12-08","2026-12-25"];
const DP=[[9,0],[1,2],[3,4],[5,6],[7,8]],RD=new Date(2026,2,2);
function gRD(date){const d=new Date(date),w=d.getDay();if(w===0)return null;if(HOL.includes(d.toISOString().split("T")[0]))return null;return DP[((w-1)+Math.floor((d.getTime()-RD.getTime())/864e5/7))%5];}
function hR(date){const r=gRD(date);return r?r.includes(PD):false;}

function fCOP(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n)}
function fD(d){return new Date(d+"T12:00:00").toLocaleDateString("es-CO",{weekday:"short",day:"numeric",month:"short"})}
function gT(){return new Date().toISOString().split("T")[0]}
function gId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

const OP=0.60,DP2=0.40;
const MES=["Enero","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function getWeekRange(ds){const d=new Date(ds+"T12:00:00"),dy=d.getDay(),m=new Date(d);m.setDate(d.getDate()-((dy+6)%7));const s=new Date(m);s.setDate(m.getDate()+6);return{start:m.toISOString().split("T")[0],end:s.toISOString().split("T")[0]};}
function isInWeek(ds){const{start,end}=getWeekRange(gT());return ds>=start&&ds<=end;}

function dayTotals(e=[],x=[],t=[]){const tI=e.reduce((s,i)=>s+(i.totalEarnings||0),0)+t.reduce((s,i)=>s+(i.amount||0),0);const tO=x.reduce((s,i)=>s+(i.amount||0),0);const tC=e.reduce((s,i)=>s+(i.cashReceived||0),0);return{tI,tO,tC,net:tI-tO};}

function genXLS(data,archives){
  const wb=XLSX.utils.book_new(),td=new Date(),mn=MES[td.getMonth()]+" "+td.getFullYear();
  const allE=[...data.dailyEarnings,...archives.flatMap(a=>a.earnings||[])];
  const allX=[...data.expenses,...archives.flatMap(a=>a.expenses||[])];
  const allS=[...data.shifts,...archives.flatMap(a=>a.shifts||[])];
  const allT=[...data.personalTrips,...archives.flatMap(a=>a.trips||[])];
  const iM=ds=>{const d=new Date(ds+"T12:00:00");return d.getMonth()===td.getMonth()&&d.getFullYear()===td.getFullYear();};
  const mE=allE.filter(e=>iM(e.date)),mX=allX.filter(e=>iM(e.date)),mT=allT.filter(t=>iM(t.date));
  const tI=mE.reduce((s,e)=>s+(e.totalEarnings||0),0)+mT.reduce((s,t)=>s+(t.amount||0),0),tC=mE.reduce((s,e)=>s+(e.cashReceived||0),0),tO=mX.reduce((s,e)=>s+(e.amount||0),0);
  const r=[["RESUMEN — "+mn],[""],["Camioneta",PLATE],[""],["CONCEPTO","MONTO"],["Ingreso bruto",tI],["Gastos",tO],["Neto",tI-tO],["Efectivo",tC],[""],["DISTRIBUCIÓN","PROP (60%)","COND (40%)"],["Ingresos",tI*OP,tI*DP2],["Gastos",tO*OP,tO*DP2],["Neto",(tI-tO)*OP,(tI-tO)*DP2]];
  const w1=XLSX.utils.aoa_to_sheet(r);w1["!cols"]=[{wch:25},{wch:20},{wch:20}];XLSX.utils.book_append_sheet(wb,w1,"Resumen");
  const dr=[["FECHA","DÍA","INGRESOS","GASTOS","NETO","EFECTIVO","PROP","COND"]];
  archives.filter(a=>iM(a.date)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(a=>{const t=dayTotals(a.earnings,a.expenses,a.trips);const dn=new Date(a.date+"T12:00:00").toLocaleDateString("es-CO",{weekday:"long"});dr.push([a.date,dn,t.tI,t.tO,t.net,t.tC,t.net*OP,t.net*DP2]);});
  const w2=XLSX.utils.aoa_to_sheet(dr);w2["!cols"]=[{wch:14},{wch:12},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14}];XLSX.utils.book_append_sheet(wb,w2,"Por día");
  const er=[["FECHA","PLATAFORMA","TOTAL","EFECTIVO","PROP","COND"]];allE.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(e=>er.push([e.date,e.platform,e.totalEarnings,e.cashReceived,(e.totalEarnings||0)*OP,(e.totalEarnings||0)*DP2]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(er),"Ganancias");
  const xr=[["FECHA","TIPO","MONTO","NOTA","PROP","COND"]];allX.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(e=>xr.push([e.date,e.type,e.amount,e.note||"",(e.amount||0)*OP,(e.amount||0)*DP2]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(xr),"Gastos");
  const sr=[["FECHA","INICIO","FIN","HORAS"]];allS.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(s=>{const[sh,sm]=(s.start||'0:0').split(':').map(Number),[eh,em]=(s.end||'0:0').split(':').map(Number);let d=(eh*60+em)-(sh*60+sm);if(d<0)d+=1440;sr.push([s.date,s.start,s.end,`${Math.floor(d/60)}h ${d%60}m`]);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(sr),"Turnos");
  const tr=[["FECHA","RECORRIDO","HORARIO","CLIENTE","VALOR","PROP","COND"]];allT.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(t=>tr.push([t.date,t.route||"",t.time||"",t.client||"",t.amount,(t.amount||0)*OP,(t.amount||0)*DP2]));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(tr),"Viajes");
  XLSX.writeFile(wb,`Reporte_${PLATE}_${gT()}.xlsx`);
}

const I={
  gas:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/><path d="M15 10h2a2 2 0 012 2v3a2 2 0 002 2"/><path d="M3 22h12"/><rect x="6" y="8" width="6" height="4" rx="1"/></svg>,
  clock:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  dollar:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  car:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M5 17h14M6 17l-1-5 2-4h10l2 4-1 5"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>,
  route:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h3a4 4 0 004-4V9"/></svg>,
  alert:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  plus:<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  cam:<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  trash:<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  check:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>,
  x:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  plate:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="7" width="20" height="10" rx="3"/><path d="M7 12h10"/></svg>,
  owner:<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  xl:<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l3-3 3 3M9 12l3 3 3-3" strokeWidth="1.5"/></svg>,
  sync:<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  sun:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  play:<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  cal:<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
};

const CSS=`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}:root{--bg:#0A0E17;--sf:#111827;--cd:#1A2236;--bd:#283352;--tx:#F0F2F8;--t2:#7B8BA8;--ac:#06D6A0;--a2:#118AB2;--rd:#EF476F;--yl:#FFD166;--or:#F78C6B;--pu:#9B5DE5;--ow:#4EA8DE;--dr:#06D6A0;--xl:#217346}
html,body,#root{height:100%}body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--tx);-webkit-font-smoothing:antialiased}
.app{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
.hdr{padding:16px 18px 10px;display:flex;justify-content:space-between;align-items:flex-start}.hdr h1{font-size:22px;font-weight:800;letter-spacing:-.5px}
.pb{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--cd);border:1px solid var(--bd);border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:var(--yl);letter-spacing:1px}
.hd{font-size:12px;color:var(--t2);font-family:'JetBrains Mono',monospace;margin-top:4px}
.syn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:600;margin-top:4px}.syn.ok{background:rgba(6,214,160,.1);color:var(--ac)}.syn.off{background:rgba(239,71,111,.1);color:var(--rd)}
.pyp{margin:0 16px 10px;padding:12px 16px;border-radius:14px;display:flex;align-items:center;gap:12px;border:1px solid;font-size:14px}
.pyp.ok{background:rgba(6,214,160,.06);border-color:rgba(6,214,160,.2)}.pyp.bad{background:rgba(239,71,111,.08);border-color:rgba(239,71,111,.25)}
.pyp-i{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pyp.ok .pyp-i{background:rgba(6,214,160,.12);color:var(--ac)}.pyp.bad .pyp-i{background:rgba(239,71,111,.12);color:var(--rd)}
.pyp-m{font-weight:700}.pyp.ok .pyp-m{color:var(--ac)}.pyp.bad .pyp-m{color:var(--rd)}.pyp-s{font-size:11px;color:var(--t2);margin-top:2px}
.dbn{margin:0 16px 10px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,209,102,.25);background:rgba(255,209,102,.05);display:flex;align-items:center;gap:12px}
.dbn-i{width:40px;height:40px;border-radius:10px;background:rgba(255,209,102,.1);color:var(--yl);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dbn-t{font-size:14px;font-weight:700;color:var(--yl)}.dbn-s{font-size:11px;color:var(--t2);margin-top:1px}
.cnt{flex:1;padding:0 16px 100px;overflow-y:auto}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:rgba(17,24,39,.94);backdrop-filter:blur(20px);border-top:1px solid var(--bd);display:flex;justify-content:space-around;padding:6px 0 max(8px,env(safe-area-inset-bottom));z-index:100}
.nb{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 8px 4px;border-radius:12px;cursor:pointer;color:var(--t2);transition:all .2s;background:none;border:none;font-family:'Outfit',sans-serif;font-size:10px;font-weight:600}.nb.act{color:var(--ac);background:rgba(6,214,160,.1)}
.card{background:var(--cd);border:1px solid var(--bd);border-radius:16px;padding:18px;margin-bottom:12px}
.clbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--t2);margin-bottom:10px}
.sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.st{font-size:18px;font-weight:700}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 18px;border-radius:12px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s;width:100%}.btn:active{transform:scale(.97)}
.bp{background:var(--ac);color:#0A0E17}.bs{padding:8px 14px;font-size:13px;width:auto;border-radius:10px}.bo{background:transparent;border:1px solid var(--bd);color:var(--t2)}.bx{background:rgba(33,115,70,.15);color:var(--xl);border:1px solid rgba(33,115,70,.3)}
.bnd{background:linear-gradient(135deg,rgba(6,214,160,.12),rgba(17,138,178,.12));border:1px solid rgba(6,214,160,.25);color:var(--ac);font-size:15px;padding:16px;border-radius:16px}
.fg{margin-bottom:14px}.fl{display:block;font-size:11px;font-weight:700;color:var(--t2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
.fi{width:100%;padding:12px 14px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;color:var(--tx);font-family:'Outfit',sans-serif;font-size:15px;outline:none}.fi:focus{border-color:var(--ac)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.chs{display:flex;gap:8px;flex-wrap:wrap}.ch{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid var(--bd);background:var(--sf);color:var(--t2)}.ch.a{border-color:var(--ac);background:rgba(6,214,160,.1);color:var(--ac)}
.li{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--bd)}.li:last-child{border-bottom:none}
.lic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lic.gas{background:rgba(247,140,107,.12);color:var(--or)}.lic.fuel{background:rgba(155,93,229,.12);color:var(--pu)}.lic.misc{background:rgba(123,139,168,.12);color:var(--t2)}.lic.earn{background:rgba(6,214,160,.12);color:var(--ac)}.lic.trip{background:rgba(17,138,178,.12);color:var(--a2)}
.lib{flex:1;min-width:0}.lim{font-size:14px;font-weight:600}.lis{font-size:12px;color:var(--t2);margin-top:2px}
.la{font-size:15px;font-weight:700;font-family:'JetBrains Mono',monospace}.la.r{color:var(--rd)}.la.g{color:var(--ac)}
.db{background:none;border:none;color:var(--t2);cursor:pointer;padding:6px;border-radius:8px;display:flex}.db:hover{color:var(--rd);background:rgba(239,71,111,.1)}
.rt{width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--bd);cursor:pointer}
.ua{border:2px dashed var(--bd);border-radius:12px;padding:20px;text-align:center;cursor:pointer;color:var(--t2)}.ua:hover{border-color:var(--ac);color:var(--ac)}
.up{width:100%;max-height:200px;object-fit:contain;border-radius:10px;margin-top:8px}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:flex-end;justify-content:center}
.ms{background:var(--cd);border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;padding:24px 20px max(24px,env(safe-area-inset-bottom));animation:su .3s ease}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
.mb2{width:36px;height:4px;background:var(--bd);border-radius:2px;margin:0 auto 18px}.mt2{font-size:18px;font-weight:700;margin-bottom:20px}
.iv{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}.iv img{max-width:100%;max-height:90vh;border-radius:12px}
.ic{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.15);border:none;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer}
.empty{text-align:center;padding:40px 20px;color:var(--t2)}.ee{font-size:40px;margin-bottom:10px;opacity:.5}.et{font-size:14px;line-height:1.5}
.sc{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:16px;margin-bottom:8px}
.sch{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.sb2{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.sb2.ow{background:rgba(78,168,222,.12);color:var(--ow)}.sb2.dr{background:rgba(6,214,160,.12);color:var(--dr)}
.sp2{font-size:11px;color:var(--t2);margin-left:auto;font-family:'JetBrains Mono',monospace}
.sr{display:flex;justify-content:space-between;align-items:center;padding:5px 0}.sl{font-size:12px;color:var(--t2)}
.sv{font-size:15px;font-weight:700;font-family:'JetBrains Mono',monospace}.sv.g{color:var(--ac)}.sv.b{color:var(--ow)}.sv.r{color:var(--rd)}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
.sbx{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:12px}
.sbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:3px}
.sbv{font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:-.5px}.sbv.g{color:var(--ac)}.sbv.r{color:var(--rd)}.sbv.b{color:var(--ow)}.sbv.y{color:var(--yl)}
.wk{background:linear-gradient(135deg,var(--sf),var(--cd));border:1px solid var(--bd);border-radius:14px;padding:16px;margin-bottom:12px}
.wkt{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--a2);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.pcg{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}.pch{font-size:10px;font-weight:700;color:var(--t2);padding:4px 0;text-transform:uppercase}
.pd{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:13px;font-weight:600;font-family:'JetBrains Mono',monospace}
.pd.ok{background:rgba(6,214,160,.08);color:var(--ac)}.pd.bad{background:rgba(239,71,111,.12);color:var(--rd)}.pd.free{background:rgba(123,139,168,.06);color:var(--t2)}.pd.today{box-shadow:inset 0 0 0 2px var(--yl)}.pd.empty{background:none}
.plg{display:flex;gap:16px;margin-top:12px;justify-content:center}.pli{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2)}.pdt{width:10px;height:10px;border-radius:3px}
::-webkit-scrollbar{width:0}@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fade{animation:fu .3s ease forwards}`;

export default function App(){
  const[expenses,setExpenses]=useState([]);
  const[shifts,setShifts]=useState([]);
  const[dailyEarnings,setDE]=useState([]);
  const[personalTrips,setPT]=useState([]);
  const[archives,setArchives]=useState([]);
  const[activeDay,setAD]=useState(null);
  const[tab,setTab]=useState("home");
  const[modal,setModal]=useState(null);
  const[viewImg,setVI]=useState(null);
  const[synced,setSynced]=useState(false);
  const[saving,setSaving]=useState(false);
  const[archiving,setArch]=useState(false);

  useEffect(()=>{
    const u1=subscribeToCollection(expensesRef(),i=>{setExpenses(i);setSynced(true);});
    const u2=subscribeToCollection(shiftsRef(),i=>setShifts(i));
    const u3=subscribeToCollection(earningsRef(),i=>setDE(i));
    const u4=subscribeToCollection(tripsRef(),i=>setPT(i));
    const u5=subscribeActiveDay(d=>setAD(d));
    const u6=subscribeArchives(a=>setArchives(a));
    return()=>{u1();u2();u3();u4();u5();u6();};
  },[]);

  const data={expenses,shifts,dailyEarnings,personalTrips};
  const hasLive=expenses.length||shifts.length||dailyEarnings.length||personalTrips.length;
  const isActive=activeDay?.active;

  const handleNewDay=async()=>{
    if(isActive&&hasLive){setArch(true);await archiveDay(activeDay.date,{expenses,shifts,earnings:dailyEarnings,trips:personalTrips});setArch(false);}
    await setActiveDay(gT());
  };

  const addDoc=async(ref,item)=>{setSaving(true);await addDocument(ref,item.id,item);setSaving(false);setModal(null);};
  const delDoc=async(ref,id)=>{await deleteDocument(ref,id);};

  const today=new Date(),todayStr=gT();
  const restricted=hR(today),rDig=gRD(today);

  // Day totals
  const dI=dailyEarnings.reduce((s,e)=>s+(e.totalEarnings||0),0)+personalTrips.reduce((s,t)=>s+(t.amount||0),0);
  const dC=dailyEarnings.reduce((s,e)=>s+(e.cashReceived||0),0);
  const dO=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const dN=dI-dO;

  // Week totals
  const wA=archives.filter(a=>isInWeek(a.date));
  const wF=wA.reduce((acc,a)=>{const t=dayTotals(a.earnings||[],a.expenses||[],a.trips||[]);return{tI:acc.tI+t.tI,tO:acc.tO+t.tO,tC:acc.tC+t.tC};},{tI:0,tO:0,tC:0});
  const wI=wF.tI+dI,wO=wF.tO+dO,wC=wF.tC+dC,wN=wI-wO;

  const wr=getWeekRange(todayStr);

  // HOME
  const Home=()=>(<div className="fade">
    {!isActive?<button className="btn bnd" style={{marginBottom:12}} onClick={handleNewDay}>{archiving?'⏳ Archivando...':<>{I.play} Iniciar jornada de hoy</>}</button>
    :activeDay.date!==todayStr&&hasLive?<button className="btn bnd" style={{marginBottom:12}} onClick={handleNewDay}>{archiving?'⏳ Archivando...':<>{I.sun} Cerrar {fD(activeDay.date)} e iniciar hoy</>}</button>:null}

    <div className="sc" style={{borderColor:'rgba(255,209,102,.2)'}}>
      <div style={{fontSize:13,fontWeight:700,color:'var(--yl)',display:'flex',alignItems:'center',gap:6,marginBottom:10}}>{I.sun} Hoy{isActive?' — '+fD(activeDay.date):''}</div>
      <div className="sg" style={{marginBottom:0}}>
        <div className="sbx"><div className="sbl">Ingresos</div><div className="sbv g">{fCOP(dI)}</div></div>
        <div className="sbx"><div className="sbl">Gastos</div><div className="sbv r">{fCOP(dO)}</div></div>
        <div className="sbx"><div className="sbl">Neto</div><div className="sbv" style={{color:dN>=0?'var(--ac)':'var(--rd)'}}>{fCOP(dN)}</div></div>
        <div className="sbx"><div className="sbl">Efectivo</div><div className="sbv y">{fCOP(dC)}</div></div>
      </div>
    </div>

    <div className="wk">
      <div className="wkt">{I.cal} Semana ({fD(wr.start)} — {fD(wr.end)})</div>
      <div className="sg" style={{marginBottom:0}}>
        <div className="sbx"><div className="sbl">Ingresos</div><div className="sbv g">{fCOP(wI)}</div></div>
        <div className="sbx"><div className="sbl">Gastos</div><div className="sbv r">{fCOP(wO)}</div></div>
        <div className="sbx"><div className="sbl">Neto</div><div className="sbv" style={{color:wN>=0?'var(--ac)':'var(--rd)'}}>{fCOP(wN)}</div></div>
        <div className="sbx"><div className="sbl">Efectivo</div><div className="sbv y">{fCOP(wC)}</div></div>
      </div>
    </div>

    <div className="sc" style={{borderColor:'rgba(78,168,222,.2)'}}>
      <div className="sch"><span className="sb2 ow">{I.owner} Propietario</span><span className="sp2">60%</span></div>
      <div className="sr"><span className="sl">Neto hoy</span><span className="sv b">{fCOP(dN*OP)}</span></div>
      <div className="sr"><span className="sl">Neto semana</span><span className="sv b">{fCOP(wN*OP)}</span></div>
    </div>
    <div className="sc" style={{borderColor:'rgba(6,214,160,.2)',marginBottom:12}}>
      <div className="sch"><span className="sb2 dr">{I.car} Conductor</span><span className="sp2">40%</span></div>
      <div className="sr"><span className="sl">Neto hoy</span><span className="sv g">{fCOP(dN*DP2)}</span></div>
      <div className="sr"><span className="sl">Neto semana</span><span className="sv g">{fCOP(wN*DP2)}</span></div>
    </div>

    <button className="btn bx" style={{marginBottom:12}} onClick={()=>genXLS(data,archives)}>{I.xl} Descargar reporte Excel</button>

    {isActive&&<div className="card"><div className="clbl">Registro rápido</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
      <button className="btn bs bo" onClick={()=>setModal("earning")} style={{width:'100%'}}>{I.dollar} Ganancias</button>
      <button className="btn bs bo" onClick={()=>setModal("expense")} style={{width:'100%'}}>{I.gas} Gastos</button>
      <button className="btn bs bo" onClick={()=>setModal("shift")} style={{width:'100%'}}>{I.clock} Turno</button>
      <button className="btn bs bo" onClick={()=>setModal("trip")} style={{width:'100%'}}>{I.route} Viaje personal</button>
    </div></div>}

    <div className="card"><div className="clbl">Actividad del día</div>
    {(()=>{const all=[...dailyEarnings.map(e=>({...e,_t:'e'})),...expenses.map(e=>({...e,_t:'x'})),...personalTrips.map(e=>({...e,_t:'p'}))].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,8);
      if(!all.length)return<div className="empty"><div className="ee">{isActive?'📋':'🌅'}</div><div className="et">{isActive?'Sin registros aún.':'Inicia jornada para registrar.'}</div></div>;
      return all.map(i=>{
        if(i._t==='e')return<div key={i.id} className="li"><div className="lic earn">{I.dollar}</div><div className="lib"><div className="lim">{i.platform}</div><div className="lis">Efvo: {fCOP(i.cashReceived||0)}</div></div><div className="la g">+{fCOP(i.totalEarnings||0)}</div></div>;
        if(i._t==='x')return<div key={i.id} className="li"><div className={`lic ${i.type==='Gas natural'?'gas':i.type==='Gasolina'?'fuel':'misc'}`}>{I.gas}</div><div className="lib"><div className="lim">{i.type}</div><div className="lis">{i.note||''}</div></div><div style={{display:'flex',alignItems:'center',gap:6}}>{i.receipt&&<img src={i.receipt} className="rt" onClick={()=>setVI(i.receipt)}/>}<div className="la r">-{fCOP(i.amount||0)}</div></div></div>;
        return<div key={i.id} className="li"><div className="lic trip">{I.route}</div><div className="lib"><div className="lim">{i.route||'Viaje'}</div><div className="lis">{i.time} · {i.client||''}</div></div><div className="la g">+{fCOP(i.amount||0)}</div></div>;
      });
    })()}
    </div>
  </div>);

  // OTHER TABS
  const Exp=()=>(<div className="fade"><div className="sh"><span className="st">Gastos</span>{isActive&&<button className="btn bp bs" onClick={()=>setModal("expense")}>{I.plus} Nuevo</button>}</div>{!expenses.length?<div className="empty"><div className="ee">⛽</div><div className="et">Sin gastos hoy.</div></div>:<div className="card">{expenses.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(e=><div key={e.id} className="li"><div className={`lic ${e.type==='Gas natural'?'gas':e.type==='Gasolina'?'fuel':'misc'}`}>{I.gas}</div><div className="lib"><div className="lim">{e.type}</div><div className="lis">{e.note||''}</div></div><div style={{display:'flex',alignItems:'center',gap:6}}>{e.receipt&&<img src={e.receipt} className="rt" onClick={()=>setVI(e.receipt)}/>}<div className="la r">-{fCOP(e.amount||0)}</div><button className="db" onClick={()=>delDoc(expensesRef(),e.id)}>{I.trash}</button></div></div>)}</div>}</div>);

  const Shf=()=>(<div className="fade"><div className="sh"><span className="st">Turnos</span>{isActive&&<button className="btn bp bs" onClick={()=>setModal("shift")}>{I.plus} Nuevo</button>}</div>{!shifts.length?<div className="empty"><div className="ee">🕐</div><div className="et">Sin turnos hoy.</div></div>:<div className="card">{shifts.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(s=>{const[sh,sm]=(s.start||'0:0').split(':').map(Number),[eh,em]=(s.end||'0:0').split(':').map(Number);let d=(eh*60+em)-(sh*60+sm);if(d<0)d+=1440;return<div key={s.id} className="li"><div className="lic" style={{background:'rgba(17,138,178,.12)',color:'var(--a2)'}}>{I.clock}</div><div className="lib"><div className="lim">{s.start} — {s.end}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:'var(--a2)'}}>{Math.floor(d/60)}h {d%60}m</span><button className="db" onClick={()=>delDoc(shiftsRef(),s.id)}>{I.trash}</button></div></div>;})}</div>}</div>);

  const Ear=()=>(<div className="fade"><div className="sh"><span className="st">Ganancias</span>{isActive&&<button className="btn bp bs" onClick={()=>setModal("earning")}>{I.plus} Nuevo</button>}</div>{!dailyEarnings.length?<div className="empty"><div className="ee">💰</div><div className="et">Sin ganancias hoy.</div></div>:<div className="card">{dailyEarnings.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(e=><div key={e.id} className="li"><div className="lic earn">{I.dollar}</div><div className="lib"><div className="lim">{e.platform}</div><div className="lis">Efvo: {fCOP(e.cashReceived||0)}</div></div><div style={{display:'flex',alignItems:'center',gap:6}}><div className="la g">+{fCOP(e.totalEarnings||0)}</div><button className="db" onClick={()=>delDoc(earningsRef(),e.id)}>{I.trash}</button></div></div>)}</div>}<div className="sh" style={{marginTop:16}}><span className="st">Viajes personales</span>{isActive&&<button className="btn bp bs" onClick={()=>setModal("trip")}>{I.plus} Nuevo</button>}</div>{!personalTrips.length?<div className="empty"><div className="ee">🚐</div><div className="et">Sin viajes hoy.</div></div>:<div className="card">{personalTrips.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).map(t=><div key={t.id} className="li"><div className="lic trip">{I.route}</div><div className="lib"><div className="lim">{t.route||'Sin ruta'}</div><div className="lis">{t.time} · {t.client||''}</div></div><div style={{display:'flex',alignItems:'center',gap:6}}><div className="la g">+{fCOP(t.amount||0)}</div><button className="db" onClick={()=>delDoc(tripsRef(),t.id)}>{I.trash}</button></div></div>)}</div>}</div>);

  const Pyp=()=>{const y=today.getFullYear(),m=today.getMonth(),dim=new Date(y,m+1,0).getDate(),fd=new Date(y,m,1).getDay(),mn=today.toLocaleDateString("es-CO",{month:"long",year:"numeric"});const days=[];for(let j=0;j<fd;j++)days.push(null);for(let d=1;d<=dim;d++)days.push(d);return(<div className="fade"><div className="st" style={{marginBottom:14}}>Pico y Placa</div><div className="card"><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}><div className="pb" style={{fontSize:16,padding:'8px 14px'}}>{I.plate} {PLATE}</div><div style={{fontSize:13,color:'var(--t2)'}}>Dígito: <strong style={{color:'var(--yl)'}}>{PD}</strong></div></div><div className="clbl" style={{textTransform:'capitalize'}}>{mn}</div><div className="pcg">{["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d=><div key={d} className="pch">{d}</div>)}{days.map((d,j)=>{if(d===null)return<div key={`e${j}`} className="pd empty"/>;const dt=new Date(y,m,d),it=d===today.getDate(),iS=dt.getDay()===0,ds=dt.toISOString().split("T")[0],iH=HOL.includes(ds),iR=hR(dt);let c="pd";if(it)c+=" today";if(iS||iH)c+=" free";else if(iR)c+=" bad";else c+=" ok";return<div key={d} className={c}>{d}</div>;})}</div><div className="plg"><div className="pli"><div className="pdt" style={{background:'var(--ac)'}}/> Circula</div><div className="pli"><div className="pdt" style={{background:'var(--rd)'}}/> Restricción</div><div className="pli"><div className="pdt" style={{background:'var(--bd)'}}/> Libre</div></div></div><div className="card"><div className="clbl">Info</div><div style={{fontSize:13,lineHeight:1.6,color:'var(--t2)'}}><p><strong style={{color:'var(--tx)'}}>Horario:</strong> Lun-Sáb, 5:30 AM — 9:00 PM</p><p style={{marginTop:6}}><strong style={{color:'var(--tx)'}}>Grupos:</strong> (9-0, 1-2, 3-4, 5-6, 7-8) rotación semanal</p></div></div></div>);};

  // MODALS
  const ExpM=()=>{const[f,sF]=useState({type:"Gas natural",amount:"",date:activeDay?.date||todayStr,note:"",receipt:null});const[comp,sC]=useState(false);const fR=useRef(null);const hF=async e=>{const fl=e.target.files[0];if(!fl)return;sC(true);const r=new FileReader();r.onload=async ev=>{sF(p=>({...p,receipt:await compressImage(ev.target.result)}));sC(false);};r.readAsDataURL(fl);};const v=f.amount&&!saving;
  return(<div className="mo" onClick={()=>setModal(null)}><div className="ms" onClick={e=>e.stopPropagation()}><div className="mb2"/><div className="mt2">Registrar gasto</div>
    <div className="fg"><label className="fl">Tipo</label><div className="chs">{["Gas natural","Gasolina","Varios"].map(t=><span key={t} className={`ch ${f.type===t?'a':''}`} onClick={()=>sF({...f,type:t})}>{t}</span>)}</div></div>
    <div className="fr"><div className="fg"><label className="fl">Monto</label><input className="fi" type="number" placeholder="50000" value={f.amount} onChange={e=>sF({...f,amount:e.target.value})}/></div><div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={f.date} onChange={e=>sF({...f,date:e.target.value})}/></div></div>
    <div className="fg"><label className="fl">Nota</label><input className="fi" placeholder="Tanqueada Terpel" value={f.note} onChange={e=>sF({...f,note:e.target.value})}/></div>
    <div className="fg"><label className="fl">Recibo</label><input type="file" accept="image/*" capture="environment" ref={fR} style={{display:'none'}} onChange={hF}/>{comp?<div style={{textAlign:'center',padding:20,color:'var(--t2)',fontSize:13}}>Comprimiendo...</div>:f.receipt?<div style={{position:'relative'}}><img src={f.receipt} className="up"/><button onClick={()=>sF({...f,receipt:null})} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,.6)',border:'none',color:'#fff',width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>{I.x}</button></div>:<div className="ua" onClick={()=>fR.current?.click()}>{I.cam}<div style={{marginTop:6,fontSize:13}}>Adjuntar recibo</div></div>}</div>
    <button className="btn bp" disabled={!v} style={{opacity:v?1:.4}} onClick={()=>addDoc(expensesRef(),{id:gId(),type:f.type,amount:Number(f.amount),date:f.date,note:f.note,receipt:f.receipt})}>{saving?'Guardando...':'Guardar gasto'}</button>
  </div></div>);};

  const ShfM=()=>{const[f,sF]=useState({date:activeDay?.date||todayStr,start:"06:00",end:"18:00"});const v=f.start&&f.end&&!saving;return(<div className="mo" onClick={()=>setModal(null)}><div className="ms" onClick={e=>e.stopPropagation()}><div className="mb2"/><div className="mt2">Registrar turno</div><div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={f.date} onChange={e=>sF({...f,date:e.target.value})}/></div><div className="fr"><div className="fg"><label className="fl">Inicio</label><input className="fi" type="time" value={f.start} onChange={e=>sF({...f,start:e.target.value})}/></div><div className="fg"><label className="fl">Fin</label><input className="fi" type="time" value={f.end} onChange={e=>sF({...f,end:e.target.value})}/></div></div><button className="btn bp" disabled={!v} style={{opacity:v?1:.4}} onClick={()=>addDoc(shiftsRef(),{id:gId(),date:f.date,start:f.start,end:f.end})}>{saving?'Guardando...':'Guardar turno'}</button></div></div>);};

  const EarM=()=>{const[f,sF]=useState({date:activeDay?.date||todayStr,totalEarnings:"",cashReceived:"",platform:"Uber + Cabify"});const v=f.totalEarnings&&!saving;const t=Number(f.totalEarnings)||0;return(<div className="mo" onClick={()=>setModal(null)}><div className="ms" onClick={e=>e.stopPropagation()}><div className="mb2"/><div className="mt2">Ganancias del día</div><div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={f.date} onChange={e=>sF({...f,date:e.target.value})}/></div><div className="fg"><label className="fl">Plataforma</label><div className="chs">{["Uber","Cabify","Uber + Cabify"].map(p=><span key={p} className={`ch ${f.platform===p?'a':''}`} onClick={()=>sF({...f,platform:p})}>{p}</span>)}</div></div><div className="fr"><div className="fg"><label className="fl">Total (COP)</label><input className="fi" type="number" placeholder="200000" value={f.totalEarnings} onChange={e=>sF({...f,totalEarnings:e.target.value})}/></div><div className="fg"><label className="fl">Efectivo</label><input className="fi" type="number" placeholder="80000" value={f.cashReceived} onChange={e=>sF({...f,cashReceived:e.target.value})}/></div></div>{t>0&&<div style={{background:'var(--sf)',border:'1px solid var(--bd)',borderRadius:12,padding:14,marginBottom:14}}><div style={{fontSize:11,color:'var(--t2)',fontWeight:700,marginBottom:8,textTransform:'uppercase'}}>Distribución</div><div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span style={{color:'var(--ow)'}}>Prop 60%</span><span style={{color:'var(--ow)',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fCOP(t*OP)}</span></div><div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:4}}><span style={{color:'var(--dr)'}}>Cond 40%</span><span style={{color:'var(--dr)',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fCOP(t*DP2)}</span></div></div>}<button className="btn bp" disabled={!v} style={{opacity:v?1:.4}} onClick={()=>addDoc(earningsRef(),{id:gId(),date:f.date,totalEarnings:Number(f.totalEarnings),cashReceived:Number(f.cashReceived||0),platform:f.platform})}>{saving?'Guardando...':'Guardar'}</button></div></div>);};

  const TrpM=()=>{const[f,sF]=useState({date:activeDay?.date||todayStr,amount:"",route:"",time:"",client:""});const v=f.amount&&!saving;return(<div className="mo" onClick={()=>setModal(null)}><div className="ms" onClick={e=>e.stopPropagation()}><div className="mb2"/><div className="mt2">Viaje personal</div><div className="fr"><div className="fg"><label className="fl">Fecha</label><input className="fi" type="date" value={f.date} onChange={e=>sF({...f,date:e.target.value})}/></div><div className="fg"><label className="fl">Valor</label><input className="fi" type="number" placeholder="50000" value={f.amount} onChange={e=>sF({...f,amount:e.target.value})}/></div></div><div className="fg"><label className="fl">Recorrido</label><input className="fi" placeholder="Chapinero → Aeropuerto" value={f.route} onChange={e=>sF({...f,route:e.target.value})}/></div><div className="fr"><div className="fg"><label className="fl">Horario</label><input className="fi" placeholder="2:00-3:30 PM" value={f.time} onChange={e=>sF({...f,time:e.target.value})}/></div><div className="fg"><label className="fl">Cliente</label><input className="fi" placeholder="Nombre" value={f.client} onChange={e=>sF({...f,client:e.target.value})}/></div></div><button className="btn bp" disabled={!v} style={{opacity:v?1:.4}} onClick={()=>addDoc(tripsRef(),{id:gId(),date:f.date,amount:Number(f.amount),route:f.route,time:f.time,client:f.client})}>{saving?'Guardando...':'Guardar'}</button></div></div>);};

  const navs=[{id:"home",icon:I.car,l:"Inicio"},{id:"expenses",icon:I.gas,l:"Gastos"},{id:"earnings",icon:I.dollar,l:"Ingresos"},{id:"shifts",icon:I.clock,l:"Turnos"},{id:"pyp",icon:I.plate,l:"P&P"}];
  const tL=today.toLocaleDateString("es-CO",{weekday:"long",day:"numeric",month:"long"});

  return(<><style>{CSS}</style><div className="app">
    <div className="hdr"><div><h1>🚐 Conductor</h1><div className="hd">{tL}</div><div className={`syn ${synced?'ok':'off'}`}>{I.sync} {synced?'Sincronizado':'Conectando...'}</div></div><div className="pb">{PLATE}</div></div>
    {isActive&&<div className="dbn"><div className="dbn-i">{I.sun}</div><div><div className="dbn-t">Jornada activa — {fD(activeDay.date)}</div><div className="dbn-s">Registrando datos del día</div></div></div>}
    <div className={`pyp ${restricted?'bad':'ok'}`}><div className="pyp-i">{restricted?I.alert:I.check}</div><div><div className="pyp-m">{restricted?'⚠️ Pico y placa':'✅ Puedes circular'}</div><div className="pyp-s">{rDig?`Placas ${rDig.join(' y ')} · 5:30-9:00 PM`:'Sin restricción'}</div></div></div>
    <div className="cnt">{tab==="home"&&<Home/>}{tab==="expenses"&&<Exp/>}{tab==="earnings"&&<Ear/>}{tab==="shifts"&&<Shf/>}{tab==="pyp"&&<Pyp/>}</div>
    <nav className="bnav">{navs.map(n=><button key={n.id} className={`nb ${tab===n.id?'act':''}`} onClick={()=>setTab(n.id)}>{n.icon}{n.l}</button>)}</nav>
    {modal==="expense"&&<ExpM/>}{modal==="shift"&&<ShfM/>}{modal==="earning"&&<EarM/>}{modal==="trip"&&<TrpM/>}
    {viewImg&&<div className="iv" onClick={()=>setVI(null)}><button className="ic">{I.x}</button><img src={viewImg} alt=""/></div>}
  </div></>);
}
