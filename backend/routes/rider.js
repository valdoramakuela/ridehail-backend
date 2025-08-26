// routes/rider.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');

// Rider Registration
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    console.log('Rider registration attempt:', { fullName, email, phone });

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

    // Check if user already exists
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

    // Create rider
    const rider = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: 'rider'
    });

    const savedRider = await rider.save();
    console.log('Rider created successfully:', savedRider._id);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: savedRider._id, 
        role: 'rider',
        email: savedRider.email 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Rider registered successfully',
      rider: {
        id: savedRider._id,
        fullName: savedRider.fullName,
        email: savedRider.email,
        phone: savedRider.phone,
        role: savedRider.role
      },
      token
    });

  } catch (error) {
    console.error('Rider registration error:', error);
    
    if (error.code === 11000) {
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

// Rider Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Rider login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find rider by email
    const rider = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'rider' 
    });

    if (!rider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if account is suspended
    if (rider.isSuspended) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, rider.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last seen
    rider.lastSeen = new Date();
    await rider.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: rider._id, 
        role: 'rider',
        email: rider.email 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('Rider login successful:', rider._id);

    res.json({
      success: true,
      message: 'Login successful',
      rider: {
        id: rider._id,
        fullName: rider.fullName,
        email: rider.email,
        phone: rider.phone,
        role: rider.role
      },
      token
    });

  } catch (error) {
    console.error('Rider login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Rider Profile
router.get('/profile', authenticateRider, async (req, res) => {
  try {
    const rider = await User.findById(req.user.id).select('-password');
    
    if (!rider) {
      return res.status(404).json({
        success: false,
        error: 'Rider not found'
      });
    }

    res.json({
      success: true,
      rider: rider
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update Push Token
router.post('/push-token', authenticateRider, async (req, res) => {
  try {
    const { pushToken } = req.body;
    const riderId = req.user.id;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required'
      });
    }

    await User.findByIdAndUpdate(riderId, { 
      pushToken: pushToken 
    });

    console.log(`Push token updated for rider ${riderId}`);

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

// Authentication middleware
function authenticateRider(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'rider') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Rider role required.'
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
