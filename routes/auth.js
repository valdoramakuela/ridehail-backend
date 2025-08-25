  
// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const admin = {
  id: 'admin123',
  username: 'admin',
  password: '$2a$10$Fg3uYb7UqZ6aZ8vW1c3p4eX5y6z7x8c9v0b1n2m3a4s5d6f7g8h9j' // hash of 'password123'
};

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== admin.username) return res.status(401).json({ error: 'Invalid' });

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) return res.status(401).json({ error: 'Invalid' });

  const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { username, role: 'admin' } });
  // In your login route
await User.findOneAndUpdate(
  { phone: user.phone },
  { pushToken: req.body.token });
});

module.exports = router;