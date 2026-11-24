import { api } from "./client";
import type {
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

export const clinicApi = {
  getClinic: () => api<Clinic>("/clinic/clinic"),
  readiness: () => api<Readiness>("/clinic/readiness"),
  connections: () => api<Connection[]>("/clinic/connections"),
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
