const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || "No fue posible completar la solicitud.", response.status);
  }
  return data;
}

export function login(correo, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: { correo, password },
  });
}

export function consultarPoliticas(pregunta, token) {
  return request("/api/chat/politicas", {
    method: "POST",
    body: { pregunta },
    token,
  });
}

export function consultarChat(pregunta, token) {
  return request("/api/chat/consulta", {
    method: "POST",
    body: { pregunta },
    token,
  });
}

export function obtenerHistorialRRHH(token, page = 1, colaboradorId = "") {
  const params = new URLSearchParams({ page: String(page), page_size: "10" });
  if (colaboradorId) params.set("colaborador_id", colaboradorId);
  return request(`/api/chat/consultas?${params.toString()}`, { token });
}

export function obtenerColaboradoresRRHH(token) {
  return request("/api/rrhh/colaboradores", { token });
}

export function obtenerReporteDiarioRRHH(token, colaboradorId, fecha) {
  const params = new URLSearchParams({ colaborador_id: String(colaboradorId), fecha });
  return request(`/api/rrhh/reportes-diarios?${params.toString()}`, { token });
}

export function obtenerDashboardRRHH(token, fecha) {
  const params = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return request(`/api/rrhh/dashboard${params}`, { token });
}

export function obtenerHistorialReportesRRHH(token, limit = 30) {
  return request(`/api/rrhh/reportes-diarios/historial?limit=${limit}`, { token });
}

export { ApiError };
