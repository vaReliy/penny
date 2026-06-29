# identity-application

**Tags:** `scope:identity` · `type:application` · `platform:server`

Use-case services: `LoginWithTelegramService` (HMAC verify → find-or-create → JWT), `ApproveUserService`, `RejectUserService`. Plain TypeScript — no `@Injectable()`, no framework imports. May import `scope:identity` core + `scope:shared` kernel/contracts/errors/util/validation.
