# QR Studio 🚀

A full-stack Dynamic QR Code Generator Platform built with React (Vite) + Node.js + MongoDB.

## Quick Start

### 1. Backend
```bash
cd server
cp .env.example .env
# Edit .env and set your MONGO_URI
npm install
npm run dev
```
Server runs at **http://localhost:5000**

### 2. Frontend
```bash
cd client
# .env is already configured for local development
npm run dev
```
App runs at **http://localhost:5173**

## Features
- 🔗 20+ QR Types (URL, vCard, WiFi, Email, SMS, WhatsApp, and more)
- ⚡ Dynamic QR Codes — change destination any time without reprinting
- 🎨 Fully customizable QR appearance (colors, dot styles, logo, corner styles)
- 📊 Scan analytics tracking
- 💾 Save & manage QR codes
- 📥 Download as PNG, SVG, JPEG, WebP

## Tech Stack
- **Frontend**: React 19, Vite, TailwindCSS, Framer Motion, React Hook Form + Zod, qr-code-styling
- **Backend**: Node.js, Express.js, MongoDB, Mongoose

## Dynamic QR Flow
1. User creates a Dynamic QR with a destination URL
2. Backend generates a short code (e.g. `abc123`)
3. QR encodes `http://localhost:5000/d/abc123`
4. Scanning redirects to the current destination
5. Destination can be updated anytime — same QR code!
