const express = require('express');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Role hierarchy
const ADMIN_ONLY = ['admin'];
const ADMIN_AND_MANAGER = ['admin', 'manager'];
const ALL_PRIVILEGED = ['admin', 'manager', 'agent'];

// ── List all users (admin / manager / agent) ─────────────────────────────────
router.get('/', auth, requireRole(...ALL_PRIVILEGED), async (req, res) => {
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

// ── Get single user ───────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const isSelf  = req.user._id.toString() === req.params.id;
    const isPrivileged = ALL_PRIVILEGED.includes(req.user.role);
    if (!isSelf && !isPrivileged) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Create user (admin / manager) ────────────────────────────────────────────
router.post('/', auth, requireRole(...ADMIN_AND_MANAGER), async (req, res) => {
  try {
    const { email, role } = req.body;

    // Only admin can create admin accounts
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create admin accounts' });
    }

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

// ── Update user (admin / manager, or own profile) ────────────────────────────
router.patch('/:id', auth, async (req, res) => {
  try {
    const isSelf    = req.user._id.toString() === req.params.id;
    const isAdmin   = req.user.role === 'admin';
    const isManager = req.user.role === 'manager';
    const isPrivileged = isAdmin || isManager;

    if (!isSelf && !isPrivileged) return res.status(403).json({ message: 'Access denied' });

    const updateData = { ...req.body };

    // Only admins can change roles
    if (updateData.role !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Only admins can change user roles' });
      }
      // Admins cannot promote anyone to admin via this route either — only via dedicated route
      // (this keeps it auditable)
      if (updateData.role === 'admin' && !isAdmin) {
        return res.status(403).json({ message: 'Only admins can assign admin role' });
      }
    }

    // Non-admins cannot change isActive / isOnboarded
    if (!isAdmin) {
      delete updateData.isActive;
      delete updateData.isOnboarded;
      if (updateData.kyc) {
        delete updateData.kyc.aadhaarVerified;
        delete updateData.kyc.vehicleVerified;
        delete updateData.kyc.verifiedAt;
        delete updateData.kyc.verifiedBy;
      }
    }

    // Never allow password update via this route
    delete updateData.password;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Change role (admin only) ──────────────────────────────────────────────────
// Agents can see users but CANNOT change any role. Managers can change non-admin roles.
router.patch('/:id/role', auth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'Role is required' });

    const validRoles = ['admin', 'manager', 'agent', 'driver', 'vendor', 'distributor', 'store', 'fulfillment_center', 'client'];
    if (!validRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    // Only admin can assign admin role
    if (role === 'admin') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can assign the admin role' });
      }
    } else {
      // Manager can change non-admin roles; agents cannot change any role
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Agents cannot change user roles' });
      }
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Prevent downgrading an admin unless the requester is also an admin
    if (targetUser.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change another admin\'s role' });
    }

    targetUser.role = role;
    await targetUser.save({ validateBeforeSave: false });
    res.json({ user: targetUser, message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Verify KYC (admin / manager) ─────────────────────────────────────────────
router.patch('/:id/verify-kyc', auth, requireRole(...ADMIN_AND_MANAGER), async (req, res) => {
  try {
    const { aadhaarVerified, vehicleVerified } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.kyc) user.kyc = {};
    if (aadhaarVerified !== undefined) user.kyc.aadhaarVerified = aadhaarVerified;
    if (vehicleVerified !== undefined) user.kyc.vehicleVerified = vehicleVerified;

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

// ── Toggle active status (admin only) ────────────────────────────────────────
router.patch('/:id/toggle-active', auth, requireRole(...ADMIN_ONLY), async (req, res) => {
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
