const base=(process.argv[2]||process.env.BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const r=await fetch(`${base}/api/health`); if(!r.ok) throw new Error(`health ${r.status}`);
const j=await r.json(); if(!j.ok) throw new Error('health returned ok=false');
console.log(JSON.stringify({ok:true,url:base,service:j.service,documentStorage:j.documentStorage,notificationProviders:j.notificationProviders},null,2));
