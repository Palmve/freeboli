import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = credentials.email.trim().toLowerCase();
        
        try {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          if (!url || !key) return null;

          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(url, key);
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, email, name, password_hash")
            .eq("email", email)
            .single();

          if (!profile) return null;
          
          if (profile.password_hash) {
            const { verifyPassword } = await import("@/lib/password");
            if (!credentials.password || !verifyPassword(credentials.password, profile.password_hash))
              return null;
          } else if (credentials.password) {
            return null;
          }

          return {
            id: profile.id,
            email: profile.email,
            name: profile.name,
          };
        } catch (e) {
          console.error("[NextAuth] authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        
        // Buscar perfil existente
        const { data: existing } = await supabase
          .from("profiles")
          .select("id, public_id")
          .eq("email", user.email)
          .single();

        if (!existing) {
          // Crear perfil nuevo de forma asíncrona si es posible, o atrapar error
          const publicId = Math.floor(Math.random() * 900000) + 100000;
          const { data: created, error: createError } = await supabase
            .from("profiles")
            .insert({
              email: user.email,
              name: user.name ?? user.email,
              image: (user as any).image ?? null,
              public_id: publicId,
              referral_code: String(publicId),
            })
            .select("id")
            .single();
          
          if (created && !createError) {
            // Tareas de bienvenida
            const { WELCOME_POINTS } = await import("@/lib/config");
            await Promise.all([
              supabase.from("balances").insert({ user_id: created.id, points: WELCOME_POINTS }),
              supabase.from("movements").insert({
                user_id: created.id,
                type: "recompensa",
                points: WELCOME_POINTS,
                metadata: { source: "bienvenida" },
              })
            ]).catch(e => console.error("Error en bienvenida:", e));
          }
        } else if (!existing.public_id) {
          const publicId = Math.floor(Math.random() * 900000) + 100000;
          try {
            await supabase.from("profiles").update({ public_id: publicId, referral_code: String(publicId) }).eq("id", existing.id);
          } catch {
            // Ignorar error no crítico
          }
        }
      } catch (e) {
        console.error("[NextAuth] signIn callback error:", e);
        // NO BLOQUEAR EL LOGIN si fallan tareas de perfil (mejor que entre y luego se arregle)
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as { user: { id?: string; isAdmin?: boolean } }).user.id = token.sub ?? undefined;
        try {
          const { isAdmin } = await import("@/lib/auth");
          (session as { user: { isAdmin?: boolean } }).user.isAdmin = isAdmin(session);
        } catch {
          (session as { user: { isAdmin?: boolean } }).user.isAdmin = false;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret:
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-secret-freeboli-min-32-chars" : undefined),
  debug: process.env.NODE_ENV === "development",
};
