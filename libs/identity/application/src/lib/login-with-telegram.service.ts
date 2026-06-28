import { BaseService } from 'shared-kernel';
import { User } from 'identity-core';
import { UserStatus } from 'shared-contracts';
import type { IUserRepository } from 'identity-core';
import type { TelegramLoginPayload } from 'shared-contracts';
import { InfrastructureError } from 'shared-errors';

/**
 * LIVR schema for the verified Telegram payload this service accepts.
 *
 * Distinct from `TELEGRAM_LOGIN_PAYLOAD_SCHEMA` in `shared-validation`: that
 * one validates the raw, unverified wire payload (snake_case, pre-HMAC
 * check); this one validates the already-verified, camelCase
 * `TelegramLoginPayload` produced by `VerifyTelegramLoginService` — the
 * boundary this service itself sits behind.
 */
const LOGIN_WITH_TELEGRAM_SCHEMA: Record<string, unknown> = {
  id: ['required', 'positive_integer'],
  firstName: ['required', 'string'],
  lastName: ['string'],
  username: ['string'],
  photoUrl: ['string'],
  authDate: ['required', 'positive_integer'],
  hash: ['required', 'string'],
};

/** Result of a {@link LoginWithTelegramService} call. */
export interface LoginWithTelegramResult {
  readonly user: User;
  readonly status: UserStatus;
}

/** Dependencies {@link LoginWithTelegramService} needs, injected via its constructor. */
export interface LoginWithTelegramDeps {
  readonly userRepository: IUserRepository;
}

/**
 * Turns an already-verified Telegram identity (see
 * `VerifyTelegramLoginService`) into a Penny `User`: finds the
 * user by their durable `telegramId`, creating a new `pending` user if none
 * exists yet, or refreshing mutable profile fields on an existing one.
 *
 * Framework-free `application` service — no DI decorators. Deliberately
 * does NOT mint a session/JWT here: only `active` users may
 * authenticate, so the interface layer (HTTP controller) is responsible for
 * inspecting the returned `status` and routing non-`active` users to an
 * access-status page instead of calling `ITokenIssuer.issue`.
 */
export class LoginWithTelegramService extends BaseService<
  TelegramLoginPayload,
  LoginWithTelegramResult
> {
  private readonly userRepository: IUserRepository;

  public constructor(deps: LoginWithTelegramDeps) {
    super();
    this.userRepository = deps.userRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return LOGIN_WITH_TELEGRAM_SCHEMA;
  }

  protected override async execute(
    params: TelegramLoginPayload,
  ): Promise<LoginWithTelegramResult> {
    const telegramId = String(params.id);
    const existing = await this.userRepository.findByTelegramId(telegramId);

    let user: User;
    if (existing) {
      const { firstName, lastName, username, photoUrl } = params;
      const updated = await this.userRepository.updateProfile(existing.id, {
        firstName,
        lastName,
        username,
        photoUrl,
      });
      if (!updated) {
        throw new InfrastructureError();
      }
      user = updated;
    } else {
      user = await this.userRepository.save(
        this.buildNewUser(telegramId, params),
      );
    }

    return { user, status: user.status };
  }

  /** Builds a brand-new `pending` `User` for a never-before-seen `telegramId`. */
  private buildNewUser(telegramId: string, params: TelegramLoginPayload): User {
    const now = new Date();

    return new User({
      // Placeholder id: the repository's `save` assigns the durable
      // persisted id on insert (see `MongoUserRepository.save`'s
      // `isValidObjectId` branch). Never persisted as-is.
      id: '',
      telegramId,
      firstName: params.firstName,
      lastName: params.lastName,
      username: params.username,
      photoUrl: params.photoUrl,
      status: UserStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    });
  }
}
