import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ChefHat,
  Clock,
  Sparkles,
  RefreshCcw,
  ShoppingBasket,
  Wand2,
  Coffee,
  Soup,
  Utensils,
  CheckCircle2,
  Circle,
  Wallet,
  Send,
  Trash2,
  LogOut,
  Heart,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ListChecks,
  History,
  Users,
  Lightbulb,
} from "lucide-react";

import doodles from "@/assets/cozy-doodles.png";
import { generatePlan, type CookFlowPlan, type CookFlowMeal } from "@/lib/plan.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: CookFlowHome,
});

const VIBE_CHIPS = [
  "Busy workday",
  "Relaxed evening",
  "Family dinner",
  "Quick & healthy",
  "On a budget",
  "Cozy rainy day",
  "Date night",
  "Meal prep",
];

const PEOPLE_OPTIONS = ["1", "2", "3-4", "5+"];
const TIME_OPTIONS = ["< 30 min", "30–60 min", "1–2 hrs", "Lots of time"];
const BUDGET_OPTIONS = ["Tight", "Comfy", "Splurge"];

type SavedState = {
  plan: CookFlowPlan | null;
  checks: Record<string, boolean>;
  groceryChecks: Record<string, boolean>;
};

type SavedRecipe = { id: string; meal: CookFlowMeal; savedAt: number };
type RecentPlan = { id: string; vibeTag: string; savedAt: number; plan: CookFlowPlan };

const STORAGE_KEY = "cookflow.state.v2";
const FAVORITES_KEY = "cookflow.favorites.v1";
const RECENT_KEY = "cookflow.recent.v1";

function loadSaved(): SavedState {
  if (typeof window === "undefined") return { plan: null, checks: {}, groceryChecks: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { plan: null, checks: {}, groceryChecks: {} };
    return JSON.parse(raw);
  } catch {
    return { plan: null, checks: {}, groceryChecks: {} };
  }
}
function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function CookFlowHome() {
  const [prompt, setPrompt] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [people, setPeople] = useState("2");
  const [diet, setDiet] = useState("");
  const [time, setTime] = useState("30–60 min");
  const [budget, setBudget] = useState("Comfy");
  const [pantry, setPantry] = useState("");

  const [plan, setPlan] = useState<CookFlowPlan | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [groceryChecks, setGroceryChecks] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<SavedRecipe[]>([]);
  const [recent, setRecent] = useState<RecentPlan[]>([]);
  const planRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = loadSaved();
    if (s.plan) setPlan(s.plan);
    if (s.checks) setChecks(s.checks);
    if (s.groceryChecks) setGroceryChecks(s.groceryChecks);
    setFavorites(loadJSON<SavedRecipe[]>(FAVORITES_KEY, []));
    setRecent(loadJSON<RecentPlan[]>(RECENT_KEY, []));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ plan, checks, groceryChecks } satisfies SavedState),
    );
  }, [plan, checks, groceryChecks]);

  const persistFavorites = (next: SavedRecipe[]) => {
    setFavorites(next);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };
  const persistRecent = (next: RecentPlan[]) => {
    setRecent(next);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const mutation = useMutation({
    mutationFn: async () =>
      generatePlan({
        data: {
          prompt: prompt.trim() || "A balanced cozy cooking day.",
          vibes,
          people,
          diet,
          time,
          budget,
          pantry,
        },
      }),
    onSuccess: (data) => {
      setPlan(data);
      setChecks({});
      setGroceryChecks({});
      const entry: RecentPlan = {
        id: `${Date.now()}`,
        vibeTag: data.vibeTag,
        savedAt: Date.now(),
        plan: data,
      };
      persistRecent([entry, ...recent].slice(0, 6));
      setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    },
  });

  const regenerateMeal = useMutation({
    mutationFn: async (slot: "breakfast" | "lunch" | "dinner") => {
      if (!plan) throw new Error("No plan");
      const result = await generatePlan({
        data: {
          prompt: `Replace ONLY the ${slot} from the existing plan with a fresh idea. Original ${slot}: ${plan.meals[slot].name}. Keep tone cozy.`,
          vibes,
          people,
          diet,
          time,
          budget,
          pantry,
        },
      });
      return { slot, meal: result.meals[slot] };
    },
    onSuccess: ({ slot, meal }) => {
      if (!plan) return;
      setPlan({ ...plan, meals: { ...plan.meals, [slot]: meal } });
    },
  });

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const clearPlan = () => {
    setPlan(null);
    setChecks({});
    setGroceryChecks({});
  };

  const saveRecipe = (meal: CookFlowMeal) => {
    if (favorites.some((f) => f.meal.name === meal.name)) return;
    persistFavorites([{ id: `${Date.now()}-${meal.name}`, meal, savedAt: Date.now() }, ...favorites]);
  };
  const removeFavorite = (id: string) => persistFavorites(favorites.filter((f) => f.id !== id));
  const isFavorited = (meal: CookFlowMeal) => favorites.some((f) => f.meal.name === meal.name);

  return (
    <main className="min-h-screen">
      <AppHeader />

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6">
        <InputCard
          prompt={prompt}
          setPrompt={setPrompt}
          vibes={vibes}
          toggleVibe={toggleVibe}
          people={people}
          setPeople={setPeople}
          diet={diet}
          setDiet={setDiet}
          time={time}
          setTime={setTime}
          budget={budget}
          setBudget={setBudget}
          pantry={pantry}
          setPantry={setPantry}
          loading={mutation.isPending}
          onGenerate={() => mutation.mutate()}
          hasPlan={!!plan}
          onClear={clearPlan}
        />

        {mutation.isError && (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Hmm, something burned in the oven. Try again in a moment.
          </p>
        )}

        {mutation.isPending && <CozyLoader />}

        {recent.length > 0 && !plan && (
          <RecentPlans
            recent={recent}
            onOpen={(p) => {
              setPlan(p);
              setChecks({});
              setGroceryChecks({});
              setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
            }}
            onClear={() => persistRecent([])}
          />
        )}
      </section>

      {plan && (
        <section ref={planRef} className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <PlanView
            plan={plan}
            checks={checks}
            setChecks={setChecks}
            groceryChecks={groceryChecks}
            setGroceryChecks={setGroceryChecks}
            onRegenerate={() => mutation.mutate()}
            regenerating={mutation.isPending}
            onRegenerateMeal={(slot) => regenerateMeal.mutate(slot)}
            regeneratingMeal={regenerateMeal.isPending ? regenerateMeal.variables ?? null : null}
            onSaveRecipe={saveRecipe}
            isFavorited={isFavorited}
          />
          <ChatRefine plan={plan} />
        </section>
      )}

      {favorites.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <FavoritesSection favorites={favorites} onRemove={removeFavorite} />
        </section>
      )}

      <footer className="border-t border-border/60 bg-beige/40 py-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">
          Made with <span className="text-terracotta">♥</span> for home cooks · CookFlow
        </p>
      </footer>
    </main>
  );
}

function AppHeader() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { name: "Friend", initial: "F", email: "" };
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      const name = data?.full_name || u.user.email?.split("@")[0] || "Friend";
      return {
        name,
        initial: name.trim().charAt(0).toUpperCase() || "F",
        email: u.user.email ?? "",
      };
    },
  });

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth/signin", replace: true });
  };

  return (
    <header className="relative overflow-hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-5 sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-cocoa shadow-soft">
          <ChefHat className="size-3.5 text-terracotta" />
          Your cozy cooking companion
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-cocoa shadow-soft sm:inline-flex">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-terracotta text-[11px] font-bold text-white">
              {profile?.initial ?? "·"}
            </span>
            <span className="max-w-[140px] truncate">{profile?.name ?? "…"}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSignOut}
            className="rounded-full border-cocoa/20 bg-card text-cocoa hover:bg-beige"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-2 pt-6 text-center sm:px-6 sm:pt-10">
        <h1 className="text-4xl font-bold tracking-tight text-cocoa sm:text-5xl">
          Cook<span className="text-terracotta">Flow</span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Welcome back, <span className="font-semibold text-cocoa">{profile?.name ?? "friend"}</span> ·
          Plan. Cook. Enjoy. <span className="text-terracotta">✿</span>
        </p>
        <img
          src={doodles}
          alt=""
          width={1280}
          height={640}
          className="mx-auto mt-2 w-full max-w-md opacity-90"
        />
      </div>
    </header>
  );
}

type InputCardProps = {
  prompt: string;
  setPrompt: (s: string) => void;
  vibes: string[];
  toggleVibe: (v: string) => void;
  people: string;
  setPeople: (s: string) => void;
  diet: string;
  setDiet: (s: string) => void;
  time: string;
  setTime: (s: string) => void;
  budget: string;
  setBudget: (s: string) => void;
  pantry: string;
  setPantry: (s: string) => void;
  loading: boolean;
  onGenerate: () => void;
  hasPlan: boolean;
  onClear: () => void;
};

function InputCard(p: InputCardProps) {
  return (
    <div className="cozy-card p-5 sm:p-7">
      <label className="mb-2 block text-sm font-semibold text-cocoa">
        Tell me about your day
      </label>
      <Textarea
        value={p.prompt}
        onChange={(e) => p.setPrompt(e.target.value)}
        placeholder="e.g. Long work day, just my partner and me, want something warming and easy after 7pm…"
        className="min-h-[96px] resize-none rounded-2xl border-border bg-cream/50 text-cocoa placeholder:text-muted-foreground focus-visible:ring-terracotta"
      />

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Today's vibe
        </p>
        <div className="flex flex-wrap gap-2">
          {VIBE_CHIPS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => p.toggleVibe(v)}
              className={cn("cozy-chip", p.vibes.includes(v) && "cozy-chip-active")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ChipGroup label="People" value={p.people} onChange={p.setPeople} options={PEOPLE_OPTIONS} />
        <ChipGroup label="Time available" value={p.time} onChange={p.setTime} options={TIME_OPTIONS} />
        <ChipGroup label="Budget" value={p.budget} onChange={p.setBudget} options={BUDGET_OPTIONS} />
        <Field label="Dietary (optional)">
          <Input
            value={p.diet}
            onChange={(e) => p.setDiet(e.target.value)}
            placeholder="vegetarian, gluten-free…"
            className="rounded-xl border-border bg-cream/50"
          />
        </Field>
      </div>

      <Field className="mt-4" label="Ingredients I already have (optional)">
        <Textarea
          value={p.pantry}
          onChange={(e) => p.setPantry(e.target.value)}
          placeholder="eggs, spinach, brown rice, half an onion…"
          className="min-h-[64px] resize-none rounded-2xl border-border bg-cream/50"
        />
      </Field>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {p.hasPlan ? (
          <button
            onClick={p.onClear}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-cocoa"
          >
            <Trash2 className="size-3.5" /> Clear saved plan
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Saved locally in your browser ✨</span>
        )}
        <Button
          onClick={p.onGenerate}
          disabled={p.loading}
          className="h-12 rounded-full bg-terracotta px-7 text-base font-semibold text-white shadow-cozy hover:bg-terracotta/90"
        >
          <Sparkles className="size-4" />
          {p.loading ? "Cooking up your plan…" : "Plan my cooking day"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ChipGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn("cozy-chip text-xs", value === o && "cozy-chip-active")}
          >
            {o}
          </button>
        ))}
      </div>
    </Field>
  );
}

function CozyLoader() {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-terracotta/30 bg-card/60 px-6 py-8 text-center">
      <div className="relative">
        <div className="whisk-spin inline-flex size-12 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
          <ChefHat className="size-6" />
        </div>
      </div>
      <p className="text-sm font-medium text-cocoa">Stirring up something cozy…</p>
      <p className="text-xs text-muted-foreground">
        Picking recipes, balancing your day, packing the grocery basket
      </p>
    </div>
  );
}

/* ---------- Plan view ---------- */

function PlanView({
  plan,
  checks,
  setChecks,
  groceryChecks,
  setGroceryChecks,
  onRegenerate,
  regenerating,
  onRegenerateMeal,
  regeneratingMeal,
  onSaveRecipe,
  isFavorited,
}: {
  plan: CookFlowPlan;
  checks: Record<string, boolean>;
  setChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  groceryChecks: Record<string, boolean>;
  setGroceryChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onRegenerate: () => void;
  regenerating: boolean;
  onRegenerateMeal: (slot: "breakfast" | "lunch" | "dinner") => void;
  regeneratingMeal: "breakfast" | "lunch" | "dinner" | null;
  onSaveRecipe: (meal: CookFlowMeal) => void;
  isFavorited: (meal: CookFlowMeal) => boolean;
}) {
  return (
    <div className="space-y-6">
      <PantryHeroAndVibe
        score={plan.pantryScore}
        message={plan.pantryMessage}
        vibe={plan.vibeTag}
        totalTime={plan.totalCookTime}
        onRegenerate={onRegenerate}
        regenerating={regenerating}
      />

      {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
        <MealCard
          key={slot}
          meal={plan.meals[slot]}
          label={slot[0].toUpperCase() + slot.slice(1)}
          icon={slot === "breakfast" ? <Coffee className="size-4" /> : slot === "lunch" ? <Soup className="size-4" /> : <Utensils className="size-4" />}
          slotKey={slot}
          checks={checks}
          setChecks={setChecks}
          onRegenerate={() => onRegenerateMeal(slot)}
          regenerating={regeneratingMeal === slot}
          onSave={() => onSaveRecipe(plan.meals[slot])}
          favorited={isFavorited(plan.meals[slot])}
        />
      ))}

      <GroceryCard groups={plan.grocery} checks={groceryChecks} setChecks={setGroceryChecks} />

      <SubstitutesCard items={plan.substitutes} />
      <BudgetCard budget={plan.budget} />
      <LeftoverCard items={plan.leftoverMagic} />
    </div>
  );
}

function PantryHeroAndVibe({
  score,
  message,
  vibe,
  totalTime,
  onRegenerate,
  regenerating,
}: {
  score: number;
  message: string;
  vibe: string;
  totalTime: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="cozy-card overflow-hidden">
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/15 px-3 py-1 text-xs font-semibold text-terracotta">
              <Sparkles className="size-3" /> {vibe}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-beige px-3 py-1 text-xs font-medium text-cocoa">
              <Clock className="size-3" /> {totalTime}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-cocoa">
            Pantry Hero: {clamped}% <span className="ml-1">🍳</span>
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-beige">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${clamped}%`, backgroundColor: "var(--terracotta)" }}
            />
          </div>
        </div>
        <Button
          onClick={onRegenerate}
          disabled={regenerating}
          variant="outline"
          className="h-11 self-start rounded-full border-cocoa/20 bg-card text-cocoa hover:bg-beige sm:self-center"
        >
          <RefreshCcw className={cn("size-4", regenerating && "whisk-spin")} />
          Regenerate
        </Button>
      </div>
    </div>
  );
}

function MealCard({
  meal,
  label,
  icon,
  slotKey,
  checks,
  setChecks,
  onRegenerate,
  regenerating,
  onSave,
  favorited,
}: {
  meal: CookFlowMeal;
  label: string;
  icon: React.ReactNode;
  slotKey: string;
  checks: Record<string, boolean>;
  setChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onRegenerate: () => void;
  regenerating: boolean;
  onSave: () => void;
  favorited: boolean;
}) {
  const [recipeOpen, setRecipeOpen] = useState(true);
  const [todoOpen, setTodoOpen] = useState(true);

  return (
    <article className="cozy-card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cocoa px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cream">
          {icon} {label}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" /> {meal.cookTime}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3" /> {meal.servings}
        </span>
        <span className="text-xs text-muted-foreground">· {meal.difficulty}</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-cocoa">{meal.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{meal.description}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onSave}
            title={favorited ? "Saved" : "Save recipe"}
            className={cn(
              "rounded-full border-cocoa/20 bg-card hover:bg-beige",
              favorited && "border-terracotta/40 bg-terracotta/10",
            )}
          >
            <Heart
              className={cn("size-3.5", favorited ? "fill-terracotta text-terracotta" : "text-cocoa/70")}
            />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onRegenerate}
            disabled={regenerating}
            title="Regenerate this meal"
            className="rounded-full border-cocoa/20 bg-card hover:bg-beige"
          >
            <RefreshCcw className={cn("size-3.5 text-cocoa/70", regenerating && "whisk-spin")} />
          </Button>
        </div>
      </div>

      {/* Ingredients */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cocoa/70">
          Ingredients
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {meal.ingredients.map((ing, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                ing.have
                  ? "border-sage/40 bg-sage/10 text-cocoa"
                  : "border-dashed border-border bg-cream/40 text-cocoa",
              )}
            >
              {ing.have ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-cocoa/40" />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-cocoa">
                  {ing.quantity} {ing.unit}
                </span>{" "}
                <span>{ing.name}</span>
                <span
                  className={cn(
                    "ml-1 text-[11px]",
                    ing.have ? "text-sage" : "text-muted-foreground",
                  )}
                >
                  {ing.have ? "(Available)" : "(Need to buy)"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recipe */}
      <Collapsible
        open={recipeOpen}
        setOpen={setRecipeOpen}
        icon={<BookOpen className="size-3.5 text-terracotta" />}
        title="Recipe"
        className="mt-5"
      >
        <ol className="space-y-2.5">
          {meal.recipe.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-cream/50 p-3 text-sm text-cocoa">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-xs font-bold text-terracotta">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        {meal.tips.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-dashed border-terracotta/30 bg-terracotta/5 p-3 text-xs text-cocoa">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-terracotta" />
            <div>
              <p className="mb-1 font-semibold text-terracotta">Chef tips</p>
              <ul className="space-y-1">
                {meal.tips.map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Collapsible>

      {/* To-Do */}
      <Collapsible
        open={todoOpen}
        setOpen={setTodoOpen}
        icon={<ListChecks className="size-3.5 text-terracotta" />}
        title="To-do list"
        className="mt-4"
      >
        <ul className="space-y-1.5">
          {meal.todo.map((step, i) => {
            const key = `${slotKey}-${i}`;
            const done = !!checks[key];
            return (
              <li key={key}>
                <button
                  onClick={() => setChecks((c) => ({ ...c, [key]: !c[key] }))}
                  className="group flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-beige/60"
                >
                  {done ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-terracotta" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-cocoa/30 group-hover:text-cocoa/60" />
                  )}
                  <span
                    className={cn(
                      "text-cocoa",
                      done && "text-muted-foreground line-through decoration-terracotta/60",
                    )}
                  >
                    {step}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Collapsible>
    </article>
  );
}

function Collapsible({
  open,
  setOpen,
  icon,
  title,
  className,
  children,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  icon: React.ReactNode;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-2 flex w-full items-center justify-between rounded-xl text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cocoa/70">
          {icon} {title}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-cocoa/50" />
        ) : (
          <ChevronDown className="size-4 text-cocoa/50" />
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  Produce: "🥬",
  Protein: "🍗",
  Pantry: "🌾",
  Dairy: "🥛",
  Bakery: "🥖",
  Spices: "🌶️",
  Other: "🧺",
};

function GroceryCard({
  groups,
  checks,
  setChecks,
}: {
  groups: CookFlowPlan["grocery"];
  checks: Record<string, boolean>;
  setChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const allKeys = useMemo(
    () => groups.flatMap((g) => g.items.map((i) => `${g.category}-${i}`)),
    [groups],
  );
  const allChecked = allKeys.length > 0 && allKeys.every((k) => checks[k]);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.category, true])),
  );

  return (
    <article className="cozy-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-bold text-cocoa">
          <ShoppingBasket className="size-5 text-terracotta" /> Grocery list
        </h3>
        <Button
          variant="outline"
          className="h-9 rounded-full border-cocoa/20 bg-card text-xs text-cocoa hover:bg-beige"
          onClick={() => {
            const next: Record<string, boolean> = {};
            allKeys.forEach((k) => (next[k] = !allChecked));
            setChecks(next);
          }}
        >
          {allChecked ? "Uncheck all" : "Check all"}
        </Button>
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const open = openCats[g.category] ?? true;
          return (
            <div key={g.category} className="rounded-2xl border border-border bg-cream/40">
              <button
                type="button"
                onClick={() => setOpenCats((s) => ({ ...s, [g.category]: !open }))}
                className="flex w-full items-center justify-between px-3 py-2"
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cocoa/70">
                  <span className="text-base">{CATEGORY_ICONS[g.category] ?? "🧺"}</span>
                  {g.category}
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {g.items.length}
                  </span>
                </span>
                {open ? (
                  <ChevronUp className="size-4 text-cocoa/50" />
                ) : (
                  <ChevronDown className="size-4 text-cocoa/50" />
                )}
              </button>
              {open && (
                <ul className="grid gap-1 px-2 pb-3 sm:grid-cols-2">
                  {g.items.map((item) => {
                    const key = `${g.category}-${item}`;
                    const done = !!checks[key];
                    return (
                      <li key={key}>
                        <button
                          onClick={() => setChecks((c) => ({ ...c, [key]: !c[key] }))}
                          className="group flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-beige/60"
                        >
                          {done ? (
                            <CheckCircle2 className="size-4 text-terracotta" />
                          ) : (
                            <Circle className="size-4 text-cocoa/30 group-hover:text-cocoa/60" />
                          )}
                          <span
                            className={cn(
                              "text-cocoa",
                              done && "text-muted-foreground line-through decoration-terracotta/60",
                            )}
                          >
                            {item}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SubstitutesCard({ items }: { items: CookFlowPlan["substitutes"] }) {
  if (!items.length) return null;
  return (
    <article className="cozy-card p-5 sm:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-cocoa">
        <Wand2 className="size-5 text-terracotta" /> Smart substitutes
      </h3>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-cream/50 p-3 text-sm"
          >
            <span className="font-semibold text-cocoa">{s.original}</span>
            <span className="text-muted-foreground">→</span>
            <span className="rounded-full bg-terracotta/15 px-2.5 py-0.5 font-semibold text-terracotta">
              {s.swap}
            </span>
            <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
              {s.reason}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function BudgetCard({ budget }: { budget: CookFlowPlan["budget"] }) {
  const color =
    budget.level === "Great"
      ? "bg-sage/20 text-cocoa ring-sage/40"
      : budget.level === "Okay"
        ? "bg-terracotta/15 text-cocoa ring-terracotta/40"
        : "bg-destructive/10 text-destructive ring-destructive/30";

  return (
    <article className="cozy-card p-5 sm:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-cocoa">
        <Wallet className="size-5 text-terracotta" /> Budget feasibility
      </h3>
      <div className="flex items-start gap-3">
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1", color)}>
          {budget.level}
        </span>
        <p className="text-sm text-cocoa/80">{budget.note}</p>
      </div>
    </article>
  );
}

function LeftoverCard({ items }: { items: CookFlowPlan["leftoverMagic"] }) {
  if (!items.length) return null;
  return (
    <article className="cozy-card overflow-hidden">
      <div className="bg-gradient-to-br from-beige to-terracotta/15 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold text-cocoa">
          Tomorrow's Leftover Magic <span>✨</span>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A little spark for the next day, made from what's left tonight.
        </p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        {items.map((l, i) => (
          <div
            key={i}
            className="rounded-2xl border border-dashed border-terracotta/30 bg-cream/60 p-4"
          >
            <p className="text-sm font-semibold text-cocoa">{l.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{l.idea}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

/* ---------- Favorites & Recent ---------- */

function FavoritesSection({
  favorites,
  onRemove,
}: {
  favorites: SavedRecipe[];
  onRemove: (id: string) => void;
}) {
  return (
    <article className="cozy-card p-5 sm:p-6">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-cocoa">
        <Heart className="size-5 fill-terracotta text-terracotta" /> Favorite recipes
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {favorites.map((f) => (
          <div key={f.id} className="rounded-2xl border border-border bg-cream/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-cocoa">{f.meal.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.meal.cookTime} · {f.meal.difficulty} · {f.meal.servings}
                </p>
              </div>
              <button
                onClick={() => onRemove(f.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
                aria-label="Remove favorite"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-cocoa/70">{f.meal.description}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecentPlans({
  recent,
  onOpen,
  onClear,
}: {
  recent: RecentPlan[];
  onOpen: (p: CookFlowPlan) => void;
  onClear: () => void;
}) {
  return (
    <article className="cozy-card mt-6 p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-cocoa">
          <History className="size-4 text-terracotta" /> Recent plans
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Clear
        </button>
      </div>
      <div className="grid gap-2">
        {recent.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen(r.plan)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-cream/50 px-3 py-2 text-left text-sm hover:bg-beige/60"
          >
            <span className="inline-flex items-center gap-2 font-medium text-cocoa">
              <Sparkles className="size-3.5 text-terracotta" /> {r.vibeTag}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.savedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- Chat refine ---------- */

function ChatRefine({ plan }: { plan: CookFlowPlan }) {
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: { messages, id, planContext: planRef.current },
        }),
      }),
    [],
  );

  const initial: UIMessage[] = useMemo(
    () => [
      {
        id: "welcome",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Hi! Want me to **swap a meal**, make something quicker, or scale this for more people? Just ask. 🍂",
          },
        ],
      },
    ],
    [],
  );

  const { messages, sendMessage, status } = useChat({
    id: "cookflow-chat",
    messages: initial,
    transport,
  });

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    composerRef.current?.focus();
  }, []);
  useEffect(() => {
    if (status === "ready") composerRef.current?.focus();
  }, [status]);

  const onSubmit = useCallback(
    (m: PromptInputMessage) => {
      const text = m.text.trim();
      if (!text || status === "submitted" || status === "streaming") return;
      void sendMessage({ text });
    },
    [sendMessage, status],
  );

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <section className="mt-8 cozy-card overflow-hidden">
      <div className="border-b border-border bg-beige/50 px-5 py-4 sm:px-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-cocoa">
          <Send className="size-4 text-terracotta" /> Refine with CookFlow
        </h3>
        <p className="text-xs text-muted-foreground">
          Tweak the plan — swap a recipe, change portions, dial up the spice.
        </p>
      </div>

      <Conversation className="max-h-[420px] bg-card">
        <ConversationContent className="space-y-3 px-4 py-4 sm:px-6">
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            if (m.role === "assistant") {
              return (
                <Message key={m.id} from="assistant">
                  <MessageContent className="bg-transparent p-0 text-cocoa">
                    <MessageResponse>{text}</MessageResponse>
                  </MessageContent>
                </Message>
              );
            }
            return (
              <Message key={m.id} from="user">
                <MessageContent className="rounded-2xl bg-cocoa text-cream">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </MessageContent>
              </Message>
            );
          })}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent className="bg-transparent p-0">
                <Shimmer>Stirring a thought…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={onSubmit} className="border-t border-border bg-card px-4 py-3 sm:px-6">
        <PromptInputTextarea
          ref={composerRef}
          placeholder="e.g. Make lunch vegetarian and quicker…"
          disabled={isBusy}
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            status={isBusy ? "submitted" : undefined}
            disabled={isBusy}
            className="bg-terracotta text-white hover:bg-terracotta/90"
          />
        </PromptInputFooter>
      </PromptInput>
    </section>
  );
}
