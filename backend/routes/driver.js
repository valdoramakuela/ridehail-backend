// routes/driver.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/token', async (req, res) => {
  const { driverId, token } = req.body;
  await User.findByIdAndUpdate(driverId, { pushToken: token });
  res.json({ success: true });
});

module.exports = router;
