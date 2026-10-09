import fs from 'node:fs';
import Database from 'better-sqlite3';
import path from 'node:path';
const source=process.argv[2]; const target=process.env.DB_PATH||path.resolve('backend/loanleads.db');
if(!source||!fs.existsSync(source)){console.error('Usage: node scripts/restore-db.mjs <backup.db>');process.exit(2)}
if(fs.existsSync(target)) fs.copyFileSync(target,`${target}.before-restore-${Date.now()}.bak`);
const src=new Database(source,{readonly:true}); const dst=new Database(target); dst.exec('PRAGMA foreign_keys=OFF');
const tables=src.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
for(const t of tables){dst.exec(`DROP TABLE IF EXISTS "${t.name.replaceAll('"','""')}"`)}
src.backup(target).then(()=>{src.close();dst.close();console.log(`Database restored to: ${target}`)}).catch(e=>{src.close();dst.close();console.error(e);process.exit(1)});
