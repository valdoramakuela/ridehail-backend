// routes/ride.js - Corrected Version
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const admin = require('../firebase/admin');

// Request a ride
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

    // Get Socket.io instance
    const io = req.app.get('io') || global.io;

    // Send ride request to specific drivers (NOT broadcast to all)
    if (io && nearbyDrivers.length > 0) {
      const rideRequestData = {
        rideId: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        estimatedFare: ride.fare.estimated,
        estimatedDistance: ride.distance.estimated,
        estimatedDuration: ride.duration.estimated,
        riderId: req.user.id
      };

      // Send to each nearby driver specifically
      nearbyDrivers.forEach(driver => {
        console.log(`Sending ride request to driver: ${driver._id}`);
        
        // Send to multiple room formats for reliability
        io.to(driver._id.toString()).emit('rideRequest', rideRequestData);
        io.to(`driver_${driver._id}`).emit('rideRequest', rideRequestData);
      });

      // Also send to general drivers room as backup
      io.to('drivers').emit('rideRequest', rideRequestData);
    }

    // Send push notifications to nearby drivers
    for (let driver of nearbyDrivers) {
      if (driver.pushToken) {
        try {
          await admin.messaging().send({
            token: driver.pushToken,
            notification: {
              title: 'New Ride Request!',
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

// Accept ride
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

    // Get Socket.io instance
    const io = req.app.get('io') || global.io;

    // Notify rider via Socket.IO
    if (io) {
      const acceptData = {
        rideId: rideId,
        status: 'accepted',
        driver: {
          id: driver._id,
          name: driver.fullName,
          phone: driver.phone,
          rating: driver.rating
        }
      };

      // Send to specific rider
      io.to(ride.riderId._id.toString()).emit('rideAccepted', acceptData);
      io.to(`rider_${ride.riderId._id}`).emit('rideAccepted', acceptData);
    }

    // Send push notification to rider
    if (ride.riderId.pushToken) {
      try {
        await admin.messaging().send({
          token: ride.riderId.pushToken,
          notification: {
            title: 'Ride Accepted!',
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

// FIXED: Cancel ride endpoint with proper authentication
router.post('/:rideId/cancel', authenticateUser, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    
    console.log(`Cancel ride request: ${rideId} by user: ${userId}`);
    
    // Find the ride
    const ride = await Ride.findById(rideId);
    
    if (!ride) {
      return res.status(404).json({ 
        success: false,
        error: 'Ride not found' 
      });
    }
    
    // Check if user can cancel (rider or driver)
    if (ride.riderId.toString() !== userId && ride.driverId?.toString() !== userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to cancel this ride' 
      });
    }
    
    // Check if ride can be cancelled
    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot cancel completed or already cancelled ride' 
      });
    }
    
    // Update ride status
    ride.status = 'cancelled';
    ride.cancelledBy = userId;
    ride.cancellationReason = reason || 'No reason provided';
    ride.cancelledAt = new Date();
    
    await ride.save();
    
    // Get Socket.io instance
    const io = req.app.get('io') || global.io;
    
    if (io) {
      const isRiderCancelling = ride.riderId.toString() === userId;
      
      const cancelData = {
        rideId: ride._id,
        reason: reason || 'Ride cancelled',
        cancelledBy: isRiderCancelling ? 'rider' : 'driver',
        timestamp: Date.now()
      };

      // Notify the other party
      if (ride.driverId && ride.driverId.toString() !== userId) {
        // Notify driver
        io.to(ride.driverId.toString()).emit('rideCancelled', cancelData);
        io.to(`driver_${ride.driverId}`).emit('rideCancelled', cancelData);
      }
      
      if (ride.riderId.toString() !== userId) {
        // Notify rider
        io.to(ride.riderId.toString()).emit('rideCancelled', cancelData);
        io.to(`rider_${ride.riderId}`).emit('rideCancelled', cancelData);
      }
    }
    
    console.log(`Ride ${rideId} cancelled successfully`);
    
    res.json({
      success: true,
      message: 'Ride cancelled successfully',
      ride: {
        _id: ride._id,
        status: ride.status,
        cancelledBy: ride.riderId.toString() === userId ? 'rider' : 'driver',
        cancelledAt: ride.cancelledAt,
        reason: ride.cancellationReason
      }
    });
    
  } catch (error) {
    console.error('Cancel ride error:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid ride ID format' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel ride. Please try again.' 
    });
  }
});

// Update ride status
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

    // Get Socket.io instance
    const io = req.app.get('io') || global.io;

    // Notify rider via Socket.IO
    if (io) {
      const statusData = {
        rideId: rideId,
        status: status,
        timestamp: Date.now()
      };

      io.to(ride.riderId._id.toString()).emit('rideStatusUpdate', statusData);
      io.to(`rider_${ride.riderId._id}`).emit('rideStatusUpdate', statusData);
    }

    // Send push notification to rider
    if (ride.riderId.pushToken) {
      const messages = {
        arrived: 'Your driver has arrived!',
        started: 'Your ride has started!',
        completed: 'Ride completed! Thank you!',
        cancelled: 'Your ride has been cancelled'
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

// Get active rides
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

// Get ride history
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
    res.status(401.json({
      success: false,
      error: 'Token is not valid'
    });
  }
}

module.exports = router;
