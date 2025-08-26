// routes/driver.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

// Driver Registration
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    console.log('Driver registration attempt:', { fullName, email, phone });

    // Validation
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: fullName, email, phone, password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if driver already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email or phone number'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create driver
    const driver = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: 'driver',
      isVerified: false,
      online: false,
      rating: 5.0,
      totalRides: 0,
      totalEarnings: 0
    });

    const savedDriver = await driver.save();
    console.log('Driver created successfully:', savedDriver._id);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: savedDriver._id, 
        role: 'driver',
        email: savedDriver.email 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Driver registered successfully',
      driver: {
        id: savedDriver._id,
        fullName: savedDriver.fullName,
        email: savedDriver.email,
        phone: savedDriver.phone,
        role: savedDriver.role,
        isVerified: savedDriver.isVerified,
        rating: savedDriver.rating,
        totalRides: savedDriver.totalRides
      },
      token
    });

  } catch (error) {
    console.error('Driver registration error:', error);
    
    if (error.code === 11000) {
      // Duplicate key error
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${duplicateField} already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Driver Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Driver login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find driver by email
    const driver = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'driver' 
    });

    if (!driver) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if account is suspended
    if (driver.isSuspended) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, driver.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last seen
    driver.lastSeen = new Date();
    await driver.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: driver._id, 
        role: 'driver',
        email: driver.email 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Driver login successful:', driver._id);

    res.json({
      success: true,
      message: 'Login successful',
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        email: driver.email,
        phone: driver.phone,
        role: driver.role,
        isVerified: driver.isVerified,
        online: driver.online,
        rating: driver.rating,
        totalRides: driver.totalRides,
        totalEarnings: driver.totalEarnings
      },
      token
    });

  } catch (error) {
    console.error('Driver login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update Driver Location & Online Status
router.post('/location', authenticateDriver, async (req, res) => {
  try {
    const { latitude, longitude, available } = req.body;
    const driverId = req.user.id;

    console.log(`Updating location for driver ${driverId}:`, { latitude, longitude, available });

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const updateData = {
      location: {
        type: 'Point',
        coordinates: [longitude, latitude] // Note: MongoDB uses [lng, lat] order
      },
      online: available,
      lastSeen: new Date()
    };

    const driver = await User.findByIdAndUpdate(
      driverId,
      updateData,
      { new: true }
    ).select('-password');

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.json({
      success: true,
      message: 'Location and status updated',
      driver: {
        id: driver._id,
        online: driver.online,
        location: driver.location,
        lastSeen: driver.lastSeen
      }
    });

  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Driver Profile
router.get('/profile', authenticateDriver, async (req, res) => {
  try {
    const driver = await User.findById(req.user.id).select('-password');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found'
      });
    }

    res.json({
      success: true,
      driver: driver
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update Push Token (replaces your current /token endpoint)
router.post('/push-token', authenticateDriver, async (req, res) => {
  try {
    const { pushToken } = req.body;
    const driverId = req.user.id;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required'
      });
    }

    await User.findByIdAndUpdate(driverId, { 
      pushToken: pushToken 
    });

    console.log(`Push token updated for driver ${driverId}`);

    res.json({
      success: true,
      message: 'Push token updated successfully'
    });

  } catch (error) {
    console.error('Push token update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Driver Statistics
router.get('/stats', authenticateDriver, async (req, res) => {
  try {
    const driverId = req.user.id;
    
    // Get driver with basic stats
    const driver = await User.findById(driverId).select('-password');
    
    // You can add more complex stats here later
    res.json({
      success: true,
      stats: {
        totalRides: driver.totalRides,
        rating: driver.rating,
        totalEarnings: driver.totalEarnings,
        isVerified: driver.isVerified,
        online: driver.online
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Authentication middleware
function authenticateDriver(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Driver role required.'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }
    
    res.status(401).json({
      success: false,
      error: 'Invalid token.'
    });
  }
}

module.exports = router;
