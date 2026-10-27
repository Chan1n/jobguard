// Test-only probe: instruments the built HTML, never the application source.
// Run after npm run build. Use --restore before delivery or build again.
import { readFile, writeFile, unlink } from "node:fs/promises";
const path = "out/index.html",
  backup = "out/index.html.qa-backup";
if (process.argv.includes("--restore")) {
  await writeFile(path, await readFile(backup));
  await unlink(backup);
  process.exit(0);
}
const original = await readFile(path, "utf8");
await writeFile(backup, original);
const script = `<script>
(()=>{let since=Infinity;const rows=[];let report;
function update(){if(report)report.textContent=JSON.stringify({scanStarted:Number.isFinite(since),requestsAfterScan:rows.filter(r=>r.startTime>=since).map(r=>({url:r.name,type:r.initiatorType})),allResourceOrigins:[...new Set(rows.map(r=>new URL(r.name,location.href).origin))]})}
new PerformanceObserver(list=>{rows.push(...list.getEntries());update()}).observe({type:'resource',buffered:true});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/^ตรวจสอบ(ลิงก์|ไฟล์)$/.test(b.textContent.trim())){since=performance.now();update()}},true);
document.addEventListener('DOMContentLoaded',()=>{report=document.createElement('pre');report.id='qa-network-report';report.style='white-space:pre-wrap;padding:20px;background:#fff7d6;color:#111';document.body.append(report);update()});
})();</script>`;
await writeFile(path, original.replace("<head>", "<head>" + script));
console.log(
  "Test probe inserted. Restore with node scripts/network-probe.mjs --restore",
);
