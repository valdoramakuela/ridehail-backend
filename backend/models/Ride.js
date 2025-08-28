// models/Ride.js
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Pickup details
  pickup: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' }
  },
  
  // Destination details  
  dropoff: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' }
  },
  
  // Ride details
  fare: {
    estimated: { type: Number, default: 0 },
    final: { type: Number, default: 0 }
  },
  
  distance: {
    estimated: { type: Number, default: 0 }, // in km
    actual: { type: Number, default: 0 }
  },
  
  duration: {
    estimated: { type: Number, default: 0 }, // in minutes
    actual: { type: Number, default: 0 }
  },
  
  status: { 
    type: String, 
    enum: [
      'requested',   // Rider requested
      'accepted',    // Driver accepted
      'arrived',     // Driver arrived at pickup
      'started',     // Ride started
      'completed',   // Ride completed
      'cancelled'    // Ride cancelled
    ],
    default: 'requested' 
  },
  
  // Timestamps for different stages
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  arrivedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  
  // Ratings and feedback
  riderRating: { type: Number, min: 1, max: 5 },
  driverRating: { type: Number, min: 1, max: 5 },
  riderComment: { type: String, default: '' },
  driverComment: { type: String, default: '' },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'wallet'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Cancellation details
  cancellationReason: {
    type: String,
    enum: [
      'rider_cancelled',
      'driver_cancelled',
      'no_driver_found',
      'payment_failed',
      'long_pickup_time',
      'rider_not_found_at_pickup',
      'other'
    ]
  },
  
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

// Indexes for efficient queries
rideSchema.index({ riderId: 1, createdAt: -1 });
rideSchema.index({ driverId: 1, createdAt: -1 });
rideSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ride', rideSchema);

