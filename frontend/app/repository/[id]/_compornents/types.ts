export type Repository = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
};

export type RepoNode = {
  readonly id: string;
  readonly parentRepositoryNodeId: string | null;
  readonly nodeType: string;
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly originalCreatedAt: string;
};

export type RepoBranch = {
  readonly repository_branch_id: string;
  readonly name: string;
  readonly nodes: ReadonlyArray<RepoNode>;
};
