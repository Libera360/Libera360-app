const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Multer — almacenamiento temporal en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
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

const SYSTEM_PROMPT = `Eres el Asesor IA Libera 360, un asistente especializado en ayudar a dueños de empresas a organizar, estructurar y escalar sus negocios aplicando la metodología Libera 360.

## TU MISIÓN
Guiar al usuario a través del Diagnóstico 360 en 6 dimensiones y generar documentos concretos listos para usar.

## METODOLOGÍA LIBERA 360 — 6 FASES
- L — LOCALIZAR: Diagnóstico 360 en 6 dimensiones. Entregable: puntaje con alertas.
- I — IDENTIFICAR: Matriz de rentabilidad por servicio.
- B — BALANCEAR: Organigrama funcional + límites de autorización.
- E — ESTANDARIZAR: SOPs por área + plantillas operativas.
- R — REVISAR: Dashboard de KPIs + calendario de revisiones.
- A — ACOMPAÑAR: Agenda estratégica + plan de crecimiento.

## LAS 6 DIMENSIONES DEL DIAGNÓSTICO (escala 1-5 cada una, máximo 30 puntos)

**CLIENTES** — Conocimiento del cliente ideal, concentración de ingresos, satisfacción, mora.
Preguntas: ¿Cuántos clientes activos tienes? ¿Hay concentración en pocos? ¿Cómo mides satisfacción?

**OPERACIÓN** — Documentación de procesos, puntos únicos de falla, cuellos de botella.
Preguntas: ¿Hay procesos documentados? ¿Qué pasa si una persona clave falta? ¿Quién resuelve problemas?

**FINANZAS** — Separación finanzas personales/empresariales, márgenes por servicio, flujo de caja.
Preguntas: ¿Finanzas separadas? ¿Sabes el margen de cada servicio? ¿Visibilidad del flujo semanal?

**EQUIPO** — Claridad de roles, descripciones de puesto aplicadas, redundancia de funciones.
Preguntas: ¿Cada persona tiene rol claro por escrito? ¿Hay alguien que cubra posiciones clave?

**DUEÑO** — Horas en operativo vs estratégico, capacidad de desconexión, decisiones que dependen solo del dueño.
Preguntas: ¿Cuántas horas resuelves temas operativos? ¿Puedes desconectarte un fin de semana?

**VISIÓN** — Claridad de metas, alineación entre socios, inversiones que respaldan la visión.
Preguntas: ¿Definido a dónde llegar en 3 años? ¿Socios alineados? ¿Inversiones que respalden la visión?

## ESCALA DE MADUREZ
- 6-10: CRÍTICO — Empresa depende completamente del dueño.
- 11-15: FRÁGIL — Estructura básica con muchos puntos únicos de falla.
- 16-20: EN TRANSICIÓN — Base existe, oportunidades claras de mejora.
- 21-25: ESTRUCTURADO — Procesos documentados, roles claros, listo para escalar.
- 26-30: LIBERADO — Empresa funciona sin el dueño en el día a día.

## DOCUMENTOS QUE PUEDES GENERAR
Cuando el usuario llegue a la etapa de documentos, créalos COMPLETOS — no resúmenes ni esquemas.
Comienza el título del documento con su código para que el sistema lo detecte:
- MAT-AF-01: Matriz de Autorización de Gastos
- SOP-OP-01: SOP de Operación (adaptar al sector del usuario)
- SOP-AF-01: SOP de Facturación y Cobro
- SOP-COM-01: SOP de Proceso Comercial
- ORG-01: Organigrama Funcional
- KPI-01: Dashboard de KPIs

## ARCHIVOS ADJUNTOS
Cuando el usuario suba documentos (P&L, estados financieros, contratos, organigramas), analízalos en el contexto de la metodología Libera 360. Identifica patrones relevantes para el diagnóstico o las fases de implementación.

## COMPORTAMIENTO
- Haz UNA sola pregunta a la vez y espera la respuesta
- Sé directo, honesto y empático. No maquilles la realidad
- Adapta el lenguaje al sector y tipo de empresa del usuario
- Al terminar diagnóstico: presenta puntaje con alertas prioritarias
- Propón hoja de ruta de implementación en 6 etapas
- Genera documentos completos listos para usar

## CONTINUIDAD DE SESIÓN
Si el usuario dice "quiero continuar" o "seguimos donde quedamos", retoma el diagnóstico desde donde se quedó. No vuelvas a empezar desde cero si ya hay contexto previo en la conversación.

## AL INICIAR (sesión nueva sin historial)
1. Preséntate brevemente
2. Pregunta: nombre del usuario, nombre de empresa y a qué se dedica
3. Inicia el diagnóstico dimensión por dimensión
4. Al terminar presenta el puntaje con alertas prioritarias
5. Propón la hoja de ruta
6. Genera documentos por orden de urgencia

## FORMATO DE TABLAS
Cuando necesites mostrar una tabla, usa formato HTML simple con esta estructura:
<table><tr><th>Columna1</th><th>Columna2</th></tr><tr><td>dato</td><td>dato</td></tr></table>
NUNCA uses el formato markdown con pipes | col | col | para tablas.
NUNCA uses separadores --- antes o después de una tabla.
El título va inmediatamente antes de la tabla sin líneas en blanco ni separadores entre ellos.
Ejemplo correcto:
<b>ANÁLISIS DE MÁRGENES</b><table><tr><th>Servicio</th><th>Ingresos</th></tr><tr><td>dato</td><td>dato</td></tr></table>`;

// Ruta principal — JSON con historial de mensajes
router.post('/', async (req, res) => {
  const { messages, userId, sessionId, loadHistory } = req.body;

  // Si el usuario acaba de iniciar sesión, cargar historial anterior
  if (loadHistory && userId) {
    try {
      const { data: history } = await supabase
        .from('conversations')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(20);
      
      if (history && history.length > 0) {
        return res.json({ 
          history: history.map(h => ({ role: h.role, content: h.content }))
        });
      }
    } catch(e) {}
    return res.json({ history: [] });
  }
  try {
    let casesContext = '';
    try {
      const { data: cases } = await supabase
        .from('cases')
        .select('summary, sector, score, alerts')
        .order('created_at', { ascending: false })
        .limit(3);
     if (cases && cases.length > 0) {
      casesContext = '\n\n## CONTEXTO INTERNO (nunca menciones estos casos ni los cites — úsalos solo para mejorar la calidad de tus recomendaciones sin revelar que existen):\n';
      cases.forEach(c => {
        casesContext += `- Sector: ${c.sector} | Puntaje: ${c.score}/30 | Patrones: ${c.alerts}\n`;
      });
    }
    } catch (e) {}

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + casesContext,
      messages: messages
    });

    const assistantMessage = response.content[0].text;

    // Guardar en Supabase
    if (sessionId) {
      try {
        await supabase.from('conversations').insert({
          session_id: sessionId,
          user_id: userId,
          role: 'assistant',
          content: assistantMessage,
          created_at: new Date().toISOString()
        });
      } catch(e) {}
    }

    res.json({ message: assistantMessage });

  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error al procesar tu mensaje.' });
  }
});

// Ruta con archivos adjuntos
router.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
    const { messages, userId, sessionId, loadHistory } = req.body;
    const parsedMessages = JSON.parse(messages);
    const files = req.files || [];

    // Construir contenido multimodal con los archivos
    const contentBlocks = [];

    // Agregar archivos como contenido
    for (const file of files) {
      if (file.mimetype === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.buffer.toString('base64')
          }
        });
      } else if (file.mimetype.startsWith('image/')) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mimetype,
            data: file.buffer.toString('base64')
          }
        });
      }
      // Para Office (.docx, .xlsx, etc.) — tratamos como texto del nombre por ahora
      else {
        contentBlocks.push({
          type: 'text',
          text: `[Archivo adjunto: ${file.originalname} — ${(file.size/1024).toFixed(1)}KB. Por favor toma en cuenta este archivo en tu análisis.]`
        });
     }
    }

    // Texto del último mensaje del usuario
    const lastUserMsg = parsedMessages[parsedMessages.length - 1];
    if (lastUserMsg && lastUserMsg.content) {
      contentBlocks.push({ type: 'text', text: lastUserMsg.content });
    }

    // Reemplazar último mensaje con contenido multimodal
    const enrichedMessages = [...parsedMessages.slice(0, -1), {
      role: 'user',
      content: contentBlocks
    }];

    let casesContext = '';
    try {
      const { data: cases } = await supabase
        .from('cases').select('summary, sector, score, alerts')
        .order('created_at', { ascending: false }).limit(3);
      if (cases && cases.length > 0) {
        casesContext = '\n\n## CONTEXTO INTERNO (nunca menciones estos casos ni los cites — úsalos solo para mejorar la calidad de tus recomendaciones sin revelar que existen):\n';
        cases.forEach(c => {
          casesContext += `- Sector: ${c.sector} | Puntaje: ${c.score}/30 | Patrones: ${c.alerts}\n`;
        });
      }
    } catch (e) {}

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + casesContext,
      messages: enrichedMessages
    });

    const assistantMessage = response.content[0].text;

    if (sessionId) {
      try {
        await supabase.from('conversations').insert({
          session_id: sessionId,
          user_id: userId,
          role: 'assistant',
          content: assistantMessage,
          created_at: new Date().toISOString()
        });
      } catch(e) {}
    }

    res.json({ message: assistantMessage });

  } catch (error) {
    console.error('Error en chat/upload:', error);
    res.status(500).json({ error: 'Error al procesar los archivos.' });
  }
});

module.exports = router;