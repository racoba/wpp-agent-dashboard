import { api } from "./client";
import type {
  AgentPreviewRequest,
  AgentPreviewResponse,
  AgentSettings,
  Availability,
  AvailabilityException,
  AvailabilityExceptionInput,
  ClinicUpdate,
  Professional,
  ProfessionalInput,
  Service,
  ServiceInput,
  AdminClinicListItem,
  AuthSession,
  Clinic,
  ClinicStatus,
  Connection,
  CursorPage,
  ForgotPasswordRequest,
  ImpersonateResponse,
  LoginRequest,
  LoginResponse,
  LoginOkResponse,
  MeResponse,
  MfaEnableRequest,
  MfaEnableResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  Readiness,
  ResetPasswordRequest,
} from "./types";

/** Funções tipadas, uma por rota do contrato. Caminhos SEM o prefixo /api. */

export const authApi = {
  login: (body: LoginRequest) => api<LoginResponse>("/auth/login", { method: "POST", body }),
  verifyMfa: (body: MfaVerifyRequest) => api<LoginOkResponse>("/auth/mfa/verify", { method: "POST", body }),
  me: () => api<MeResponse>("/auth/me"),
  logoutAll: () => api<void>("/auth/logout-all", { method: "POST" }),
  sessions: () => api<AuthSession[]>("/auth/sessions"),
  deleteSession: (id: string) => api<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  forgotPassword: (body: ForgotPasswordRequest) => api<void>("/auth/forgot-password", { method: "POST", body }),
  resetPassword: (body: ResetPasswordRequest) => api<void>("/auth/reset-password", { method: "POST", body }),
  mfaSetup: () => api<MfaSetupResponse>("/auth/mfa/setup", { method: "POST" }),
  mfaEnable: (body: MfaEnableRequest) => api<MfaEnableResponse>("/auth/mfa/enable", { method: "POST", body }),
};

const id = (value: string) => encodeURIComponent(value);

export const clinicApi = {
  getClinic: () => api<Clinic>("/clinic/clinic"),
  updateClinic: (body: ClinicUpdate) => api<Clinic>("/clinic/clinic", { method: "PATCH", body }),
  readiness: () => api<Readiness>("/clinic/readiness"),
  connections: () => api<Connection[]>("/clinic/connections"),

  professionals: () => api<Professional[]>("/clinic/professionals"),
  createProfessional: (body: ProfessionalInput) => api<Professional>("/clinic/professionals", { method: "POST", body }),
  updateProfessional: (pid: string, body: Partial<ProfessionalInput>) =>
    api<Professional>(`/clinic/professionals/${id(pid)}`, { method: "PATCH", body }),
  deleteProfessional: (pid: string) => api<void>(`/clinic/professionals/${id(pid)}`, { method: "DELETE" }),
  setProfessionalServices: (pid: string, serviceIds: string[]) =>
    api<Professional>(`/clinic/professionals/${id(pid)}/services`, { method: "PUT", body: { serviceIds } }),

  services: () => api<Service[]>("/clinic/services"),
  createService: (body: ServiceInput) => api<Service>("/clinic/services", { method: "POST", body }),
  updateService: (sid: string, body: Partial<ServiceInput>) =>
    api<Service>(`/clinic/services/${id(sid)}`, { method: "PATCH", body }),
  deleteService: (sid: string) => api<void>(`/clinic/services/${id(sid)}`, { method: "DELETE" }),

  availability: (pid: string) => api<Availability>(`/clinic/professionals/${id(pid)}/availability`),
  setAvailability: (pid: string, body: Availability) =>
    api<Availability>(`/clinic/professionals/${id(pid)}/availability`, { method: "PUT", body }),
  exceptions: () => api<AvailabilityException[]>("/clinic/availability-exceptions"),
  createException: (body: AvailabilityExceptionInput) =>
    api<AvailabilityException>("/clinic/availability-exceptions", { method: "POST", body }),
  updateException: (eid: string, body: AvailabilityExceptionInput) =>
    api<AvailabilityException>(`/clinic/availability-exceptions/${id(eid)}`, { method: "PATCH", body }),
  deleteException: (eid: string) => api<void>(`/clinic/availability-exceptions/${id(eid)}`, { method: "DELETE" }),

  agentSettings: () => api<AgentSettings>("/clinic/agent-settings"),
  updateAgentSettings: (body: AgentSettings) => api<AgentSettings>("/clinic/agent-settings", { method: "PUT", body }),
  agentPreview: (body: AgentPreviewRequest) => api<AgentPreviewResponse>("/clinic/agent/preview", { method: "POST", body }),
  activateAgent: () => api<void>("/clinic/agent/activate", { method: "POST" }),
  deactivateAgent: () => api<void>("/clinic/agent/deactivate", { method: "POST" }),
};

/** Chaves do TanStack Query (prefixo "clinic" é limpo ao entrar/sair da impersonação). */
export const clinicKeys = {
  clinic: ["clinic", "clinic"] as const,
  readiness: ["clinic", "readiness"] as const,
  connections: ["clinic", "connections"] as const,
  professionals: ["clinic", "professionals"] as const,
  services: ["clinic", "services"] as const,
  availability: (pid: string) => ["clinic", "availability", pid] as const,
  exceptions: ["clinic", "exceptions"] as const,
  agentSettings: ["clinic", "agent-settings"] as const,
};

export interface AdminClinicsQuery {
  q?: string;
  status?: ClinicStatus;
  cursor?: string | null;
}

export const adminApi = {
  clinics: (query: AdminClinicsQuery = {}) =>
    api<CursorPage<AdminClinicListItem>>("/admin/clinics", { query: { ...query } }),
  impersonate: (clinicId: string) =>
    api<ImpersonateResponse>(`/admin/clinics/${encodeURIComponent(clinicId)}/impersonate`, { method: "POST" }),
};
