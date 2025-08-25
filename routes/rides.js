// routes/rides.js
const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const admin = require('../firebase/admin');

let activeRides = [];

router.get('/active', (req, res) => {
  res.json(activeRides);
});

router.get('/history/:userId', async (req, res) => {
  const rides = await Ride.find({ $or: [{ riderId: req.params.userId }, { driverId: req.params.userId }] });
  res.json(rides);
});

router.post('/request', (req, res) => {
  const ride = { id: Date.now().toString(), ...req.body, status: 'requested' };
  activeRides.push(ride);
  global.io.emit('rideUpdate', { rides: activeRides });
  res.json(ride);
});

router.post('/accept', async (req, res) => {
  const { rideId, driverId, driverName } = req.body;

  // Find the ride
  const ride = activeRides.find(r => r.id === rideId);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  // Update ride status
  ride.driverId = driverId;
  ride.driverName = driverName;
  ride.status = 'accepted';

  // Save to MongoDB (optional)
  await Ride.findByIdAndUpdate(rideId, { driverId, status: 'accepted' });

  // Get rider's push token from DB (you’ll need to store it)
  // Example: assume you have a User model with token
  const rider = await User.findById(ride.riderId);
  const riderToken = rider?.pushToken;

  if (riderToken) {
    try {
      await admin.messaging().send({
        token: riderToken,
        notification: {
          title: 'Ride Accepted! 🚖',
          body: `${driverName} is on the way to pick you up!`
        },
        data: {
          rideId: rideId,
          driverName: driverName,
          screen: 'ActiveRide'
        }
      });
      console.log('Push notification sent to rider');
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Notify all clients via Socket.IO
  global.io.emit('rideUpdate', { rides: activeRides });
  global.io.emit('rideAccepted', { rideId, driverId, driverName });

  res.json({ success: true, driverName });
});

module.exports = router;  
