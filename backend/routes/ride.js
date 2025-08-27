// routes/ride.js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const admin = require('../firebase/admin');

// Request a ride (replaces your current /request)
router.post('/request', authenticateUser, async (req, res) => {
  try {
    const { pickup, dropoff, estimatedFare, estimatedDistance, estimatedDuration } = req.body;
    
    if (!pickup || !dropoff || !pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
      return res.status(400).json({
        success: false,
        error: 'Pickup and dropoff coordinates are required'
      });
    }

    // Create ride in database
    const ride = new Ride({
      riderId: req.user.id,
      pickup: {
        lat: pickup.lat,
        lng: pickup.lng,
        address: pickup.address || ''
      },
      dropoff: {
        lat: dropoff.lat,
        lng: dropoff.lng,
        address: dropoff.address || ''
      },
      fare: { estimated: estimatedFare || 0 },
      distance: { estimated: estimatedDistance || 0 },
      duration: { estimated: estimatedDuration || 0 },
      status: 'requested'
    });

    await ride.save();

    // Find nearby drivers (within 5km)
    const nearbyDrivers = await User.find({
      role: 'driver',
      online: true,
      isVerified: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [pickup.lng, pickup.lat] },
          $maxDistance: 5000 // 5km
        }
      }
    });

    console.log(`Found ${nearbyDrivers.length} nearby drivers for ride ${ride._id}`);

    // Send push notifications to nearby drivers
    for (let driver of nearbyDrivers) {
      if (driver.pushToken) {
        try {
          await admin.messaging().send({
            token: driver.pushToken,
            notification: {
              title: 'New Ride Request! 🚕',
              body: 'Tap to view pickup location'
            },
            data: {
              rideId: ride._id.toString(),
              pickupLat: pickup.lat.toString(),
              pickupLng: pickup.lng.toString(),
              screen: 'RideRequest'
            }
          });
          console.log(`Push sent to driver: ${driver._id}`);
        } catch (error) {
          console.error(`Error sending to driver ${driver._id}:`, error.message);
          if (error.code === 'messaging/invalid-registration-token') {
            await User.findByIdAndUpdate(driver._id, { pushToken: null });
          }
        }
      }
    }

    // Broadcast to all connected clients via Socket.IO
    if (global.io) {
      global.io.emit('rideRequest', {
        rideId: ride._id,
        pickup: pickup,
        dropoff: dropoff,
        estimatedFare: estimatedFare,
        riderId: req.user.id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      ride: ride,
      nearbyDrivers: nearbyDrivers.length
    });

  } catch (error) {
    console.error('Ride request error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Accept ride (replaces your current /accept)
router.post('/accept', authenticateDriver, async (req, res) => {
  try {
    const { rideId } = req.body;
    const driverId = req.user.id;

    // Find the ride
    const ride = await Ride.findById(rideId).populate('riderId', 'fullName pushToken');
    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    if (ride.status !== 'requested') {
      return res.status(400).json({
        success: false,
        error: 'Ride is no longer available'
      });
    }

    // Get driver details
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    // Update ride
    ride.driverId = driverId;
    ride.status = 'accepted';
    ride.acceptedAt = new Date();
    await ride.save();

    // Send push notification to rider
    if (ride.riderId.pushToken) {
      try {
        await admin.messaging().send({
          token: ride.riderId.pushToken,
          notification: {
            title: 'Ride Accepted! 🚖',
            body: `${driver.fullName} is on the way to pick you up!`
          },
          data: {
            rideId: rideId,
            driverName: driver.fullName,
            driverPhone: driver.phone,
            screen: 'ActiveRide'
          }
        });
        console.log('Push notification sent to rider');
      } catch (error) {
        console.error('Error sending push notification to rider:', error);
      }
    }

    // Notify via Socket.IO
    if (global.io) {
      global.io.emit('rideAccepted', { 
        rideId: rideId, 
        driver: {
          id: driver._id,
          name: driver.fullName,
          phone: driver.phone,
          rating: driver.rating
        },
        riderId: ride.riderId._id
      });
    }

    res.json({
      success: true,
      message: 'Ride accepted successfully',
      ride: ride,
      driver: {
        id: driver._id,
        name: driver.fullName,
        phone: driver.phone,
        rating: driver.rating
      }
    });

  } catch (error) {
    console.error('Ride accept error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// In your ride routes file (e.g., routes/rides.js)
router.post('/ride/:rideId/cancel', async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id; // From auth middleware
    
    // Find the ride
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    
    // Check if user can cancel (rider or driver)
    if (ride.riderId.toString() !== userId && ride.driverId?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this ride' });
    }
    
    // Check if ride can be cancelled
    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ error: 'Cannot cancel completed or already cancelled ride' });
    }
    
    // Update ride status
    ride.status = 'cancelled';
    ride.cancelledBy = userId;
    ride.cancellationReason = reason;
    ride.cancelledAt = new Date();
    
    await ride.save();
    
    // Emit socket events to notify other party
    const io = req.app.get('io'); // Assuming you have socket.io attached to app
    
    if (ride.driverId && ride.driverId.toString() !== userId) {
      io.to(ride.driverId.toString()).emit('rideCancelled', {
        rideId: ride._id,
        reason,
        cancelledBy: 'rider'
      });
    }
    
    if (ride.riderId.toString() !== userId) {
      io.to(ride.riderId.toString()).emit('rideCancelled', {
        rideId: ride._id,
        reason,
        cancelledBy: 'driver'
      });
    }
    
    res.json({
      success: true,
      message: 'Ride cancelled successfully',
      ride
    });
    
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ error: 'Failed to cancel ride' });
  }
});

// Update ride status (new endpoint)
router.patch('/:rideId/status', authenticateDriver, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;

    const validStatuses = ['arrived', 'started', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const ride = await Ride.findById(rideId).populate('riderId', 'pushToken');
    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    if (ride.driverId.toString() !== driverId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Update status and timestamp
    ride.status = status;
    switch (status) {
      case 'arrived':
        ride.arrivedAt = new Date();
        break;
      case 'started':
        ride.startedAt = new Date();
        break;
      case 'completed':
        ride.completedAt = new Date();
        break;
      case 'cancelled':
        ride.cancelledAt = new Date();
        ride.cancellationReason = 'driver_cancelled';
        break;
    }

    await ride.save();

    // Send push notification to rider
    if (ride.riderId.pushToken) {
      const messages = {
        arrived: 'Your driver has arrived! 🚗',
        started: 'Your ride has started! 🛣️',
        completed: 'Ride completed! Thank you! ⭐',
        cancelled: 'Your ride has been cancelled 😔'
      };

      try {
        await admin.messaging().send({
          token: ride.riderId.pushToken,
          notification: {
            title: 'Ride Update',
            body: messages[status]
          },
          data: {
            rideId: rideId,
            status: status,
            screen: status === 'completed' ? 'RideComplete' : 'ActiveRide'
          }
        });
      } catch (error) {
        console.error('Error sending status update notification:', error);
      }
    }

    // Notify via Socket.IO
    if (global.io) {
      global.io.emit('rideStatusUpdate', {
        rideId: rideId,
        status: status,
        riderId: ride.riderId._id
      });
    }

    res.json({
      success: true,
      message: `Ride ${status} successfully`,
      ride: ride
    });

  } catch (error) {
    console.error('Ride status update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active rides (enhanced version)
router.get('/active', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {
      status: { $in: ['requested', 'accepted', 'arrived', 'started'] }
    };

    // Filter by user role
    if (userRole === 'rider') {
      query.riderId = userId;
    } else if (userRole === 'driver') {
      query.driverId = userId;
    }

    const rides = await Ride.find(query)
      .populate('riderId', 'fullName phone')
      .populate('driverId', 'fullName phone rating')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      rides: rides
    });

  } catch (error) {
    console.error('Get active rides error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get ride history (enhanced version)
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const rides = await Ride.find({
      $or: [{ riderId: userId }, { driverId: userId }],
      status: { $in: ['completed', 'cancelled'] }
    })
    .populate('riderId', 'fullName phone')
    .populate('driverId', 'fullName phone rating')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const totalRides = await Ride.countDocuments({
      $or: [{ riderId: userId }, { driverId: userId }],
      status: { $in: ['completed', 'cancelled'] }
    });

    res.json({
      success: true,
      rides: rides,
      totalPages: Math.ceil(totalRides / limit),
      currentPage: page
    });

  } catch (error) {
    console.error('Get ride history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get ride details
router.get('/:rideId', authenticateUser, async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.id;

    const ride = await Ride.findById(rideId)
      .populate('riderId', 'fullName phone')
      .populate('driverId', 'fullName phone rating');

    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }

    // Check authorization
    const isRider = ride.riderId._id.toString() === userId;
    const isDriver = ride.driverId && ride.driverId._id.toString() === userId;
    
    if (!isRider && !isDriver) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    res.json({
      success: true,
      ride: ride
    });

  } catch (error) {
    console.error('Get ride details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware functions
function authenticateUser(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token, authorization denied'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token is not valid'
    });
  }
}

function authenticateDriver(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token, authorization denied'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Driver access required'
      });
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Token is not valid'
    });
  }
}

module.exports = router;

