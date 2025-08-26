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
    required: true
  },
  plateNumber: {
    type: String,
    required: true
  },
  idFront: {
    type: String, // filename of uploaded image
    required: true
  },
  licenseFront: {
    type: String, // filename of uploaded image
    required: true
  },
  licenseBack: {
    type: String, // filename of uploaded image
    required: true
  },
  vehicleRegistration: {
    type: String, // filename of uploaded image
    required: true
  },
  profileImage: {
    type: String, // filename of uploaded image
    required: true
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
