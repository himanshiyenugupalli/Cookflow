import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";
import { z } from "zod";
import doodles from "@/assets/cozy-doodles.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth/signin")({
  head: () => ({
    meta: [
      { title: "Welcome Back — CookFlow" },
      { name: "description", content: "Sign in to your CookFlow kitchen." },
    ],
  }),
  component: SignInPage,
});

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!remember) {
      // For session-only, sign out the persisted token on tab close
      try {
        window.addEventListener("beforeunload", () => supabase.auth.signOut());
      } catch {}
    }
    navigate({ to: "/" });
  }

  return (
    <AuthShell title="Welcome back" subtitle="A warm kitchen awaits 🍂">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@kitchen.com"
            autoComplete="email"
            className="rounded-xl border-border bg-cream/50"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="rounded-xl border-border bg-cream/50"
            required
          />
        </Field>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-cocoa/80">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-3.5 accent-terracotta"
            />
            Remember me
          </label>
          <span className="text-muted-foreground">Forgot password? Reach out soon ✨</span>
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-full bg-terracotta text-base font-semibold text-white shadow-cozy hover:bg-terracotta/90"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ChefHat className="size-4" />}
          {loading ? "Opening the kitchen…" : "Welcome Back"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/auth/signup" className="font-semibold text-terracotta hover:underline">
            Create your kitchen
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cocoa/70">{label}</p>
      {children}
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-cocoa shadow-soft">
            <ChefHat className="size-3.5 text-terracotta" />
            Your cozy cooking companion
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-cocoa">
            Cook<span className="text-terracotta">Flow</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Plan. Cook. Enjoy. <span className="text-terracotta">✿</span>
          </p>
          <img src={doodles} alt="" className="mx-auto mt-1 w-full max-w-xs opacity-90" />
        </div>

        <div className="cozy-card mt-2 p-6 sm:p-7">
          <h2 className="text-2xl font-bold text-cocoa">{title}</h2>
          <p className="mb-5 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Made with <span className="text-terracotta">♥</span> for home cooks · CookFlow
        </p>
      </div>
    </main>
  );
}
