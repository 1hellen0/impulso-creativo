import { useEffect, useState } from "react";
import {
  ApiError,
  consultarChat,
  login,
  obtenerColaboradoresRRHH,
  obtenerDashboardRRHH,
  obtenerHistorialRRHH,
  obtenerHistorialReportesRRHH,
  obtenerReporteDiarioRRHH,
} from "./api";

const SESSION_KEY = "impulso_creativo_session";

function readSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return session?.token && session?.usuario ? session : null;
  } catch {
    return null;
  }
}

function Login({ onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(correo, password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-sun" aria-hidden="true" />
      <div className="login-grid" aria-hidden="true" />
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-lockup">
          <span className="logo-mark">IC</span>
          <p className="eyebrow">Impulso<br />Creativo</p>
        </div>
        <p className="edition">Edición interna · 01</p>
        <h1 id="login-title">Tu brújula<br /><em>laboral.</em></h1>
        <p className="muted">Consulta las políticas internas con respaldo documental.</p>
        <form onSubmit={submit}>
          <label htmlFor="correo">Correo</label>
          <input id="correo" type="email" value={correo} onChange={(event) => setCorreo(event.target.value)} required autoComplete="email" />
          <label htmlFor="password">Contraseña</label>
          <div className="password-field">
            <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.2 0 8.8 4.7 9.7 6.1a1.7 1.7 0 0 1 0 1.8 16.6 16.6 0 0 1-3 3.4M6.3 6.3a16.4 16.4 0 0 0-4 3.8 1.7 1.7 0 0 0 0 1.8C3.2 13.3 6.8 18 12 18c1.2 0 2.3-.3 3.3-.8" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.3 10.1a1.7 1.7 0 0 0 0 1.8C3.2 13.3 6.8 18 12 18s8.8-4.7 9.7-6.1a1.7 1.7 0 0 0 0-1.8C20.8 8.7 17.2 4 12 4S3.2 8.7 2.3 10.1Z" />
                  <circle cx="12" cy="11" r="3" />
                </svg>
              )}
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Ingresando…" : "Iniciar sesión"}</button>
        </form>
      </section>
    </main>
  );
}

function Citas({ citas }) {
  if (!citas?.length) return null;
  return (
    <div className="citations">
      <strong>Fuentes</strong>
      <ul>
        {citas.map((cita, index) => (
          <li key={`${cita.enlace}-${index}`}>
            <a href={cita.enlace} target="_blank" rel="noreferrer">{cita.documento}</a>
            {cita.seccion && <span> · {cita.seccion}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chat({ token, onUnauthorized }) {
  const [pregunta, setPregunta] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const text = pregunta.trim();
    if (!text || loading) return;

    setError("");
    setPregunta("");
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);
    try {
      const data = await consultarChat(text, token);
      setMessages((current) => [...current, {
        role: "assistant",
        text: data.respuesta,
        citas: data.citas,
      }]);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel chat-panel" aria-labelledby="chat-title">
      <div className="panel-ribbon" aria-hidden="true">POLÍTICAS / PERSONAS / CULTURA</div>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Agente de Personas</p>
          <h2 id="chat-title">Tus políticas y<br /><em>datos personales, claros.</em></h2>
        </div>
      </div>
      <div className="messages" aria-live="polite">
        {!messages.length && <p className="empty-state">Pregunta sobre políticas, permisos o tus vacaciones y datos personales.</p>}
        {messages.map((message, index) => (
          <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
            <p>{message.text}</p>
            <Citas citas={message.citas} />
          </article>
        ))}
        {loading && <article className="message assistant loading">Buscando respaldo en las políticas…</article>}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="pregunta">Pregunta sobre políticas</label>
        <textarea id="pregunta" value={pregunta} onChange={(event) => setPregunta(event.target.value)} placeholder="Ej.: ¿Cuántos días de vacaciones tengo?" maxLength="1000" rows="3" />
        <button type="submit" disabled={loading || !pregunta.trim()}><span>Enviar</span><b>↗</b></button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

function BarrasHorizontales({ items }) {
  const maximo = Math.max(1, ...items.map((item) => item.total));
  if (!items.length) return <p className="empty-state">No hay datos para el período seleccionado.</p>;
  return (
    <div className="bar-chart" role="img" aria-label="Ausencias activas por tipo y departamento">
      {items.map((item) => (
        <div className="bar-row" key={`${item.tipo}-${item.departamento}`}>
          <span>{item.tipo.replace("_", " ")} · {item.departamento}</span>
          <div className="bar-track"><i style={{ width: `${(item.total / maximo) * 100}%` }} /></div>
          <b>{item.total}</b>
        </div>
      ))}
    </div>
  );
}

function GraficoTendencia({ items }) {
  const maximo = Math.max(1, ...items.map((item) => item.consultas_chat));
  if (!items.length) return <p className="empty-state">La tendencia aparecerá cuando existan reportes diarios.</p>;
  return (
    <div className="trend-chart" role="img" aria-label="Tendencia de consultas del chat de los últimos 30 días">
      {items.map((item) => (
        <div className="trend-column" key={item.fecha} title={`${item.fecha}: ${item.consultas_chat} consultas`}>
          <i style={{ height: `${Math.max(4, (item.consultas_chat / maximo) * 100)}%` }} />
          <span>{item.fecha.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardRRHH({ token, onUnauthorized }) {
  const [dashboard, setDashboard] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([obtenerDashboardRRHH(token), obtenerHistorialReportesRRHH(token)])
      .then(([datosDashboard, datosHistorial]) => {
        if (!active) return;
        setDashboard(datosDashboard);
        setHistorial(datosHistorial.reportes || []);
      })
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 401) onUnauthorized();
        else if (active) setError(requestError.message);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, onUnauthorized]);

  if (loading) return <section className="panel dashboard-panel"><p className="empty-state">Cargando indicadores agregados…</p></section>;
  if (error) return <section className="panel dashboard-panel"><p className="error" role="alert">{error}</p></section>;
  if (!dashboard) return null;

  const { indicadores } = dashboard.reporte;
  const cards = [
    ["Ausencias activas", indicadores.ausencias.total_activas],
    ["Solicitudes pendientes", indicadores.solicitudes_pendientes.total],
    ["Incapacidades activas", indicadores.incapacidades.activas],
    ["Rotación mensual", `${indicadores.movimientos_mes.rotacion_porcentaje}%`],
    ["Saldos > 20 días", indicadores.vacaciones_mayores_a_veinte_dias.total],
    ["Consultas ayer", indicadores.chat_dia_anterior.total_consultas],
  ];

  return (
    <section className="panel dashboard-panel" aria-labelledby="dashboard-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Recursos Humanos · {dashboard.reporte.fecha}</p>
          <h2 id="dashboard-title">Pulso diario<br /><em>del equipo.</em></h2>
        </div>
      </div>
      <p className="executive-summary">{dashboard.reporte.resumen_ejecutivo}</p>
      <div className="metric-grid">
        {cards.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>
      <div className="dashboard-charts">
        <article className="chart-card">
          <h3>Ausencias por tipo y departamento</h3>
          <BarrasHorizontales items={indicadores.ausencias.por_tipo_y_departamento} />
        </article>
        <article className="chart-card">
          <h3>Tendencia de consultas · 30 días</h3>
          <GraficoTendencia items={dashboard.tendencia_30_dias} />
        </article>
      </div>
      <div className="dashboard-detail-grid">
        <article className="detail-card">
          <h3>Solicitudes pendientes</h3>
          {!dashboard.solicitudes_pendientes.length ? <p className="empty-state">No hay solicitudes pendientes.</p> : (
            <ul className="pending-list">
              {dashboard.solicitudes_pendientes.map((solicitud) => <li key={solicitud.id_solicitud}><b>{solicitud.tipo}</b><span>{solicitud.departamento} · {solicitud.dias_pendiente} días pendientes</span></li>)}
            </ul>
          )}
        </article>
        <article className="detail-card">
          <h3>Chat del día anterior</h3>
          <p><b>{indicadores.chat_dia_anterior.resolucion_sin_escalamiento_porcentaje}%</b> resuelto sin escalar</p>
          <p><b>{indicadores.chat_dia_anterior.latencia_promedio_ms} ms</b> de latencia promedio</p>
          <p><b>{indicadores.consultas_sin_respuesta.total}</b> consultas sin respuesta</p>
          <div className="topic-list">
            {indicadores.top_cinco_temas.map((tema) => <span key={tema.tema}>{tema.tema}: {tema.total}</span>)}
          </div>
        </article>
      </div>
      <section className="report-history" aria-labelledby="report-history-title">
        <h3 id="report-history-title">Historial de reportes</h3>
        {!historial.length ? <p className="empty-state">Todavía no hay reportes generados.</p> : <div className="report-history-list">{historial.map((reporte) => <article key={reporte.fecha}><strong>{reporte.fecha}</strong><span>{reporte.indicadores.chat_dia_anterior?.total_consultas || 0} consultas · {reporte.indicadores.solicitudes_pendientes?.total || 0} pendientes</span></article>)}</div>}
      </section>
    </section>
  );
}

function ReporteDiarioRRHH({ token, colaboradores, onUnauthorized }) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function consultarReporte() {
    if (!colaboradorId) return;
    setLoading(true);
    setError("");
    try {
      setReporte(await obtenerReporteDiarioRRHH(token, colaboradorId, fecha));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) onUnauthorized();
      else setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="daily-report" aria-labelledby="report-title">
      <div>
        <p className="eyebrow">Recursos Humanos</p>
        <h3 id="report-title">Reporte diario por persona</h3>
      </div>
      <div className="report-controls">
        <label>
          Colaborador
          <select value={colaboradorId} onChange={(event) => setColaboradorId(event.target.value)}>
            <option value="">Selecciona una persona</option>
            {colaboradores.map((colaborador) => <option key={colaborador.id_colaborador} value={colaborador.id_colaborador}>{colaborador.nombre}</option>)}
          </select>
        </label>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </label>
        <button type="button" onClick={consultarReporte} disabled={!colaboradorId || loading}>{loading ? "Consultando…" : "Consultar"}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {reporte && (
        <div className="report-result">
          <strong>{reporte.colaborador.nombre}</strong>
          <span>{reporte.colaborador.puesto} · {reporte.colaborador.departamento}</span>
          <div className="report-grid">
            <p><b>Movimientos:</b> {reporte.movimientos.length}</p>
            <p><b>Solicitudes vigentes:</b> {reporte.solicitudes.length}</p>
            <p><b>Evaluaciones:</b> {reporte.evaluaciones.length}</p>
            <p><b>Saldo disponible:</b> {reporte.saldo_vacaciones ? reporte.saldo_vacaciones.dias_disponibles : "Sin registro"}</p>
          </div>
          {reporte.reporte_global?.resumen_texto && <p className="global-summary"><b>Resumen general del día:</b> {reporte.reporte_global.resumen_texto}</p>}
        </div>
      )}
    </section>
  );
}

function HistorialRRHH({ token, onUnauthorized }) {
  const [history, setHistory] = useState(null);
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    obtenerHistorialRRHH(token, page, colaboradorId)
      .then((data) => active && setHistory(data))
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          onUnauthorized();
        } else if (active) {
          setError(requestError.message);
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, page, colaboradorId, onUnauthorized]);

  useEffect(() => {
    let active = true;
    obtenerColaboradoresRRHH(token)
      .then((data) => active && setColaboradores(data.colaboradores || []))
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 401) onUnauthorized();
        else if (active) setError(requestError.message);
      });
    return () => { active = false; };
  }, [token, onUnauthorized]);

  const totalPages = history ? Math.max(1, Math.ceil(history.total / history.por_pagina)) : 1;

  return (
    <section className="panel history-panel" aria-labelledby="history-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Recursos Humanos</p>
          <h2 id="history-title">Historial de consultas</h2>
        </div>
      </div>
      <label className="history-filter">
        Filtrar por persona
        <select value={colaboradorId} onChange={(event) => { setColaboradorId(event.target.value); setPage(1); }}>
          <option value="">Todas las personas</option>
          {colaboradores.map((colaborador) => <option key={colaborador.id_colaborador} value={colaborador.id_colaborador}>{colaborador.nombre}</option>)}
        </select>
      </label>
      {loading && <p className="empty-state">Cargando historial…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && history?.consultas?.length === 0 && <p className="empty-state">No hay consultas registradas.</p>}
      {!loading && history?.consultas?.length > 0 && (
        <div className="history-list">
          {history.consultas.map((consulta) => (
            <article className="history-item" key={consulta.id_consulta}>
              <div className="history-meta">
                <strong>{consulta.colaborador?.nombre || "Colaborador no disponible"}</strong>
                <span>{consulta.colaborador?.correo}</span>
                <time>{new Date(consulta.fecha).toLocaleString("es-CR")}</time>
              </div>
              <p>{consulta.pregunta}</p>
              <div className="badges">
                <span className={consulta.resuelta ? "badge success" : "badge warning"}>{consulta.resultado}</span>
                {consulta.escalada && <span className="badge warning">escalada</span>}
                <span className="badge">{consulta.agente}</span>
                {consulta.latencia_ms !== null && <span className="badge">{consulta.latencia_ms} ms</span>}
              </div>
              <Citas citas={consulta.citas} />
            </article>
          ))}
        </div>
      )}
      <div className="pagination">
        <button type="button" onClick={() => setPage((value) => value - 1)} disabled={page === 1 || loading}>Anterior</button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= totalPages || loading}>Siguiente</button>
      </div>
      <ReporteDiarioRRHH token={token} colaboradores={colaboradores} onUnauthorized={onUnauthorized} />
    </section>
  );
}

function App() {
  const [session, setSession] = useState(readSession);
  const [view, setView] = useState("chat");

  async function handleLogin(correo, password) {
    const data = await login(correo, password);
    const nextSession = { token: data.token, usuario: data.usuario };
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setView("chat");
  }

  if (!session) return <Login onLogin={handleLogin} />;

  const isRRHH = session.usuario.rol === "rrhh";
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-header">
          <span className="logo-mark">IC</span>
          <div>
            <p className="eyebrow">Impulso Creativo</p>
            <h1>Personas con <em>impulso.</em></h1>
          </div>
        </div>
        <div className="user-menu">
          <span>{session.usuario.nombre}</span>
          <button type="button" className="secondary" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>
      {isRRHH && (
        <nav className="tabs" aria-label="Secciones">
          <button className={view === "chat" ? "active" : ""} type="button" onClick={() => setView("chat")}>Chat de políticas</button>
          <button className={view === "dashboard" ? "active" : ""} type="button" onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={view === "history" ? "active" : ""} type="button" onClick={() => setView("history")}>Historial y reportes</button>
        </nav>
      )}
      {view === "chat" && <Chat token={session.token} onUnauthorized={logout} />}
      {view === "dashboard" && isRRHH && <DashboardRRHH token={session.token} onUnauthorized={logout} />}
      {view === "history" && isRRHH && <HistorialRRHH token={session.token} onUnauthorized={logout} />}
    </main>
  );
}

export default App;
