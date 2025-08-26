// routes/verification.js
const express = require('express');
const router = express.Router();
const Verification = require('../models/Verification');
const upload = require('../middleware/upload');

// Submit driver verification with file uploads
router.post('/submit', upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'vehicleRegistration', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      userId,
      fullName,
      licenseNumber,
      vehicleModel,
      plateNumber
    } = req.body;

    // Create verification object with file paths
    const verificationData = {
      userId,
      fullName,
      licenseNumber,
      vehicleModel,
      plateNumber,
      status: 'pending'
    };

    // Add file paths if files were uploaded
    if (req.files.idFront) verificationData.idFront = req.files.idFront[0].filename;
    if (req.files.licenseFront) verificationData.licenseFront = req.files.licenseFront[0].filename;
    if (req.files.licenseBack) verificationData.licenseBack = req.files.licenseBack[0].filename;
    if (req.files.vehicleRegistration) verificationData.vehicleRegistration = req.files.vehicleRegistration[0].filename;
    if (req.files.profileImage) verificationData.profileImage = req.files.profileImage[0].filename;

    const verification = new Verification(verificationData);
    await verification.save();

    res.json({
      success: true,
      verification
    });
  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all verifications (for admin)
router.get('/all', async (req, res) => {
  try {
    const verifications = await Verification.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    console.error('Get verifications error:', error);
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
router.post('/action', async (req, res) => {
  try {
    const { id, status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

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
      { status },
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
