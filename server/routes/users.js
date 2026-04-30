const express = require('express');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

const ADMIN_ROLES = ['admin', 'manager'];

// ── List all users (admin / manager) ────────────────────────────────────────
router.get('/', auth, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 30 } = req.query;
    const query = {};
    if (role)     query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Get single user ──────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    // Users can fetch their own profile; admins can fetch anyone
    if (req.user._id.toString() !== req.params.id && !ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Create user (admin / manager) ───────────────────────────────────────────
router.post('/', auth, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { email } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create(req.body);
    res.status(201).json({ user });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join('. ') });
    }
    res.status(500).json({ message: err.message });
  }
});

// ── Update user (admin / manager, or own profile) ───────────────────────────
router.patch('/:id', auth, async (req, res) => {
  try {
    const isSelf  = req.user._id.toString() === req.params.id;
    const isAdmin = ADMIN_ROLES.includes(req.user.role);

    if (!isSelf && !isAdmin) return res.status(403).json({ message: 'Access denied' });

    // Only admins can change roles / isActive / verification flags
    const updateData = { ...req.body };
    if (!isAdmin) {
      delete updateData.role;
      delete updateData.isActive;
      delete updateData.isOnboarded;
      // Drivers can submit KYC docs but cannot set verified flags
      if (updateData.kyc) {
        delete updateData.kyc.aadhaarVerified;
        delete updateData.kyc.vehicleVerified;
        delete updateData.kyc.verifiedAt;
        delete updateData.kyc.verifiedBy;
      }
    }
    // Never allow password update via this route (use /auth/change-password)
    delete updateData.password;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Verify KYC (Aadhaar + Vehicle) ─────────────────────────────────────────
router.patch('/:id/verify-kyc', auth, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const { aadhaarVerified, vehicleVerified } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.kyc) user.kyc = {};
    if (aadhaarVerified !== undefined) user.kyc.aadhaarVerified = aadhaarVerified;
    if (vehicleVerified !== undefined) user.kyc.vehicleVerified = vehicleVerified;

    // Onboard driver only when BOTH are verified
    if (user.role === 'driver' && user.kyc.aadhaarVerified && user.kyc.vehicleVerified) {
      user.isOnboarded = true;
      user.kyc.verifiedAt = new Date();
      user.kyc.verifiedBy = req.user._id;
    }

    await user.save({ validateBeforeSave: false });
    res.json({ user, message: user.isOnboarded ? 'Driver fully onboarded!' : 'KYC status updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Toggle active status ─────────────────────────────────────────────────────
router.patch('/:id/toggle-active', auth, requireRole(...ADMIN_ROLES), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ user, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
