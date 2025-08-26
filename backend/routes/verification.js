const express = require('express');
const router = express.Router();
const Verification = require('../models/Verification');

const BACKEND_URL = 'https://ridehail-backend.onrender.com'; // ✅ Your Render app URL

// POST /api/verifications/submit
router.post('/submit', async (req, res) => {
  try {
    const verification = new Verification(req.body);
    await verification.save();

    // Emit socket event (if using)
    if (global.io) {
      global.io.emit('verificationUpdate', { action: 'new', verification });
    }

    res.json({ success: true, verification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/verifications/pending
router.get('/pending', async (req, res) => {
  try {
    const pending = await Verification.find({ status: 'pending' });

    const formatted = pending.map(v => {
      const doc = v.toObject();
      const baseUrl = `${BACKEND_URL}/uploads`; // Serve from backend

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

// POST /api/verifications/action
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
