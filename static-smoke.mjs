import fs from "node:fs";
import assert from "node:assert/strict";
const root=new URL(".",import.meta.url).pathname;
const server=fs.readFileSync(`${root}/backend/server.js`,`utf8`);
const index=fs.readFileSync(`${root}/frontend/index.html`,`utf8`);
const admin=fs.readFileSync(`${root}/frontend/admin.html`,`utf8`);
assert.ok(server.includes("app.get('/api/application/:code'"),"missing token-protected application tracking route");
for(const route of ["/api/customer/login","/api/customer/account/register","/api/customer/me","/api/customer/documents/:id/download","/api/partner/register","/api/partner/login","/api/partner/leads","/api/health","/api/loan-types","/api/leads","/api/support","/api/ai","/api/calculate-emi","/api/application/:code","/api/admin/applications","/api/admin/loan-products","/api/admin/cms","/api/admin/notifications","/loans/:slug","/sitemap.xml"]){assert.ok(server.includes(route),`missing route ${route}`)}
for(const route of ["/api/health","/api/loan-types","/api/leads","/api/support","/api/ai","/api/calculate-emi","/api/application/:code","/api/admin/applications","/api/admin/loan-products","/api/admin/cms","/api/admin/notifications"]){assert.ok(server.includes(route),`missing route ${route}`)}
assert.ok(index.includes("EMI calculator") || index.includes("EMI Calculator")); assert.ok(index.includes("Application Tracker")); assert.ok(index.includes("Register as Partner")); assert.ok(index.includes("Smart loan finder")); assert.ok(index.includes("Compare"));
const applicationForm=index.match(/<form id="applyForm"[\s\S]*?<\/form>/)?.[0];
assert.ok(applicationForm,"missing loan application form");
assert.doesNotMatch(applicationForm,/name=["'](?:existingEmi|emi)["']/i,"EMI must remain separate from the application form");
for(const [label,route] of [["Customer Login","/customer"],["Partner Login","/partner"],["Admin Login","/admin"]]){
  assert.ok(index.includes(`<b>${label}</b>`),`missing ${label} menu entry`);
  assert.ok(index.includes(`href="${route}"`),`incorrect or missing ${label} route`);
}
for(const panel of ["applications","smart","products","content","audit"]) assert.ok(admin.includes(`id=\"${panel}\"`),`missing admin panel ${panel}`);
console.log("LOANSMEET static smoke: PASS");

for(const page of ['frontend/customer.html','frontend/partner.html','backup-db.mjs','restore-db.mjs','frontend/service-worker.js']) assert.ok(fs.existsSync(`${root}/${page}`),`missing ${page}`);
