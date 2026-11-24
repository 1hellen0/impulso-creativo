# Impulso Creativo — instalación y ejecución

Portal interno académico de RR. HH. para una agencia ficticia. Combina consulta de políticas con RAG, consultas personales con MySQL, historial protegido, dashboard de RR. HH. y reportes agregados.

## Requisitos

- Node.js 20 o superior.
- MySQL disponible con la base y los datos simulados ya preparados.
- Una cuenta de servicio de Google Drive con acceso de lectura a la carpeta configurada.
- Clave de Gemini para embeddings y clave de DeepSeek para respuestas de políticas y resúmenes de reportes.

No se deben versionar archivos `.env`, credenciales de Google ni bases locales de LanceDB.

## Instalación

Desde la raíz del proyecto:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

Copie `backend/.env.example` a `backend/.env` y complete únicamente los valores locales requeridos. Nunca incluya secretos en el repositorio ni en capturas de pantalla.

Variables principales:

- MySQL: `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`.
- Sesión: `JWT_SECRET` de al menos 32 caracteres y, opcionalmente, `JWT_EXPIRES_IN`.
- Drive: `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_DRIVE_FOLDER_ID`.
- RAG: `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, `LANCEDB_PATH`, `RAG_MIN_SIMILARITY`.
- DeepSeek: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`.
- Evaluación: correo y contraseña del colaborador de prueba; el runner solicita en consola la contraseña vigente de RR. HH. y no la persiste.

## Arranque local

En una primera terminal:

```powershell
cd backend
npm run dev
```

La API queda en `http://localhost:3000`. Al iniciar, intenta recuperar la sincronización pendiente de Drive y, al terminar, inicia la generación de reportes diarios. Estas tareas requieren la configuración local de sus respectivos servicios.

En una segunda terminal:

```powershell
cd frontend
npm run dev
```

Vite sirve el frontend y redirige las rutas `/api` al backend local. Para un artefacto de producción del frontend:

```powershell
cd frontend
npm run build
```

## Comandos operativos

| Propósito | Comando desde `backend` | Observación |
| --- | --- | --- |
| Verificar MySQL | `npm run db:check` | Comprueba la conexión configurada. |
| Índice inicial de Drive | `npm run rag:index` | Descarga, extrae, fragmenta y genera embeddings; consume Drive y Gemini. |
| Buscar RAG | `npm run rag:search -- "pregunta"` | Consume Gemini para la consulta. |
| Sincronizar Drive | `npm run rag:sync` | Incremental; puede consumir Drive y Gemini si hay cambios. |
| Configurar RR. HH. inicial | `npm run auth:setup-rrhh` | Solo para una cuenta existente sin `password_hash`. |
| Configurar colaborador de evaluación | `npm run auth:setup-evaluation-user` | Solo para cuenta activa con rol `colaborador` y sin `password_hash`. |
| Crear hoja de evaluación | `npm run evaluation:workbook` | No llama a APIs. |
| Ejecutar evaluación | `npm run evaluation:run` | Requiere backend activo y sí envía las 45 consultas. |

## Flujo recomendado de primera puesta en marcha

1. Verifique MySQL con `npm run db:check`.
2. Configure las cuentas de evaluación solo si cumplen los controles de los scripts.
3. Ejecute una indexación inicial de Drive y una búsqueda RAG de prueba.
4. Inicie backend y frontend.
5. Compruebe login, consulta de política, consulta personal propia y acceso de RR. HH.
6. Ejecute la sincronización manual de Drive antes de depender de su programación diaria.
7. Ejecute y revise manualmente la hoja de evaluación; no interprete las fórmulas como resultados hasta completar las respuestas y latencias.

## Endpoints principales

| Método | Ruta | Acceso | Finalidad |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Público | Valida correo/contraseña y emite JWT. |
| `POST` | `/api/chat/consulta` | Autenticado | Orquesta política RAG o dato personal propio. |
| `POST` | `/api/chat/politicas` | Autenticado | Consulta explícita al agente de políticas. |
| `GET` | `/api/chat/consultas/mias` | Autenticado | Historial propio. |
| `GET` | `/api/chat/consultas` | RR. HH. | Historial paginado y filtrable. |
| `GET` | `/api/rrhh/dashboard` | RR. HH. | Métricas agregadas del reporte diario. |
| `GET` | `/api/rrhh/reportes-diarios/historial` | RR. HH. | Historial de reportes globales. |
| `GET` | `/api/rrhh/reportes-diarios` | RR. HH. | Reporte individual por colaborador y fecha. |

## Estado de validación

La compilación del frontend y la sintaxis de los módulos modificados se han verificado durante el desarrollo. La ejecución integral contra Drive, Gemini, DeepSeek, la programación horaria y la evaluación de 45 preguntas deben validarse en el entorno local configurado. No hay un porcentaje de aciertos ni una latencia P90 documentables hasta ejecutar y revisar esa evaluación.
