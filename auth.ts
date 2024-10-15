import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type { User } from './app/lib/definitions';
import bcrypt from 'bcrypt';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getUser(email: string): Promise<User | undefined> {
  try {
    // Use Prisma's findUnique method to fetch the user by email
    const user = await prisma.users.findUnique({
      where: { email: email },
    });

    // Return the user or undefined if not found
    return user || undefined;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) return user;
        }

        console.log('Invalid credentials.');
        return null;
      },
    }),
  ],
});
