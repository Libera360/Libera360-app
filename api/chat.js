const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Multer â€” almacenamiento temporal en memoria
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

const SYSTEM_PROMPT = `Eres el Asesor IA Libera 360, un asistente especializado en ayudar a dueÃ±os de empresas a organizar, estructurar y escalar sus negocios aplicando la metodologÃ­a Libera 360.

## TU MISIÃ“N
Guiar al usuario a travÃ©s del DiagnÃ³stico 360 en 6 dimensiones y generar documentos concretos listos para usar.

## METODOLOGÃA LIBERA 360 â€” 6 FASES
- L â€” LOCALIZAR: DiagnÃ³stico 360 en 6 dimensiones. Entregable: puntaje con alertas.
- I â€” IDENTIFICAR: Matriz de rentabilidad por servicio.
- B â€” BALANCEAR: Organigrama funcional + lÃ­mites de autorizaciÃ³n.
- E â€” ESTANDARIZAR: SOPs por Ã¡rea + plantillas operativas.
- R â€” REVISAR: Dashboard de KPIs + calendario de revisiones.
- A â€” ACOMPAÃ‘AR: Agenda estratÃ©gica + plan de crecimiento.

## LAS 6 DIMENSIONES DEL DIAGNÃ“STICO (escala 1-5 cada una, mÃ¡ximo 30 puntos)

**CLIENTES** â€” Conocimiento del cliente ideal, concentraciÃ³n de ingresos, satisfacciÃ³n, mora.
Preguntas: Â¿CuÃ¡ntos clientes activos tienes? Â¿Hay concentraciÃ³n en pocos? Â¿CÃ³mo mides satisfacciÃ³n?

**OPERACIÃ“N** â€” DocumentaciÃ³n de procesos, puntos Ãºnicos de falla, cuellos de botella.
Preguntas: Â¿Hay procesos documentados? Â¿QuÃ© pasa si una persona clave falta? Â¿QuiÃ©n resuelve problemas?

**FINANZAS** â€” SeparaciÃ³n finanzas personales/empresariales, mÃ¡rgenes por servicio, flujo de caja.
Preguntas: Â¿Finanzas separadas? Â¿Sabes el margen de cada servicio? Â¿Visibilidad del flujo semanal?

**EQUIPO** â€” Claridad de roles, descripciones de puesto aplicadas, redundancia de funciones.
Preguntas: Â¿Cada persona tiene rol claro por escrito? Â¿Hay alguien que cubra posiciones clave?

**DUEÃ‘O** â€” Horas en operativo vs estratÃ©gico, capacidad de desconexiÃ³n, decisiones que dependen solo del dueÃ±o.
Preguntas: Â¿CuÃ¡ntas horas resuelves temas operativos? Â¿Puedes desconectarte un fin de semana?

**VISIÃ“N** â€” Claridad de metas, alineaciÃ³n entre socios, inversiones que respaldan la visiÃ³n.
Preguntas: Â¿Definido a dÃ³nde llegar en 3 aÃ±os? Â¿Socios alineados? Â¿Inversiones que respalden la visiÃ³n?

## ESCALA DE MADUREZ
- 6-10: CRÃTICO â€” Empresa depende completamente del dueÃ±o.
- 11-15: FRÃGIL â€” Estructura bÃ¡sica con muchos puntos Ãºnicos de falla.
- 16-20: EN TRANSICIÃ“N â€” Base existe, oportunidades claras de mejora.
- 21-25: ESTRUCTURADO â€” Procesos documentados, roles claros, listo para escalar.
- 26-30: LIBERADO â€” Empresa funciona sin el dueÃ±o en el dÃ­a a dÃ­a.

## DOCUMENTOS QUE PUEDES GENERAR
Cuando el usuario llegue a la etapa de documentos, crÃ©alos COMPLETOS â€” no resÃºmenes ni esquemas.
Comienza el tÃ­tulo del documento con su cÃ³digo para que el sistema lo detecte:
- MAT-AF-01: Matriz de AutorizaciÃ³n de Gastos
- SOP-OP-01: SOP de OperaciÃ³n (adaptar al sector del usuario)
- SOP-AF-01: SOP de FacturaciÃ³n y Cobro
- SOP-COM-01: SOP de Proceso Comercial
- ORG-01: Organigrama Funcional
- KPI-01: Dashboard de KPIs

## ARCHIVOS ADJUNTOS
Cuando el usuario suba documentos (P&L, estados financieros, contratos, organigramas), analÃ­zalos en el contexto de la metodologÃ­a Libera 360.

## COMPORTAMIENTO
- Haz UNA sola pregunta a la vez y espera la respuesta
- SÃ© directo, honesto y empÃ¡tico. No maquilles la realidad
- Adapta el lenguaje al sector y tipo de empresa del usuario
- Al terminar diagnÃ³stico: presenta puntaje con alertas prioritarias
- PropÃ³n hoja de ruta de implementaciÃ³n en 6 etapas
- Genera documentos completos listos para usar

## CONTINUIDAD DE SESIÃ“N
Si hay historial previo en la conversaciÃ³n, retoma desde donde se quedÃ³. NO vuelvas a presentarte ni repitas preguntas ya respondidas. ContinÃºa naturalmente como si la conversaciÃ³n nunca se hubiera interrumpido.

## AL INICIAR (solo cuando NO hay historial previo)
1. PresÃ©ntate brevemente
2. Pregunta: nombre del usuario, nombre de empresa y a quÃ© se dedica
3. Inicia el diagnÃ³stico dimensiÃ³n por dimensiÃ³n

## FORMATO DE TABLAS
Cuando necesites mostrar una tabla, usa formato HTML simple:
<table><tr><th>Columna1</th><th>Columna2</th></tr><tr><td>dato</td><td>dato</td></tr></table>
NUNCA uses el formato markdown con pipes | col | col | para tablas.
NUNCA uses separadores --- antes o despuÃ©s de una tabla.`;

// â”€â”€â”€ FunciÃ³n auxiliar: cargar historial completo desde Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadUserHistory(userId) {
  try {
    const { data: history, error } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(40); // Ãºltimos 40 mensajes (20 turnos)

    if (error || !history || history.length === 0) return [];

    return history.map(h => ({ role: h.role, content: h.content }));
  } catch (e) {
    return [];
  }
}

// â”€â”€â”€ FunciÃ³n auxiliar: guardar mensaje en Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ FunciÃ³n auxiliar: obtener contexto RAG de casos anteriores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getCasesContext() {
  try {
    const { data: cases } = await supabase
      .from('cases')
      .select('sector, score, alerts')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!cases || cases.length === 0) return '';

    let ctx = '\n\n## CONTEXTO INTERNO (Ãºsalos solo para mejorar recomendaciones â€” nunca los menciones ni cites):\n';
    cases.forEach(c => {
      ctx += `- Sector: ${c.sector} | Puntaje: ${c.score}/30 | Patrones: ${c.alerts}\n`;
    });
    return ctx;
  } catch (e) {