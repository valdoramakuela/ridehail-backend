// backend/server.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/driver', require('./routes/driver'));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ DB Error:', err));

// Routes (if any)
app.use('/api/auth', require('./routes/auth'));

// Socket.IO
const io = require('socket.io')(server, {
  cors: { origin: "*" }
});

// Import Firebase Admin
const admin = require('./firebase/admin'); // ← Add this line
const User = require('./models/User');     // ← Add this line

io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);

  //  Handle Ride Request
  socket.on('rideRequest', async (rideData) => {
    const { id, pickup } = rideData;

    console.log('New ride request:', pickup);

    try {
      // 🌍 Find nearby drivers (within 5km)
      const drivers = await User.find({
        role: 'driver',
        online: true,
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [pickup.lng, pickup.lat] },
            $maxDistance: 5000 // 5km
          }
        }
      });

      console.log(`Found ${drivers.length} nearby drivers`);

      // 🔔 Send push notification to each driver
      for (let driver of drivers) {
        if (driver.pushToken) {
          try {
            await admin.messaging().send({
              token: driver.pushToken,
              notification: {
                title: 'New Ride Nearby 🚕',
                body: `Tap to view pickup location`
              },
               {
                rideId: id,
                pickupLat: pickup.lat.toString(),
                pickupLng: pickup.lng.toString(),
                screen: 'DriverHome'
              }
            });
            console.log('Push sent to driver:', driver._id);
          } catch (error) {
            console.error('Error sending to driver:', driver._id, error.message);
            // If token is invalid, clear it
            if (error.code === 'messaging/invalid-registration-token') {
              await User.findByIdAndUpdate(driver._id, { pushToken: null });
            }
          }
        }
      }

      // 📡 Broadcast to all connected drivers (Socket.IO fallback)
      socket.broadcast.emit('rideRequest', {
        rideId: id,
        pickup,
        from: rideData.from || 'Nearby Location'
      });

    } catch (err) {
      console.error('Error finding drivers:', err);
    }
  });

  // Handle driver going online
  socket.on('driverUpdate', async (data) => {
    const { id, location, available } = data;
    // Update driver location/status in DB
    await User.findByIdAndUpdate(data.id, {
    location: { type: "Point", coordinates: [data.location.lng, data.location.lat] },
    online: data.available
  });
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

global.io = io;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
