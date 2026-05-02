const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ── Initialise Firebase Admin (once, idempotently) ──────────────────────────
if (!admin.apps.length) {
  try {
    // Option A: Service account JSON file
    // const serviceAccount = require('../firebase-service-account.json');
    // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

    // Option B: Env-var based (preferred for production)
    // Set GOOGLE_APPLICATION_CREDENTIALS=<path to service account json>
    // OR encode the JSON as base64 in FIREBASE_SERVICE_ACCOUNT_BASE64
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      // Fallback: init without credentials (Google Sign-In verification will fail gracefully)
      console.warn('⚠️  Firebase Admin: no service account configured — Google Sign-In will not work.');
      admin.initializeApp();
    }
  } catch (err) {
    console.error('Firebase Admin init error:', err.message);
  }
}

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── Register (email/password) ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, company, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, role, company, phone, authProvider: 'local' });
    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Login (email/password) ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Google-only accounts have no password
    if (!user.password) {
      return res.status(401).json({ message: 'This account uses Google Sign-In. Please sign in with Google.' });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Google Sign-In / Sign-Up ─────────────────────────────────────────────────
// Flow:
//  1. Client authenticates with Google via Firebase client SDK
//  2. Client sends the Firebase ID token to this endpoint
//  3. We verify the token with Firebase Admin
//  4. We upsert the user in MongoDB (create if new, update lastLogin if existing)
//  5. We return our own JWT + user object
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Firebase ID token is required' });

    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired Google token' });
    }

    const { uid, email, name, picture } = decodedToken;
    if (!email) return res.status(400).json({ message: 'Google account has no email' });

    // Upsert user: find by googleUid or email
    let user = await User.findOne({ $or: [{ googleUid: uid }, { email }] });

    if (!user) {
      // New user — create with google provider
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        googleUid: uid,
        avatar: picture || null,
        authProvider: 'google',
        role: 'client', // default role; admin can change later
        isActive: true,
      });
    } else {
      // Existing user — link Google UID if not already linked
      let changed = false;
      if (!user.googleUid) { user.googleUid = uid; changed = true; }
      if (!user.avatar && picture) { user.avatar = picture; changed = true; }
      if (user.authProvider === 'local' && !user.password) { user.authProvider = 'google'; changed = true; }
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account is inactive. Please contact support.' });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── Get current user ─────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// ── Update profile ───────────────────────────────────────────────────────────
router.patch('/me', auth, async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'company', 'avatar'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Change password (email/password users) ───────────────────────────────────
router.patch('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (user.password) {
      // Has existing password — must verify current
      if (!(await user.comparePassword(currentPassword))) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    user.password = newPassword;
    user.authProvider = 'local'; // now has a password regardless of original provider
    await user.save();
    const token = signToken(user._id);
    res.json({ token, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Set password (for Google-only users who want to add a password) ──────────
// Does NOT require current password — user is authenticated via JWT
router.post('/set-password', auth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (user.password) {
      return res.status(400).json({ message: 'You already have a password. Use change-password instead.' });
    }

    user.password = newPassword;
    user.authProvider = user.googleUid ? 'google' : 'local'; // keep google if linked
    await user.save();

    // Optionally sync to Firebase (if user has a Google UID and admin is configured)
    if (user.googleUid && admin.apps.length) {
      try {
        await admin.auth().updateUser(user.googleUid, { password: newPassword });
      } catch (fbErr) {
        console.warn('Firebase password sync failed (non-fatal):', fbErr.message);
      }
    }

    const token = signToken(user._id);
    res.json({ token, message: 'Password set successfully. You can now sign in with email & password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
