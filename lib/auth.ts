import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in as the app owner.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export const ownerEmail = (
  process.env.OWNER_EMAIL || "awadi@asu.edu"
).toLowerCase();

const gmailScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "missing-google-client-id",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "missing-google-client-secret",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: gmailScopes.join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = (user.email || profile?.email || "").toLowerCase();
      return email === ownerEmail;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = "OWNER";
      }

      return session;
    },
  },
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!session?.user?.id || email !== ownerEmail) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function getGmailConnection(userId: string) {
  return prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      id: true,
      scope: true,
      expires_at: true,
      access_token: true,
      refresh_token: true,
    },
  });
}
