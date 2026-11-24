# Divergências e suposições em relação ao contrato da API

Pontos em que o contrato não define o comportamento e o frontend precisou assumir algo. Cada item marcado como **SUPOSIÇÃO** em `src/lib/api/types.ts` está listado aqui. Ao validar com o backend, ajuste o tipo e remova o item.

## Autenticação

| # | Ponto | O que o frontend assume | Por quê |
|---|---|---|---|
| A1 | `AuthUser.mfaEnabled` | O `user` do login e do `/auth/me` traz `mfaEnabled: boolean`. | Sem isso, o front não sabe que precisa forçar o assistente de MFA do master. |
| A2 | Master sem MFA configurado | O login devolve `status:'ok'`. A sessão fica "não verificada" e `/api/admin/*` responde `403 MFA_REQUIRED` até o `/auth/mfa/enable`. | O contrato diz que o MFA é obrigatório para master, mas não cobre quem ainda não o configurou. |
| A3 | Depois do `/auth/mfa/enable` | A sessão atual passa a constar como verificada. O front chama `/auth/refresh` para obter um token com essa informação e recarrega o `/auth/me`. | Não está definido se o `enable` devolve tokens novos. |
| A4 | `/auth/mfa/setup` | Resposta `{ otpauthUrl, secret }`. | Formato não especificado. |
| A5 | `/auth/mfa/enable` | Corpo `{ code }` e resposta `{ recoveryCodes: string[] }`. | Formato não especificado. |
| A6 | Códigos de recuperação | São aceitos no mesmo campo `code` de `/auth/mfa/verify`. | O contrato só cita o TOTP. |
| A7 | `mfaToken` expirado ou já usado | `401 TOKEN_EXPIRED` ou `401 TOKEN_INVALID` em `/auth/mfa/verify`. O front volta para e-mail e senha com um aviso. | Código não especificado. Como `/auth/mfa/verify` é uma rota pública de auth, esse 401 não dispara refresh. |
| A8 | Credenciais inválidas e código errado | `401 INVALID_CREDENTIALS` e `401 INVALID_MFA_CODE`. Limite de tentativas: `429 RATE_LIMITED`. | Códigos não listados no contrato. |
| A9 | `/auth/reset-password` | Corpo `{ token, password }`. Token inválido: `400 TOKEN_INVALID`. | Formato não especificado. O front lê o token de `#token=` (preferido: não vai ao servidor nem ao Referer) ou de `?token=`, e o remove da URL. **Pedido ao backend:** gerar o link do e-mail com `#token=`. |
| A10 | Bearer nas rotas `/auth/*` autenticadas | `me`, `sessions`, `logout`, `logout-all`, `mfa/setup` e `mfa/enable` recebem `Authorization: Bearer`, além do cookie e do `X-Requested-With`. | O contrato só exige Bearer em `/clinic/*` e `/admin/*`, mas essas rotas precisam identificar o usuário. Se o backend usar só o cookie, o Bearer a mais é inofensivo. |
| A11 | CSRF | O front envia `X-Requested-With: XMLHttpRequest` em todas as rotas `/auth/*`. Nas rotas com Bearer, usa `credentials: 'omit'`. | O mock rejeita o refresh sem esse cabeçalho (`403 CSRF_REJECTED`). |
| A12 | `/auth/sessions` | Array de `{ id, device, ip, createdAt, lastUsedAt, current }`. | Formato não especificado (será usado na Fase 4). |
| A13 | Reuso do refresh token | Um refresh token antigo reapresentado revoga a sessão e devolve `401 SESSION_REVOKED`. | Comportamento simulado no mock. O front já serializa os refreshes entre abas para não disparar esse caso. |
| A14 | Falha de rede ou 5xx no refresh | **Não** encerra a sessão: o erro sobe e a tela oferece "tentar novamente". Só 401/403 no refresh levam ao login. | Evita deslogar o usuário por uma oscilação de rede. |
| A15 | Token de impersonação | É um JWT com `exp`. O front lê o `exp` (sem validar) para o contador e o encerramento automático. Se não conseguir ler, assume 30 min. Durante a impersonação, só `/api/clinic/*` usa esse token. | — |

## Painel da clínica e admin

| # | Ponto | Suposição |
|---|---|---|
| C1 | Caminhos | O contrato lista `GET /clinic` dentro de `/api/clinic/*`, então o caminho real fica `/api/clinic/clinic`. Idem para `/api/clinic/readiness`, `/api/clinic/connections` etc. |
| C2 | `/auth/me` | `{ user, clinic: { id, name, timezone, status } \| null, permissions: Permission[] }`. Os nomes das permissões estão em `src/lib/api/types.ts`. Se a lista vier vazia, o front usa um mapa por papel como reserva. |
| C3 | Paginação por cursor | `{ items: T[], nextCursor: string \| null }`. A ordenação das tabelas é feita no cliente, só na página carregada, porque o contrato não tem parâmetros de ordenação. **Pedido ao backend:** `sort`/`order` nas listagens. |
| C4 | `GET /admin/clinics` | Aceita `q`, `status` e `cursor`. Cada item traz `messagesThisMonth`, `monthlyMessageCap` e `connectionHealth` (`ok`/`attention`/`error`) para as colunas de uso e saúde. |
| C5 | `Connection.status` | `not_connected \| connecting \| active \| attention \| error`, que correspondem aos cinco selos pedidos. |
