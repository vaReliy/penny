/** DI injection tokens for the workspace domain. */
export const TOKENS = {
  MongoConnection: Symbol('WorkspaceMongoConnection'),
  WorkspaceRepository: Symbol('IWorkspaceRepository'),
  FindMembership: Symbol('FindMembershipService'),
  ListMyWorkspaces: Symbol('ListMyWorkspacesService'),
} as const;
