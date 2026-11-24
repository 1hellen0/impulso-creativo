# Guion de demo — 5 minutos

## Preparación previa

- Backend y frontend iniciados localmente.
- Una cuenta colaboradora y una cuenta RR. HH. existentes y activas.
- Índice RAG y variables de servicios configurados si se demostrará una respuesta generativa.
- No proyectar `.env`, terminales con secretos, JWT ni el archivo de credenciales.

## Minuto 0:00–0:40 — Propósito y acceso

1. Presentar el portal como una herramienta académica para políticas y autoservicio de RR. HH.
2. Iniciar sesión como colaborador.
3. Señalar que el token se gestiona internamente por el frontend y no se copia manualmente.

## Minuto 0:40–1:50 — Consulta de política con respaldo

1. Preguntar: “¿Las vacaciones se acumulan automáticamente al año siguiente?”.
2. Mostrar la respuesta y las citas de Drive.
3. Explicar que el flujo recupera fragmentos desde LanceDB, valida el umbral de similitud y solo después usa DeepSeek para redactar.
4. Aclarar que una consulta sin respaldo devuelve abstención y remite a RR. HH.

## Minuto 1:50–2:35 — Datos personales y privacidad

1. Preguntar: “¿Cuántos días de vacaciones tengo?”.
2. Explicar que el orquestador envía la pregunta al agente MySQL y usa la identidad del JWT.
3. Intentar una consulta por el saldo de otra persona.
4. Mostrar el rechazo y explicar que no se recibe `id_colaborador` desde el cuerpo de la solicitud.

## Minuto 2:35–3:30 — Vista de RR. HH.

1. Cerrar sesión e ingresar como RR. HH.
2. Abrir historial y filtrar por persona.
3. Mostrar el reporte individual por colaborador sin exponer información médica innecesaria.
4. Abrir Dashboard y explicar tarjetas, solicitudes pendientes, gráfico de ausencias y tendencia de treinta días.

## Minuto 3:30–4:20 — Operación y trazabilidad

1. Mostrar, sin ejecutar si no corresponde, los comandos `npm run rag:sync` y `npm run evaluation:workbook`.
2. Explicar que Drive se sincroniza a las 06:00 de Costa Rica y los reportes se generan a las 07:00.
3. Indicar que `consultas_chat` registra agente, resultado, escalamiento, citas y latencia.

## Minuto 4:20–5:00 — Límites y próximos pasos

1. Mostrar la hoja de evaluación y las columnas aún vacías.
2. Aclarar que no hay porcentaje de aciertos ni P90 de latencia hasta ejecutar y revisar los 45 casos.
3. Cerrar recordando que los datos son simulados, el sistema no sustituye asesoría laboral y los secretos nunca se muestran.
