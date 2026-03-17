import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    isAdmin?: boolean;
  }
  interface Session {
    user: User;
  }
}
