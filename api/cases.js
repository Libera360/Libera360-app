const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

router.post('/', async (req, res) => {
  try {
    const { userId, companyName, sector, scores, totalScore, alerts, documents } = req.body;

    const { data, error } = await supabase.from('cases').insert({
      user_id: userId,
      company_name: companyName,
      sector: sector,
      scores: scores,
      score: totalScore,
      alerts: alerts,
      documents: documents,
      summary: `Empresa: ${companyName} | Sector: ${sector} | Puntaje: ${totalScore}/30 | Alertas: ${alerts}`,
      created_at: new Date().toISOString()
    }).select().single();

    if (error) throw error;
    res.json({ success: true, case: data });

  } catch (error) {
    console.error('Error guardando caso:', error);
    res.status(500).json({ error: 'Error al guardar el caso.' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ cases: data });

  } catch (error) {
    res.status(500).json({ error: 'Error al obtener casos.' });
  }
});

module.exports = router;