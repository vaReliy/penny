# GitHub Actions Secrets

This repository uses GitHub Actions secrets to pass sensitive configuration values (like API tokens and usernames) into CI/CD workflows and Docker image builds without storing them in version control.

## Adding a Secret

To add a new GitHub Actions secret to this repository:

1. Go to the repository on GitHub.
2. Navigate to **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
4. Enter the secret name (use `SCREAMING_SNAKE_CASE`) and value.
5. Click **Add secret**.

The secret will then be available to all workflows in the repository via the syntax `${{ secrets.SECRET_NAME }}`.

## Known Secrets

| Secret Name             | Purpose                                                                                                                                                     | Consumed by                                                                                                                                                                                                                   | Notes                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_USERNAME` | Telegram bot username used by the web application. The username is set from BotFather when the bot is created (e.g., `mypennybot`, without the `@` prefix). | `apps/web/Dockerfile` (build ARG) → generates `apps/web/src/environments/environment.ts` at build time via Docker build. Also consumed by GitHub Actions CI job `build-images` which passes it to `docker/build-push-action`. | Required for Docker image builds only. Local development uses `apps/web/src/environments/environment.development.ts` (generated from `environment.example.ts`). |

## Future Secrets

When adding a new secret in the future:

1. Add the entry to the table above.
2. Update the relevant workflow job or Dockerfile to use the secret (either via `${{ secrets.SECRET_NAME }}` in `.github/workflows/*.yml` or via build-args in the Dockerfile).
3. Add a comment in the code consuming the secret (see examples in `apps/web/Dockerfile` and `.github/workflows/ci.yml`) pointing to this document.
4. If the secret is used in a CI job, verify that the job's permissions are minimal (e.g., the `build-images` job sets `permissions: { contents: read }`, ensuring the job cannot modify repository content even if the secret is compromised).
