const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY
);

router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId requerido' });

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    res.json({ history: data || [] });

  } catch(e) {
    console.error('Error cargando historial:', e);
    res.status(500).json({ history: [] });
  }
});

module.exports = router;