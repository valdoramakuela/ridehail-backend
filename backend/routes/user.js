// backend/routes/user.js
router.post('/token', async (req, res) => {
  const { userId, token } = req.body;
  await User.findByIdAndUpdate(userId, { pushToken: token });
  res.json({ success: true });
});
