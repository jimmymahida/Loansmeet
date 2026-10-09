import assert from "node:assert/strict";
function emi(P,annual,n){const r=annual/1200;return r===0?P/n:P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1)}
assert.equal(Number(emi(500000,0,60).toFixed(2)),8333.33);
assert.equal(Number(emi(500000,12,60).toFixed(2)),11122.22);
console.log("EMI smoke: PASS");
