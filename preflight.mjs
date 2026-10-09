const prod=process.env.NODE_ENV==='production';
const required=['ADMIN_USERNAME','ADMIN_PASSWORD','DOCUMENT_STORAGE_DIR','SITE_URL'];
const missing=prod?required.filter(k=>!process.env[k]):[];
if(missing.length){console.error(`Missing production environment variables: ${missing.join(', ')}`);process.exit(1)}
if(prod && process.env.ADMIN_PASSWORD.length<16){console.error('ADMIN_PASSWORD must be at least 16 characters.');process.exit(1)}
if(prod && !/^https:\/\//i.test(process.env.SITE_URL)){console.error('SITE_URL must use HTTPS in production.');process.exit(1)}
console.log('LOANSMEET production preflight: PASS');
