/**
 * Tipos do contrato da API, escritos à mão a partir da especificação.
 * Quando o backend publicar o OpenAPI, substituir por tipos gerados
 * (ex.: openapi-typescript) mantendo estes nomes como aliases.
 *
 * Campos marcados com "SUPOSIÇÃO" não estão explícitos no contrato e foram
 * definidos pelo frontend; ver docs/contrato-divergencias.md.
 */

// ---------------------------------------------------------------- comuns

export type Role = "master_admin" | "clinic_admin" | "clinic_staff";
export type ClinicRole = Extract<Role, "clinic_admin" | "clinic_staff">;

export type ApiErrorCode =
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "SESSION_REVOKED"
  | "FORBIDDEN"
  | "MFA_REQUIRED"
  | "IMPERSONATION_READ_ONLY"
  | "CLINIC_SUSPENDED"
  | "INVALID_CREDENTIALS"
  | "INVALID_MFA_CODE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | (string & {});

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

/** SUPOSIÇÃO: formato das listas paginadas por cursor. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export type IsoDateTime = string;
export type IsoDate = string;

// ---------------------------------------------------------------- auth

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  clinicId: string | null;
  /** SUPOSIÇÃO: necessário para forçar o assistente de MFA do master_admin. */
  mfaEnabled: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginOkResponse {
  status: "ok";
  accessToken: string;
  /** Segundos até expirar. */
  expiresIn: number;
  user: AuthUser;
}

export interface LoginMfaRequiredResponse {
  status: "mfa_required";
  mfaToken: string;
}

export type LoginResponse = LoginOkResponse | LoginMfaRequiredResponse;

export interface MfaVerifyRequest {
  mfaToken: string;
  /** Código TOTP de 6 dígitos ou código de recuperação. */
  code: string;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export type ClinicStatus = "active" | "suspended" | "trial";

export interface MeClinic {
  id: string;
  name: string;
  timezone: string;
  status: ClinicStatus;
}

export type Permission =
  | "clinic:read"
  | "clinic:write"
  | "catalog:write"
  | "agent:write"
  | "connections:manage"
  | "users:manage"
  | "conversations:read"
  | "contacts:read"
  | "contacts:reveal_phone"
  | "admin:access";

export interface MeResponse {
  user: AuthUser;
  clinic: MeClinic | null;
  permissions: Permission[];
}

export interface AuthSession {
  id: string;
  /** Ex.: "Chrome no Windows". */
  device: string;
  ip: string | null;
  createdAt: IsoDateTime;
  lastUsedAt: IsoDateTime;
  current: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

/** SUPOSIÇÃO: corpo da redefinição. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/** SUPOSIÇÃO: resposta de /auth/mfa/setup. */
export interface MfaSetupResponse {
  otpauthUrl: string;
  secret: string;
}

/** SUPOSIÇÃO: corpo e resposta de /auth/mfa/enable. */
export interface MfaEnableRequest {
  code: string;
}
export interface MfaEnableResponse {
  recoveryCodes: string[];
}

// ---------------------------------------------------------------- clínica

export interface Clinic {
  id: string;
  name: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface Readiness {
  whatsapp: boolean;
  hasProfessionalWithCalendar: boolean;
  hasAvailability: boolean;
  agentActive: boolean;
  completed: number;
  total: number;
}

export type ConnectionType = "whatsapp" | "calendar";
export type ConnectionStatus = "not_connected" | "connecting" | "active" | "attention" | "error";

export interface Connection {
  id: string;
  type: ConnectionType;
  provider: "meta" | "google" | "microsoft" | "caldav" | (string & {});
  status: ConnectionStatus;
  lastCheckedAt: IsoDateTime | null;
  lastError: string | null;
  summary: Record<string, unknown>;
}

// ---------------------------------------------------------------- admin

export interface AdminClinicListItem {
  id: string;
  name: string;
  status: ClinicStatus;
  plan: string;
  /** SUPOSIÇÃO: colunas de uso/saúde na listagem. */
  messagesThisMonth: number;
  monthlyMessageCap: number | null;
  connectionHealth: "ok" | "attention" | "error";
  createdAt: IsoDateTime;
}

export interface ImpersonateResponse {
  accessToken: string;
}

// ---------------------------------------------------------------- catálogo (Fase 2)

export type ClinicUpdate = Partial<Pick<Clinic, "name" | "timezone" | "phone" | "email" | "address">>;

/** SUPOSIÇÃO: formato do profissional. */
export interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  active: boolean;
  serviceIds: string[];
  /** Agenda vinculada (configurada na tela de Conexões). */
  calendar: { connectionId: string; calendarId: string; calendarName: string } | null;
}

export type ProfessionalInput = Pick<Professional, "name" | "specialty" | "active">;

/** SUPOSIÇÃO: formato do serviço. Preço em centavos. */
export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
  description: string | null;
  active: boolean;
}

export type ServiceInput = Omit<Service, "id">;

/** 0 = domingo … 6 = sábado. Horários "HH:mm" no fuso da clínica. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AvailabilityRule {
  weekday: Weekday;
  start: string;
  end: string;
}

/** SUPOSIÇÃO: GET/PUT /professionals/:id/availability usam { rules }. */
export interface Availability {
  rules: AvailabilityRule[];
}

/** SUPOSIÇÃO: exceção de dia inteiro, por profissional ou para a clínica toda (professionalId null). */
export interface AvailabilityException {
  id: string;
  professionalId: string | null;
  startsOn: IsoDate;
  endsOn: IsoDate;
  reason: string;
}

export type AvailabilityExceptionInput = Omit<AvailabilityException, "id">;

// ---------------------------------------------------------------- agente (Fase 2)

export type AgentTone = "friendly" | "neutral" | "formal";

/** SUPOSIÇÃO: formato de /agent-settings. */
export interface AgentSettings {
  tone: AgentTone;
  welcomeMessage: string;
  urgencyMessage: string;
  extraRules: string;
  /** Janela de atuação; null = 24 h todos os dias. */
  activeHours: { start: string; end: string; weekdays: Weekday[] } | null;
  /** Antecedência mínima para agendar, em minutos. */
  minAdvanceMinutes: number;
  consentMessage: string;
}

export interface PreviewMessage {
  role: "patient" | "agent";
  text: string;
}

export type PreviewActionType = "suggest_slots" | "would_book" | "would_cancel" | "would_reschedule" | "handoff";

/** SUPOSIÇÃO: prévia sem estado no servidor (o cliente manda o histórico). */
export interface AgentPreviewRequest {
  messages: PreviewMessage[];
  /** Testar com configurações ainda não salvas. */
  settings?: AgentSettings;
}

export interface AgentPreviewResponse {
  reply: string;
  actions: Array<{ type: PreviewActionType; description: string }>;
}
