import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChefHat, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "./signin";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Create Your Kitchen — CookFlow" },
      { name: "description", content: "Join CookFlow and start planning cozy cooking days." },
    ],
  }),
  component: SignUpPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(1, "Tell us your name").max(80),
    email: z.string().trim().email("Please enter a valid email").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ fullName, email, password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName },
      },
    });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    // Make sure they land on sign in cleanly (auto-confirm is on, so a session
    // may have been created — sign out so the user goes through Sign In).
    await supabase.auth.signOut();
    setLoading(false);
    navigate({ to: "/auth/signin" });
  }

  return (
    <AuthShell title="Create your kitchen" subtitle="A warm welcome to CookFlow 🍞">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Baker"
            autoComplete="name"
            className="rounded-xl border-border bg-cream/50"
            required
          />
        </Field>
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
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className="rounded-xl border-border bg-cream/50"
            required
          />
        </Field>
        <Field label="Confirm password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            autoComplete="new-password"
            className="rounded-xl border-border bg-cream/50"
            required
          />
        </Field>

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
          {loading ? "Setting the table…" : "Create My Kitchen"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/signin" className="font-semibold text-terracotta hover:underline">
            Sign In
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
