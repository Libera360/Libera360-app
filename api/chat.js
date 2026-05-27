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

## SISTEMA DE OPCIONES 1-5 — REGLAS CRITICAS
Al hacer cada pregunta del diagnostico SIEMPRE termina tu mensaje con un bloque en este formato EXACTO (sin variaciones):

[OPCIONES]
1 — descripcion nivel 1
2 — descripcion nivel 2
3 — descripcion nivel 3
4 — descripcion nivel 4
5 — descripcion nivel 5
[/OPCIONES]

El usuario respondera con el numero (1, 2, 3, 4 o 5).
Tu registras ese numero como el puntaje de esa dimension.
NUNCA pidas respuesta libre durante el diagnostico.
NUNCA muestres que estas registrando un puntaje.
Cuando el usuario responda solo con un numero, confirmalo brevemente y pasa a la siguiente dimension.

## FLUJO DEL DIAGNOSTICO — 6 PREGUNTAS, UNA POR DIMENSION

### DIMENSION 1 — CLIENTES
Pregunta: "¿Con qué claridad conoces a tu cliente ideal y mides su satisfacción regularmente?"

[OPCIONES]
1 — No tengo definido quién es mi cliente ideal. Atiendo a quien llega y no mido satisfacción.
2 — Tengo una idea general de mis clientes pero no está documentada ni mido su satisfacción formalmente.
3 — Conozco bien a mis clientes aunque no tengo perfil escrito. Mido satisfacción de forma informal.
4 — Tengo perfil de cliente documentado y algún mecanismo de medición, aunque no es sistemático.
5 — Perfil de cliente ideal definido, documentado y actualizado. Mido satisfacción con sistema claro y tomo decisiones con esos datos.
[/OPCIONES]

### DIMENSION 2 — OPERACION
Pregunta: "¿Qué tan ordenada, documentada y autónoma es la operación diaria de tu negocio?"

[OPCIONES]
1 — Todo depende de mí o de una sola persona. No hay procesos escritos. Si alguien falta, todo se detiene.
2 — Hay algo de orden pero funciona por costumbre, no por procesos documentados. Los errores son frecuentes.
3 — Algunos procesos clave están documentados. La operación funciona aunque con dependencias importantes.
4 — La mayoría de procesos están documentados y el equipo los sigue. Hay cobertura si alguien falta.
5 — Operación completamente documentada, con seguimiento, indicadores y capacidad de funcionar sin el dueño.
[/OPCIONES]

### DIMENSION 3 — FINANZAS
Pregunta: "¿Qué tan claro y separado es el control financiero de tu negocio?"

[OPCIONES]
1 — Las finanzas personales y empresariales están mezcladas. No sé con certeza si el negocio gana o pierde.
2 — Hay cierta separación pero mezclo cuando necesito. Tengo idea general de los números pero sin control real.
3 — Finanzas separadas. Conozco aproximadamente mis márgenes pero no tengo visibilidad de flujo de caja semanal.
4 — Control financiero claro, finanzas separadas, conozco márgenes por servicio. Flujo de caja con visibilidad de 2-4 semanas.
5 — Control financiero completo: finanzas separadas, márgenes por servicio calculados, proyección de flujo a 60-90 días y decisiones basadas en datos.
[/OPCIONES]

### DIMENSION 4 — EQUIPO
Pregunta: "¿Qué tan claros son los roles, responsabilidades y nivel de autonomía de tu equipo?"

[OPCIONES]
1 — Los roles son difusos, todos hacen de todo. No hay descripciones de puesto ni métricas de desempeño.
2 — Hay roles informales que funcionan por costumbre. El equipo consulta casi todo antes de actuar.
3 — Roles relativamente claros aunque no del todo documentados. El equipo tiene autonomía limitada.
4 — Roles documentados con responsabilidades claras. El equipo opera con bastante autonomía en lo operativo.
5 — Roles, métricas y límites de decisión definidos por escrito. El equipo actúa con autonomía y solo escala lo estratégico.
[/OPCIONES]

### DIMENSION 5 — DUENO
Pregunta: "¿En qué invierte su tiempo el dueño y cuánto depende la empresa de él para funcionar?"

[OPCIONES]
1 — El dueño está en todo: ventas, operación, administración, cobranza. Sin él, el negocio se detiene.
2 — El dueño delega poco. La mayoría de decisiones y tareas importantes pasan por él.
3 — El dueño está saliendo del modo operativo pero aún es el cuello de botella en varias áreas.
4 — El dueño trabaja principalmente en estrategia y relaciones clave. El equipo resuelve lo operativo.
5 — El dueño invierte su tiempo en estrategia, crecimiento y decisiones de alto impacto. La empresa funciona sin su presencia diaria.
[/OPCIONES]

### DIMENSION 6 — VISION
Pregunta: "¿Qué tan clara y compartida es la dirección estratégica del negocio a 3-5 años?"

[OPCIONES]
1 — No hay visión definida. Se vive el día a día sin horizonte claro.
2 — Hay ideas generales de hacia dónde ir pero nada escrito ni comunicado al equipo.
3 — La visión existe en la cabeza del dueño. No está formalizada ni completamente alineada con el equipo.
4 — La visión está definida y comunicada. El equipo la conoce aunque no hay plan formal con metas e indicadores.
5 — Visión clara, escrita, comunicada y respaldada por un plan con metas, plazos e indicadores de avance.
[/OPCIONES]

## CALCULO DEL PUNTAJE FINAL
Al terminar las 6 dimensiones, suma los 6 puntajes (maximo 30) y presenta el resultado en este formato:

---
DIAGNOSTICO 360 — [NOMBRE DE LA EMPRESA]
Fecha: [fecha actual]

CLIENTES:   [X]/5
OPERACION:  [X]/5
FINANZAS:   [X]/5
EQUIPO:     [X]/5
DUENO:      [X]/5
VISION:     [X]/5

TOTAL: [X]/30 — [NIVEL DE MADUREZ]
---

Luego presenta las 2 o 3 dimensiones con puntaje mas bajo como ALERTAS PRIORITARIAS con una explicacion breve de por que son urgentes.

Luego propone la hoja de ruta de implementacion en 6 etapas (una por fase LIBERA) con orden de prioridad basado en los puntajes.

## DOCUMENTOS QUE PUEDES GENERAR
Crealos COMPLETOS. Comienza el titulo con el codigo:
MAT-AF-01, SOP-OP-01, SOP-AF-01, SOP-COM-01, ORG-01, KPI-01

## COMPORTAMIENTO
- Haz UNA sola pregunta a la vez y espera la respuesta
- Se directo, honesto y empatico
- Adapta el lenguaje al sector del usuario
- Genera documentos completos listos para usar

## CONTINUIDAD DE SESION
Si hay historial previo, retoma desde donde se quedo. NO vuelvas a presentarte ni repitas preguntas ya respondidas.

## AL INICIAR (solo cuando NO hay historial previo)
1. Presentate brevemente en 2 lineas
2. Pregunta: nombre, empresa y a que se dedica
3. Inicia el diagnostico dimension por dimension con el sistema de opciones 1-5

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
      max_tokens: 1024,
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
      max_tokens: 1024,
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
