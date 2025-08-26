// middleware/upload.js
const multer = require('multer');
const path = require('path');

// Set storage location
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    // Make sure directory exists
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    console.log('📁 Processing file:', file.fieldname, 'Original name:', file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter allowed file types
const fileFilter = (req, file, cb) => {
  console.log('🔍 File filter check - Field:', file.fieldname, 'MimeType:', file.mimetype);
  
  if (file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    console.log('❌ Rejected file type:', file.mimetype);
    cb(new Error('Invalid file type. Only images and PDFs allowed.'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  // Add error handling
  onError: function(err, next) {
    console.log('🚨 Multer error:', err);
    next(err);
  }
});

// Add debugging middleware
upload.debugFields = (req, res, next) => {
  console.log('📋 Incoming request fields:');
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('File field names expected:', ['idFront', 'licenseFront', 'licenseBack', 'vehicleRegistration', 'profileImage']);
  
  // Log the actual field names being sent
  req.on('data', (chunk) => {
    const data = chunk.toString();
    if (data.includes('Content-Disposition: form-data; name=')) {
      const matches = data.match(/name="([^"]+)"/g);
      if (matches) {
        console.log('📨 Detected field names:', matches.map(m => m.match(/name="([^"]+)"/)[1]));
      }
    }
  });
  
  next();
};

module.exports = upload;
