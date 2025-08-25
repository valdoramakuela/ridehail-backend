  
// models/Verification.js
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: String,
  fullName: String,
  licenseNumber: String,
  vehicleModel: String,
  plateNumber: String,
  idFront: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Verification', verificationSchema);
