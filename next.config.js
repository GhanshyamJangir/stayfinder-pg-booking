const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the Windows LAN IP used by phones during local development.
  allowedDevOrigins: [
    '172.150.1.165',
    'localhost',
    '127.0.0.1',
  ],
  // Prevent Next/Turbopack from treating C:\\Users\\Motisons as the project root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;
