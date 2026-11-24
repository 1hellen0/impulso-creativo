# Informe técnico

## Impulso Creativo: portal interno de políticas de RR. HH. con RAG, datos personales y reportes

**Proyecto:** Impulso Creativo  
**Ámbito:** mini proyecto académico de RR. HH. para una agencia de marketing ficticia  
**Tecnologías principales:** Node.js, Express 5, Sequelize 6, MySQL, React, Vite, LanceDB, Google Drive, Gemini y DeepSeek  
**Estado del documento:** descripción técnica basada en el repositorio actual  

---

## 1. Resumen ejecutivo

Impulso Creativo es un portal interno concebido para centralizar consultas de políticas de Recursos Humanos y permitir autoservicio limitado sobre información laboral propia. El proyecto separa las dos clases de información: las reglas generales viven en documentos indexados mediante recuperación aumentada por generación (RAG), mientras que los datos personales se obtienen de MySQL y se limitan al usuario autenticado. Esta separación evita que el modelo generativo sea la fuente de datos individuales.

El backend se implementa con Node.js, Express 5, Sequelize 6 y MySQL. El frontend es una aplicación React creada con Vite que administra el inicio de sesión, el envío automático del token JWT, el chat, las citas de documentos y las vistas exclusivas de Recursos Humanos. Los modelos cubren colaboradores, saldos de vacaciones, solicitudes, evaluaciones, movimientos, incapacidades, calendario de pagos, consultas de chat y reportes diarios.

El agente de políticas consulta una base LanceDB local. El índice se alimenta de documentos autorizados de Google Drive, admite Markdown, DOCX, PDF, XLSX y Google Docs, y genera embeddings de 768 dimensiones con Gemini. Después de recuperar los fragmentos relevantes y aplicar un umbral de similitud, DeepSeek redacta una respuesta limitada al contexto recibido. El backend arma las citas, de modo que el modelo no controla las fuentes ni los enlaces.

El proyecto también incorpora un analista de reportes diarios para RR. HH. Calcula indicadores agregados desde SQL, los persiste de forma idempotente en `reportes_diarios` y genera un resumen ejecutivo. El resumen puede solicitarse a DeepSeek usando únicamente métricas agregadas; si la respuesta tiene una estructura o cifras no autorizadas, se descarta y se conserva un resumen local. El dashboard no debe revelar diagnósticos, observaciones médicas, nombres ni el texto de consultas individuales.

La implementación disponible no equivale aún a una aceptación final completa. La evaluación de 45 preguntas existe como hoja y runner, pero no se ha ejecutado ni revisado manualmente. Por ello este informe no reporta porcentajes de acierto, percentiles de latencia ni afirmaciones de rendimiento no medidas.

---

## 2. Alcance funcional

### 2.1 Agente de políticas

El agente responde consultas generales sobre vacaciones, permisos, incapacidades, jornada, remuneración, beneficios, ingreso y salida, desempeño, conducta y privacidad. Los documentos de referencia están en `backend/documentos/politicas` y el informe de investigación del proyecto complementa su contexto académico. La respuesta debe sustentarse en fragmentos recuperados desde LanceDB y devolver citas con nombre, sección y enlace de Drive.

La ruta explícita es `POST /api/chat/politicas`. La ruta general `POST /api/chat/consulta` aplica un clasificador local: cuando identifica una pregunta de datos personales en primera persona, usa el agente MySQL; en los demás casos envía la consulta al flujo de políticas. Si la recuperación no obtiene fragmentos por encima de `RAG_MIN_SIMILARITY`, el sistema se abstiene y recomienda consultar a RR. HH. Esa decisión ocurre antes de llamar a DeepSeek.

### 2.2 Agente de datos personales

El agente de datos no usa Drive, LanceDB ni DeepSeek. Recibe el usuario desde el middleware de autenticación y consulta MySQL mediante los modelos Sequelize. Puede construir una respuesta con perfil laboral, saldo de vacaciones, solicitudes recientes o evaluación programada del usuario autenticado.

El controlador no acepta identidad, rol, nombre, correo o identificador del colaborador en el cuerpo como fuente de autorización. Para un usuario de rol `colaborador`, preguntas que apuntan a otra persona se rechazan antes de recuperar datos. La consulta queda registrada como dato personal con estado, escalamiento y latencia cuando es posible. El rol `rrhh` se determina nuevamente desde MySQL al validar el token y no desde el cliente.

### 2.3 RR. HH. y dashboard

El usuario de RR. HH. puede listar historial paginado de consultas, filtrarlo por colaborador, consultar perfiles autorizados, revisar reportes individuales y abrir el dashboard global. Los endpoints `/api/rrhh/*` están protegidos por el middleware `requerirRRHH`.

El dashboard presenta indicadores agregados del reporte del día: ausencias activas por tipo y departamento, solicitudes pendientes, incapacidades activas, movimientos y rotación mensual, saldos de vacaciones altos, uso del chat, temas y consultas sin respuesta. También presenta solicitudes pendientes sin nombres, gráficos CSS y tendencia de hasta treinta reportes diarios. Los datos individuales se reservan para la vista específica de RR. HH. y no se mezclan con el reporte global.

---

## 3. Arquitectura y flujo de datos

La arquitectura se organiza en cuatro límites: presentación, API/autorización, fuentes estructuradas y fuentes documentales. React nunca consulta MySQL, LanceDB, Google Drive ni proveedores de IA de manera directa. Todas las llamadas pasan por el backend.

1. La persona inicia sesión en `POST /api/auth/login` con correo y contraseña.
2. El backend busca el colaborador, compara bcrypt y firma un JWT HS256 con `sub` igual al identificador interno.
3. El frontend conserva el token dentro de su sesión local y lo adjunta como `Authorization: Bearer ...` en las solicitudes protegidas.
4. El middleware verifica firma, emisor, audiencia, vencimiento y estado de la cuenta; luego obtiene de MySQL el rol actualizado.
5. El controlador aplica autorización y selecciona el flujo: RAG, MySQL, consultas o reporte.
6. El resultado y los metadatos de auditoría se devuelven al frontend. Las citas se construyen en backend.

La separación de datos es intencional. LanceDB contiene contenido de políticas e embeddings, no saldos ni expedientes personales. MySQL contiene datos estructurados simulados, pero no sirve como base textual de las políticas. DeepSeek participa solo después de la recuperación RAG o para un resumen agregado; no decide permisos ni consulta MySQL por sí mismo.

La [arquitectura](arquitectura.md) contiene el diagrama de componentes, flujos y programadores.

---

## 4. Modelo de datos y persistencia

### 4.1 MySQL y Sequelize

`Colaborador` es la entidad de identidad laboral. Incluye identificador, código, nombre, correo, departamento, puesto, fecha de ingreso, jefe, rol, estado y `password_hash`. La contraseña nunca se persiste en texto plano. Los roles declarados son `colaborador` y `rrhh`; los estados declarados son `activo`, `inactivo` y `licencia`.

`SaldoVacaciones` guarda un saldo por colaborador y período, con días asignados, tomados y disponibles. `Solicitud` representa vacaciones, permisos o licencias con fechas, estado y aprobador. `EvaluacionDesempeno` conserva fecha programada y estado. `MovimientoPersonal` mantiene ingresos, salidas y ascensos. `Incapacidad` tiene campos administrativos de tipo, fecha y días, pero el diseño del dashboard evita usar entidad u observación administrativa.

`ConsultaChat` registra las interacciones relevantes: persona consultante, pregunta, intención, agente, citas, resultado, escalamiento, latencia y fecha. El historial utiliza asociaciones hacia `Colaborador` solo en el contexto de RR. HH. `ReporteDiario` almacena una fila única por fecha, con JSON de indicadores, resumen y origen de generación.

Las migraciones no se alteran para la operación actual. Los modelos declaran los nombres físicos de tabla explícitamente, por ejemplo `colaboradores`, `saldos_vacaciones`, `solicitudes`, `consultas_chat` y `reportes_diarios`.

### 4.2 LanceDB

La tabla local `rag_chunks` usa vectores `Float32` de tamaño fijo 768. Cada fragmento contiene identificador de Drive, nombre, ruta, MIME type, sección, fecha de modificación, hash del fragmento, hash de fuente, texto y vector. La clave de fragmento deriva del archivo, el contenido de origen y el texto; por ello una reindexación puede reemplazar de forma segura todos los fragmentos de un archivo modificado.

El índice se conserva bajo la ruta configurable `LANCEDB_PATH`, por defecto `data/lancedb`. Esta carpeta está ignorada por Git. El estado de sincronización de Drive y su bloqueo local viven también dentro de esa zona local, no en MySQL ni en el repositorio.

---

## 5. RAG y gestión documental

### 5.1 Ingesta inicial

El indexador crea un cliente de Google Drive de solo lectura usando la cuenta de servicio configurada. Recorre recursivamente la carpeta indicada y conserva la ruta relativa de cada archivo. Para cada MIME type soportado descarga o exporta el contenido: los Google Docs se exportan como texto, DOCX se procesa con Mammoth, PDF con `pdf-parse`, XLSX con `xlsx`, y los archivos Markdown o texto se interpretan directamente.

El texto se normaliza, se separa por encabezados Markdown cuando están disponibles y se fragmenta con solapamiento. La concurrencia es secuencial. El limitador local estima tokens, respeta una separación mínima entre solicitudes Gemini y reintenta errores transitorios 429 o 503 hasta el límite configurado. La respuesta de embeddings se valida explícitamente para asegurar un único vector numérico de 768 posiciones.

Antes de reemplazar los chunks de un archivo, el indexador completa sus embeddings y construye la tabla Arrow correspondiente. Si no se producen batches válidos, no borra chunks existentes. Esta propiedad reduce el riesgo de pérdida de conocimiento por un fallo de extracción o del proveedor de embeddings.

### 5.2 Recuperación y respuesta

`buscarFragmentos` valida la pregunta, genera el vector de consulta con la instrucción de búsqueda apropiada para Gemini Embedding 2 y ejecuta búsqueda vectorial. Convierte distancia a puntuación mediante `1 / (1 + distancia)`, deduplica resultados por nombre base de archivo para evitar que copias DOCX y Markdown dominen la respuesta y limita los resultados.

El controlador de políticas filtra por `RAG_MIN_SIMILARITY`, con valor inicial 0.55. La puntuación es una señal de recuperación, no una probabilidad. Si no queda ningún fragmento, responde abstención con `citas: []` y no consume DeepSeek. Si hay contexto, DeepSeek recibe la pregunta y los fragmentos permitidos con instrucciones de no inventar reglas ni fuentes. Las citas finales no provienen del modelo: las arma el backend con metadatos RAG.

### 5.3 Sincronización incremental de Drive

La sincronización usa el API de cambios de Drive cuando hay un cursor válido. Guarda `startPageToken`, `folderId` y los IDs confirmados dentro de la carpeta. Para cada ciclo obtiene una lista recursiva de la carpeta como verificación de alcance, compara fechas de modificación contra LanceDB e indexa solamente archivos nuevos, modificados o ausentes del índice.

Los archivos eliminados o movidos se retiran de LanceDB únicamente si su ID había sido confirmado previamente como administrado por esa carpeta. En una primera reconciliación, fragmentos sin propiedad verificable se conservan y se reportan como protegidos. Si el cursor expira, hay cambio de subcarpeta o falla la continuidad, se ejecuta una reconciliación segura. Un archivo de bloqueo evita operaciones simultáneas entre el scheduler del servidor y el comando manual.

El scheduler intenta sincronizar al arrancar y programa la ejecución diaria a las 06:00, zona `America/Costa_Rica`. La validación de esta operación contra la cuenta de servicio, cambios reales y límites de Gemini sigue pendiente en el entorno final.

---

## 6. Seguridad, privacidad y autorización

La seguridad se aplica por capas. Las credenciales se leen desde variables de entorno; `.env`, el JSON de la cuenta de servicio y LanceDB local están excluidos de Git. El login utiliza bcrypt y no devuelve hash ni secretos. JWT usa HS256, emisor, audiencia y vencimiento configurables. Tras verificar el token, el backend vuelve a consultar el colaborador y su estado, por lo que un rol o estado revocado en la base no depende de un dato almacenado en el cliente.

El agente de datos personales toma identidad y rol únicamente de `req.usuario`, construido por el middleware. Un colaborador no recibe un selector de persona ni se acepta `id_colaborador` en la petición de chat. Las preguntas de terceros se rechazan y se registran como tal. RR. HH. tiene endpoints específicos protegidos y no depende del texto de una consulta para adquirir permisos.

La política de privacidad del repositorio exige minimizar datos, limitar finalidad y evitar exponer datos médicos. Por esa razón, las consultas generales no deben entregar diagnósticos, certificados, observaciones administrativas ni información de terceros. En reportes globales se usan conteos, tipos y departamentos; no nombres, correos, textos de chat o salarios individuales. La aplicación conserva datos simulados para el alcance académico, pero estas restricciones siguen siendo relevantes para una demostración responsable.

DeepSeek se usa en dos límites controlados. Para políticas recibe fragmentos documentales y para reportes recibe solo el JSON de métricas agregadas. En el segundo caso el resumen debe tener entre tres y cinco frases y sus números se comparan con formatos de las métricas permitidas. Si DeepSeek falla, falta la clave, responde con formato inválido o aporta una cifra no autorizada, se usa un resumen local. Esta validación reduce, pero no elimina, la necesidad de revisión humana antes de utilizar informes en una decisión real.

---

## 7. Analista de reportes diarios

El analista ejecuta consultas SQL agregadas sobre las tablas existentes. Calcula: ausencias activas por tipo y departamento; solicitudes pendientes y con más de tres días; incapacidades activas y días acumulados del mes; ingresos, salidas y rotación; saldos de vacaciones superiores a veinte días; uso del chat del día anterior, resolución sin escalamiento y latencia promedio; top cinco intenciones; y consultas sin respuesta por intención.

Los indicadores se guardan como JSON en `reportes_diarios` junto con el resumen ejecutivo. La unicidad de fecha evita duplicados. Si dos procesos intentan crear el mismo reporte, la excepción de unicidad vuelve a cargar el reporte existente. La generación diaria se programa para las 07:00 de Costa Rica. En el arranque del backend, la sincronización de Drive intenta completar primero y luego se inicia el programador de reportes.

El dashboard de React se alimenta de `GET /api/rrhh/dashboard`. Incluye al menos seis tarjetas, dos gráficos CSS, solicitudes pendientes, resumen, salud del chat e historial de hasta treinta reportes. El reporte individual por colaborador sigue separado en `GET /api/rrhh/reportes-diarios`, con acceso RR. HH. El reporte global no debe confundirse con un expediente individual.

La generación programada, el resumen DeepSeek y el dashboard con datos reales aún deben probarse en una ejecución local controlada. Es incorrecto asumir que haya registros históricos o datos visibles simplemente porque el código y las rutas estén presentes.

---

## 8. Frontend y experiencia de uso

El frontend tiene tres áreas. El login incluye validación básica, mensajes de error y control visual de contraseña. El chat muestra mensajes de usuario, respuestas, estado de carga y fuentes. Para RR. HH. se habilitan pestañas de dashboard e historial/reportes. Las solicitudes protegidas se realizan desde `api.js`, que agrega el header `Authorization` cuando existe sesión.

La interfaz usa una identidad visual editorial limpia con una paleta reducida, tipografía de contraste y componentes adaptables a móvil. El diseño no reemplaza controles de backend: ocultar una pestaña no autoriza una ruta, por lo que las rutas RR. HH. conservan middleware de rol.

El runner de evaluación no está integrado al frontend. Es una herramienta de backend que puede llenar respuestas y latencias en el libro Excel. Solicita de manera oculta la contraseña vigente de RR. HH. en ejecución y no la guarda. Las columnas de resultado permanecen para revisión humana; una coincidencia textual superficial no se considera un acierto.

---

## 9. Pruebas, evaluación y estado conocido

El repositorio incluye `banco-evaluacion-impulso-creativo.xlsx` con 45 casos: 25 base y 20 propios. Cubre políticas, datos personales propios, rechazo de privacidad, abstención, reportes agregados y rutas de RR. HH. Para cada caso se define pregunta, tipo, agente esperado, perfil de ejecución, criterio, fuente, respuesta obtenida, resultado y latencia. La hoja calcula porcentaje de aciertos y P90 cuando se completen los datos.

La ejecución no se ha realizado como parte de este estado documentado. Por consiguiente:

- No existe porcentaje de aciertos oficial.
- No existe P90 de latencia medido contra la meta de ocho segundos.
- No se puede afirmar que los 45 casos pasen.
- No se ha comprobado el comportamiento de todos los proveedores externos bajo sus cuotas y tiempos reales.

Sí se ha validado de forma estática la sintaxis de módulos modificados y se ha compilado el frontend con Vite. Estas verificaciones son necesarias, pero no sustituyen pruebas de integración, pruebas de seguridad, revisión de respuestas y monitoreo en ejecución.

Un plan de aceptación mínimo consiste en iniciar backend y frontend, preparar las dos cuentas de evaluación existentes, ejecutar el workbook, revisar manualmente cada criterio, clasificar cada resultado y confirmar que la hoja calcula métricas a partir de datos reales. Los casos de privacidad y abstención requieren especial atención: una respuesta aparentemente útil puede ser incorrecta si divulga datos o inventa información.

---

## 10. Riesgos, limitaciones y próximos pasos

El clasificador de intención actual es basado en patrones y no un modelo de clasificación semántico. Por diseño es simple y auditable, pero puede necesitar ampliación al crecer el vocabulario de consultas. Las preguntas personales están protegidas además por el alcance de la consulta MySQL, de manera que un falso negativo de clasificación no debe habilitar acceso a registros ajenos.

La detección inicial de objetos eliminados de Drive tiene una precaución deliberada: sin estado previo de propiedad no borra chunks históricos no verificables. Esto protege información de otra fuente, pero puede dejar contenido huérfano hasta una revisión o reindexación administrada. Las sincronizaciones siguientes, con estado válido, sí pueden retirar IDs previamente administrados.

El uso de DeepSeek y Gemini depende de claves, conectividad, límites del proveedor y respuestas de APIs externas. La aplicación incluye reintentos y respaldos en algunos flujos, pero requiere observabilidad operativa antes de usarse con una carga real. Los datos del proyecto son simulados; una migración a información real requeriría evaluación legal, controles de privacidad, retención, auditoría, seguridad de secretos y revisión de proveedores.

Próximos pasos recomendados:

1. Ejecutar la evaluación de 45 casos y registrar resultados revisados.
2. Validar manualmente la primera sincronización y una eliminación controlada de un archivo de prueba en Drive.
3. Comprobar el scheduler de 06:00 y 07:00 en un entorno controlado con zona horaria de Costa Rica.
4. Agregar pruebas automatizadas para middleware, autorización de terceros, umbral RAG y validación de números de reportes.
5. Añadir monitoreo, límites de tamaño, registro estructurado sin PII y estrategia de backup para la base e índice local.

---

## 11. Conclusión

Impulso Creativo implementa una arquitectura coherente para separar conocimiento documental, datos personales y analítica agregada. El uso de MySQL para hechos personales, LanceDB para políticas y controles explícitos de rol ofrece una base más segura que un único agente con acceso indiscriminado. Las citas construidas en backend, la abstención por falta de respaldo y la validación de reportes agregados son controles relevantes frente a alucinación y divulgación indebida.

El proyecto debe presentarse con precisión: dispone de las piezas de implementación descritas, pero requiere validación integral de proveedores, programación y evaluación antes de afirmar calidad cuantitativa. La documentación, el diagrama, el guion de demo y la hoja de evaluación permiten realizar esa validación de manera trazable sin inventar métricas ni exponer secretos.
