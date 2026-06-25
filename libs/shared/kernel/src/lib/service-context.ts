/**
 * Identity of the authenticated caller invoking a service. Carries only
 * what authorization decisions need — never credentials or tokens.
 */
export interface CallerIdentity {
  readonly userId: string;
  readonly status: string;
  readonly roles: readonly string[];
}

/**
 * Per-request execution context passed into every `BaseService.run` call.
 *
 * `ServiceContext` is a pure type — the kernel only consumes it. Building
 * the concrete value (reading env vars, decoding a session/JWT into a
 * `CallerIdentity`) is the responsibility of the interface layer (HTTP
 * controller, CLI command, queue worker entry point), never the kernel or
 * any service. This keeps `process.env` and transport concerns out of the
 * framework-free core.
 *
 * @template TConfig - Shape of the injected configuration values a service
 * is allowed to read. Keep this typed and minimal — pass only the slice of
 * config a given service actually needs, not the whole app config.
 */
export interface ServiceContext<TConfig = unknown> {
  readonly config: TConfig;
  readonly caller: CallerIdentity | null;
}
