const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const ACCESS_CODES = ['LIBERA2026', 'LIBERA360PRO', 'BETA001', 'BETA002', 'BETA003'];

router.post('/access', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!ACCESS_CODES.includes(code.toUpperCase())) {
      return res.status(401).json({ error: 'Código de acceso inválido.' });
    }

    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ email, access_code: code, created_at: new Date().toISOString() })
        .select().single();
      
      if (error) throw error;
      user = newUser;
    }

    const { data: history } = await supabase
  .from('conversations')
  .select('role, content, created_at')
  .eq('user_id', user.id)
  .order('created_at', { ascending: true })
  .limit(100);

res.json({ 
  success: true, 
  user: { id: user.id, email: user.email },
  history: history || []
});

  } catch (error) {
    console.error('Error en auth:', error);
    res.status(500).json({ error: 'Error de autenticación.' });
  }
});

module.exports = router;