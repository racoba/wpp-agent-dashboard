import type { ClinicStatus, Connection, Readiness, Role } from "@/lib/api/types";

/**
 * "Banco" do backend simulado.
 *
 * Fica no localStorage SÓ para que várias abas e recargas de página vejam o
 * mesmo "servidor", inclusive o `cookieJar`, que faz o papel do cookie httpOnly
 * de refresh. O código do app NUNCA lê nada daqui: só os handlers do MSW e o
 * painel de simulação (src/mocks/devtools.tsx). Os tokens são falsos.
 */

export interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  clinicId: string | null;
  mfaEnabled: boolean;
  pendingMfaSecret: string | null;
  recoveryCodes: string[];
}

export interface MockClinic {
  id: string;
  name: string;
  timezone: string;
  status: ClinicStatus;
  plan: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  monthlyMessageCap: number | null;
  messagesThisMonth: number;
  connectionHealth: "ok" | "attention" | "error";
}

export interface MockSession {
  id: string;
  userId: string;
  refreshToken: string;
  previousRefreshTokens: string[];
  revoked: boolean;
  mfaVerified: boolean;
  device: string;
  ip: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface MockFaults {
  /** Tokens de acesso emitidos antes disto (epoch ms) recebem TOKEN_EXPIRED. */
  expireIssuedBefore: number;
  nextServerError: boolean;
  nextInvalidToken: boolean;
  accessTtlSeconds: number;
  impersonationTtlSeconds: number;
}

export interface MockAuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  clinicId: string | null;
  details?: Record<string, unknown>;
}

export interface MockState {
  version: number;
  users: MockUser[];
  clinics: MockClinic[];
  sessions: MockSession[];
  connections: Array<Connection & { clinicId: string }>;
  readiness: Record<string, Omit<Readiness, "completed" | "total">>;
  cookieJar: { refreshToken: string | null };
  mfaTokens: Array<{ token: string; userId: string; expiresAt: number; used: boolean }>;
  resetTokens: Array<{ token: string; userId: string; expiresAt: number }>;
  faults: MockFaults;
  auditLog: MockAuditEntry[];
  /** Contador de chamadas a /auth/refresh (útil nos testes e no painel). */
  refreshCalls: number;
}

const STORAGE_KEY = "__wpp_mock_backend__";
const VERSION = 1;

export const MOCK_PASSWORD = "Senha@123";
export const MOCK_TOTP_CODE = "123456";

export const MOCK_ACCOUNTS = [
  { email: "admin@sorrisopleno.com.br", label: "Admin da clínica (sem MFA)" },
  { email: "recepcao@sorrisopleno.com.br", label: "Equipe da clínica" },
  { email: "gestora@vidaesaude.com.br", label: "Admin da clínica com MFA" },
  { email: "contato@auroraderm.com.br", label: "Clínica suspensa" },
  { email: "master@atende.app", label: "Master com MFA" },
  { email: "novo.master@atende.app", label: "Master sem MFA (força configuração)" },
] as const;

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

const EXTRA_CLINICS = [
  "Odonto Prime Centro", "Clínica Bem Viver", "Instituto Olhar Claro", "Fisio+ Movimento",
  "Pediatria Pequenos Passos", "Clínica Integrada São Lucas", "Dermato Leve", "Cardio Ritmo",
  "Espaço Mulher Ginecologia", "Nutri Equilíbrio", "Ortopedia Avançada Sul", "Psicologia Mente Aberta",
  "Clínica Sorriso Kids", "Otorrino Bem Ouvir", "Centro Médico Jardins", "Clínica Veredas",
  "Endocrino Vida", "Odonto Família Feliz", "Clínica Harmonia Estética", "Urologia Saúde do Homem",
  "Clínica Horizonte", "Pilates & Fisio Equilibrium", "Oftalmo Visão Total", "Clínica Raízes",
];

function seed(): MockState {
  const clinics: MockClinic[] = [
    {
      id: "cli_sorriso",
      name: "Clínica Sorriso Pleno",
      timezone: "America/Sao_Paulo",
      status: "active",
      plan: "Profissional",
      phone: "+55 11 3456-7890",
      email: "contato@sorrisopleno.com.br",
      address: "Av. Paulista, 1000, São Paulo, SP",
      createdAt: daysAgo(180),
      monthlyMessageCap: 5000,
      messagesThisMonth: 4310,
      connectionHealth: "attention",
    },
    {
      id: "cli_vida",
      name: "Clínica Vida & Saúde",
      timezone: "America/Manaus",
      status: "trial",
      plan: "Teste",
      phone: "+55 92 3234-5566",
      email: "contato@vidaesaude.com.br",
      address: "Rua das Flores, 210, Manaus, AM",
      createdAt: daysAgo(9),
      monthlyMessageCap: 1000,
      messagesThisMonth: 128,
      connectionHealth: "ok",
    },
    {
      id: "cli_aurora",
      name: "Aurora Dermatologia",
      timezone: "America/Sao_Paulo",
      status: "suspended",
      plan: "Essencial",
      phone: null,
      email: "contato@auroraderm.com.br",
      address: null,
      createdAt: daysAgo(400),
      monthlyMessageCap: 2000,
      messagesThisMonth: 0,
      connectionHealth: "error",
    },
    ...EXTRA_CLINICS.map((name, i): MockClinic => {
      const status: ClinicStatus = i % 9 === 4 ? "suspended" : i % 5 === 2 ? "trial" : "active";
      const cap = [2000, 5000, 10000][i % 3]!;
      return {
        id: `cli_${String(i + 1).padStart(3, "0")}`,
        name,
        timezone: i % 7 === 3 ? "America/Recife" : "America/Sao_Paulo",
        status,
        plan: status === "trial" ? "Teste" : ["Essencial", "Profissional", "Rede"][i % 3]!,
        phone: null,
        email: null,
        address: null,
        createdAt: daysAgo(20 + i * 11),
        monthlyMessageCap: cap,
        messagesThisMonth: status === "suspended" ? 0 : Math.round(cap * ((i * 37) % 100) / 100),
        connectionHealth: i % 6 === 1 ? "error" : i % 4 === 3 ? "attention" : "ok",
      };
    }),
  ];

  const users: MockUser[] = [
    { id: "usr_ana", name: "Ana Paula Ribeiro", email: "admin@sorrisopleno.com.br", role: "clinic_admin", clinicId: "cli_sorriso", mfaEnabled: false },
    { id: "usr_bruna", name: "Bruna Costa", email: "recepcao@sorrisopleno.com.br", role: "clinic_staff", clinicId: "cli_sorriso", mfaEnabled: false },
    { id: "usr_carla", name: "Carla Mendes", email: "gestora@vidaesaude.com.br", role: "clinic_admin", clinicId: "cli_vida", mfaEnabled: true },
    { id: "usr_diego", name: "Diego Lima", email: "contato@auroraderm.com.br", role: "clinic_admin", clinicId: "cli_aurora", mfaEnabled: false },
    { id: "usr_master", name: "Marina Alves", email: "master@atende.app", role: "master_admin", clinicId: null, mfaEnabled: true },
    { id: "usr_novo", name: "Rafael Souza", email: "novo.master@atende.app", role: "master_admin", clinicId: null, mfaEnabled: false },
  ].map((u) => ({
    ...(u as Omit<MockUser, "password" | "pendingMfaSecret" | "recoveryCodes">),
    password: MOCK_PASSWORD,
    pendingMfaSecret: null,
    recoveryCodes: u.mfaEnabled ? ["ABCD-EFGH", "JKLM-NPQR", "STUV-WXYZ"] : [],
  }));

  const sessions: MockSession[] = [
    {
      id: randomId("ses"),
      userId: "usr_ana",
      refreshToken: randomId("rt"),
      previousRefreshTokens: [],
      revoked: false,
      mfaVerified: false,
      device: "Safari no iPhone",
      ip: "177.32.10.4",
      createdAt: daysAgo(6),
      lastUsedAt: daysAgo(1),
    },
    {
      id: randomId("ses"),
      userId: "usr_ana",
      refreshToken: randomId("rt"),
      previousRefreshTokens: [],
      revoked: false,
      mfaVerified: false,
      device: "Firefox no Windows",
      ip: "189.40.2.77",
      createdAt: daysAgo(20),
      lastUsedAt: daysAgo(3),
    },
  ];

  const connections: MockState["connections"] = [
    {
      clinicId: "cli_sorriso",
      id: "con_wa_sorriso",
      type: "whatsapp",
      provider: "meta",
      status: "active",
      lastCheckedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      lastError: null,
      summary: { displayPhoneNumber: "+55 11 98765-4321", verifiedName: "Sorriso Pleno", businessVerification: "pending" },
    },
    {
      clinicId: "cli_sorriso",
      id: "con_gcal_sorriso",
      type: "calendar",
      provider: "google",
      status: "attention",
      lastCheckedAt: new Date(Date.now() - 32 * 60_000).toISOString(),
      lastError: "A conta Google conectada perdeu acesso a 1 calendário. Reconecte para continuar agendando.",
      summary: { account: "agenda@sorrisopleno.com.br", calendars: 3 },
    },
    {
      clinicId: "cli_vida",
      id: "con_wa_vida",
      type: "whatsapp",
      provider: "meta",
      status: "active",
      lastCheckedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      lastError: null,
      summary: { displayPhoneNumber: "+55 92 99123-4567", verifiedName: "Vida & Saúde", businessVerification: "verified" },
    },
  ];

  return {
    version: VERSION,
    users,
    clinics,
    sessions,
    connections,
    readiness: {
      cli_sorriso: { whatsapp: true, hasProfessionalWithCalendar: true, hasAvailability: true, agentActive: true },
      cli_vida: { whatsapp: true, hasProfessionalWithCalendar: false, hasAvailability: true, agentActive: false },
      cli_aurora: { whatsapp: false, hasProfessionalWithCalendar: false, hasAvailability: false, agentActive: false },
    },
    cookieJar: { refreshToken: null },
    mfaTokens: [],
    resetTokens: [],
    faults: {
      expireIssuedBefore: 0,
      nextServerError: false,
      nextInvalidToken: false,
      accessTtlSeconds: 15 * 60,
      impersonationTtlSeconds: 30 * 60,
    },
    auditLog: [],
    refreshCalls: 0,
  };
}

let memoryFallback: MockState | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readDb(): MockState {
  const store = storage();
  if (!store) return (memoryFallback ??= seed());
  const raw = store.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MockState;
      if (parsed.version === VERSION) return parsed;
    } catch {
      // cai para o seed
    }
  }
  const fresh = seed();
  store.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function writeDb(state: MockState) {
  const store = storage();
  if (!store) {
    memoryFallback = state;
    return;
  }
  store.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Lê, aplica a mudança e grava (cada handler usa isto). */
export function updateDb<T>(mutate: (state: MockState) => T): T {
  const state = readDb();
  const result = mutate(state);
  writeDb(state);
  return result;
}

export function resetDb() {
  memoryFallback = null;
  storage()?.removeItem(STORAGE_KEY);
}

export { now as isoNow };
