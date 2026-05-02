const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const kycSchema = new mongoose.Schema({
  aadhaarNumber:    { type: String, trim: true },
  aadhaarImageUrl:  { type: String },
  aadhaarVerified:  { type: Boolean, default: false },
  vehicleNumber:    { type: String, trim: true },
  vehicleImageUrl:  { type: String },
  vehiclePhotoUrl:  { type: String },
  vehicleVerified:  { type: Boolean, default: false },
  dlNumber:         { type: String, trim: true },
  dlImageUrl:       { type: String },
  panImageUrl:      { type: String },
  verifiedAt:       { type: Date },
  verifiedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  address:  String,
  city:     String,
  state:    String,
  country:  String,
  pincode:  String,
  googleMapLink: String,
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },

  /**
   * Password is optional — Google OAuth users may not have one initially.
   * They can set a password later via /auth/set-password.
   * Password is stored as bcrypt hash in MongoDB.
   * For Google users, it is ALSO synced to their Firebase Auth account
   * via the /auth/set-password endpoint so both sources are consistent.
   */
  password: { type: String, minlength: 6, select: false },

  // Authentication method
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  googleUid: { type: String, unique: true, sparse: true }, // Firebase UID for Google users

  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'driver', 'vendor', 'distributor', 'store', 'fulfillment_center', 'client'],
    default: 'client',
  },

  company:    { type: String, trim: true },
  phone:      { type: String, trim: true },
  avatar:     { type: String },
  isActive:   { type: Boolean, default: true },
  isOnboarded:{ type: Boolean, default: false },
  lastLogin:  { type: Date },

  location: locationSchema,

  assignedArea:       { type: String, trim: true },
  vehicleType:        { type: String, trim: true },
  vehicleCapacity:    { type: Number, default: 0 },
  vehicleLicensePlate:{ type: String, trim: true },
  kyc:                kycSchema,

  gstNumber:    { type: String, trim: true },
  panNumber:    { type: String, trim: true },
  bankAccount:  { type: String, trim: true },
  ifscCode:     { type: String, trim: true },
  upiId:        { type: String, trim: true },

}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
