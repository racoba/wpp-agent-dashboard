# wpp-agent-dashboard

Painel web do agente de agendamento pelo WhatsApp: painel da **clínica** (`/app`) e do **master admin** (`/admin`).

Stack: Next.js 16 (App Router), TypeScript strict, Tailwind 4, shadcn/ui, TanStack Query, react-hook-form + Zod, Recharts, MSW, Vitest, Playwright.

## Rodando

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_MOCKING=enabled usa o mock
npm run dev
```

### Mock × API real

| Variável | Valor | Efeito |
|---|---|---|
| `NEXT_PUBLIC_API_MOCKING` | `enabled` | O MSW intercepta `/api/*` no navegador. |
| | `disabled` | Usa a API real. |
| `API_PROXY_TARGET` | ex. `http://localhost:3333` | O Next repassa `/api/*` ao backend, na mesma origem (o cookie de refresh funciona sem CORS). |

Com o mock ligado, o botão **Mock** (canto inferior esquerdo) simula os cenários de auth:
- expirar o token de acesso;
- `TOKEN_INVALID`;
- revogar a sessão;
- reuso do refresh token;
- erro 500;
- suspender a clínica;
- token de 30 s;
- impersonação de 1 min.

O mesmo painel lista as contas de teste.

| Conta | Perfil |
|---|---|
| `admin@sorrisopleno.com.br` | clinic_admin |
| `recepcao@sorrisopleno.com.br` | clinic_staff |
| `gestora@vidaesaude.com.br` | clinic_admin com MFA |
| `contato@auroraderm.com.br` | clínica suspensa |
| `master@atende.app` | master com MFA |
| `novo.master@atende.app` | master sem MFA (força a configuração) |

Senha de todas: `Senha@123`. Código MFA: `123456`. Códigos de recuperação: `ABCD-EFGH`, `JKLM-NPQR`, `STUV-WXYZ`.

> O "servidor" simulado guarda o estado em `localStorage` (`__wpp_mock_backend__`), inclusive o cookie de refresh simulado, para que várias abas vejam o mesmo backend. Só os handlers do MSW leem esse estado. O app nunca grava token em storage.

## Scripts

```bash
npm run typecheck
npm run lint
npm test            # Vitest + Testing Library (usa os mesmos handlers do MSW)
npm run build && npm run test:e2e   # Playwright contra o mock (sobe `next start` na porta 3100)
```

## Autenticação (resumo)

- O `accessToken` fica só em memória (`src/lib/auth/token-store.ts`). O refresh token é um cookie httpOnly que o JS não vê.
- **Interceptor** (`src/lib/api/client.ts`):
  - Bearer em `/clinic/*` e `/admin/*`;
  - `credentials: 'include'` e `X-Requested-With` em `/auth/*`;
  - `401 TOKEN_EXPIRED` faz um único refresh (single-flight) e repete a requisição uma vez;
  - `TOKEN_INVALID` e `SESSION_REVOKED` levam ao login com o motivo e a rota de retorno.
- **Renovação proativa** (`src/lib/auth/session.ts`): 60 s antes do `exp` e ao voltar o foco para a aba.
- **Ao recarregar a página:** o app primeiro pede o token a outra aba aberta (BroadcastChannel) e, se nenhuma responder, chama `/auth/refresh`.
- **Várias abas:**
  - a Web Locks API serializa o refresh (com fallback por BroadcastChannel);
  - o token novo e o logout são propagados para as outras abas;
  - se outra aba entrar com outro usuário, esta recarrega do zero.
- **Impersonação:** o token fica separado do token do master e não tem refresh. Uma faixa fixa mostra a contagem regressiva. Ao sair ou expirar, o master volta à tela de onde entrou.
- **Proteção de rotas:** a guarda é só no cliente (`RouteGuard` + `/auth/me`). O backend continua sendo a barreira real, e todo 403/423 é tratado.

Divergências e suposições sobre o contrato: [docs/contrato-divergencias.md](docs/contrato-divergencias.md).
