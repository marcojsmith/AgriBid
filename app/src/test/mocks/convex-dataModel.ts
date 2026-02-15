// Mock Convex DataModel types

export type Id<T extends string> = string & { __tableName: T };

export type Doc<T extends string> = {
  _id: Id<T>;
  _creationTime: number;
  [key: string]: any;
};