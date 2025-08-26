const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  fullName: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  vehicleModel: { type: String },
  plateNumber: { type: String },
  
  // ✅ Use clear, consistent field names
  idFront: String,                    // e.g., government ID
  licenseFront: String,               // front of driver's license
  licenseBack: String,                // back of license
  vehicleRegistration: String,        // reg doc              
  profileImage: String,               // profile photo

  status: { 
    type: String, 
    default: 'pending',
    enum: ['pending', 'approved', 'rejected'] 
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Verification', verificationSchema);
