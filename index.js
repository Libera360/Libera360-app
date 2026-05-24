require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/chat', require('./api/chat'));
app.use('/api/cases', require('./api/cases'));
app.use('/api/auth', require('./api/auth'));

// Ruta principal - sirve el frontend
app.get('/dueno-atrapado', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dueno-atrapado.html'));
});

app.get('/diagnostico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Libera360 corriendo en puerto ${PORT}`);
  });
}

module.exports = app;