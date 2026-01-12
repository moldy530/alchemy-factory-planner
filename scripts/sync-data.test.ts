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
