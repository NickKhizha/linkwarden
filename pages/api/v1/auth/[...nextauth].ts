import { prisma } from "@/lib/api/db";
import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import { AuthOptions, Session, User } from "next-auth";
import bcrypt from "bcrypt";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Adapter } from "next-auth/adapters";
import sendVerificationRequest from "@/lib/api/sendVerificationRequest";
import { Provider } from "next-auth/providers";
import checkSubscription from "@/lib/api/checkSubscription";

const emailEnabled =
  process.env.EMAIL_FROM && process.env.EMAIL_SERVER ? true : false;

const providers: Provider[] = [
  CredentialsProvider({
    type: "credentials",
    credentials: {},
    async authorize(credentials, req) {
      console.log("User logged in...");
      if (!credentials) return null;

      const { username, password } = credentials as {
        username: string;
        password: string;
      };

      const findUser = await prisma.user.findFirst({
        where: emailEnabled
          ? {
              OR: [
                {
                  username: username.toLowerCase(),
                },
                {
                  email: username?.toLowerCase(),
                },
              ],
              emailVerified: { not: null },
            }
          : {
              username: username.toLowerCase(),
            },
      });

      let passwordMatches: boolean = false;

      if (findUser?.password) {
        passwordMatches = bcrypt.compareSync(password, findUser.password);
      }

      if (passwordMatches) {
        return findUser;
      } else return null as any;
    },
  }),
];

if (emailEnabled)
  providers.push(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      maxAge: 1200,
      sendVerificationRequest(params) {
        sendVerificationRequest(params);
      },
    })
  );

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers,
  pages: {
    signIn: "/login",
    verifyRequest: "/confirmation",
  },
  callbacks: {
    async jwt({ token, trigger, user }) {
      const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

      const NEXT_PUBLIC_TRIAL_PERIOD_DAYS =
        process.env.NEXT_PUBLIC_TRIAL_PERIOD_DAYS;
      const secondsInTwoWeeks = NEXT_PUBLIC_TRIAL_PERIOD_DAYS
        ? Number(NEXT_PUBLIC_TRIAL_PERIOD_DAYS) * 86400
        : 1209600;
      const subscriptionIsTimesUp =
        token.subscriptionCanceledAt &&
        new Date() >
          new Date(
            ((token.subscriptionCanceledAt as number) + secondsInTwoWeeks) *
              1000
          );

      if (
        STRIPE_SECRET_KEY &&
        (trigger || subscriptionIsTimesUp || !token.isSubscriber)
      ) {
        const subscription = await checkSubscription(
          STRIPE_SECRET_KEY,
          token.email as string
        );

        if (subscription.subscriptionCanceledAt) {
          token.subscriptionCanceledAt = subscription.subscriptionCanceledAt;
        } else token.subscriptionCanceledAt = undefined;

        token.isSubscriber = subscription.isSubscriber;
      }

      if (trigger === "signIn") {
        token.id = user.id as number;
        token.username = (user as any).username;
      } else if (trigger === "update" && token.id) {
        console.log(token);

        const user = await prisma.user.findUnique({
          where: {
            id: token.id as number,
          },
        });

        if (user?.name && user.username && user.email) {
          token.name = user.name;
          token.username = user.username?.toLowerCase();
          token.email = user.email?.toLowerCase();
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.isSubscriber = token.isSubscriber;

      return session;
    },
  },
};

export default NextAuth(authOptions);
