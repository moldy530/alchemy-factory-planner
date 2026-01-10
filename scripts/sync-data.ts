#!/usr/bin/env bun

/**
 * Syncs game data from the AlchemyFactoryData repository
 * Transforms abbreviated fields to full property names
 */

const REMOTE_BASE_URL = 'https://raw.githubusercontent.com/faultyd3v/AlchemyFactoryData/main';
const DATA_DIR = './data';

interface RemoteItem {
  id?: string;
  name?: string;
  displayName?: string;
  value?: number;
  cost?: number;
  gameValue?: string;
  gameCost?: string;
  hv?: number; // heat value
  nv?: number; // nutrient value
  ns?: number; // nutrient speed
  cauldronCost?: number;
  cauldronTarget?: number;
  cauldronMulti?: number;
  questCost?: number;
  questTier?: number;
  maxStack?: number;
  sellType?: number;
  portal?: boolean;
  liquid?: boolean;
  sellStack?: boolean;
  [key: string]: any;
}

interface LocalItem {
  id: string;
  name: string;
  cost?: number;
  category?: string | string[];
  heat_value?: number;
  nutrient_value?: number;
  nutrient_speed?: number;
  paradox_time?: number;
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
  furnitureType?: number;
  secondaryType?: number;
  costList?: Array<{ name: string; qty: number }>;
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
  [key: string]: any;
}

interface RemoteCrafting {
  craftIdName: string;
  craftId: number;
  ingredientList: Array<{ name: string; qty: number }>;
  productInfo: { name: string; qty: number };
  craftType: number;
  craftTime: number;
  fractionNum?: number;
  failRate1?: number;
  failRate2?: number;
  sideProduct?: { name: string; qty: number };
  alternate?: boolean;
  [key: string]: any;
}

interface LocalRecipe {
  id: string;
  inputs: Array<{ name: string; count: number }>;
  outputs: Array<{ name: string; count: number }>;
  time: number;
  crafted_in?: string;
  category?: string;
  [key: string]: any;
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

function transformItems(remoteItems: RemoteItem[]): LocalItem[] {
  return remoteItems.map(item => {
    // Ensure id is a string before calling toLowerCase
    const rawId = item.id || item.displayName || item.name || '';
    const idStr = typeof rawId === 'string' ? rawId : String(rawId);
    const transformed: LocalItem = {
      id: idStr.toLowerCase().replace(/\s+/g, '-'),
      name: item.displayName || item.name || '',
    };

    // Map cost
    if (item.cost !== undefined) {
      transformed.cost = item.cost;
    } else if (item.value !== undefined) {
      transformed.cost = item.value;
    }

    // Transform abbreviated fields to full names
    if (item.hv !== undefined) {
      transformed.heat_value = item.hv;
    }
    if (item.nv !== undefined) {
      transformed.nutrient_value = item.nv;
    }
    if (item.ns !== undefined) {
      transformed.nutrient_speed = item.ns;
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

    // Copy over any other properties that might be useful
    const keysToSkip = ['id', 'name', 'displayName', 'cost', 'value', 'hv', 'nv', 'ns',
                        'cauldronCost', 'cauldronTarget', 'cauldronMulti', 'gameValue', 'gameCost'];
    Object.keys(item).forEach(key => {
      if (!keysToSkip.includes(key) && !(key in transformed)) {
        transformed[key] = item[key];
      }
    });

    return transformed;
  });
}

// Device category mapping based on crafting types
const DEVICE_CATEGORIES: Record<number, string> = {
  0: 'raw material production',      // Table Saw type
  1: 'raw material production',      // Stone Crusher type
  2: 'raw material production',      // Smelter type
  3: 'raw material production',      // Seed Plot type
  4: 'production',                   // Grinder type
  5: 'production',                   // Mortar type
  6: 'production',                   // Flask type
  7: 'production',                   // Cauldron type
  8: 'production',                   // Retort type
  9: 'production',                   // Philosopher's Stone
};

function getDeviceCategoryFromTags(tags?: { ParentTags?: string[]; GameplayTags?: string[] }): string {
  if (!tags) return 'production';

  const allTags = [...(tags.ParentTags || []), ...(tags.GameplayTags || [])];

  if (allTags.some(tag => tag.toLowerCase().includes('raw') || tag.toLowerCase().includes('basic'))) {
    return 'raw material production';
  }

  return 'production';
}

function transformBuildings(remoteBuildings: RemoteBuilding[]): LocalDevice[] {
  const devices: LocalDevice[] = [];

  // Filter out hidden buildings and duplicates
  const visibleBuildings = remoteBuildings.filter(b => !b.hide);

  for (const building of visibleBuildings) {
    const device: LocalDevice = {
      id: building.idName.toLowerCase().replace(/\s+/g, '-'),
      name: building.name,
      category: getDeviceCategoryFromTags(building.buildingTags),
    };

    // Map heating capacity to heat_consuming_speed
    if (building.hc !== undefined && building.hc > 0) {
      device.heat_consuming_speed = building.hc;
    }

    devices.push(device);
  }

  return devices;
}

// Craft type to device name mapping
const CRAFT_TYPE_TO_DEVICE: Record<number, string> = {
  0: 'table saw',
  1: 'stone crusher',
  2: 'iron smelter',
  3: 'seed plot',
  4: 'grinder',
  5: 'mortar',
  6: 'flask',
  7: 'cauldron',
  8: 'retort',
  9: 'philosophers stone',
  10: 'purchasing portal',
  11: 'nursery',
  12: 'bank portal',
  13: 'dispatch portal',
  14: 'world tree nursery',
};

function transformCrafting(remoteCrafting: RemoteCrafting[]): LocalRecipe[] {
  return remoteCrafting.map(craft => {
    const recipe: LocalRecipe = {
      id: craft.craftIdName.toLowerCase().replace(/\s+/g, '-'),
      inputs: craft.ingredientList.map(ing => ({
        name: ing.name.toLowerCase(),
        count: ing.qty,
      })),
      outputs: [{
        name: craft.productInfo.name.toLowerCase(),
        count: craft.productInfo.qty,
      }],
      time: craft.craftTime,
    };

    // Add side product to outputs if it exists
    if (craft.sideProduct && craft.sideProduct.name.toLowerCase() !== 'none') {
      recipe.outputs.push({
        name: craft.sideProduct.name.toLowerCase(),
        count: craft.sideProduct.qty,
      });
    }

    // Map craft type to device name
    const deviceName = CRAFT_TYPE_TO_DEVICE[craft.craftType];
    if (deviceName) {
      recipe.crafted_in = deviceName;
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

    // Transform data
    console.log('🔄 Transforming data...');
    const localItems = transformItems(remoteItems);
    const localDevices = transformBuildings(remoteBuildings);
    const localRecipes = transformCrafting(remoteCrafting);

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
    await Bun.write(
      `${DATA_DIR}/plantseeds.json`,
      JSON.stringify(plantSeeds, null, 2)
    );

    console.log(`\n✅ Successfully synced all data files!`);
    console.log(`\nFiles updated:`);
    console.log(`  - data/items.json (${localItems.length} items)`);
    console.log(`  - data/devices.json (${localDevices.length} devices)`);
    console.log(`  - data/recipes.json (${localRecipes.length} recipes)`);
    console.log(`  - data/plantseeds.json (${plantSeeds.length} plant seeds)`);

  } catch (error) {
    console.error('❌ Error syncing data:', error);
    process.exit(1);
  }
}

main();
