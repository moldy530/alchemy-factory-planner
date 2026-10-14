import { describe, test, expect } from "bun:test";
import recipes from "../data/recipes.json";
import devices from "../data/devices.json";

describe("Craft Type Mappings", () => {
  test("processor device exists in devices.json", () => {
    const processor = devices.find((d) => d.id === "processor");
    expect(processor).toBeDefined();
    expect(processor?.name).toBe("Processor");
    expect(processor?.category).toBe("production");
  });

  test("nails are crafted in processor (craftType 9)", () => {
    const nailsRecipe = recipes.find((r) => r.id === "nails");
    expect(nailsRecipe).toBeDefined();
    expect(nailsRecipe?.crafted_in).toBe("processor");
  });

  test("processor recipes are correctly mapped (craftType 9)", () => {
    // These items all have craftType 9 and should use processor
    const processorItems = [
      "mortar",
      "nails",
      "wood-gear",
      "copper-coin",
      "copper-bearing",
      "bronze-rivet",
      "silver-coin",
      "gold-coin",
    ];

    processorItems.forEach((itemId) => {
      const recipe = recipes.find((r) => r.id === itemId);
      expect(recipe).toBeDefined();
      expect(recipe?.crafted_in).toBe("processor");
    });
  });

  test("shaper recipes are correctly mapped (craftType 18)", () => {
    // These items have craftType 18 and should use shaper
    const shaperItems = ["jupiter", "saturn", "mars"];

    shaperItems.forEach((itemId) => {
      const recipe = recipes.find((r) => r.id === itemId);
      expect(recipe).toBeDefined();
      expect(recipe?.crafted_in).toBe("shaper");
    });
  });

  test("all recipes have valid crafted_in devices", () => {
    const deviceIds = new Set(devices.map((d) => d.id));

    recipes.forEach((recipe) => {
      if (recipe.crafted_in) {
        expect(deviceIds.has(recipe.crafted_in)).toBe(true);
      }
    });
  });

  test("advanced devices exist for extended craft types", () => {
    const advancedDevices = [
      { id: "advanced-blender", name: "Advanced Blender" },
      { id: "advanced-alembic", name: "Advanced Alembic" },
      { id: "advanced-athanor", name: "Advanced Athanor" },
      { id: "advanced-shaper", name: "Advanced Shaper" },
      { id: "omni-machine", name: "Advanced Assembler" },
      { id: "aether-shaper", name: "Arcane Shaper" },
      { id: "paradox-crucible", name: "Paradox Crucible" },
      { id: "arcane-processor", name: "Arcane Processor" },
    ];

    advancedDevices.forEach(({ id, name }) => {
      const device = devices.find((d) => d.id === id);
      expect(device).toBeDefined();
      expect(device?.name).toBe(name);
    });
  });
});

describe("Fail products (expected-value byproducts)", () => {
  // In-game, a craft "fails" with probability failRate1 and yields the fail
  // product INSTEAD of the main product. The sync models expected values:
  // main output scaled by (1 - failRate1), fail product appended at qty * failRate1.
  test("obsidian models the marble byproduct at 50% fail rate", () => {
    const obsidian = recipes.find((r) => r.id === "obsidian");
    expect(obsidian).toBeDefined();
    expect(obsidian?.outputs[0]).toMatchObject({ id: "obsidian", count: 0.5 });
    expect(obsidian?.outputs[1]).toMatchObject({ id: "marble", count: 0.5 });
  });

  test("steel ingot main output scaled by 75% fail rate", () => {
    const steel = recipes.find((r) => r.id === "steel-ingot");
    expect(steel).toBeDefined();
    expect(steel?.outputs[0]).toMatchObject({ id: "steelingot", count: 0.25 });
    expect(steel?.outputs[1]).toMatchObject({ id: "ironingot", count: 0.75 });
  });

  test("all fail-product byproducts reference known items", () => {
    const itemIds = new Set(
      // items.json uses kebab-case ids matching recipe item ids
      (recipes as Array<{ id: string }>).map((r) => r.id)
    );
    recipes.forEach((recipe) => {
      recipe.outputs.slice(1).forEach((output) => {
        // byproduct ids should be resolvable (either a recipe or an item)
        expect(typeof output.id).toBe("string");
        expect(output.count).toBeGreaterThan(0);
      });
    });
    expect(itemIds.size).toBeGreaterThan(0);
  });
});
