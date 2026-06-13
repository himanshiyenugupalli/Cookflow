import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

const IngredientSchema = z.object({
  quantity: z.string(),
  unit: z.string(),
  name: z.string(),
  have: z.boolean(),
});

const MealSchema = z.object({
  name: z.string(),
  description: z.string(),
  servings: z.string(),
  cookTime: z.string(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  ingredients: z.array(IngredientSchema),
  recipe: z.array(z.string()).describe("Detailed cooking instructions, one step per item"),
  todo: z.array(z.string()).describe("Actionable planning tasks (gather, prep, cook, store)"),
  tips: z.array(z.string()),
});

const PlanSchema = z.object({
  vibeTag: z.string(),
  pantryScore: z.number(),
  pantryMessage: z.string(),
  totalCookTime: z.string(),
  meals: z.object({
    breakfast: MealSchema,
    lunch: MealSchema,
    dinner: MealSchema,
  }),
  grocery: z.array(
    z.object({
      category: z.string(),
      items: z.array(z.string()),
    }),
  ),
  substitutes: z.array(
    z.object({
      original: z.string(),
      swap: z.string(),
      reason: z.string(),
    }),
  ),
  budget: z.object({
    level: z.enum(["Great", "Okay", "Tight"]),
    note: z.string(),
  }),
  leftoverMagic: z.array(
    z.object({
      title: z.string(),
      idea: z.string(),
    }),
  ),
});

export type CookFlowPlan = z.infer<typeof PlanSchema>;
export type CookFlowMeal = z.infer<typeof MealSchema>;

const InputSchema = z.object({
  prompt: z.string().min(1),
  vibes: z.array(z.string()).default([]),
  people: z.string().optional(),
  diet: z.string().optional(),
  time: z.string().optional(),
  budget: z.string().optional(),
  pantry: z.string().optional(),
});

export const generatePlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const userBrief = [
      `Day brief: ${data.prompt}`,
      data.vibes.length ? `Vibes: ${data.vibes.join(", ")}` : "",
      data.people ? `People: ${data.people}` : "",
      data.diet ? `Diet: ${data.diet}` : "",
      data.time ? `Time available: ${data.time}` : "",
      data.budget ? `Budget level: ${data.budget}` : "",
      data.pantry ? `Pantry on hand: ${data.pantry}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: PlanSchema }),
      system:
        "You are CookFlow, a warm, encouraging home-cooking planner. Create realistic, cozy daily meal plans for home cooks. " +
        "For each meal include: a friendly recipe name and short description, servings, cook time, difficulty (Easy/Medium/Hard), " +
        "a full ingredient list with quantity + unit (use 'to taste' or '1' / 'pinch' when appropriate), have:true for items the user already has, " +
        "a `recipe` array of 5-8 clear cooking instructions (HOW to cook, written like a real recipe), " +
        "a `todo` array of 4-7 separate planning tasks (gather ingredients, wash veg, prep, start cooking, plate, store leftovers — NOT the recipe), " +
        "and 1-3 short cooking tips. " +
        "Pantry score 0-100 reflects how much of the planned meals the user already has. Group grocery by category (Produce, Protein, Pantry, Dairy, Bakery, Spices, Other). " +
        "Provide 2-4 substitutes and 1-2 leftover ideas. Keep the tone warm and encouraging.",
      prompt: userBrief,
    });

    return output;
  });
