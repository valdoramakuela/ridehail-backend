  
// routes/verification.js
const express = require('express');
const router = express.Router();
const Verification = require('../models/Verification');

router.post('/submit', async (req, res) => {
  const verification = new Verification(req.body);
  await verification.save();
  global.io.emit('verificationUpdate', { action: 'new', verification });
  res.json({ success: true, verification });
});

router.get('/pending', async (req, res) => {
  const list = await Verification.find({ status: 'pending' });
  res.json(list);
});

router.post('/action', async (req, res) => {
  const { id, status } = req.body;
  const verification = await Verification.findByIdAndUpdate(id, { status }, { new: true });
  global.io.emit('verificationUpdate', { action: 'updated', verification });
  res.json(verification);
});

module.exports = router;