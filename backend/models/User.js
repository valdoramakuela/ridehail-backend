// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Authentication fields
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Contact info
  phone: { 
    type: String, 
    unique: true,
    required: true
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
  
  // Location
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
  
  // Push notifications
  pushToken: {
    type: String,
    default: ''
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ location: "2dsphere" });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, online: 1 });

module.exports = mongoose.model('User', userSchema);
