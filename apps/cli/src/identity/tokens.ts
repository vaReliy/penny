/** DI injection tokens for the identity domain within the CLI app. */
export const TOKENS = {
  UserRepository: Symbol('IUserRepository'),
  ApproveUser: Symbol('ApproveUserService'),
  RejectUser: Symbol('RejectUserService'),
  MongoConnection: Symbol('MongoConnection'),
} as const;
