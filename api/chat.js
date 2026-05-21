const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/webp'
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

const SYSTEM_PROMPT = `Eres el Asesor IA Libera 360, un asistente especializado en ayudar a duenos de empresas a organizar, estructurar y escalar sus negocios aplicando la metodologia Libera 360.

## MISION
Guiar al usuario a traves del Diagnostico 360 en 6 dimensiones y generar documentos concretos listos para usar.

## METODOLOGIA LIBERA 360 - 6 FASES
- L: LOCALIZAR - Diagnostico 360 en 6 dimensiones.
- I: IDENTIFICAR - Matriz de rentabilidad por servicio.
- B: BALANCEAR - Organigrama funcional + limites de autorizacion.
- E: ESTANDARIZAR - SOPs por area + plantillas operativas.
- R: REVISAR - Dashboard de KPIs + calendario de revisiones.
- A: ACOMPANAR - Agenda estrategica + plan de crecimiento.

## LAS 6 DIMENSIONES DEL DIAGNOSTICO (escala 1-5, maximo 30 puntos)
CLIENTES: Conocimiento del cliente ideal, concentracion de ingresos, satisfaccion, mora.
OPERACION: Documentacion de procesos, puntos unicos de falla, cuellos de botella.
FINANZAS: Separacion finanzas personales/empresariales, margenes por servicio, flujo de caja.
EQUIPO: Claridad de roles, descripciones de puesto aplicadas, redundancia de funciones.
DUENO: Horas en operativo vs estrategico, capacidad de desconexion.
VISION: Claridad de metas, alineacion entre socios, inversiones que respaldan la vision.

## ESCALA DE MADUREZ
6-10: CRITICO | 11-15: FRAGIL | 16-20: EN TRANSICION | 21-25: ESTRUCTURADO | 26-30: LIBERADO

## DOCUMENTOS QUE PUEDES GENERAR
Crealos COMPLETOS. Comienza el titulo con el codigo:
MAT-AF-01, SOP-OP-01, SOP-AF-01, SOP-COM-01, ORG-01, KPI-01

## COMPORTAMIENTO
- Haz UNA sola pregunta a la vez y espera la respuesta
- Se directo, honesto y empatico
- Adapta el lenguaje al sector del usuario
- Al terminar diagnostico: presenta puntaje con alertas prioritarias
- Propone hoja de ruta en 6 etapas
- Genera documentos completos listos para usar

## CONTINUIDAD DE SESION
Si hay historial previo, retoma desde donde se quedo. NO vuelvas a presentarte ni repitas preguntas ya respondidas.

## AL INICIAR (solo cuando NO hay historial previo)
1. Presentate brevemente
2. Pregunta: nombre, empresa y a que se dedica
3. Inicia el diagnostico dimension por dimension

## FORMATO DE TABLAS
Usa HTML: <table><tr><th>Col</th></tr><tr><td>dato</td></tr></table>
NUNCA uses pipes markdown para tablas.`;

async function loadUserHistory(userId) {
  try {
    const { data: history, error } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(40);
    if (error || !history || history.length === 0) return [];
    return history.map(h => ({ role: h.role, content: h.content }));
  } catch (e) {
    return [];
  }
}

async function saveMessage(userId, sessionId, role, content) {
  try {
    await supabase.from('conversations').insert({
      user_id: userId,
      session_id: sessionId,
      role: role,
      content: content,
      created_at: new Date().toISOString()
    });
  } catch (e) {}
}

async function getCasesContext() {
  try {
    const { data: cases } = await supabase
      .from('cases')
      .select('sector, score, alerts')
      .order('created_at', { ascending: false })
      .limit(3);
    if (!cases || cases.length === 0) return '';
    let ctx = '\n\n## CONTEXTO INTERNO (nunca los menciones):\n';
    cases.forEach(c => {
      ctx += `- Sector: ${c.sector} | Puntaje: ${c.score}/30 | Patrones: ${c.alerts}\n`;
    });
    return ctx;
  } catch (e) {
    return '';
  }
}

router.get('/history', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ history: [] });
  const history = await loadUserHistory(userId);
  res.json({ history });
});

router.post('/', async (req, res) => {
  const { messages, userId, sessionId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requerido' });
  }
  try {
    if (userId && messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg.role === 'user' && typeof lastUserMsg.content === 'string') {
        await saveMessage(userId, sessionId, 'user', lastUserMsg.content);
      }
    }
    const casesContext = await getCasesContext();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + casesContext,
      messages: messages
    });
    const assistantMessage = response.content[0].text;
    if (userId) await saveMessage(userId, sessionId, 'assistant', assistantMessage);
    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error al procesar tu mensaje.' });
  }
});

router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    const { messages, userId, sessionId } = req.body;
    const parsedMessages = JSON.parse(messages);
    const files = req.files || [];
    const contentBlocks = [];
    for (const file of files) {
      if (file.mimetype === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') }
        });
      } else if (file.mimetype.startsWith('image/')) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: file.mimetype, data: file.buffer.toString('base64') }
        });
      } else {
        contentBlocks.push({
          type: 'text',
          text: `[Archivo adjunto: ${file.originalname}]`
        });
      }
    }
    const lastUserMsg = parsedMessages[parsedMessages.length - 1];
    if (lastUserMsg && lastUserMsg.content) {
      contentBlocks.push({ type: 'text', text: lastUserMsg.content });
    }
    if (userId && lastUserMsg) {
      await saveMessage(userId, sessionId, 'user', lastUserMsg.content || '[Archivo adjunto]');
    }
    const enrichedMessages = [...parsedMessages.slice(0, -1), {
      role: 'user',
      content: contentBlocks
    }];
    const casesContext = await getCasesContext();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + casesContext,
      messages: enrichedMessages
    });
    const assistantMessage = response.content[0].text;
    if (userId) await saveMessage(userId, sessionId, 'assistant', assistantMessage);
    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Error en chat/upload:', error);
    res.status(500).json({ error: 'Error al procesar los archivos.' });
  }
});

module.exports = router;
