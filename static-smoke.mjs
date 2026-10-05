import fs from "node:fs";
import assert from "node:assert/strict";
const root=new URL("..",import.meta.url).pathname;
const server=fs.readFileSync(`${root}/backend/server.js`,`utf8`);
const index=fs.readFileSync(`${root}/frontend/index.html`,`utf8`);
const admin=fs.readFileSync(`${root}/frontend/admin.html`,`utf8`);
for(const route of ["/api/customer/login","/api/customer/account/register","/api/customer/me","/api/customer/documents/:id/download","/api/partner/register","/api/partner/login","/api/partner/leads","/api/health","/api/loan-types","/api/leads","/api/support","/api/ai","/api/calculate-emi","/api/application/:code","/api/admin/applications","/api/admin/loan-products","/api/admin/cms","/api/admin/notifications"]){assert.ok(server.includes(route),`missing route ${route}`)}
for(const route of ["/api/health","/api/loan-types","/api/leads","/api/support","/api/ai","/api/calculate-emi","/api/application/:code","/api/admin/applications","/api/admin/loan-products","/api/admin/cms","/api/admin/notifications"]){assert.ok(server.includes(route),`missing route ${route}`)}
assert.ok(index.includes("EMI Calculator")); assert.ok(index.includes("Application Tracker")); assert.ok(index.includes("Register as Partner"));
for(const panel of ["applications","smart","products","content","notifications"]) assert.ok(admin.includes(`id=\"${panel}\"`),`missing admin panel ${panel}`);
console.log("LOANSMEET static smoke: PASS");

for(const page of ['frontend/customer.html','frontend/partner.html','scripts/backup-db.mjs','scripts/restore-db.mjs']) assert.ok(fs.existsSync(`${root}/${page}`),`missing ${page}`);
