import React, { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Eye, Download, Archive } from 'lucide-react'
import { supabaseClient } from '../utils/supabase'
import { apiUrl } from '../utils/api'
import {
    DOCTOR_NEARBY_HOSPITAL_CACHE_KEY,
    filterNearbyHospitals,
    fetchNearbyHospitalsByLocation,
    readNearbyHospitalCache,
    sortHospitalsByDistance,
    writeNearbyHospitalCache,
} from '../utils/doctorHospitalSearch'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --teal:#0cb8a0;--teal-dim:rgba(12,184,160,0.13);--teal-glow:rgba(12,184,160,0.25);
  --blue:#3b8ef3;--blue-dim:rgba(59,142,243,0.13);
  --amber:#f0a500;--amber-dim:rgba(240,165,0,0.13);
  --red:#f05252;--red-dim:rgba(240,82,82,0.13);
  --violet:#7c6ff7;--violet-dim:rgba(124,111,247,0.13);
  --s0:#0c1623;--s1:#111e2e;--s2:#162235;--s3:#1c2d43;
  --b:rgba(255,255,255,0.07);--bh:rgba(255,255,255,0.14);
  --tp:#e8f2ff;--ts:#7a9bbf;--tm:#4a6a8a;
  --fd:'Syne',sans-serif;--fb:'DM Sans',sans-serif;
  --rsm:8px;--rmd:12px;--rlg:18px;--tr:0.2s cubic-bezier(0.4,0,0.2,1);
}
.dp-shell{min-height:100vh;background:var(--s0);font-family:var(--fb);color:var(--tp);display:grid;grid-template-columns:220px 1fr;position:relative;overflow:hidden;}
.dp-orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0;animation:orbFloat ease-in-out infinite;}
.dp-orb-1{width:500px;height:500px;background:radial-gradient(circle,rgba(12,184,160,0.14) 0%,transparent 70%);top:-180px;right:-100px;animation-duration:16s;}
.dp-orb-2{width:400px;height:400px;background:radial-gradient(circle,rgba(59,142,243,0.1) 0%,transparent 70%);bottom:-150px;left:100px;animation-duration:20s;animation-direction:reverse;}
.dp-orb-3{width:280px;height:280px;background:radial-gradient(circle,rgba(124,111,247,0.1) 0%,transparent 70%);top:40%;right:25%;animation-duration:13s;}
@keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(20px,-16px) scale(1.06);}}
.dp-sidebar{background:var(--s1);border-right:1px solid var(--b);display:flex;flex-direction:column;padding:28px 0;position:sticky;top:0;height:100vh;z-index:10;overflow:hidden;}
.dp-sidebar-logo{display:flex;align-items:center;gap:10px;padding:0 22px 28px;border-bottom:1px solid var(--b);}
.dp-logo-mark{width:36px;height:36px;border-radius:var(--rsm);background:linear-gradient(135deg,var(--teal),#08a08a);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.dp-logo-mark svg{width:18px;height:18px;stroke:#fff;}
.dp-logo-name{font-family:var(--fd);font-size:17px;font-weight:700;color:var(--tp);letter-spacing:-0.3px;}
.dp-logo-sub{display:block;font-size:10px;font-weight:400;font-family:var(--fb);color:var(--tm);letter-spacing:1.2px;text-transform:uppercase;}
.dp-nav{flex:1;padding:18px 12px;display:flex;flex-direction:column;gap:2px;}
.dp-nav-section{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:var(--tm);padding:14px 10px 6px;font-weight:500;}
.dp-nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--rsm);cursor:pointer;transition:background var(--tr),color var(--tr);font-size:13.5px;color:var(--ts);border:none;background:none;width:100%;text-align:left;font-family:var(--fb);position:relative;}
.dp-nav-item svg{width:16px;height:16px;flex-shrink:0;stroke:currentColor;}
.dp-nav-item:hover{background:var(--s3);color:var(--tp);}
.dp-nav-item.active{background:var(--teal-dim);color:var(--teal);}
.dp-nav-item.active::before{content:'';position:absolute;left:0;top:20%;bottom:20%;width:3px;border-radius:0 3px 3px 0;background:var(--teal);}
.dp-nav-badge{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:999px;min-width:18px;text-align:center;}
.dp-sidebar-footer{padding:16px 12px 0;border-top:1px solid var(--b);}
.dp-doctor-mini{display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--rmd);background:var(--s2);}
.dp-doctor-mini-btn{width:100%;border:none;cursor:pointer;text-align:left;transition:background var(--tr),border-color var(--tr);border:1px solid transparent;}
.dp-doctor-mini-btn:hover{background:var(--s3);border-color:var(--bh);}
.dp-mini-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--teal-glow);}
.dp-mini-name{font-size:13px;font-weight:500;color:var(--tp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dp-mini-role{font-size:11px;color:var(--tm);}
.dp-mini-hospital{font-size:10px;color:var(--tm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;}
.dp-main{display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1;}
.dp-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;border-bottom:1px solid var(--b);background:rgba(12,22,35,0.7);backdrop-filter:blur(12px);position:sticky;top:0;z-index:5;gap:12px;}
.dp-topbar-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--tm);font-weight:500;}
.dp-topbar-title{font-family:var(--fd);font-size:20px;font-weight:600;color:var(--tp);margin-top:2px;}
.dp-topbar-right{display:flex;align-items:center;gap:10px;}
.dp-pill-live{display:flex;align-items:center;gap:6px;background:var(--teal-dim);border:1px solid var(--teal-glow);color:var(--teal);font-size:11px;font-weight:600;padding:5px 12px;border-radius:999px;letter-spacing:0.5px;}
.dp-pill-dot{width:6px;height:6px;border-radius:50%;background:var(--teal);animation:pulse 2s ease-in-out infinite;display:inline-block;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.7);}}
.dp-icon-btn{width:36px;height:36px;border-radius:var(--rsm);background:var(--s2);border:1px solid var(--b);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background var(--tr);color:var(--ts);}
.dp-icon-btn:hover{background:var(--s3);color:var(--tp);}
.dp-icon-btn svg{width:16px;height:16px;stroke:currentColor;}
.dp-logout-btn{display:flex;align-items:center;gap:7px;background:var(--s2);border:1px solid var(--b);border-radius:var(--rsm);padding:8px 14px;color:var(--ts);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--fb);transition:all var(--tr);}
.dp-logout-btn:hover{background:var(--red-dim);border-color:rgba(240,82,82,0.3);color:var(--red);}
.dp-logout-btn svg{width:14px;height:14px;stroke:currentColor;}
.dp-content{padding:28px 32px;flex:1;display:flex;flex-direction:column;gap:24px;}
.dp-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
.dp-hero-left{display:flex;align-items:center;gap:18px;}
.dp-avatar{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,rgba(12,184,160,0.3),rgba(59,142,243,0.3));border:2px solid var(--teal-glow);display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-weight:700;font-size:17px;color:var(--teal);flex-shrink:0;}
.dp-hero-name{font-family:var(--fd);font-size:22px;font-weight:700;color:var(--tp);letter-spacing:-0.4px;}
.dp-hero-meta{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;}
.dp-hero-meta-item{font-size:13px;color:var(--ts);}
.dp-hero-meta-sep{width:3px;height:3px;border-radius:50%;background:var(--tm);flex-shrink:0;}
.dp-hero-hospital{font-size:13px;color:var(--teal);font-weight:500;}
.dp-hero-date{background:var(--s2);border:1px solid var(--b);border-radius:var(--rmd);padding:10px 18px;text-align:right;}
.dp-hero-date-day{font-family:var(--fd);font-size:28px;font-weight:700;color:var(--tp);line-height:1;}
.dp-hero-date-label{font-size:11px;color:var(--tm);margin-top:3px;letter-spacing:0.5px;}
.dp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
.dp-kpi{background:var(--s1);border:1px solid var(--b);border-radius:var(--rlg);padding:20px;position:relative;overflow:hidden;transition:border-color var(--tr),transform var(--tr);animation:slideUp 0.4s ease both;}
.dp-kpi:hover{border-color:var(--bh);transform:translateY(-2px);}
.dp-kpi::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity var(--tr);}
.dp-kpi:hover::before{opacity:1;}
.dp-kpi-teal::before{background:linear-gradient(135deg,var(--teal-dim),transparent 60%);}
.dp-kpi-blue::before{background:linear-gradient(135deg,var(--blue-dim),transparent 60%);}
.dp-kpi-red::before{background:linear-gradient(135deg,var(--red-dim),transparent 60%);}
.dp-kpi-violet::before{background:linear-gradient(135deg,var(--violet-dim),transparent 60%);}
.dp-kpi-icon{width:38px;height:38px;border-radius:var(--rsm);display:flex;align-items:center;justify-content:center;margin-bottom:16px;}
.dp-kpi-icon svg{width:18px;height:18px;stroke:currentColor;}
.dp-kpi-teal .dp-kpi-icon{background:var(--teal-dim);color:var(--teal);}
.dp-kpi-blue .dp-kpi-icon{background:var(--blue-dim);color:var(--blue);}
.dp-kpi-red .dp-kpi-icon{background:var(--red-dim);color:var(--red);}
.dp-kpi-violet .dp-kpi-icon{background:var(--violet-dim);color:var(--violet);}
.dp-kpi-label{font-size:11px;color:var(--tm);text-transform:uppercase;letter-spacing:0.8px;font-weight:500;margin-bottom:6px;}
.dp-kpi-value{font-family:var(--fd);font-size:32px;font-weight:700;line-height:1;}
.dp-kpi-teal .dp-kpi-value{color:var(--teal);}
.dp-kpi-blue .dp-kpi-value{color:var(--blue);}
.dp-kpi-red .dp-kpi-value{color:var(--red);}
.dp-kpi-violet .dp-kpi-value{color:var(--violet);}
.dp-kpi-foot{font-size:11.5px;color:var(--tm);margin-top:8px;}
.dp-grid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;align-items:start;}
.dp-left-col{display:flex;flex-direction:column;gap:18px;}
.dp-section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.dp-section-title{font-family:var(--fd);font-size:15px;font-weight:600;color:var(--tp);}
.dp-section-link{font-size:12px;color:var(--teal);background:none;border:none;cursor:pointer;font-family:var(--fb);padding:0;}
.dp-module-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.dp-module-card{background:var(--s1);border:1px solid var(--b);border-radius:var(--rlg);padding:18px;cursor:pointer;transition:border-color var(--tr),transform var(--tr),background var(--tr);animation:slideUp 0.45s ease both;}
.dp-module-card:hover{border-color:var(--bh);background:var(--s2);transform:translateY(-3px);}
.dp-module-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;}
.dp-module-icon{width:40px;height:40px;border-radius:var(--rsm);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.dp-module-icon svg{width:18px;height:18px;stroke:currentColor;}
.mi-teal{background:var(--teal-dim);color:var(--teal);}
.mi-blue{background:var(--blue-dim);color:var(--blue);}
.mi-red{background:var(--red-dim);color:var(--red);}
.mi-violet{background:var(--violet-dim);color:var(--violet);}
.dp-module-badge{font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;letter-spacing:0.4px;}
.mb-live{background:var(--teal-dim);color:var(--teal);border:1px solid var(--teal-glow);}
.mb-secure{background:var(--blue-dim);color:var(--blue);border:1px solid rgba(59,142,243,0.25);}
.mb-alert{background:var(--red-dim);color:var(--red);border:1px solid rgba(240,82,82,0.25);}
.mb-ai{background:var(--violet-dim);color:var(--violet);border:1px solid rgba(124,111,247,0.25);}
.dp-module-title{font-family:var(--fd);font-size:14.5px;font-weight:600;color:var(--tp);margin-bottom:6px;}
.dp-module-desc{font-size:12.5px;color:var(--ts);line-height:1.6;}
.dp-module-link{display:inline-flex;align-items:center;gap:4px;margin-top:14px;font-size:12px;font-weight:600;color:var(--teal);background:none;border:none;cursor:pointer;font-family:var(--fb);padding:0;transition:gap var(--tr);}
.dp-module-link:hover{gap:7px;}
.dp-card{background:var(--s1);border:1px solid var(--b);border-radius:var(--rlg);padding:20px;}
.dp-patient-list{display:flex;flex-direction:column;}
.dp-patient-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--b);}
.dp-patient-row:last-child{border-bottom:none;}
.dp-pt-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:var(--fd);flex-shrink:0;}
.dp-pt-info{flex:1;min-width:0;}
.dp-pt-name{font-size:13.5px;font-weight:500;color:var(--tp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dp-pt-sub{font-size:11.5px;color:var(--tm);margin-top:2px;}
.dp-pt-status{font-size:10.5px;font-weight:600;padding:4px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;}
.ps-in{background:var(--teal-dim);color:var(--teal);}
.ps-next{background:var(--blue-dim);color:var(--blue);}
.ps-waiting{background:var(--amber-dim);color:var(--amber);}
.ps-critical{background:var(--red-dim);color:var(--red);}
.dp-right-col{display:flex;flex-direction:column;gap:14px;}
.dp-alerts{display:flex;flex-direction:column;gap:8px;}
.dp-alert{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:var(--rmd);border:1px solid;}
.dp-alert-danger{background:var(--red-dim);border-color:rgba(240,82,82,0.25);}
.dp-alert-warn{background:var(--amber-dim);border-color:rgba(240,165,0,0.25);}
.dp-alert-icon{width:16px;height:16px;flex-shrink:0;margin-top:1px;}
.dp-alert-icon svg{width:16px;height:16px;stroke:currentColor;}
.dp-alert-danger .dp-alert-icon{color:var(--red);}
.dp-alert-warn .dp-alert-icon{color:var(--amber);}
.dp-alert-title{font-size:12.5px;font-weight:600;}
.dp-alert-danger .dp-alert-title{color:var(--red);}
.dp-alert-warn .dp-alert-title{color:var(--amber);}
.dp-alert-sub{font-size:11.5px;margin-top:2px;}
.dp-alert-danger .dp-alert-sub{color:rgba(240,82,82,0.75);}
.dp-alert-warn .dp-alert-sub{color:rgba(240,165,0,0.75);}
.dp-schedule{display:flex;flex-direction:column;}
.dp-sch-row{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--b);}
.dp-sch-row:last-child{border-bottom:none;}
.dp-sch-time{font-size:11px;font-weight:600;color:var(--tm);min-width:44px;padding-top:2px;letter-spacing:0.3px;}
.dp-sch-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0;}
.dp-sch-content{flex:1;}
.dp-sch-title{font-size:13px;font-weight:500;color:var(--tp);}
.dp-sch-sub{font-size:11.5px;color:var(--tm);margin-top:2px;}
.dp-full-btn{margin-top:14px;width:100%;background:var(--s2);border:1px solid var(--b);border-radius:var(--rmd);padding:11px;font-size:13px;font-weight:500;color:var(--ts);cursor:pointer;font-family:var(--fb);transition:all var(--tr);}
.dp-full-btn:hover{background:var(--teal-dim);border-color:var(--teal-glow);color:var(--teal);}
.dp-verify-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(240,165,0,0.28);background:rgba(240,165,0,0.1);}
.dp-verify-title{font-size:12px;font-weight:700;color:var(--amber);letter-spacing:.4px;text-transform:uppercase;}
.dp-verify-sub{font-size:12px;color:rgba(240,165,0,0.86);margin-top:3px;}
.dp-verify-chip{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;border:1px solid;}
.dp-verify-chip.pending{color:var(--amber);background:var(--amber-dim);border-color:rgba(240,165,0,0.32);}
.dp-verify-chip.verified{color:var(--teal);background:var(--teal-dim);border-color:rgba(12,184,160,0.32);}
.dp-disabled{opacity:.5;pointer-events:none;filter:grayscale(.2);}
.dp-modal-mask{position:fixed;inset:0;background:rgba(3,8,16,.72);backdrop-filter:blur(6px);z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;}
.dp-modal{width:min(760px,100%);border:1px solid var(--b);border-radius:18px;background:linear-gradient(180deg,var(--s1),#0d1724);box-shadow:0 20px 60px rgba(0,0,0,.45);padding:20px;}
.dp-modal-head h3{font-family:var(--fd);font-size:22px;color:var(--tp);}
.dp-modal-head p{font-size:13px;color:var(--ts);margin-top:8px;line-height:1.55;}
.dp-modal-grid{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.dp-field{display:flex;flex-direction:column;gap:7px;}
.dp-field label{font-size:11px;color:var(--tm);font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
.dp-field input,.dp-field select{height:42px;border-radius:10px;border:1px solid var(--b);background:var(--s2);color:var(--tp);padding:0 12px;font-size:13px;font-family:var(--fb);}
.dp-field input:focus,.dp-field select:focus{outline:none;border-color:var(--teal-glow);box-shadow:0 0 0 3px rgba(12,184,160,.15);}
.dark-input{height:42px;border-radius:10px;border:1px solid var(--b);background:var(--s2);color:var(--tp);padding:0 12px;font-size:13px;font-family:var(--fb);transition:all var(--tr);}
.dark-input:focus{outline:none;border-color:var(--teal-glow);box-shadow:0 0 0 3px rgba(12,184,160,.15);background:var(--s3);}
.dp-combobox{position:relative;}
.dp-combobox-input{width:100%;}
.dp-combobox-menu{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:20;max-height:500px;overflow-y:auto;overflow-x:hidden;padding:8px;background:linear-gradient(180deg,#142234,#0d1724);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:6px;}
.dp-combobox-option{width:100%;border:1px solid transparent;border-radius:12px;background:rgba(255,255,255,.03);color:var(--tp);padding:10px 12px;cursor:pointer;text-align:left;font-family:var(--fb);transition:background var(--tr),border-color var(--tr),transform var(--tr);}
.dp-combobox-option:hover{background:rgba(12,184,160,.12);border-color:rgba(12,184,160,.22);transform:translateY(-1px);}
.dp-combobox-option strong{display:block;font-size:13px;color:var(--tp);}
.dp-combobox-option span{display:block;font-size:11.5px;color:var(--ts);margin-top:3px;line-height:1.45;}
.dp-combobox-option small{display:inline-flex;margin-top:6px;font-size:10.5px;color:var(--teal);font-weight:700;letter-spacing:.3px;text-transform:uppercase;}
.dp-combobox-empty{padding:10px 12px;font-size:12px;color:var(--tm);}
.dp-hospital-helper{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--tm);}
.dp-hospital-count{color:var(--teal);font-weight:700;}
.dp-field-full{grid-column:1/-1;}
.dp-modal-error{margin-top:12px;padding:9px 12px;border-radius:10px;border:1px solid rgba(240,82,82,.35);background:rgba(240,82,82,.12);color:#ff9d9d;font-size:12px;}
.dp-modal-actions{margin-top:16px;display:flex;justify-content:flex-end;}
.dp-modal-btn{height:42px;padding:0 16px;border-radius:10px;border:1px solid var(--teal-glow);background:var(--teal-dim);color:var(--teal);font-family:var(--fb);font-size:13px;font-weight:700;cursor:pointer;}
.dp-modal-btn:disabled{opacity:.6;cursor:not-allowed;}
.dp-profile-wrap{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px;align-items:start;}
.dp-profile-card{background:var(--s1);border:1px solid var(--b);border-radius:var(--rlg);padding:20px;}
.dp-profile-avatar-wrap{display:flex;flex-direction:column;align-items:center;text-align:center;}
.dp-profile-avatar{width:104px;height:104px;border-radius:50%;object-fit:cover;border:2px solid var(--teal-glow);background:linear-gradient(135deg,rgba(12,184,160,.3),rgba(59,142,243,.3));}
.dp-profile-name{font-family:var(--fd);font-size:20px;color:var(--tp);margin-top:12px;}
.dp-profile-sub{font-size:12px;color:var(--ts);margin-top:4px;}
.dp-upload-btn{margin-top:14px;display:inline-flex;align-items:center;justify-content:center;height:38px;padding:0 14px;border-radius:10px;border:1px solid var(--b);background:var(--s2);color:var(--ts);font-size:12px;font-weight:700;cursor:pointer;}
.dp-upload-btn:hover{border-color:var(--teal-glow);color:var(--teal);background:var(--teal-dim);}
.dp-upload-note{margin-top:8px;font-size:11px;color:var(--tm);}
.dp-avatar-error{margin-top:10px;padding:8px;border-radius:8px;background:rgba(240,82,82,.12);border:1px solid rgba(240,82,82,.3);font-size:11px;color:#ffacac;}
.dp-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.dp-profile-item{background:var(--s1);border:1px solid var(--b);border-radius:14px;padding:14px;}
.dp-profile-label{font-size:11px;color:var(--tm);letter-spacing:.6px;text-transform:uppercase;font-weight:700;}
.dp-profile-value{margin-top:6px;font-size:14px;color:var(--tp);font-weight:600;word-break:break-word;}
.dp-profile-actions{margin-top:14px;display:flex;justify-content:flex-end;align-items:center;gap:12px;}
.dp-profile-secondary-btn{height:42px;padding:0 16px;border-radius:10px;border:1px solid var(--b);background:var(--s2);color:var(--ts);font-family:var(--fb);font-size:13px;font-weight:700;cursor:pointer;transition:all var(--tr);}
.dp-profile-secondary-btn:hover{border-color:var(--teal-glow);color:var(--teal);background:var(--teal-dim);}
.dp-profile-actions .dp-full-btn{margin-top:0;height:42px;padding:0 16px;}
.dp-profile-edit-panel{margin-top:18px;border:1px solid var(--b);border-radius:18px;background:linear-gradient(180deg,#132131,#0d1724);padding:18px;}
.dp-profile-edit-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;}
.dp-profile-edit-header p{font-size:12px;color:var(--ts);margin-top:6px;line-height:1.55;max-width:560px;}
.dp-profile-edit-grid{margin-top:0;}
@keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
.dp-appointments-wrap{padding:0;}
.dp-appointments-container{display:flex;flex-direction:column;gap:24px;}
.dp-appointments-list{display:flex;flex-direction:column;gap:12px;}
.dp-appointment-card{background:var(--s2);border:1px  solid var(--b);border-radius:var(--rmd);padding:16px;transition:all var(--tr);}
.dp-appointment-card-clickable{cursor:pointer;}
.dp-appointment-pending{border-left:4px solid var(--amber);background:linear-gradient(90deg,rgba(240,165,0,0.05) 0%,transparent 100%);}
.dp-appointment-pending:hover{border-color:var(--amber-glow);background:linear-gradient(90deg,rgba(240,165,0,0.08) 0%,transparent 100%);}
.dp-appointment-confirmed{border-left:4px solid var(--teal);background:linear-gradient(90deg,rgba(12,184,160,0.05) 0%,transparent 100%);}
.dp-appointment-confirmed:hover{border-color:var(--teal-glow);background:linear-gradient(90deg,rgba(12,184,160,0.08) 0%,transparent 100%);}
.dp-apt-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;}
.dp-apt-patient{font-size:15px;font-weight:600;color:var(--tp);margin-bottom:4px;}
.dp-apt-details{font-size:13px;color:var(--ts);}
.dp-apt-badge{display:inline-block;font-size:11px;font-weight:600;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;}
.dp-apt-badge.pending{background:var(--amber-dim);color:var(--amber);}
.dp-apt-badge.confirmed{background:var(--teal-dim);color:var(--teal);}
.dp-apt-footer{display:flex;gap:12px;font-size:12px;color:var(--tm);margin-bottom:12px;padding:8px 0;border-top:1px solid var(--b);border-bottom:1px solid var(--b);}
.dp-apt-specialty,.dp-apt-phone{flex-shrink:0;}
.dp-apt-actions{display:flex;gap:8px;}
.dp-apt-btn{flex:1;padding:8px 12px;border:1px solid;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all var(--tr);font-family:var(--fb);}
.dp-apt-approve{background:var(--teal-dim);border-color:var(--teal-glow);color:var(--teal);}
.dp-apt-approve:hover{background:rgba(12,184,160,0.15);border-color:var(--teal);}
.dp-apt-reject{background:var(--red-dim);border-color:rgba(240,82,82,0.3);color:var(--red);}
.dp-apt-reject:hover{background:rgba(240,82,82,0.15);border-color:var(--red);}
.dp-appointment-loading,.dp-appointment-empty{text-align:center;padding:40px 20px;color:var(--tm);}
.dp-empty-icon{font-size:48px;margin-bottom:12px;}
.dp-empty-text{font-size:15px;font-weight:600;color:var(--tp);margin-bottom:4px;}
.dp-empty-sub{font-size:13px;color:var(--tm);}
.dp-apt-detail-grid{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.dp-apt-detail-item{border:1px solid var(--b);background:var(--s2);border-radius:10px;padding:10px;}
.dp-apt-detail-label{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--tm);font-weight:700;}
.dp-apt-detail-value{margin-top:5px;color:var(--tp);font-size:13px;word-break:break-word;}
.dp-apt-detail-notes{margin-top:12px;border:1px solid var(--b);background:var(--s2);border-radius:10px;padding:12px;}
.dp-apt-detail-notes p{margin-top:6px;color:var(--ts);font-size:13px;line-height:1.6;white-space:pre-wrap;}
@media(max-width:1100px){.dp-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}.dp-grid{grid-template-columns:1fr;}}
@media(max-width:860px){.dp-shell{grid-template-columns:1fr;}.dp-sidebar{display:none;}.dp-content{padding:20px;}.dp-topbar{padding:14px 20px;}.dp-profile-wrap{grid-template-columns:1fr;}}
@media(max-width:560px){.dp-module-grid{grid-template-columns:1fr;}.dp-kpis{grid-template-columns:1fr;}.dp-hero{flex-direction:column;align-items:flex-start;}.dp-modal-grid{grid-template-columns:1fr;}.dp-profile-grid{grid-template-columns:1fr;}.dp-profile-actions{flex-direction:column;}.dp-profile-secondary-btn,.dp-profile-actions .dp-full-btn,.dp-profile-actions .dp-modal-btn{width:100%;}.dp-apt-actions{flex-direction:column;}.dp-apt-btn{width:100%;}.dp-apt-detail-grid{grid-template-columns:1fr;}}
`

// ── Icons ─────────────────────────────────────────────────────────────────
const CalIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
)
const FileIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
)
const AlertTriIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
)
const BotIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M12 11V7m-4 0a4 4 0 018 0" />
        <line x1="8" y1="15" x2="8.01" y2="15" /><line x1="16" y1="15" x2="16.01" y2="15" />
    </svg>
)
const HeartIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
)
const GridIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
)
const BellIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
)
const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21a8 8 0 10-16 0" />
        <circle cx="12" cy="7" r="4" />
    </svg>
)
const LogoutIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
)
const CircleAlertIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
)

// ── Data ──────────────────────────────────────────────────────────────────
// NAV_ITEMS ko function bana diya hai taki dynamic badge count aa sake
const getNavItems = (pendingCount, emergencyCount) => [
    { key: 'dashboard', label: 'Dashboard', Icon: GridIcon },
    { key: 'appointments', label: 'Appointments', Icon: CalIcon, badge: pendingCount > 0 ? pendingCount : null },
    { key: 'patients', label: 'Patients', Icon: HeartIcon },
    { key: 'emergency', label: 'Emergency', Icon: AlertTriIcon, badge: emergencyCount > 0 ? emergencyCount : null },
    { key: 'ai', label: 'AI Assistant', Icon: BotIcon },
    { key: 'profile', label: 'Profile', Icon: UserIcon },
]

// ── Helpers ───────────────────────────────────────────────────────────────
function getInitials(name = '') {
    return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
}
function getDateInfo() {
    const d = new Date()
    return {
        day: d.getDate(),
        label: `${d.toLocaleString('default', { weekday: 'long' })}, ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
    }
}

const parseAppointmentDate = (value) => {
    const parsed = new Date(String(value || ''))
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getAppointmentSortStamp = (appointment) => {
    const createdAt = parseAppointmentDate(appointment?.createdAt)
    const bookingDate = parseAppointmentDate(appointment?.date)
    return createdAt?.getTime?.() || bookingDate?.getTime?.() || 0
}

const formatAppointmentDate = (value) => {
    const parsed = parseAppointmentDate(value)
    if (!parsed) return String(value || 'Unknown date')

    return parsed.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

const isSameLocalDate = (valueA, valueB) => {
    const first = parseAppointmentDate(valueA)
    const second = parseAppointmentDate(valueB)
    if (!first || !second) return false
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    )
}

const getAppointmentStatus = (appointment) => {
    const approvalStatus = String(appointment?.approvalStatus || appointment?.approval_status || '').toLowerCase()
    const rawStatus = String(appointment?.status || '').toLowerCase()

    if (approvalStatus === 'rejected' || rawStatus === 'rejected' || rawStatus === 'cancelled') return 'Rejected'
    if (approvalStatus === 'approved' || rawStatus === 'confirmed') return 'Confirmed'
    if (approvalStatus === 'pending' || rawStatus === 'pending' || rawStatus === 'upcoming') return 'Pending'

    return 'Pending'
}

const getStatusToneClass = (status) => {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'confirmed') return 'confirmed'
    if (normalized === 'rejected') return 'rejected'
    return 'pending'
}

const getInitialsFromText = (value = '') =>
    String(value)
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() || '')
        .join('') || 'PT'

// ── Component ─────────────────────────────────────────────────────────────
export default function DoctorPanel({ currentUser, onLogout, onUserUpdate = () => { } }) {
    // Move meta and profileRow state above all useEffect hooks that use them
    const [meta, setMeta] = useState(currentUser?.user_metadata || {})
    const [profileRow, setProfileRow] = useState(null)
    const [activeTab, setActiveTab] = useState('dashboard')

    // Patients state
    const [patients, setPatients] = useState([]);
    const [patientsLoading, setPatientsLoading] = useState(false);
    const [patientSearch, setPatientSearch] = useState("");
    const [filteredPatients, setFilteredPatients] = useState([]);

    // Records state
    const [recordsSearchQuery, setRecordsSearchQuery] = useState("");
    const [recordsSearchResult, setRecordsSearchResult] = useState(null);
    const [isSearchingRecords, setIsSearchingRecords] = useState(false);
    const [recordsSearchError, setRecordsSearchError] = useState("");
    const [selectedDocumentDate, setSelectedDocumentDate] = useState(null)

    // Load patients for this doctor
    useEffect(() => {
        if (activeTab !== "patients") return;
        const fetchPatients = async () => {
            setPatientsLoading(true);
            try {
                // API: /api/patients?doctorName=...&hospitalName=...
                const doctorNameRaw = profileRow?.name || meta.name || "";
                const hospitalNameRaw = profileRow?.hospital_name || meta.hospital_name || meta.hospital || "";
                if (!doctorNameRaw || !hospitalNameRaw) {
                    setPatients([]);
                    setFilteredPatients([]);
                    setPatientsLoading(false);
                    return;
                }
                const doctorName = normalizeDoctorName(doctorNameRaw);
                const hospitalName = normalizeHospitalName(hospitalNameRaw);
                const res = await fetch(apiUrl(`/api/patients?doctorName=${encodeURIComponent(doctorName)}&hospitalName=${encodeURIComponent(hospitalName)}`));
                if (!res.ok) throw new Error("Failed to fetch patients");
                const data = await res.json();
                const list = Array.isArray(data.patients) ? data.patients : [];
                setPatients(list);
                setFilteredPatients(list);
            } catch (e) {
                setPatients([]);
                setFilteredPatients([]);
            } finally {
                setPatientsLoading(false);
            }
        };
        fetchPatients();
    }, [activeTab, profileRow, meta]);

    const documentsByDate = useMemo(() => {
        if (!recordsSearchResult?.documents) return {}
        return recordsSearchResult.documents.reduce((groups, doc) => {
            const dateKey = new Date(doc.upload_date || doc.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            })
            groups[dateKey] = groups[dateKey] || {}
            
            const sessionId = doc.group_id || doc.sessionId || 'single'
            groups[dateKey][sessionId] = groups[dateKey][sessionId] || []
            groups[dateKey][sessionId].push(doc)
            return groups
        }, {})
    }, [recordsSearchResult])

    const documentDates = useMemo(() => 
        Object.keys(documentsByDate).sort((a, b) => new Date(b) - new Date(a)), 
        [documentsByDate]
    )

    useEffect(() => {
        if (documentDates.length > 0 && !selectedDocumentDate) {
            setSelectedDocumentDate(documentDates[0])
        }
    }, [documentDates, selectedDocumentDate])

    // Patient search filter
    useEffect(() => {
        if (!patientSearch.trim()) {
            setFilteredPatients(patients);
        } else {
            const q = patientSearch.trim().toLowerCase();
            setFilteredPatients(
                patients.filter(
                    (p) =>
                        (p.name && p.name.toLowerCase().includes(q)) ||
                        (p.email && p.email.toLowerCase().includes(q)) ||
                        (p.phone && String(p.phone).includes(q))
                )
            );
        }
    }, [patientSearch, patients]);
    const [formState, setFormState] = useState({
        specialization: '',
        license_number: '',
        experience_years: '',
        qualification: '',
        hospital_name: '',
    })
    const [profileError, setProfileError] = useState('')
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const [avatarError, setAvatarError] = useState('')
    const [hospitalOptions, setHospitalOptions] = useState([])
    const [hospitalQuery, setHospitalQuery] = useState('')
    const [selectedHospital, setSelectedHospital] = useState(null)
    const [isHospitalDropdownOpen, setIsHospitalDropdownOpen] = useState(false)
    const [isLoadingHospitals, setIsLoadingHospitals] = useState(false)
    const [hospitalLoadError, setHospitalLoadError] = useState('')
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [allAppointments, setAllAppointments] = useState([])
    const [pendingAppointments, setPendingAppointments] = useState([])
    const [approvedAppointments, setApprovedAppointments] = useState([])
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
    const [selectedAppointmentDetail, setSelectedAppointmentDetail] = useState(null)

    useEffect(() => {
        setMeta(currentUser?.user_metadata || {})
    }, [currentUser])

    useEffect(() => {
        let intervalId

        const loadProfileRow = async () => {
            if (!currentUser?.id) return
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id,name,avatar_url,role,hospital_name,specialization,license_number,qualification,experience_years,doctor_profile_completed,verification_status')
                .eq('id', currentUser.id)
                .maybeSingle()

            if (!error && data) {
                setProfileRow(data)
            }
        }

        loadProfileRow()
        intervalId = window.setInterval(loadProfileRow, 6000)

        return () => {
            if (intervalId) window.clearInterval(intervalId)
        }
    }, [currentUser?.id])

    useEffect(() => {
        setFormState({
            specialization: meta.specialization || '',
            license_number: meta.license_number || '',
            experience_years: meta.experience_years != null ? String(meta.experience_years) : '',
            qualification: meta.qualification || '',
            hospital_name: meta.hospital_name || meta.hospital || '',
        })
    }, [meta])

    const isProfileCompleted = profileRow?.doctor_profile_completed ?? Boolean(meta.doctor_profile_completed)
    const verificationStatus = profileRow?.verification_status || meta.verification_status || (isProfileCompleted ? 'pending' : 'profile_incomplete')
    const isVerifiedDoctor = verificationStatus === 'verified'
    const showProfileModal = !isProfileCompleted
    const requiresVerification = !isVerifiedDoctor

    useEffect(() => {
        const savedHospitalName = profileRow?.hospital_name || meta.hospital_name || meta.hospital || ''
        if (!savedHospitalName) return
        setHospitalQuery(savedHospitalName)
        const exactMatch = (Array.isArray(hospitalOptions) ? hospitalOptions : []).find(
            (hospital) => String(hospital.name || '').trim().toLowerCase() === savedHospitalName.trim().toLowerCase(),
        )
        if (exactMatch) {
            setSelectedHospital(exactMatch)
        }
    }, [profileRow?.hospital_name, meta.hospital_name, meta.hospital, hospitalOptions])

    useEffect(() => {
        if (!showProfileModal && !isEditingProfile) return

        let isMounted = true
        const fallbackCoords = { lat: 27.4924, lng: 77.6737 }

        const loadNearbyHospitals = async () => {
            setIsLoadingHospitals(true)
            setHospitalLoadError('')

            try {
                const cachedHospitals = sortHospitalsByDistance(readNearbyHospitalCache())
                if (cachedHospitals.length > 0) {
                    if (!isMounted) return
                    setHospitalOptions(cachedHospitals)
                }

                let coords = fallbackCoords
                if (navigator.geolocation) {
                    try {
                        const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                                enableHighAccuracy: true,
                                maximumAge: 10000,
                                timeout: 15000,
                            })
                        })

                        coords = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        }
                    } catch {
                        coords = fallbackCoords
                    }
                }

                const hospitals = await fetchNearbyHospitalsByLocation(coords.lat, coords.lng)

                if (!isMounted) return
                const sortedHospitals = sortHospitalsByDistance(hospitals)
                setHospitalOptions(sortedHospitals)
                writeNearbyHospitalCache(sortedHospitals)
            } catch (error) {
                if (!isMounted) return
                setHospitalLoadError(error?.message || 'Unable to load nearby hospitals.')
                setHospitalOptions(readNearbyHospitalCache())
            } finally {
                if (isMounted) {
                    setIsLoadingHospitals(false)
                }
            }
        }

        loadNearbyHospitals()

        return () => {
            isMounted = false
        }
    }, [showProfileModal, isEditingProfile])

    const handleDownloadDocument = async (doc) => {
        try {
            const response = await fetch(doc.file_url)
            const blob = await response.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = doc.title || 'document'
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(downloadUrl)
        } catch (error) {
            console.error('Download failed:', error)
            window.open(doc.file_url, '_blank')
        }
    }

    const handleDownloadBatch = async (docs, dateKey) => {
        if (!docs || !docs.length) return
        
        try {
            const zip = new JSZip()
            const folderName = `Medical_Records_${dateKey.replace(/\s+/g, '_')}`
            const folder = zip.folder(folderName)

            for (const doc of docs) {
                try {
                    const response = await fetch(doc.file_url)
                    const blob = await response.blob()
                    // Use title or a unique name for the file in ZIP
                    const fileName = doc.title || `doc_${Math.random().toString(36).slice(2, 7)}`
                    folder.file(fileName, blob)
                } catch (err) {
                    console.error(`Failed to add file ${doc.title} to zip:`, err)
                }
            }

            const content = await zip.generateAsync({ type: 'blob' })
            saveAs(content, `${folderName}.zip`)
        } catch (error) {
            console.error('Batch download failed:', error)
            alert('Failed to create ZIP file. Trying individual downloads...')
            for (const doc of docs) {
                await handleDownloadDocument(doc)
            }
        }
    }

    useEffect(() => {
        if (activeTab !== 'appointments') return
        loadPendingAppointments()
        const interval = setInterval(loadPendingAppointments, 15000)
        return () => clearInterval(interval)
    }, [activeTab])

    const verificationLabel = useMemo(() => {
        if (verificationStatus === 'verified') return 'Verified Doctor'
        if (verificationStatus === 'rejected') return 'Verification Rejected'
        if (verificationStatus === 'pending') return 'Verification Pending'
        return 'Profile Incomplete'
    }, [verificationStatus])

    const fullName = meta.full_name || meta.name || meta.first_name || 'Doctor'
    const email = currentUser?.email || 'No email'
    const hospital = profileRow?.hospital_name || meta.hospital_name || meta.hospital || 'Hospital not set'
    const initials = getInitials(fullName)
    const { day, label: dateLabel } = getDateInfo()
    const firstName = fullName.split(' ')[0]
    const avatarUrl = profileRow?.avatar_url || meta.avatar_url || ''
    const specialization = profileRow?.specialization || meta.specialization || 'Not added'
    const qualification = profileRow?.qualification || meta.qualification || 'Not added'
    const licenseNumber = profileRow?.license_number || meta.license_number || 'Not added'
    const experienceYears = (profileRow?.experience_years ?? meta.experience_years) != null
        ? `${profileRow?.experience_years ?? meta.experience_years} years`
        : 'Not added'

    const pageTitle = activeTab === 'profile' ? 'Doctor Profile' : activeTab === 'appointments' ? 'Appointment Approvals' : `Good morning, Dr. ${firstName}`
    const dashboardStats = useMemo(() => {
        const today = new Date()
        const pendingCount = pendingAppointments.length
        const confirmedCount = approvedAppointments.length
        const rejectedCount = allAppointments.filter((appointment) => getAppointmentStatus(appointment) === 'Rejected').length
        const todayCount = allAppointments.filter((appointment) => isSameLocalDate(appointment?.date, today)).length

        return [
            {
                key: 'today',
                label: 'Today\'s Appointments',
                value: String(todayCount).padStart(2, '0'),
                foot: `${pendingCount} pending · ${confirmedCount} confirmed`,
                cls: 'dp-kpi-teal',
                Icon: CalIcon,
            },
            {
                key: 'pending',
                label: 'Pending Requests',
                value: String(pendingCount).padStart(2, '0'),
                foot: 'Awaiting your approval',
                cls: 'dp-kpi-blue',
                Icon: FileIcon,
            },
            {
                key: 'confirmed',
                label: 'Confirmed Appointments',
                value: String(confirmedCount).padStart(2, '0'),
                foot: 'Accepted and visible to patients',
                cls: 'dp-kpi-violet',
                Icon: AlertTriIcon,
            },
            {
                key: 'rejected',
                label: 'Rejected Requests',
                value: String(rejectedCount).padStart(2, '0'),
                foot: 'Removed from approval queue',
                cls: 'dp-kpi-red',
                Icon: BotIcon,
            },
        ]
    }, [allAppointments, pendingAppointments.length, approvedAppointments.length])

    const recentAppointments = useMemo(
        () => [...allAppointments].sort((a, b) => getAppointmentSortStamp(b) - getAppointmentSortStamp(a)).slice(0, 6),
        [allAppointments],
    )

    const nextPendingAppointment = pendingAppointments[0] || null
    const latestAppointment = recentAppointments[0] || null
    const filteredHospitalOptions = useMemo(
        () => {
            const sortedHospitals = sortHospitalsByDistance(hospitalOptions)
            const normalizedQuery = String(hospitalQuery || '').trim().toLowerCase()
            const normalizedSelectedHospital = String(selectedHospital?.name || '').trim().toLowerCase()

            if (normalizedQuery && normalizedSelectedHospital && normalizedQuery === normalizedSelectedHospital) {
                return sortedHospitals
            }

            return filterNearbyHospitals(sortedHospitals, hospitalQuery)
        },
        [hospitalOptions, hospitalQuery, selectedHospital?.name],
    )

    const handleProfileInput = (event) => {
        const { name, value } = event.target
        setFormState((prev) => ({ ...prev, [name]: value }))
    }

    const handleHospitalSearchChange = (event) => {
        const value = event.target.value
        setHospitalQuery(value)
        setSelectedHospital(null)
        setFormState((prev) => ({ ...prev, hospital_name: value }))
        setIsHospitalDropdownOpen(true)
    }

    const handleHospitalSelect = (hospital) => {
        setSelectedHospital(hospital)
        setHospitalQuery(hospital.name)
        setFormState((prev) => ({ ...prev, hospital_name: hospital.name }))
        setIsHospitalDropdownOpen(false)
    }

    const beginProfileEdit = () => {
        setIsEditingProfile(true)
        setActiveTab('profile')
        setProfileError('')
        setFormState({
            specialization: profileRow?.specialization || meta.specialization || '',
            license_number: profileRow?.license_number || meta.license_number || '',
            experience_years: profileRow?.experience_years != null ? String(profileRow.experience_years) : (meta.experience_years != null ? String(meta.experience_years) : ''),
            qualification: profileRow?.qualification || meta.qualification || '',
            hospital_name: profileRow?.hospital_name || meta.hospital_name || meta.hospital || '',
        })

        const currentHospitalName = profileRow?.hospital_name || meta.hospital_name || meta.hospital || ''
        setHospitalQuery(currentHospitalName)
        const exactMatch = (Array.isArray(hospitalOptions) ? hospitalOptions : []).find(
            (hospital) => String(hospital.name || '').trim().toLowerCase() === currentHospitalName.trim().toLowerCase(),
        )
        setSelectedHospital(exactMatch || null)
        setIsHospitalDropdownOpen(false)
    }

    const cancelProfileEdit = () => {
        setIsEditingProfile(false)
        setProfileError('')
        setFormState({
            specialization: profileRow?.specialization || meta.specialization || '',
            license_number: profileRow?.license_number || meta.license_number || '',
            experience_years: profileRow?.experience_years != null ? String(profileRow.experience_years) : (meta.experience_years != null ? String(meta.experience_years) : ''),
            qualification: profileRow?.qualification || meta.qualification || '',
            hospital_name: profileRow?.hospital_name || meta.hospital_name || meta.hospital || '',
        })
        setHospitalQuery(profileRow?.hospital_name || meta.hospital_name || meta.hospital || '')
        setSelectedHospital(null)
        setIsHospitalDropdownOpen(false)
    }

    // Doctor name normalization (same as backend)
    function normalizeDoctorName(name = '') {
        return String(name)
            .replace(/^dr\.?\s*/i, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    function normalizeHospitalName(name = '') {
        return String(name).trim().toLowerCase();
    }

    const loadPendingAppointments = async () => {
        try {
            setIsLoadingAppointments(true)
            const doctorNameRaw = profileRow?.name || meta.name || ''
            const hospitalNameRaw = profileRow?.hospital_name || meta.hospital_name || meta.hospital || ''
            if (!doctorNameRaw || !hospitalNameRaw) {
                setAllAppointments([])
                setPendingAppointments([])
                setApprovedAppointments([])
                return
            }
            const doctorName = normalizeDoctorName(doctorNameRaw)
            const hospitalName = normalizeHospitalName(hospitalNameRaw)

            // Send normalized doctorName and hospitalName to backend
            const pending = await fetch(
                apiUrl(`/api/appointments/doctor/pending?doctorName=${encodeURIComponent(doctorName)}&hospitalName=${encodeURIComponent(hospitalName)}`)
            )
                .then((res) => res.json())
                .then((data) => (Array.isArray(data.appointments) ? data.appointments : []))
                .catch(() => [])

            const allAppointmentsResponse = await fetch(
                apiUrl(`/api/appointments/doctor/all?doctorName=${encodeURIComponent(doctorName)}&hospitalName=${encodeURIComponent(hospitalName)}`)
            )
                .then((res) => res.json())
                .then((data) => (Array.isArray(data.appointments) ? data.appointments : []))
                .catch(() => [])

            const approved = allAppointmentsResponse.filter((apt) => getAppointmentStatus(apt) === 'Confirmed')
            const pendingFromAll = allAppointmentsResponse.filter((apt) => getAppointmentStatus(apt) === 'Pending')

            setAllAppointments(allAppointmentsResponse)
            setPendingAppointments(pendingFromAll.length > 0 ? pendingFromAll : pending)
            setApprovedAppointments(approved)
        } catch (error) {
            console.error('Failed to load appointments:', error)
        } finally {
            setIsLoadingAppointments(false)
        }
    }

    const handleApproveAppointment = async (appointmentId) => {
        try {
            const doctorName = profileRow?.name || meta.name || ''
            const res = await fetch(apiUrl(`/api/appointments/${appointmentId}/approve`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvedBy: doctorName }),
            })

            if (res.ok) {
                setPendingAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId))
                const approved = pendingAppointments.find((apt) => apt.id === appointmentId)
                if (approved) {
                    setApprovedAppointments((prev) => [{ ...approved, approvalStatus: 'approved' }, ...prev])
                }
                setAllAppointments((prev) =>
                    prev.map((appointment) =>
                        appointment.id === appointmentId
                            ? { ...appointment, approvalStatus: 'approved', status: 'Confirmed' }
                            : appointment,
                    ),
                )
                setSelectedAppointmentDetail((prev) => (prev?.id === appointmentId ? { ...prev, approvalStatus: 'approved', status: 'Confirmed' } : prev))
            }
        } catch (error) {
            console.error('Failed to approve appointment:', error)
        }
    }

    const handleRejectAppointment = async (appointmentId) => {
        try {
            const doctorName = profileRow?.name || meta.name || ''
            const res = await fetch(apiUrl(`/api/appointments/${appointmentId}/reject`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvedBy: doctorName }),
            })

            if (res.ok) {
                setPendingAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId))
                setAllAppointments((prev) =>
                    prev.map((appointment) =>
                        appointment.id === appointmentId
                            ? { ...appointment, approvalStatus: 'rejected', status: 'Rejected' }
                            : appointment,
                    ),
                )
                if (selectedAppointmentDetail?.id === appointmentId) {
                    setSelectedAppointmentDetail(null)
                }
            }
        } catch (error) {
            console.error('Failed to reject appointment:', error)
        }
    }

    const handleRecordsSearch = async (e) => {
        if (e) e.preventDefault();
        const query = recordsSearchQuery.trim();
        if (!query) return;

        setIsSearchingRecords(true);
        setRecordsSearchError("");
        setRecordsSearchResult(null);

        try {
            const res = await fetch(apiUrl(`/api/records/patient/${encodeURIComponent(query)}`));
            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error("Patient not found with this ID.");
                }
                throw new Error("Failed to fetch patient records.");
            }
            const data = await res.json();
            setRecordsSearchResult(data);
        } catch (error) {
            setRecordsSearchError(error.message);
        } finally {
            setIsSearchingRecords(false);
        }
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault()
        const specialization = formState.specialization.trim()
        const licenseNumber = formState.license_number.trim()
        const qualification = formState.qualification.trim()
        const hospitalName = formState.hospital_name.trim()
        const experienceYears = Number.parseInt(formState.experience_years, 10)

        const exactHospitalMatch = (Array.isArray(hospitalOptions) ? hospitalOptions : []).find(
            (hospital) => String(hospital.name || '').trim().toLowerCase() === hospitalName.toLowerCase(),
        )

        const resolvedHospital = selectedHospital || exactHospitalMatch

        if (!specialization || !licenseNumber || !qualification || !hospitalName || Number.isNaN(experienceYears) || experienceYears < 0) {
            setProfileError('Please fill all fields correctly to continue.')
            return
        }

        if (!resolvedHospital) {
            setProfileError('Please select a hospital from the dropdown.')
            return
        }

        setIsSavingProfile(true)
        setProfileError('')
        try {
            const resolvedHospitalName = resolvedHospital.name
            const updatedMetadata = {
                ...meta,
                hospital_name: resolvedHospitalName,
                specialization,
                license_number: licenseNumber,
                qualification,
                experience_years: experienceYears,
                doctor_profile_completed: true,
                verification_status: 'pending',
            }
            const { data, error } = await supabaseClient.auth.updateUser({ data: updatedMetadata })
            if (error) throw error

            const profilePayload = {
                name: fullName,
                role: 'doctor',
                hospital_name: resolvedHospitalName,
                specialization,
                license_number: licenseNumber,
                qualification,
                experience_years: experienceYears,
                doctor_profile_completed: true,
                verification_status: 'pending',
                updated_at: new Date().toISOString(),
            }

            const { error: profileError } = await supabaseClient
                .from('profiles')
                .update(profilePayload)
                .eq('id', currentUser.id)

            if (profileError) throw profileError

            setMeta(data?.user?.user_metadata || updatedMetadata)
            setProfileRow((prev) => ({ ...(prev || {}), ...profilePayload }))
            setHospitalQuery(resolvedHospitalName)
            setSelectedHospital(resolvedHospital)
            setIsEditingProfile(false)
            onUserUpdate(data?.user || null)
        } catch (error) {
            setProfileError(error?.message || 'Unable to save doctor profile. Please try again.')
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handleAvatarUpload = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setAvatarError('Please upload a valid image file.')
            return
        }

        setAvatarError('')
        setIsUploadingAvatar(true)
        try {
            const extension = file.name.split('.').pop() || 'jpg'
            const path = `${currentUser?.id || 'doctor'}/avatar-${Date.now()}.${extension}`

            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(path, file, {
                cacheControl: '3600',
                upsert: true,
            })
            if (uploadError) throw uploadError

            const { data: publicData } = supabaseClient.storage.from('avatars').getPublicUrl(path)
            const nextAvatarUrl = publicData?.publicUrl
            const updatedMetadata = {
                ...meta,
                avatar_url: nextAvatarUrl,
            }
            const { data, error } = await supabaseClient.auth.updateUser({ data: updatedMetadata })
            if (error) throw error

            const { error: profileError } = await supabaseClient
                .from('profiles')
                .update({ avatar_url: nextAvatarUrl, updated_at: new Date().toISOString() })
                .eq('id', currentUser.id)

            if (profileError) throw profileError

            setMeta(data?.user?.user_metadata || updatedMetadata)
            setProfileRow((prev) => ({ ...(prev || {}), avatar_url: nextAvatarUrl }))
            onUserUpdate(data?.user || null)
        } catch (error) {
            setAvatarError(error?.message || 'Avatar upload failed. Please try again.')
        } finally {
            setIsUploadingAvatar(false)
            event.target.value = ''
        }
    }

    // Emergency count nikalne ka logic: emergency appointments filter karo
    const emergencyCount = allAppointments.filter(
        (apt) => String(apt.specialty || '').toLowerCase().includes('emerg')
    ).length;
    const navItems = getNavItems(pendingAppointments.length, emergencyCount);

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />
            <div className="dp-shell">
                <div className="dp-orb dp-orb-1" />
                <div className="dp-orb dp-orb-2" />
                <div className="dp-orb dp-orb-3" />

                {/* Sidebar */}
                <aside className="dp-sidebar">
                    <div className="dp-sidebar-logo">
                        <div className="dp-logo-mark"><HeartIcon /></div>
                        <div>
                            <div className="dp-logo-name">MedCore</div>
                            <span className="dp-logo-sub">Doctor Portal</span>
                        </div>
                    </div>
                    <nav className="dp-nav">
                        <span className="dp-nav-section">Main</span>
                        {navItems.map(({ key, label, Icon: NI, badge }) => (
                            <button
                                key={key}
                                type="button"
                                className={`dp-nav-item${activeTab === key ? ' active' : ''}`}
                                onClick={() => setActiveTab(key)}
                            >
                                <NI />{label}
                                {badge ? <span className="dp-nav-badge">{badge}</span> : null}
                            </button>
                        ))}
                    </nav>
                    <div className="dp-sidebar-footer">
                        <button
                            type="button"
                            className="dp-doctor-mini dp-doctor-mini-btn"
                            onClick={() => setActiveTab('profile')}
                            aria-label="Open profile"
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Doctor avatar" className="dp-mini-avatar" />
                            ) : (
                                <div className="dp-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{initials}</div>
                            )}
                            <div>
                                <div className="dp-mini-name">Dr. {fullName}</div>
                                <div className="dp-mini-role">{specialization}</div>
                                <div className="dp-mini-hospital">{hospital}</div>
                            </div>
                        </button>
                    </div>
                </aside>

                {/* Main */}
                <div className="dp-main">
                    <header className="dp-topbar">
                        <div>
                            <div className="dp-topbar-eyebrow">Doctor Workspace</div>
                            <h1 className="dp-topbar-title">{pageTitle}</h1>
                        </div>
                        <div className="dp-topbar-right">
                            <div className="dp-pill-live"><span className="dp-pill-dot" />Live</div>
                            <button type="button" className="dp-icon-btn" aria-label="Notifications"><BellIcon /></button>
                            <button type="button" className="dp-logout-btn" onClick={onLogout}><LogoutIcon />Logout</button>
                        </div>
                    </header>

                    <div className="dp-content">
                        {requiresVerification && (
                            <div className="dp-verify-banner">
                                <div>
                                    <div className="dp-verify-title">Verification Required</div>
                                    <div className="dp-verify-sub">
                                        Complete your doctor profile and wait for admin approval to unlock all modules.
                                    </div>
                                </div>
                                <span className={`dp-verify-chip ${isVerifiedDoctor ? 'verified' : 'pending'}`}>{verificationLabel}</span>
                            </div>
                        )}

                        {activeTab === 'patients' ? (
                            <div className="dp-card">
                                <div className="dp-section-heading">
                                    <h2 className="dp-section-title">Patient Records Search</h2>
                                </div>
                                <form onSubmit={handleRecordsSearch} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                                    <input
                                        className="dark-input"
                                        style={{ flex: 1, maxWidth: '400px' }}
                                        type="text"
                                        placeholder="Enter Patient ID (e.g. alok@8212)"
                                        value={recordsSearchQuery}
                                        onChange={e => setRecordsSearchQuery(e.target.value)}
                                    />
                                    <button 
                                        type="submit" 
                                        className="dp-modal-btn" 
                                        disabled={isSearchingRecords || !recordsSearchQuery.trim()}
                                        style={{ height: '42px' }}
                                    >
                                        {isSearchingRecords ? 'Searching...' : 'Search Patient'}
                                    </button>
                                </form>

                                {recordsSearchError && (
                                    <div style={{ color: '#ff6b6b', padding: '10px 0', fontSize: '14px' }}>
                                        {recordsSearchError}
                                    </div>
                                )}

                                {recordsSearchResult && (
                                    <div style={{ animation: 'slideUp 0.4s ease both' }}>
                                        <div style={{ 
                                            background: 'var(--s2)', 
                                            padding: '20px', 
                                            borderRadius: '12px', 
                                            border: '1px solid var(--b)',
                                            marginBottom: '20px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div className="dp-pt-avatar" style={{ 
                                                    width: '50px', 
                                                    height: '50px', 
                                                    fontSize: '18px',
                                                    background: 'var(--teal-dim)',
                                                    color: 'var(--teal)'
                                                }}>
                                                    {getInitialsFromText(recordsSearchResult.patient.name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--tp)' }}>
                                                        {recordsSearchResult.patient.name}
                                                    </div>
                                                    <div style={{ fontSize: '14px', color: 'var(--ts)', marginTop: '2px' }}>
                                                        Patient ID: <span style={{ color: 'var(--teal)', fontWeight: '500' }}>{recordsSearchResult.patient.memberId}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {recordsSearchResult.documents.length === 0 ? (
                                            <div style={{ color: 'var(--tm)', padding: '20px 0' }}>
                                                No documents uploaded by this patient.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', marginTop: '20px' }}>
                                                {/* DATE SIDEBAR */}
                                                <aside style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid var(--b)', paddingRight: '16px' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                                        Upload Dates
                                                    </div>
                                                    {documentDates.map(date => (
                                                        <button
                                                            key={date}
                                                            onClick={() => setSelectedDocumentDate(date)}
                                                            style={{
                                                                padding: '10px 14px',
                                                                borderRadius: '8px',
                                                                border: '1px solid',
                                                                borderColor: selectedDocumentDate === date ? 'var(--teal-glow)' : 'transparent',
                                                                background: selectedDocumentDate === date ? 'var(--teal-dim)' : 'transparent',
                                                                color: selectedDocumentDate === date ? 'var(--teal)' : 'var(--ts)',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                textAlign: 'left',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            {date}
                                                        </button>
                                                    ))}
                                                </aside>

                                                {/* DOCUMENT CONTENT */}
                                                <main>
                                                    <div style={{ display: 'grid', gap: '24px' }}>
                                                        {selectedDocumentDate && documentsByDate[selectedDocumentDate] && 
                                                            Object.entries(documentsByDate[selectedDocumentDate]).map(([sessionId, docs]) => (
                                                                <div key={sessionId} style={{ 
                                                                    background: 'var(--s1)', 
                                                                    borderRadius: '16px', 
                                                                    border: '1px solid var(--b)',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                        <div style={{ padding: '12px 16px', background: 'var(--s2)', borderBottom: '1px solid var(--b)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tp)' }}>
                                                                                Batch: {new Date(docs[0].created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '10px', color: 'var(--tm)', background: 'var(--s3)', padding: '2px 8px', borderRadius: '4px' }}>
                                                                                    {docs.length} Files
                                                                                </span>
                                                                                <button 
                                                                                    onClick={() => handleDownloadBatch(docs, selectedDocumentDate)}
                                                                                    title="Download All Files as ZIP"
                                                                                    style={{ 
                                                                                        background: 'var(--teal-dim)', 
                                                                                        color: 'var(--teal)', 
                                                                                        border: '1px solid var(--teal-glow)', 
                                                                                        borderRadius: '6px', 
                                                                                        padding: '6px 12px', 
                                                                                        fontSize: '11px', 
                                                                                        fontWeight: '700',
                                                                                        cursor: 'pointer',
                                                                                        transition: 'all 0.2s ease',
                                                                                        textTransform: 'uppercase',
                                                                                        letterSpacing: '0.5px'
                                                                                    }}
                                                                                >
                                                                                    All File Download
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                                                                        {docs.map(doc => (
                                                                            <div key={doc.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                                                <div style={{ color: 'var(--teal)', background: 'var(--teal-dim)', padding: '8px', borderRadius: '8px' }}>
                                                                                    <FileIcon />
                                                                                </div>
                                                                                <div style={{ flex: 1 }}>
                                                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tp)' }}>{doc.title}</div>
                                                                                    {doc.text_content && (
                                                                                        <div style={{ fontSize: '12px', color: 'var(--tm)', marginTop: '4px', fontStyle: 'italic', background: 'var(--s2)', padding: '6px', borderRadius: '4px' }}>
                                                                                            AI Summary: {doc.text_content.slice(0, 150)}...
                                                                                        </div>
                                                                                    )}
                                                                                    {doc.note && (
                                                                                        <div style={{ fontSize: '13px', color: 'var(--ts)', marginTop: '8px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '3px solid var(--teal)' }}>
                                                                                            <strong>Note:</strong> {doc.note}
                                                                                        </div>
                                                                                    )}
                                                                                        <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                                                                                            <a 
                                                                                                href={doc.file_url} 
                                                                                                target="_blank" 
                                                                                                rel="noopener noreferrer"
                                                                                                title="View Document"
                                                                                                style={{ 
                                                                                                    color: 'var(--teal)', 
                                                                                                    background: 'var(--teal-dim)',
                                                                                                    width: '32px',
                                                                                                    height: '32px',
                                                                                                    borderRadius: '6px',
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    justifyContent: 'center',
                                                                                                    border: '1px solid var(--teal-glow)'
                                                                                                }}
                                                                                            >
                                                                                                <Eye size={16} />
                                                                                            </a>
                                                                                            <button 
                                                                                                onClick={() => handleDownloadDocument(doc)}
                                                                                                title="Download File"
                                                                                                style={{ 
                                                                                                    background: 'var(--s3)', 
                                                                                                    border: '1px solid var(--b)', 
                                                                                                    color: 'var(--ts)', 
                                                                                                    width: '32px',
                                                                                                    height: '32px',
                                                                                                    borderRadius: '6px',
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    justifyContent: 'center',
                                                                                                    cursor: 'pointer',
                                                                                                    transition: 'all 0.2s ease'
                                                                                                }}
                                                                                            >
                                                                                                <Download size={16} />
                                                                                            </button>
                                                                                        </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>

                                                    {/* ACTIVITY HISTORY (DASHBOARD STYLE) */}
                                                    <div style={{ marginTop: '40px', padding: '20px', background: 'var(--s1)', borderRadius: '16px', border: '1px solid var(--b)' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tp)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ color: 'var(--teal)' }}>📄</span> Activity History
                                                        </div>
                                                        <div style={{ display: 'grid', gap: '10px' }}>
                                                            {selectedDocumentDate && documentsByDate[selectedDocumentDate] && (
                                                                Object.values(documentsByDate[selectedDocumentDate]).flat()
                                                                    .flatMap(doc => (doc.history || []).map((h, idx) => ({ ...h, docName: doc.title, idx })))
                                                                    .sort((a,b) => (b.time || "").localeCompare(a.time || ""))
                                                                    .map((h, i) => (
                                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--ts)' }}>
                                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--teal)' }}></div>
                                                                            <span style={{ color: 'var(--tp)', fontWeight: '500' }}>{h.docName}</span>
                                                                            <span>{h.event} at {h.time}</span>
                                                                        </div>
                                                                    ))
                                                            )}
                                                        </div>
                                                    </div>
                                                    </main>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                {!recordsSearchResult && (
                                    <div style={{ marginTop: '10px' }}>
                                        <div className="dp-section-heading" style={{ marginTop: '30px' }}>
                                            <h2 className="dp-section-title">My Registered Patients</h2>
                                        </div>
                                        <input
                                            className="dark-input"
                                            style={{ marginBottom: 18, width: "100%", maxWidth: 400 }}
                                            type="text"
                                            placeholder="Filter local patients by name..."
                                            value={patientSearch}
                                            onChange={e => setPatientSearch(e.target.value)}
                                        />
                                        {patientsLoading ? (
                                            <div style={{ color: '#7a8ba7', padding: 30 }}>Loading patients...</div>
                                        ) : filteredPatients.length === 0 ? (
                                            <div style={{ color: '#ffb4b4', padding: 30 }}>No patients found.</div>
                                        ) : (
                                            <div className="dp-patient-list">
                                                {filteredPatients.map((p, idx) => (
                                                    <div className="dp-patient-row" key={p.id || idx}>
                                                        <div className="dp-pt-avatar" style={{ background: '#0cb8a033', color: '#0cb8a0' }}>{getInitialsFromText(p.name || p.email || p.phone)}</div>
                                                        <div className="dp-pt-info">
                                                            <div className="dp-pt-name">{p.name || 'Unknown'}</div>
                                                            <div className="dp-pt-sub">{p.email || p.phone || ''}</div>
                                                        </div>
                                                        <div className="dp-pt-status ps-in">Active</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'profile' ? (
                            <div className="dp-profile-wrap">
                                <div className="dp-profile-card">
                                    <div className="dp-profile-avatar-wrap">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Doctor avatar" className="dp-profile-avatar" />
                                        ) : (
                                            <div className="dp-avatar" style={{ width: 104, height: 104, fontSize: 30 }}>{initials}</div>
                                        )}
                                        <div className="dp-profile-name">Dr. {fullName}</div>
                                        <div className="dp-profile-sub">{email}</div>

                                        <label className="dp-upload-btn" htmlFor="doctor-avatar-upload">
                                            {isUploadingAvatar ? 'Uploading...' : 'Upload Profile Photo'}
                                        </label>
                                        <input
                                            id="doctor-avatar-upload"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                            style={{ display: 'none' }}
                                            disabled={isUploadingAvatar}
                                        />
                                        <div className="dp-upload-note">JPG, PNG, WEBP accepted</div>
                                        {avatarError && <div className="dp-avatar-error">{avatarError}</div>}
                                    </div>
                                </div>

                                <div>
                                    {!isEditingProfile ? (
                                        <>
                                            <div className="dp-profile-grid">
                                                <div className="dp-profile-item">
                                                    <div className="dp-profile-label">Hospital</div>
                                                    <div className="dp-profile-value">{hospital}</div>
                                                </div>
                                                <div className="dp-profile-item">
                                                    <div className="dp-profile-label">Specialization</div>
                                                    <div className="dp-profile-value">{specialization}</div>
                                                </div>
                                                <div className="dp-profile-item">
                                                    <div className="dp-profile-label">Qualification</div>
                                                    <div className="dp-profile-value">{qualification}</div>
                                                </div>
                                                <div className="dp-profile-item">
                                                    <div className="dp-profile-label">Experience</div>
                                                    <div className="dp-profile-value">{experienceYears}</div>
                                                </div>
                                                <div className="dp-profile-item">
                                                    <div className="dp-profile-label">License Number</div>
                                                    <div className="dp-profile-value">{licenseNumber}</div>
                                                </div>
                                                <div className="dp-profile-item">
                                                    <div className="dp-profile-label">Verification Status</div>
                                                    <div className="dp-profile-value">{verificationLabel}</div>
                                                </div>
                                            </div>

                                            <div className="dp-profile-actions">
                                                <button type="button" className="dp-profile-secondary-btn" onClick={beginProfileEdit}>
                                                    Edit Profile
                                                </button>
                                                <button type="button" className="dp-full-btn" onClick={() => setActiveTab('dashboard')}>
                                                    Back to Dashboard
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="dp-profile-edit-panel">
                                            <div className="dp-profile-edit-header">
                                                <div>
                                                    <div className="dp-section-title">Edit Doctor Profile</div>
                                                    <p>Update your hospital and professional details. Saving will send the profile back to pending review.</p>
                                                </div>
                                                <span className={`dp-verify-chip ${isVerifiedDoctor ? 'verified' : 'pending'}`}>{verificationLabel}</span>
                                            </div>

                                            <div className="dp-modal-grid dp-profile-edit-grid">
                                                <div className="dp-field">
                                                    <label>Hospital Name</label>
                                                    <div className="dp-combobox">
                                                        <input
                                                            className="dp-combobox-input"
                                                            name="hospital_name_search"
                                                            value={hospitalQuery}
                                                            onChange={handleHospitalSearchChange}
                                                            onFocus={() => setIsHospitalDropdownOpen(true)}
                                                            onBlur={() => window.setTimeout(() => setIsHospitalDropdownOpen(false), 120)}
                                                            placeholder="Search nearby hospital"
                                                            autoComplete="off"
                                                            required
                                                        />
                                                        {isHospitalDropdownOpen && (
                                                            <div className="dp-combobox-menu">
                                                                <div className="dp-hospital-helper">
                                                                    <span>
                                                                        {isLoadingHospitals
                                                                            ? 'Loading nearby hospitals...'
                                                                            : hospitalLoadError || 'Select from the live nearby list'}
                                                                    </span>
                                                                    <span className="dp-hospital-count">{hospitalOptions.length} found</span>
                                                                </div>
                                                                {filteredHospitalOptions.length > 0 ? (
                                                                    filteredHospitalOptions.map((hospitalOption) => (
                                                                        <button
                                                                            key={hospitalOption.key}
                                                                            type="button"
                                                                            className="dp-combobox-option"
                                                                            onMouseDown={(event) => event.preventDefault()}
                                                                            onClick={() => handleHospitalSelect(hospitalOption)}
                                                                        >
                                                                            <strong>{hospitalOption.name}</strong>
                                                                            <span>{hospitalOption.address}</span>
                                                                            <small>{hospitalOption.distanceText}</small>
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <div className="dp-combobox-empty">
                                                                        {hospitalQuery.trim() ? 'No nearby hospital matches this search.' : 'Start typing to search hospitals.'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="dp-field">
                                                    <label>Specialization</label>
                                                    <select name="specialization" value={formState.specialization} onChange={handleProfileInput} required>
                                                        <option value="">Select specialization</option>
                                                        <option value="Cardiology">Cardiology</option>
                                                        <option value="Neurology">Neurology</option>
                                                        <option value="Orthopedics">Orthopedics</option>
                                                        <option value="Dermatology">Dermatology</option>
                                                        <option value="Pediatrics">Pediatrics</option>
                                                        <option value="General Medicine">General Medicine</option>
                                                    </select>
                                                </div>
                                                <div className="dp-field">
                                                    <label>License Number</label>
                                                    <input
                                                        name="license_number"
                                                        value={formState.license_number}
                                                        onChange={handleProfileInput}
                                                        placeholder="MMC-123456"
                                                        required
                                                    />
                                                </div>
                                                <div className="dp-field">
                                                    <label>Experience (Years)</label>
                                                    <input
                                                        name="experience_years"
                                                        type="number"
                                                        min="0"
                                                        max="60"
                                                        value={formState.experience_years}
                                                        onChange={handleProfileInput}
                                                        placeholder="8"
                                                        required
                                                    />
                                                </div>
                                                <div className="dp-field dp-field-full">
                                                    <label>Qualification</label>
                                                    <input
                                                        name="qualification"
                                                        value={formState.qualification}
                                                        onChange={handleProfileInput}
                                                        placeholder="MBBS, MD (Cardiology)"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {profileError && <div className="dp-modal-error">{profileError}</div>}

                                            <div className="dp-profile-actions">
                                                <button type="button" className="dp-profile-secondary-btn" onClick={cancelProfileEdit}>
                                                    Cancel
                                                </button>
                                                <button type="button" className="dp-modal-btn" onClick={handleProfileSubmit} disabled={isSavingProfile}>
                                                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : activeTab === 'appointments' ? (
                            <div className="dp-appointments-wrap">
                                <div className="dp-appointments-container">
                                    {/* Pending Appointments */}
                                    <div className="dp-card">
                                        <div className="dp-section-heading">
                                            <h2 className="dp-section-title">Pending Approvals ({pendingAppointments.length})</h2>
                                            {pendingAppointments.length > 0 && (
                                                <button 
                                                    type="button" 
                                                    className="dp-section-link"
                                                    onClick={loadPendingAppointments}
                                                >
                                                    Refresh →
                                                </button>
                                            )}
                                        </div>
                                        {isLoadingAppointments ? (
                                            <div className="dp-appointment-loading">Loading appointments...</div>
                                        ) : pendingAppointments.length > 0 ? (
                                            <div className="dp-appointments-list">
                                                {pendingAppointments.map((apt) => (
                                                    <div
                                                        key={apt.id}
                                                        className="dp-appointment-card dp-appointment-pending dp-appointment-card-clickable"
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => setSelectedAppointmentDetail(apt)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault()
                                                                setSelectedAppointmentDetail(apt)
                                                            }
                                                        }}
                                                    >
                                                        <div className="dp-apt-header">
                                                            <div>
                                                                <div className="dp-apt-patient">{apt.patientName || 'Patient'}</div>
                                                                <div className="dp-apt-details">{apt.hospital} • {apt.date} at {apt.time}</div>
                                            </div>
                                                            <span className="dp-apt-badge pending">Pending</span>
                                                        </div>
                                                        <div className="dp-apt-footer">
                                                            <div className="dp-apt-specialty">Specialty: {apt.specialty || 'General'}</div>
                                                            <div className="dp-apt-phone">📞 {apt.phone || 'Not provided'}</div>
                                                        </div>
                                                        <div className="dp-apt-actions">
                                                            <button 
                                                                type="button" 
                                                                className="dp-apt-btn dp-apt-approve"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    handleApproveAppointment(apt.id)
                                                                }}
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                className="dp-apt-btn dp-apt-reject"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    handleRejectAppointment(apt.id)
                                                                }}
                                                            >
                                                                ✕ Reject
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="dp-appointment-empty">
                                                <div className="dp-empty-icon">✓</div>
                                                <div className="dp-empty-text">No pending approvals</div>
                                                <div className="dp-empty-sub">All appointments are approved!</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Approved Appointments */}
                                    {approvedAppointments.length > 0 && (
                                        <div className="dp-card">
                                            <div className="dp-section-heading">
                                                <h2 className="dp-section-title">Confirmed Appointments ({approvedAppointments.length})</h2>
                                            </div>
                                            <div className="dp-appointments-list">
                                                {approvedAppointments.slice(0, 10).map((apt) => (
                                                    <div
                                                        key={apt.id}
                                                        className="dp-appointment-card dp-appointment-confirmed dp-appointment-card-clickable"
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => setSelectedAppointmentDetail(apt)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault()
                                                                setSelectedAppointmentDetail(apt)
                                                            }
                                                        }}
                                                    >
                                                        <div className="dp-apt-header">
                                                            <div>
                                                                <div className="dp-apt-patient">{apt.patientName || 'Patient'}</div>
                                                                <div className="dp-apt-details">{apt.hospital} • {apt.date} at {apt.time}</div>
                                                            </div>
                                                            <span className="dp-apt-badge confirmed">Confirmed</span>
                                                        </div>
                                                        <div className="dp-apt-footer">
                                                            <div className="dp-apt-specialty">Specialty: {apt.specialty || 'General'}</div>
                                                            <div className="dp-apt-phone">📞 {apt.phone || 'Not provided'}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : activeTab === 'emergency' ? (
                             <div className="dp-card">
                                 <div className="dp-section-heading">
                                     <h2 className="dp-section-title">Emergency Cases</h2>
                                 </div>
                                 <div className="dp-appointment-empty">
                                     <div className="dp-empty-icon">🚨</div>
                                     <div className="dp-empty-text">No active emergencies</div>
                                     <div className="dp-empty-sub">Emergency cases will appear here as high-priority alerts.</div>
                                 </div>
                             </div>
                         ) : activeTab === 'ai' ? (
                             <div className="dp-card">
                                 <div className="dp-section-heading">
                                     <h2 className="dp-section-title">AI Assistant</h2>
                                 </div>
                                 <div className="dp-appointment-empty">
                                     <div className="dp-empty-icon">🤖</div>
                                     <div className="dp-empty-text">AI Assistant Coming Soon</div>
                                     <div className="dp-empty-sub">I can help you analyze records and summarize patient history soon.</div>
                                 </div>
                             </div>
                         ) : (
                             <>
                                {/* Hero */}
                                <div className="dp-hero">
                                    <div className="dp-hero-left">
                                        <div className="dp-avatar">{initials}</div>
                                        <div>
                                            <div className="dp-hero-name">Dr. {fullName}</div>
                                            <div className="dp-hero-meta">
                                                <span className="dp-hero-meta-item">{email}</span>
                                                <span className="dp-hero-meta-sep" />
                                                <span className="dp-hero-hospital">{hospital}</span>
                                                <span className="dp-hero-meta-sep" />
                                                <span className={`dp-verify-chip ${isVerifiedDoctor ? 'verified' : 'pending'}`}>{verificationLabel}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="dp-hero-date">
                                        <div className="dp-hero-date-day">{day}</div>
                                        <div className="dp-hero-date-label">{dateLabel}</div>
                                    </div>
                                </div>

                                {/* KPIs */}
                                <div className="dp-kpis">
                                    {dashboardStats.map(({ key, label, value, foot, cls, Icon: KI }, i) => (
                                        <article key={key} className={`dp-kpi ${cls}`} style={{ animationDelay: `${i * 80}ms` }}>
                                            <div className="dp-kpi-icon"><KI /></div>
                                            <div className="dp-kpi-label">{label}</div>
                                            <div className="dp-kpi-value">{value}</div>
                                            <div className="dp-kpi-foot">{foot}</div>
                                        </article>
                                    ))}
                                </div>

                                {/* Grid */}
                                <div className="dp-grid">
                                    <div className="dp-left-col">
                                        <div>
                                            <div className="dp-section-heading">
                                                <h2 className="dp-section-title">Recent Appointments</h2>
                                                <button type="button" className="dp-section-link" onClick={() => setActiveTab('appointments')}>Open Queue →</button>
                                            </div>
                                            <div className="dp-module-grid">
                                                {recentAppointments.length > 0 ? (
                                                    recentAppointments.map((appointment, index) => {
                                                        const status = getAppointmentStatus(appointment)
                                                        return (
                                                            <article
                                                                key={appointment.id}
                                                                className="dp-module-card"
                                                                style={{ animationDelay: `${index * 60}ms` }}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => setSelectedAppointmentDetail(appointment)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault()
                                                                        setSelectedAppointmentDetail(appointment)
                                                                    }
                                                                }}
                                                            >
                                                                <div className="dp-module-top">
                                                                    <div className="dp-module-icon mi-teal"><CalIcon /></div>
                                                                    <span className={`dp-module-badge ${status === 'Confirmed' ? 'mb-live' : status === 'Rejected' ? 'mb-alert' : 'mb-secure'}`}>
                                                                        {status}
                                                                    </span>
                                                                </div>
                                                                <div className="dp-module-title">{appointment.patientName || 'Patient'}</div>
                                                                <div className="dp-module-desc">
                                                                    {appointment.doctor || 'Doctor'} · {formatAppointmentDate(appointment.date)} · {appointment.time}
                                                                    <br />
                                                                    {appointment.hospital || 'Hospital not set'}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="dp-module-link"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        setSelectedAppointmentDetail(appointment)
                                                                    }}
                                                                >
                                                                    View details →
                                                                </button>
                                                            </article>
                                                        )
                                                    })
                                                ) : (
                                                    <div className="dp-appointment-empty" style={{ gridColumn: '1 / -1' }}>
                                                        <div className="dp-empty-icon">📭</div>
                                                        <div className="dp-empty-text">No appointment requests yet</div>
                                                        <div className="dp-empty-sub">Requests will appear here as soon as a patient books this doctor.</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="dp-card">
                                            <div className="dp-section-heading">
                                                <h2 className="dp-section-title">Pending Approvals ({pendingAppointments.length})</h2>
                                                <button type="button" className="dp-section-link" onClick={loadPendingAppointments}>Refresh →</button>
                                            </div>
                                            {isLoadingAppointments ? (
                                                <div className="dp-appointment-loading">Loading appointments...</div>
                                            ) : pendingAppointments.length > 0 ? (
                                                <div className="dp-appointments-list">
                                                    {pendingAppointments.map((appointment) => (
                                                        <div
                                                            key={appointment.id}
                                                            className="dp-appointment-card dp-appointment-pending dp-appointment-card-clickable"
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setSelectedAppointmentDetail(appointment)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                    event.preventDefault()
                                                                    setSelectedAppointmentDetail(appointment)
                                                                }
                                                            }}
                                                        >
                                                            <div className="dp-apt-header">
                                                                <div>
                                                                    <div className="dp-apt-patient">{appointment.patientName || 'Patient'}</div>
                                                                    <div className="dp-apt-details">{appointment.hospital} · {formatAppointmentDate(appointment.date)} at {appointment.time}</div>
                                                                </div>
                                                                <span className={`dp-apt-badge ${getStatusToneClass(getAppointmentStatus(appointment))}`}>Pending</span>
                                                            </div>
                                                            <div className="dp-apt-footer">
                                                                <div className="dp-apt-specialty">Specialty: {appointment.specialty || 'General'}</div>
                                                                <div className="dp-apt-phone">📞 {appointment.phone || 'Not provided'}</div>
                                                            </div>
                                                            <div className="dp-apt-actions">
                                                                <button
                                                                    type="button"
                                                                    className="dp-apt-btn dp-apt-approve"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleApproveAppointment(appointment.id)
                                                                    }}
                                                                >
                                                                    ✓ Approve
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="dp-apt-btn dp-apt-reject"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        handleRejectAppointment(appointment.id)
                                                                    }}
                                                                >
                                                                    ✕ Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="dp-appointment-empty">
                                                    <div className="dp-empty-icon">✓</div>
                                                    <div className="dp-empty-text">No pending approvals</div>
                                                    <div className="dp-empty-sub">All received requests have already been handled.</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="dp-right-col">
                                        <div className="dp-card">
                                            <div className="dp-section-heading">
                                                <h2 className="dp-section-title">Confirmed Appointments ({approvedAppointments.length})</h2>
                                            </div>
                                            <div className="dp-appointments-list">
                                                {approvedAppointments.length > 0 ? (
                                                    approvedAppointments.slice(0, 5).map((appointment) => (
                                                        <div
                                                            key={appointment.id}
                                                            className="dp-appointment-card dp-appointment-confirmed dp-appointment-card-clickable"
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setSelectedAppointmentDetail(appointment)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                    event.preventDefault()
                                                                    setSelectedAppointmentDetail(appointment)
                                                                }
                                                            }}
                                                        >
                                                            <div className="dp-apt-header">
                                                                <div>
                                                                    <div className="dp-apt-patient">{appointment.patientName || 'Patient'}</div>
                                                                    <div className="dp-apt-details">{appointment.hospital} · {formatAppointmentDate(appointment.date)} at {appointment.time}</div>
                                                                </div>
                                                                <span className="dp-apt-badge confirmed">Confirmed</span>
                                                            </div>
                                                            <div className="dp-apt-footer">
                                                                <div className="dp-apt-specialty">Specialty: {appointment.specialty || 'General'}</div>
                                                                <div className="dp-apt-phone">📞 {appointment.phone || 'Not provided'}</div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="dp-appointment-empty">
                                                        <div className="dp-empty-icon">📄</div>
                                                        <div className="dp-empty-text">No confirmed appointments yet</div>
                                                        <div className="dp-empty-sub">Approved requests will appear here.</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="dp-card">
                                            <div className="dp-section-heading">
                                                <h2 className="dp-section-title">Latest Appointment Detail</h2>
                                            </div>
                                            {selectedAppointmentDetail || latestAppointment ? (
                                                <>
                                                    {(() => {
                                                        const appointment = selectedAppointmentDetail || latestAppointment
                                                        const status = getAppointmentStatus(appointment)
                                                        return (
                                                            <div>
                                                                <div className="dp-profile-grid">
                                                                    <div className="dp-profile-item">
                                                                        <div className="dp-profile-label">Patient</div>
                                                                        <div className="dp-profile-value">{appointment.patientName || 'Not provided'}</div>
                                                                    </div>
                                                                    <div className="dp-profile-item">
                                                                        <div className="dp-profile-label">Status</div>
                                                                        <div className="dp-profile-value">{status}</div>
                                                                    </div>
                                                                    <div className="dp-profile-item">
                                                                        <div className="dp-profile-label">Hospital</div>
                                                                        <div className="dp-profile-value">{appointment.hospital || 'Not provided'}</div>
                                                                    </div>
                                                                    <div className="dp-profile-item">
                                                                        <div className="dp-profile-label">Date & Time</div>
                                                                        <div className="dp-profile-value">{formatAppointmentDate(appointment.date)} at {appointment.time || '-'}</div>
                                                                    </div>
                                                                    <div className="dp-profile-item">
                                                                        <div className="dp-profile-label">Phone</div>
                                                                        <div className="dp-profile-value">{appointment.phone || 'Not provided'}</div>
                                                                    </div>
                                                                    <div className="dp-profile-item">
                                                                        <div className="dp-profile-label">Email</div>
                                                                        <div className="dp-profile-value">{appointment.email || 'Not provided'}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="dp-apt-detail-notes">
                                                                    <div className="dp-apt-detail-label">Notes</div>
                                                                    <p>{appointment.notes || 'No notes provided.'}</p>
                                                                </div>

                                                                <button type="button" className="dp-full-btn" onClick={() => setSelectedAppointmentDetail(null)}>
                                                                    Close detail view
                                                                </button>
                                                            </div>
                                                        )
                                                    })()}
                                                </>
                                            ) : (
                                                <div className="dp-appointment-empty">
                                                    <div className="dp-empty-icon">📝</div>
                                                    <div className="dp-empty-text">No appointment selected</div>
                                                    <div className="dp-empty-sub">Click any appointment card to view full details.</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {selectedAppointmentDetail && (
                <div className="dp-modal-mask" onClick={() => setSelectedAppointmentDetail(null)}>
                    <div className="dp-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="dp-modal-head">
                            <h3>Appointment Detail</h3>
                            <p>Patient ki complete info yaha visible hai.</p>
                        </div>

                        <div className="dp-apt-detail-grid">
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Patient</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.patientName || 'Not provided'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Doctor</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.doctor || 'Not provided'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Hospital</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.hospital || 'Not provided'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Status</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.status || selectedAppointmentDetail.approvalStatus || 'Pending'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Date & Time</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.date || '-'} at {selectedAppointmentDetail.time || '-'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Specialty</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.specialty || 'General'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Phone</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.phone || 'Not provided'}</div>
                            </div>
                            <div className="dp-apt-detail-item">
                                <div className="dp-apt-detail-label">Email</div>
                                <div className="dp-apt-detail-value">{selectedAppointmentDetail.email || 'Not provided'}</div>
                            </div>
                        </div>

                        <div className="dp-apt-detail-notes">
                            <div className="dp-apt-detail-label">Notes</div>
                            <p>{selectedAppointmentDetail.notes || 'No notes provided.'}</p>
                        </div>

                        <div className="dp-modal-actions">
                            <button className="dp-modal-btn" type="button" onClick={() => setSelectedAppointmentDetail(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showProfileModal && (
                <div className="dp-modal-mask">
                    <form className="dp-modal" onSubmit={handleProfileSubmit}>
                        <div className="dp-modal-head">
                            <h3>Complete Doctor Profile</h3>
                            <p>
                                Dashboard access is ready. Fill these details once to continue and move your account to verification queue.
                            </p>
                        </div>

                        <div className="dp-modal-grid">
                            <div className="dp-field">
                                <label>Hospital Name</label>
                                <div className="dp-combobox">
                                    <input
                                        className="dp-combobox-input"
                                        name="hospital_name_search"
                                        value={hospitalQuery}
                                        onChange={handleHospitalSearchChange}
                                        onFocus={() => setIsHospitalDropdownOpen(true)}
                                        onBlur={() => window.setTimeout(() => setIsHospitalDropdownOpen(false), 120)}
                                        placeholder="Search nearby hospital"
                                        autoComplete="off"
                                        required
                                    />
                                    {isHospitalDropdownOpen && (
                                        <div className="dp-combobox-menu">
                                            <div className="dp-hospital-helper">
                                                <span>
                                                    {isLoadingHospitals
                                                        ? 'Loading nearby hospitals...'
                                                        : hospitalLoadError || 'Select from the live nearby list'}
                                                </span>
                                                <span className="dp-hospital-count">{hospitalOptions.length} found</span>
                                            </div>
                                            {filteredHospitalOptions.length > 0 ? (
                                                filteredHospitalOptions.map((hospital) => (
                                                    <button
                                                        key={hospital.key}
                                                        type="button"
                                                        className="dp-combobox-option"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => handleHospitalSelect(hospital)}
                                                    >
                                                        <strong>{hospital.name}</strong>
                                                        <span>{hospital.address}</span>
                                                        <small>{hospital.distanceText}</small>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="dp-combobox-empty">
                                                    {hospitalQuery.trim() ? 'No nearby hospital matches this search.' : 'Start typing to search hospitals.'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="dp-field">
                                <label>Specialization</label>
                                <select name="specialization" value={formState.specialization} onChange={handleProfileInput} required>
                                    <option value="">Select specialization</option>
                                    <option value="Cardiology">Cardiology</option>
                                    <option value="Neurology">Neurology</option>
                                    <option value="Orthopedics">Orthopedics</option>
                                    <option value="Dermatology">Dermatology</option>
                                    <option value="Pediatrics">Pediatrics</option>
                                    <option value="General Medicine">General Medicine</option>
                                </select>
                            </div>
                            <div className="dp-field">
                                <label>License Number</label>
                                <input
                                    name="license_number"
                                    value={formState.license_number}
                                    onChange={handleProfileInput}
                                    placeholder="MMC-123456"
                                    required
                                />
                            </div>
                            <div className="dp-field">
                                <label>Experience (Years)</label>
                                <input
                                    name="experience_years"
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={formState.experience_years}
                                    onChange={handleProfileInput}
                                    placeholder="8"
                                    required
                                />
                            </div>
                            <div className="dp-field dp-field-full">
                                <label>Qualification</label>
                                <input
                                    name="qualification"
                                    value={formState.qualification}
                                    onChange={handleProfileInput}
                                    placeholder="MBBS, MD (Cardiology)"
                                    required
                                />
                            </div>
                        </div>

                        {profileError && <div className="dp-modal-error">{profileError}</div>}

                        <div className="dp-modal-actions">
                            <button className="dp-modal-btn" type="submit" disabled={isSavingProfile}>
                                {isSavingProfile ? 'Saving...' : 'Save and Continue'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    )
}
