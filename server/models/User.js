const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const kycSchema = new mongoose.Schema({
  aadhaarNumber:    { type: String, trim: true },
  aadhaarImageUrl:  { type: String }, // base64 JPEG stored
  aadhaarVerified:  { type: Boolean, default: false },
  vehicleNumber:    { type: String, trim: true },
  vehicleImageUrl:  { type: String }, // RC doc image
  vehiclePhotoUrl:  { type: String }, // vehicle photo with plate
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
  password: { type: String, required: true, minlength: 6 },

  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'driver', 'vendor', 'distributor', 'store', 'fulfillment_center', 'client'],
    default: 'client',
  },

  company:    { type: String, trim: true },
  phone:      { type: String, trim: true },
  avatar:     { type: String },
  isActive:   { type: Boolean, default: true },
  isOnboarded:{ type: Boolean, default: false }, // true once KYC verified for riders
  lastLogin:  { type: Date },

  // Location / Hub info (for stores, hubs, FCs, etc.)
  location: locationSchema,

  // Rider / Driver specific
  assignedArea:       { type: String, trim: true },
  vehicleType:        { type: String, trim: true },
  vehicleCapacity:    { type: Number, default: 0 },
  vehicleLicensePlate:{ type: String, trim: true },
  kyc:                kycSchema,

  // Business / Vendor specific
  gstNumber:    { type: String, trim: true },
  panNumber:    { type: String, trim: true },
  bankAccount:  { type: String, trim: true },
  ifscCode:     { type: String, trim: true },
  upiId:        { type: String, trim: true },

}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
