const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const brevo = require('@getbrevo/brevo');
const connectDB = require('../db/connection.js');

//dotenv.config();

const router = express.Router();

// Multer setup for photo uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}_${nanoid(10)}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

// Generate secure token
const generateUserToken = () => {
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);
  let token = '';
  for (const num of array) {
    token += num.toString(36);
  }
  return token;
};

// Initialize Brevo
const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// Get admin email
async function getAdminEmail(db) {
  const admin = await db.collection('users').findOne({ role: 'admin' });
  return admin?.email || process.env.DEFAULT_ADMIN_EMAIL || 'khyhs0418@gmail.com';
}

// Send admin notification
async function sendAdminNotification(sid, email, photoUrl, baseUrl) {
  try {
    const db = await connectDB();
    const adminEmail = await getAdminEmail(db);

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'EFS Platform', email: 'platformefs@gmail.com' };
    sendSmtpEmail.to = [{ email: adminEmail }];
    sendSmtpEmail.subject = `New Account Request – SID: ${sid}`;
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>
        body { font-family: 'Segoe UI', sans-serif; background:#f8fafc; color:#1e293b; padding:20px; margin:0; }
        .card { max-width:640px; margin:20px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.1); }
        .header { background:linear-gradient(135deg, #3b82f6, #1d4ed8); color:white; padding:40px 20px; text-align:center; }
        .header h1 { margin:0; font-size:30px; }
        .header p { margin:10px 0 0; opacity:0.95; }
        .body { padding:40px 30px; }
        .field { margin:24px 0; }
        .label { font-weight:600; color:#475569; font-size:14px; text-transform:uppercase; letter-spacing:1.2px; }
        .value { font-size:19px; margin-top:8px; color:#1e293b; word-break:break-word; }
        .photo { text-align:center; margin:40px 0; padding:20px; background:#f8fafc; border-radius:12px; }
        .photo img { max-width:100%; width:560px; height:auto; max-height:700px; object-fit:contain; border-radius:12px; border:5px solid #e0e7ff; box-shadow:0 8px 25px rgba(0,0,0,0.15); }
        .actions { text-align:center; margin:40px 0; }
        .btn { display:inline-block; padding:16px 40px; background:#3b82f6; color:white; text-decoration:none; border-radius:50px; font-weight:600; font-size:17px; box-shadow:0 6px 20px rgba(59,130,246,0.4); transition:all 0.2s; }
        .btn:hover { background:#2563eb; transform:translateY(-2px); }
        .footer { text-align:center; padding:30px 20px; color:#94a3b8; font-size:14px; border-top:1px solid #e2e8f0; margin-top:40px; background:#fcfcfd; }
      </style></head>
      <body>
        <div class="card">
          <div class="header"><h1>New Account Request</h1><p>A student has requested access to EFS Platform</p></div>
          <div class="body">
            <div class="field"><div class="label">Student ID</div><div class="value"><strong>${sid}</strong></div></div>
            <div class="field"><div class="label">Email</div><div class="value">${email}</div></div>
            <div class="field"><div class="label">Request Time</div><div class="value">${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong' })}</div></div>
            <div class="field"><div class="label">Status</div><div class="value"><span style="color:#f59e0b; font-weight:600;">Pending Approval</span></div></div>
            <div class="photo"><p><strong>Student Card Photo</strong></p><img src="${photoUrl}" alt="Student Card Photo"></div>
            <div class="actions"><a href="${baseUrl}/admin" class="btn">Open Admin Panel</a></div>
            <div class="footer">EFS Learning Platform • This is an automated notification<br>You are receiving this because you are an admin.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Admin notification sent to ${adminEmail}`);
  } catch (err) {
    console.error('Brevo send failed:', err.body?.message || err.message);
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, sid, password } = req.body;
    if (!email || !sid || !password) {
      return res.status(400).json({ ok: false, error: 'Missing credentials' });
    }

    const db = await connectDB();
    
    // Find user by sid or email
    const user = await db.collection('users').findOne({ 
      $or: [{ sid }, { email: email.toLowerCase() }] 
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Generate JWT token (simplified version)
    const token = user.token || `${sid}-${generateUserToken()}`;
    
    // Update token if not exists
    if (!user.token) {
      await db.collection('users').updateOne(
        { sid },
        { $set: { token } }
      );
    }

    // Check if the user is an admin
    const isAdmin = user.role === 'admin';

    res.json({
      ok: true,
      sid: user.sid,
      email: user.email,
      role: user.role || 'user',
      isAdmin: isAdmin,
      token,
      credits: user.credits || 0,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { sid, email, password } = req.body;
    
    if (!sid || !email || !password || !req.file) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const db = await connectDB();

    // Check if user exists
    const existingUser = await db.collection('users').findOne({ 
      $or: [{ sid }, { email: email.toLowerCase() }] 
    });
    
    const pendingUser = await db.collection('pending_accounts').findOne({ 
      $or: [{ sid }, { email: email.toLowerCase() }] 
    });

    if (existingUser || pendingUser) {
      return res.status(409).json({ 
        ok: false, 
        error: 'User already exists or pending approval' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create pending account
    const pendingAccount = {
      sid,
      email: email.toLowerCase(),
      password: hashedPassword,
      photo_path: `/uploads/${req.file.filename}`,
      createdAt: new Date(),
    };

    await db.collection('pending_accounts').insertOne(pendingAccount);

    // Send admin notification
    const baseUrl = req.get('origin') || process.env.BASE_URL || 'http://localhost:3000';
    const photoUrl = `${baseUrl}/uploads/${req.file.filename}`;
    
    await sendAdminNotification(sid, email, photoUrl, baseUrl);

    res.json({ ok: true, message: 'Account request submitted. Awaiting admin approval.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const sid = req.query.sid || req.headers['x-sid'];
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ sid });

    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Return safe user data (exclude password)
    const { password, ...safeUser } = user;
    res.json({ ok: true, data: safeUser });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Client-side logout (clear localStorage)
  res.json({ ok: true, message: 'Logged out successfully' });
});

// GET /api/auth/session - Check session
router.get('/session', async (req, res) => {
  try {
    const sid = req.headers['x-sid'] || req.query.sid;
    if (!sid) {
      return res.json({ ok: true, authenticated: false });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ sid });
    
    if (!user) {
      return res.json({ ok: true, authenticated: false });
    }
    
    res.json({
      ok: true,
      authenticated: true,
      user: {
        sid: user.sid,
        email: user.email,
        role: user.role,
        credits: user.credits || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/user/:sid - Get user by SID
router.get('/user/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();
    
    const user = await db.collection('users').findOne(
      { sid },
      { projection: { password: 0, token: 0 } }
    );
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    res.json({ ok: true, data: user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/auth/check/:sid
router.get('/check/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();

    const approved = await db.collection('users').findOne({ sid });
    const pending = await db.collection('pending_accounts').findOne({ sid });

    res.json({
      ok: true,
      exists: !!(approved || pending),
      where: approved ? 'users' : pending ? 'pending' : null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
//export default router;