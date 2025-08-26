// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Authentication fields
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Contact info (keep your existing phone field)
  phone: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  
  // User type
  role: { 
    type: String, 
    enum: ['rider', 'driver', 'admin'],
    required: true
  },
  
  // Driver specific fields
  online: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  totalRides: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  
  // Location (keep your existing structure but enhance it)
  location: {
    type: { 
      type: String, 
      default: "Point" 
    },
    coordinates: { 
      type: [Number], 
      default: [0, 0] 
    }
  },
  
  // Push notifications (keep your existing token field but rename for clarity)
  pushToken: {
    type: String,
    default: ''
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  
  // Profile
  profileImage: {
    type: String,
    default: ''
  },
  
  // Driver vehicle info (can be moved to separate model later)
  vehicle: {
    model: { type: String, default: '' },
    plateNumber: { type: String, default: '' },
    color: { type: String, default: '' },
    year: { type: Number }
  }
}, {
  timestamps: true
});

// Keep your existing indexes and add new ones
userSchema.index({ location: "2dsphere" });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, online: 1 });
userSchema.index({ role: 1, isVerified: 1 });

module.exports = mongoose.model('User', userSchema);
