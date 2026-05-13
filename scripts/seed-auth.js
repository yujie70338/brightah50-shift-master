// Seed Auth emulator with test accounts
const BASE_URL = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key';
const PROJECT_ID = 'brightah50-shift-master';
const EMULATOR_URL = `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`;

const users = [
  { email: 'manager@brightah50.com', password: 'test1234', displayName: '陳經理' },
  { email: 'staff1@brightah50.com',  password: 'test1234', displayName: '王小明' },
  { email: 'staff2@brightah50.com',  password: 'test1234', displayName: '李小華' },
  { email: 'staff3@brightah50.com',  password: 'test1234', displayName: '張小美' },
  { email: 'staff4@brightah50.com',  password: 'test1234', displayName: '吳大山' },
  { email: 'staff5@brightah50.com',  password: 'test1234', displayName: '林小雨' },
  { email: 'staff6@brightah50.com',  password: 'test1234', displayName: '趙志明' },
  { email: 'staff7@brightah50.com',  password: 'test1234', displayName: '黃美玲' },
  { email: 'staff8@brightah50.com',  password: 'test1234', displayName: '周大偉' },
];

async function seedAuth() {
  for (const u of users) {
    const res = await fetch(EMULATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
      body: JSON.stringify({
        localId: u.email.replace(/[@.]/g, '_'),
        email: u.email,
        password: u.password,
        displayName: u.displayName,
        emailVerified: true,
      }),
    });
    const data = await res.json();
    if (data.error) {
      // Already exists is fine
      if (data.error.message && data.error.message.includes('DUPLICATE_EMAIL')) {
        console.log('already exists:', u.email);
      } else {
        console.error('Error for', u.email, ':', JSON.stringify(data.error));
      }
    } else {
      console.log('created:', u.email);
    }
  }
  console.log('Auth seed done');
}

seedAuth().catch(function(e) { console.error(e.message); process.exit(1); });
