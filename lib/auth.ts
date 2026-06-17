import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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

export const googleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const localAuthEnabled =
  process.env.LOCAL_AUTH_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_AUTH_ENABLED !== "false");

const localOwnerSessionId = "local-owner";

const gmailScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

const providers: NextAuthOptions["providers"] = [
  ...(googleOAuthConfigured
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: {
            params: {
              prompt: "consent",
              access_type: "offline",
              response_type: "code",
              scope: gmailScopes.join(" "),
            },
          },
        }),
      ]
    : []),
  ...(localAuthEnabled
    ? [
        CredentialsProvider({
          id: "local-owner",
          name: "Local owner",
          credentials: {},
          async authorize() {
            return {
              id: localOwnerSessionId,
              email: ownerEmail,
              name: "Anuj Wadi",
            };
          },
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
  },
  providers,
  callbacks: {
    async signIn({ user, profile }) {
      const email = (user.email || profile?.email || "").toLowerCase();
      return email === ownerEmail;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
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

  if (session.user.id === localOwnerSessionId) {
    const user = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });

    if (user) return user;

    return prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Anuj Wadi",
        role: "OWNER",
      },
    });
  }

  return prisma.user.findUnique({ where: { id: session.user.id } });
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
