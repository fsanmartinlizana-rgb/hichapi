/**
 * Creates placeholder PNG assets for the HiChapi mobile app.
 * Run with: node create-assets.js
 * 
 * For production, replace these with proper HiChapi branded assets.
 */

const fs = require('fs');

// Minimal 1x1 white PNG (base64)
const whitePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal 1x1 orange PNG (#FF6B35) — for icon
const orangePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAABlBMVEX/az0AAAA0Wr/OAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAC0lEQVQI12NgAAIABQAABjE+iQAAAABJRU5ErkJggg==',
  'base64'
);

const assets = [
  { file: 'assets/icon.png', data: orangePng },
  { file: 'assets/splash-icon.png', data: orangePng },
  { file: 'assets/adaptive-icon.png', data: orangePng },
  { file: 'assets/favicon.png', data: orangePng },
  { file: 'assets/notification-icon.png', data: whitePng },
];

assets.forEach(function({ file, data }) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, data);
    console.log('Created: ' + file);
  } else {
    console.log('Already exists: ' + file);
  }
});

console.log('\nDone! Replace these placeholder assets with proper HiChapi branded images.');
console.log('Icon size: 1024x1024px, Splash: 1284x2778px');
