  
// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, unique: true },
  name: String,
  role: { type: String, enum: ['rider', 'driver', 'admin'] },
  online: Boolean,
  token: String,
  createdAt: { type: Date, default: Date.now },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  }
});
userSchema.index({ location: "2dsphere" }); // ← Critical for $near queries
module.exports = mongoose.model('User', userSchema);
