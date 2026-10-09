const base=(process.argv[2]||process.env.BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const total=Number(process.env.LOAD_REQUESTS||100); const concurrency=Number(process.env.LOAD_CONCURRENCY||10);
let next=0,ok=0,fail=0,lat=[];
async function worker(){while(true){const i=next++;if(i>=total)return;const t=Date.now();try{const r=await fetch(`${base}/api/health`);if(r.ok)ok++;else fail++;}catch{fail++}lat.push(Date.now()-t)}}
await Promise.all(Array.from({length:Math.min(concurrency,total)},worker));
lat.sort((a,b)=>a-b); const pct=p=>lat[Math.max(0,Math.ceil(lat.length*p)-1)]||0;
console.log(JSON.stringify({base,total,concurrency,ok,fail,p50:pct(.5),p95:pct(.95),p99:pct(.99)},null,2));
if(fail)process.exit(1);
