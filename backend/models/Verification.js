// models/Verification.js
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  fullName: {
    type: String,
    required: true
  },
  licenseNumber: {
    type: String,
    required: true
  },
  vehicleModel: {
    type: String,
    default: ''
  },
  plateNumber: {
    type: String,
    default: ''
  },
  // Make image fields optional but recommended
  idFront: {
    type: String,
    default: ''
  },
  licenseFront: {
    type: String,
    default: ''
  },
  licenseBack: {
    type: String,
    default: ''
  },
  vehicleRegistration: {
    type: String,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String // admin user ID
  }
}, {
  timestamps: true
});

// Index for efficient queries
verificationSchema.index({ status: 1, createdAt: -1 });
verificationSchema.index({ userId: 1 });

module.exports = mongoose.model('Verification', verificationSchema);
