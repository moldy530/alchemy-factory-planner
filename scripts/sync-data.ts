#!/usr/bin/env bun

/**
 * Syncs game data from the AlchemyFactoryData repository
 * Transforms data to be backwards compatible with existing calculation engines
 */

const REMOTE_BASE_URL = 'https://raw.githubusercontent.com/faultyd3v/AlchemyFactoryData/main';
const DATA_DIR = './data';

interface RemoteItem {
  id?: number | string;
  name?: string;
  displayName?: string;
  value?: number;
  cost?: number;
  baseCost?: number;
  hv?: number; // heat value (per unit)
  nv?: number; // nutrient value
  ns?: number; // nutrient speed
  cauldronCost?: number;
  cauldronTarget?: number;
  cauldronMulti?: number;
  maxStack?: number;
  portal?: boolean;
  liquid?: boolean;
  [key: string]: any;
}

interface LocalItem {
  id: string;
  name: string;
  cost?: number;
  category?: string | string[];
  heat_value?: number;
  nutrient_value?: number;
  nutrients_per_seconds?: number;
  required_nutrients?: number;
  base_cost?: number;
  cauldron_cost?: number;
  cauldron_target?: number;
  cauldron_coef?: number;
  cauldron_efficiency?: number;
  [key: string]: any;
}

interface RemoteBuilding {
  idName: string;
  id: number;
  name: string;
  desc?: string;
  hc?: number; // heating capacity
  hide?: boolean;
  buildingTags?: {
    ParentTags?: string[];
    GameplayTags?: string[];
  };
  [key: string]: any;
}

interface LocalDevice {
  id: string;
  name: string;
  category?: string;
  heat_consuming_speed?: number;
}

interface RemoteCrafting {
  craftIdName: string;
  craftId: number;
  ingredientList: Array<{ name: string; qty: number }>;
  productInfo: { name: string; qty: number };
  craftType: number;
  craftTime: number;
  sideProduct?: { name: string; qty: number };
  [key: string]: any;
}

interface LocalRecipe {
  id: string;
  inputs: Array<{ id?: string; name: string; count: number }>;
  outputs: Array<{ id?: string; name: string; count: number }>;
  time: number;
  crafted_in?: string;
  category?: string;
}

interface PlantSeed {
  id: string;
  growthSeconds: number;
  growthNutrientValue: number;
  product: { name: string; qty: number };
  sideProduct?: { name: string; qty: number };
}

async function fetchJSON<T>(filename: string): Promise<T> {
  const url = `${REMOTE_BASE_URL}/${filename}`;
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
  }
  return response.json();
}

function pascalToKebab(str: string): string {
  return str
    .replace(/_/g, '-')  // Replace underscores with hyphens first
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/--+/g, '-');  // Replace multiple hyphens with single hyphen
}

// Special building ID mappings (remote ID → local ID)
const BUILDING_ID_OVERRIDES: Record<string, string> = {
  'auto-nursery': 'nursery',
  'portal-alch-guild': 'purchasing-portal',
  'portal-bank': 'bank-portal',
  'portal-wholesaling': 'dispatch-portal',
};

// Craft type to device name mapping
const CRAFT_TYPE_TO_DEVICE: Record<number, string> = {
  0: 'table saw',
  1: 'stone crusher',
  2: 'iron smelter',
  3: 'nursery',        // Growing plants with fertilizer
  4: 'grinder',
  5: 'extractor',
  6: 'crucible',
  7: 'cauldron',
  8: 'kiln',
  9: 'shaper',
  10: 'assembler',
  11: 'blender',
  12: 'athanor',
  13: 'alembic',
  14: 'refiner',
};

const CRAFT_TYPE_CATEGORIES: Record<number, string> = {
  0: 'fuel',           // table saw - wood boards
  1: 'solid',          // stone crusher - stone, coal
  2: 'solid',          // iron smelter - ingots
  3: 'herbs',          // seed plot - plants
  4: 'powder',         // grinder - powders
  5: 'oil',            // extractor - oils
  6: 'solid',          // crucible - quicklime, etc
  7: 'misc',           // cauldron - upgrades
  8: 'solid',          // kiln - bricks
  9: 'solid',          // shaper - nails, coins
  10: 'crafted',       // assembler - general items
  11: 'potions',       // blender - soaps, potions
  12: 'potions',       // athanor - advanced potions
  13: 'essence',       // alembic - essential oils, acids
  14: 'liquid',        // refiner - refined liquids
};

function transformItems(
  remoteItems: RemoteItem[],
  plantSeeds: PlantSeed[],
  recipes: RemoteCrafting[]
): LocalItem[] {
  // Build lookup maps for plant nutrients
  const plantNutrients = new Map<string, number>();
  plantSeeds.forEach(seed => {
    const productName = seed.product.name.toLowerCase();
    plantNutrients.set(productName, seed.growthNutrientValue);
  });

  // Build lookup for recipe outputs to determine categories
  const recipeOutputs = new Map<string, RemoteCrafting>();
  recipes.forEach(recipe => {
    const outputName = recipe.productInfo.name.toLowerCase();
    recipeOutputs.set(outputName, recipe);
  });

  return remoteItems
    .filter(item => {
      // Filter out special items that aren't used in production
      const name = (item.displayName || item.name || '').toLowerCase();
      return name && name !== 'none';
    })
    .map(item => {
      // Use internal name for ID (e.g., "WoodBoard" -> "woodboard")
      const internalName = item.name || '';
      const itemId = internalName.toLowerCase();
      // Use displayName for user-facing name (e.g., "Plank")
      const displayName = item.displayName || internalName;

      const transformed: LocalItem = {
        id: itemId,
        name: displayName,
      };

      // Determine categories
      const categories: string[] = [];

      // Check if it's a fuel (has heat value)
      if (item.hv !== undefined && item.hv > 0) {
        categories.push('fuel');
        // Scale heat value by stack size ONLY for raw materials (negative maxStack)
        // Negative maxStack indicates the heat value is per-stack, not per-unit
        if (item.maxStack && item.maxStack < 0) {
          transformed.heat_value = Math.round(item.hv * Math.abs(item.maxStack));
        } else {
          transformed.heat_value = item.hv;
        }
      }

      // Check if it's a fertilizer (has both nutrient value and speed)
      if (item.nv !== undefined && item.nv > 0 && item.ns !== undefined && item.ns > 0) {
        categories.push('fertilizer');
        transformed.nutrient_value = item.nv;
        transformed.nutrients_per_seconds = item.ns;
      }

      // Check if it's a plant/herb (appears in plantseeds)
      if (plantNutrients.has(itemId)) {
        categories.push('herbs');
        transformed.required_nutrients = plantNutrients.get(itemId);
      }

      // Check if it's a raw material (can be bought through portal)
      if (item.portal === true && categories.length === 0) {
        categories.push('raw materials');
      } else if (item.portal === true && categories.includes('fuel')) {
        // Raw materials that are also fuel
        categories.push('raw materials');
      }

      // Infer category from recipe if exists
      const recipe = recipeOutputs.get(itemId);
      if (recipe && CRAFT_TYPE_CATEGORIES[recipe.craftType]) {
        const recipeCategory = CRAFT_TYPE_CATEGORIES[recipe.craftType];
        if (!categories.includes(recipeCategory)) {
          categories.push(recipeCategory);
        }
      }

      // Default category for items without any specific category
      if (categories.length === 0) {
        // If it has a recipe output, it's a crafted item
        if (recipe) {
          categories.push('crafted');
        } else {
          // Otherwise it's miscellaneous
          categories.push('misc');
        }
      }

      // Set category (single if only one, array if multiple)
      if (categories.length === 1) {
        transformed.category = categories[0];
      } else if (categories.length > 1) {
        transformed.category = categories;
      }

      // Map cost (prefer value over baseCost)
      if (item.value !== undefined) {
        transformed.cost = item.value;
      } else if (item.cost !== undefined) {
        transformed.cost = item.cost;
      }

      // Map base_cost
      if (item.baseCost !== undefined) {
        transformed.base_cost = item.baseCost;
      } else if (item.value !== undefined) {
        transformed.base_cost = item.value;
      }

      // Map cauldron properties
      if (item.cauldronCost !== undefined) {
        transformed.cauldron_cost = item.cauldronCost;
      }
      if (item.cauldronTarget !== undefined) {
        transformed.cauldron_target = item.cauldronTarget;
      }
      if (item.cauldronMulti !== undefined) {
        transformed.cauldron_coef = item.cauldronMulti;
      }

      // Calculate cauldron efficiency
      if (transformed.cauldron_cost && transformed.cauldron_target) {
        transformed.cauldron_efficiency = transformed.cauldron_cost / transformed.cauldron_target;
      }

      return transformed;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function determineDeviceCategory(
  building: RemoteBuilding,
  recipes: RemoteCrafting[]
): string {
  const buildingId = pascalToKebab(building.idName);

  // Raw material production devices
  const rawProductionKeywords = ['saw', 'crusher', 'smelter', 'plot', 'portal', 'nursery'];
  if (rawProductionKeywords.some(kw => buildingId.includes(kw))) {
    return 'raw material production';
  }

  // Automated processing
  if (buildingId.includes('grinder') || buildingId.includes('enhanced')) {
    return 'automated processing';
  }

  // Production devices
  const productionKeywords = ['assembler', 'blender', 'athanor', 'alembic', 'refiner',
                              'extractor', 'crucible', 'cauldron', 'kiln', 'shaper',
                              'processor', 'altar'];
  if (productionKeywords.some(kw => buildingId.includes(kw))) {
    return 'production';
  }

  // Default to production
  return 'production';
}

function transformBuildings(
  remoteBuildings: RemoteBuilding[],
  recipes: RemoteCrafting[]
): LocalDevice[] {
  return remoteBuildings
    .filter(building => !building.hide)
    .filter(building => {
      // Only include buildings that are used in recipes or have specific purposes
      const buildingId = pascalToKebab(building.idName);

      // Check if this building is referenced in any recipe
      const isUsedInRecipe = recipes.some(r => {
        const deviceName = CRAFT_TYPE_TO_DEVICE[r.craftType];
        if (!deviceName) return false;

        // Try exact match or partial match
        return deviceName === buildingId ||
               buildingId.includes(deviceName.replace(/\s+/g, '-')) ||
               deviceName.replace(/\s+/g, '-').includes(buildingId);
      });

      // Also include support buildings
      const isSupportBuilding =
        buildingId.includes('heater') ||
        buildingId.includes('portal') ||
        buildingId.includes('nursery');

      return isUsedInRecipe || isSupportBuilding;
    })
    .map(building => {
      let deviceId = pascalToKebab(building.idName);
      // Apply ID overrides for special cases
      deviceId = BUILDING_ID_OVERRIDES[deviceId] || deviceId;

      const device: LocalDevice = {
        id: deviceId,
        name: building.name,
        category: determineDeviceCategory(building, recipes),
      };

      // Map heating capacity to heat_consuming_speed
      if (building.hc !== undefined && building.hc > 0) {
        device.heat_consuming_speed = building.hc;
      }

      return device;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function nameToKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // Add hyphen between camelCase words
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')  // Handle consecutive caps
    .toLowerCase()
    .replace(/\s+/g, '-');  // Replace spaces with hyphens
}

function camelCaseToSpaced(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add space between camelCase words
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // Handle consecutive caps
    .toLowerCase();
}

function transformCrafting(
  remoteCrafting: RemoteCrafting[],
  remoteItems: RemoteItem[]
): LocalRecipe[] {
  // Build lookup map: internal name (lowercase) -> display name
  const itemDisplayNames = new Map<string, string>();
  remoteItems.forEach(item => {
    const internalName = (item.name || '').toLowerCase();
    const displayName = item.displayName || item.name || '';
    itemDisplayNames.set(internalName, displayName);
  });

  return remoteCrafting.map(craft => {
    const recipe: LocalRecipe = {
      id: nameToKebab(craft.craftIdName),
      inputs: craft.ingredientList.map(ing => {
        const itemId = ing.name.toLowerCase();
        const displayName = itemDisplayNames.get(itemId) || ing.name;
        return {
          id: itemId,
          name: displayName,
          count: ing.qty,
        };
      }),
      outputs: [{
        id: craft.productInfo.name.toLowerCase(),
        name: itemDisplayNames.get(craft.productInfo.name.toLowerCase()) || craft.productInfo.name,
        count: craft.productInfo.qty,
      }],
      time: craft.craftTime,
    };

    // Add side product to outputs if it exists
    if (craft.sideProduct && craft.sideProduct.name.toLowerCase() !== 'none') {
      const sideId = craft.sideProduct.name.toLowerCase();
      recipe.outputs.push({
        id: sideId,
        name: itemDisplayNames.get(sideId) || craft.sideProduct.name,
        count: craft.sideProduct.qty,
      });
    }

    // Map craft type to device name
    const deviceName = CRAFT_TYPE_TO_DEVICE[craft.craftType];
    if (deviceName) {
      recipe.crafted_in = deviceName;
    }

    // Add category from craft type
    if (CRAFT_TYPE_CATEGORIES[craft.craftType]) {
      recipe.category = CRAFT_TYPE_CATEGORIES[craft.craftType];
    }

    return recipe;
  });
}

async function main() {
  try {
    console.log('Starting data sync from AlchemyFactoryData repository...\n');

    // Fetch all data files
    console.log('📥 Fetching remote data...');
    const [remoteItems, remoteBuildings, remoteCrafting, plantSeeds] = await Promise.all([
      fetchJSON<RemoteItem[]>('items.json'),
      fetchJSON<RemoteBuilding[]>('buildings.json'),
      fetchJSON<RemoteCrafting[]>('crafting.json'),
      fetchJSON<PlantSeed[]>('plantseeds.json'),
    ]);

    console.log(`\n✅ Fetched ${remoteItems.length} items`);
    console.log(`✅ Fetched ${remoteBuildings.length} buildings`);
    console.log(`✅ Fetched ${remoteCrafting.length} crafting recipes`);
    console.log(`✅ Fetched ${plantSeeds.length} plant seeds\n`);

    // Transform data (pass dependencies for proper transformation)
    console.log('🔄 Transforming data...');
    const localRecipes = transformCrafting(remoteCrafting, remoteItems);
    const localItems = transformItems(remoteItems, plantSeeds, remoteCrafting);
    const localDevices = transformBuildings(remoteBuildings, remoteCrafting);

    // Write transformed data
    console.log('💾 Writing data files...');
    await Bun.write(
      `${DATA_DIR}/items.json`,
      JSON.stringify(localItems, null, 2)
    );
    await Bun.write(
      `${DATA_DIR}/devices.json`,
      JSON.stringify(localDevices, null, 2)
    );
    await Bun.write(
      `${DATA_DIR}/recipes.json`,
      JSON.stringify(localRecipes, null, 2)
    );

    console.log(`\n✅ Successfully synced all data files!`);
    console.log(`\nFiles updated:`);
    console.log(`  - data/items.json (${localItems.length} items)`);
    console.log(`  - data/devices.json (${localDevices.length} devices)`);
    console.log(`  - data/recipes.json (${localRecipes.length} recipes)`);
    console.log(`\nBackwards compatibility maintained:`);
    console.log(`  ✓ Item IDs are kebab-case names`);
    console.log(`  ✓ Heat values scaled by stack size`);
    console.log(`  ✓ Categories inferred from properties`);
    console.log(`  ✓ Plant nutrients merged from plantseeds`);

  } catch (error) {
    console.error('❌ Error syncing data:', error);
    process.exit(1);
  }
}

main();
