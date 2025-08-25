 
// models/Ride.js
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  riderId: String,
  driverId: String,
  pickup: { lat: Number, lng: Number },
  dropoff: { lat: Number, lng: Number },
  fare: Number,
  status: { type: String, default: 'requested' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ride', rideSchema);
