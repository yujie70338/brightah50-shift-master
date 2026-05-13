const admin = require('/Users/yujiezheng/brightah50-shift-master/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'brightah50-shift-master' });
const db = admin.firestore();
const users = [
  { email: 'manager@brightah50.com', displayName: '陳經理', role: 'manager', isActive: true },
  { email: 'staff1@brightah50.com',  displayName: '王小明', role: 'staff',   isActive: true },
  { email: 'staff2@brightah50.com',  displayName: '李小華', role: 'staff',   isActive: true },
  { email: 'staff3@brightah50.com',  displayName: '張小美', role: 'staff',   isActive: true },
  { email: 'staff4@brightah50.com',  displayName: '吳大山', role: 'staff',   isActive: true },
  { email: 'staff5@brightah50.com',  displayName: '林小雨', role: 'staff',   isActive: true },
  { email: 'staff6@brightah50.com',  displayName: '趙志明', role: 'staff',   isActive: true },
  { email: 'staff7@brightah50.com',  displayName: '黃美玲', role: 'staff',   isActive: true },
  { email: 'staff8@brightah50.com',  displayName: '周大偉', role: 'staff',   isActive: false },
];
Promise.all(users.map(function(u) { return db.collection('users').doc(u.email).set(u); }))
  .then(function() { console.log('done: 9 users seeded'); process.exit(0); })
  .catch(function(e) { console.error(e.message); process.exit(1); });
