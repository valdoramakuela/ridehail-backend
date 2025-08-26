const express = require('express');
const router = express.Router();
const Verification = require('../models/Verification');
const upload = require('../middleware/upload'); // ← Import multer

// POST /api/verification/submit - WITH FILE UPLOAD
router.post('/submit', upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'vehicleRegistration', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    // Get field data
    const {
      userId,
      fullName,
      licenseNumber,
      vehicleModel,
      plateNumber
    } = req.body;

    // Get uploaded filenames
    const idFront = req.files['idFront']?.[0]?.filename;
    const licenseFront = req.files['licenseFront']?.[0]?.filename;
    const licenseBack = req.files['licenseBack']?.[0]?.filename;
    const vehicleRegistration = req.files['vehicleRegistration']?.[0]?.filename;
    const insurance = req.files['insurance']?.[0]?.filename;
    const profileImage = req.files['profileImage']?.[0]?.filename;

    // Create verification record
    const verification = new Verification({
      userId,
      fullName,
      licenseNumber,
      vehicleModel,
      plateNumber,
      idFront,
      licenseFront,
      licenseBack,
      vehicleRegistration,
      insurance,
      profileImage,
      status: 'pending'
    });

    await verification.save();

    // Emit socket event
    if (global.io) {
      global.io.emit('verificationUpdate', { action: 'new', verification });
    }

    res.json({ success: true, verification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/verification/pending
router.get('/pending', async (req, res) => {
  try {
    const pending = await Verification.find({ status: 'pending' });

    const formatted = pending.map(v => {
      const doc = v.toObject();
      const baseUrl = 'https://ridehail-backend.onrender.com/uploads'; // Your backend URL

      return {
        ...doc,
        idFront: doc.idFront ? `${baseUrl}/${doc.idFront}` : null,
        licenseFront: doc.licenseFront ? `${baseUrl}/${doc.licenseFront}` : null,
        licenseBack: doc.licenseBack ? `${baseUrl}/${doc.licenseBack}` : null,
        vehicleRegistration: doc.vehicleRegistration ? `${baseUrl}/${doc.vehicleRegistration}` : null,
        insurance: doc.insurance ? `${baseUrl}/${doc.insurance}` : null,
        profileImage: doc.profileImage ? `${baseUrl}/${doc.profileImage}` : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/verification/action
router.post('/action', async (req, res) => {
  const { id, status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const verification = await Verification.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (global.io) {
      global.io.emit('verificationUpdate', { action: 'updated', verification });
    }

    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
