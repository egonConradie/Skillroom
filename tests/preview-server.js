// Isolated visual QA: never writes to the real catalogue or uses real credentials.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const bcrypt=require('bcryptjs');
const {createApp}=require('../server');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'skillroom-preview-'));
fs.copyFileSync(path.join(__dirname,'../data/courses.json'),path.join(directory,'courses.json'));
const server=createApp({coursesFile:path.join(directory,'courses.json'),uploadsDir:path.join(directory,'uploads'),config:{ADMIN_EMAIL:'preview@example.com',ADMIN_PASSWORD_HASH:bcrypt.hashSync('Preview-only-42',4),SESSION_SECRET:'preview-only-secret-for-local-verification'}}).listen(3101,'127.0.0.1',()=>console.log('Isolated preview ready on http://127.0.0.1:3101'));
function stop(){server.close(()=>{fs.rmSync(directory,{recursive:true,force:true});process.exit(0);});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
