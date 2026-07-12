require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

app.set('io', io);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'StayBill Cafe POS API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth.routes'));
app.use('/api/superadmin', require('./routes/superadmin.routes'));
app.use('/api/tables',     require('./routes/table.routes'));
app.use('/api/menu',       require('./routes/menu.routes'));
app.use('/api/orders',     require('./routes/order.routes'));
app.use('/api/kots',       require('./routes/kot.routes'));
app.use('/api/bills',      require('./routes/bill.routes'));
app.use('/api/payments',   require('./routes/payment.routes'));
app.use('/api/customers',  require('./routes/customer.routes'));
app.use('/api/employees',  require('./routes/employee.routes'));
app.use('/api/inventory',  require('./routes/inventory.routes'));
app.use('/api/expenses',   require('./routes/expense.routes'));
app.use('/api/public',     require('./routes/public.routes'));
app.use('/api/reports',    require('./routes/report.routes'));
app.use('/api/settings',   require('./routes/settings.routes'));
app.use('/api/subscription', require('./routes/subscription.routes'));

// ── Serve React Web App ───────────────────────────────────────────────────────
const webBuildPath = path.join(__dirname, '../web/dist');
app.use(express.static(webBuildPath));

// ── 404 for API routes & SPA fallback ───────────────────────────────────────
app.use((req, res) => {
  // If the request is for an API route, return JSON 404
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  // Otherwise, fallback to React app (useful for digital menu and admin dashboard routing)
  res.sendFile(path.join(webBuildPath, 'index.html'));
});

// ── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 StayBill POS API & WebSockets running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}\n`);
});
