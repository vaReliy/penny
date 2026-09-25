/** DI injection tokens for the workspace domain within the CLI app. */
export const WORKSPACE_TOKENS = {
  WorkspaceRepository: Symbol('IWorkspaceRepository'),
  CreateWorkspace: Symbol('CreateWorkspaceService'),
  AddMember: Symbol('AddMemberService'),
  SetMemberRole: Symbol('SetMemberRoleService'),
  RemoveMember: Symbol('RemoveMemberService'),
  ListWorkspaces: Symbol('ListWorkspacesService'),
} as const;
