const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const ACCESS_CODES = ['LIBERA2026', 'LIBERA360PRO', 'BETA001', 'BETA002', 'BETA003'];

// ── REGISTRO (primera vez) ──
router.post('/register', async (req, res) => {
  try {
    const { email, password, code } = req.body;

    if (!email || !password || !code) {
      return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }

    if (!ACCESS_CODES.includes(code.toUpperCase())) {
      return res.status(401).json({ error: 'Código de acceso inválido.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { access_code: code }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'Este correo ya tiene una cuenta. Usa "Iniciar sesión".' });
      }
      throw error;
    }

    // Cargar historial si existe
    const { data: history } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', data.user.id)
      .order('created_at', { ascending: true })
      .limit(100);

    res.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
      history: history || []
    });

  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error al crear la cuenta.' });
  }
});

// ── LOGIN (ya tiene cuenta) ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // Cargar historial
    const { data: history } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', data.user.id)
      .order('created_at', { ascending: true })
      .limit(100);

    res.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
      history: history || []
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

module.exports = router;