/** DI injection tokens for the identity domain. */
export const TOKENS = {
  UserRepository: Symbol('IUserRepository'),
  TokenIssuer: Symbol('ITokenIssuer'),
  VerifyTelegramLogin: Symbol('VerifyTelegramLoginService'),
  LoginWithTelegram: Symbol('LoginWithTelegramService'),
  ApproveUser: Symbol('ApproveUserService'),
  RejectUser: Symbol('RejectUserService'),
  MongoConnection: Symbol('MongoConnection'),
} as const;
