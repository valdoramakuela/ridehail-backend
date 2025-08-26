// routes/verification.js
const express = require('express');
const router = express.Router();
const Verification = require('../models/Verification');
const upload = require('../middleware/upload');
const User = require('../models/User');

// Debug middleware to log all incoming requests
router.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`);
  console.log('Headers:', req.headers['content-type']);
  next();
});

// Submit driver verification with file uploads
router.post('/submit', (req, res, next) => {
  console.log('🚀 Starting verification submission...');
  
  // Use the multer middleware with proper error handling
  const uploadMiddleware = upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'licenseFront', maxCount: 1 },
    { name: 'licenseBack', maxCount: 1 },
    { name: 'vehicleRegistration', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 }
  ]);
  
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      
      if (err.code === 'UNEXPECTED_FIELD') {
        return res.status(400).json({
          success: false,
          error: `Unexpected field: ${err.field}. Expected fields: idFront, licenseFront, licenseBack, vehicleRegistration, profileImage`
        });
      }
      
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    
    // Continue with the actual processing
    processVerification(req, res);
  });
});

async function processVerification(req, res) {
  try {
    console.log('📋 Processing verification...');
    console.log('Body:', req.body);
    console.log('Files received:', Object.keys(req.files || {}));
    
    const {
      userId,
      fullName,
      licenseNumber,
      vehicleModel,
      plateNumber
    } = req.body;

    // Validate required text fields
    if (!userId || !fullName || !licenseNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, fullName, licenseNumber'
      });
    }

    // Create verification object with file paths
    const verificationData = {
      userId,
      fullName,
      licenseNumber,
      vehicleModel: vehicleModel || '',
      plateNumber: plateNumber || '',
      status: 'pending'
    };

    // Add file paths if files were uploaded
    if (req.files?.idFront && req.files.idFront[0]) {
      verificationData.idFront = req.files.idFront[0].filename;
      console.log('✅ ID Front uploaded:', verificationData.idFront);
    }
    if (req.files?.licenseFront && req.files.licenseFront[0]) {
      verificationData.licenseFront = req.files.licenseFront[0].filename;
      console.log('✅ License Front uploaded:', verificationData.licenseFront);
    }
    if (req.files?.licenseBack && req.files.licenseBack[0]) {
      verificationData.licenseBack = req.files.licenseBack[0].filename;
      console.log('✅ License Back uploaded:', verificationData.licenseBack);
    }
    if (req.files?.vehicleRegistration && req.files.vehicleRegistration[0]) {
      verificationData.vehicleRegistration = req.files.vehicleRegistration[0].filename;
      console.log('✅ Vehicle Registration uploaded:', verificationData.vehicleRegistration);
    }
    if (req.files?.profileImage && req.files.profileImage[0]) {
      verificationData.profileImage = req.files.profileImage[0].filename;
      console.log('✅ Profile Image uploaded:', verificationData.profileImage);
    }

    console.log('💾 Saving verification data:', verificationData);

    const verification = new Verification(verificationData);
    const savedVerification = await verification.save();

    console.log('✅ Verification saved successfully:', savedVerification._id);

    res.json({
      success: true,
      verification: savedVerification
    });
  } catch (error) {
    console.error('❌ Verification submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Get all verifications (for admin)
router.get('/all', async (req, res) => {
  try {
    console.log('📖 Fetching all verifications...');
    const verifications = await Verification.find().sort({ createdAt: -1 });
    console.log(`📋 Found ${verifications.length} verifications`);
    
    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    console.error('❌ Get verifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get pending verifications only
router.get('/pending', async (req, res) => {
  try {
    const verifications = await Verification.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update verification status (approve/reject)
// In your routes/verification.js file, replace the /action endpoint with this:

router.post('/action', async (req, res) => {
  try {
    const { id, status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    // Find and update the verification record
    const verification = await Verification.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      });
    }

    // IMPORTANT: Also update the user's verification status
    const User = require('../models/User'); // Make sure this import is at the top of your file
    
    if (status === 'approved') {
      await User.findByIdAndUpdate(verification.userId, { 
        isVerified: true 
      });
      console.log(`User ${verification.userId} marked as verified`);
    } else if (status === 'rejected') {
      await User.findByIdAndUpdate(verification.userId, { 
        isVerified: false 
      });
      console.log(`User ${verification.userId} marked as not verified`);
    }

    res.json({
      success: true,
      verification
    });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Alternative PATCH route for status updates (RESTful approach)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "approved", "rejected", or "pending"'
      });
    }

    const verification = await Verification.findByIdAndUpdate(
      id,
      { status, reviewedAt: new Date() },
      { new: true }
    );

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      });
    }

    res.json({
      success: true,
      verification
    });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get verification by ID
router.get('/:id', async (req, res) => {
  try {
    const verification = await Verification.findById(req.params.id);
    
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      });
    }

    res.json({
      success: true,
      verification
    });
  } catch (error) {
    console.error('Get verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

