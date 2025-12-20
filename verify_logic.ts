import { calculateProduction } from './engine/planner';

// --- Baseline Test ---
console.log('--- Iron Ingot [60/min] ---');
const result = calculateProduction({
    targets: [{ item: 'Iron Ingot', rate: 60 }],
    factoryEfficiency: 0,
    alchemySkill: 0,
    fuelEfficiency: 0,
    logisticsEfficiency: 10,
    fertilizerEfficiency: 0,
    salesAbility: 0,
    throwingEfficiency: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0
});

if (result[0]) {
    console.log(`Item: ${result[0].itemName}`);
    console.log(`Machines: ${result[0].deviceCount} (Expected: 6)`);
}

// --- Logistics Test ---
console.log('\n--- Logistics Test ---');
const res3 = calculateProduction({
    targets: [{ item: 'Iron Ingot', rate: 500 }], // Should exceed lvl 1 limit (75)
    factoryEfficiency: 0,
    alchemySkill: 0,
    fuelEfficiency: 0,
    logisticsEfficiency: 1, // Limit = 60 + 15 = 75
    fertilizerEfficiency: 0,
    salesAbility: 0,
    throwingEfficiency: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0
});
if (res3[0]) {
    console.log(`Rate: ${res3[0].rate}`);
    console.log(`Belt Limit: ${res3[0].beltLimit}`);
    console.log(`Saturated? ${res3[0].isBeltSaturated}`);
}

// --- Fertilizer Test (Sage) ---
console.log('\n--- Fertilizer Test (Sage) ---');
const res4 = calculateProduction({
    targets: [{ item: 'Sage', rate: 60 }],
    factoryEfficiency: 0,
    alchemySkill: 0,
    fuelEfficiency: 0,
    logisticsEfficiency: 10,
    fertilizerEfficiency: 0,
    salesAbility: 0,
    throwingEfficiency: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0,
    selectedFertilizer: 'Basic Fertilizer'
});

if (res4[0]) {
    console.log(`Item: ${res4[0].itemName}`);
    console.log(`Machines: ${res4[0].deviceCount} (Expected: 3?)`);

    const fertInput = res4[0].inputs.find(i => i.itemName === 'Basic Fertilizer');
    if (fertInput) {
        console.log(`Fertilizer Input: ${fertInput.itemName} @ ${fertInput.rate}/min`);
    } else {
        console.log('No Fertilizer Input found!');
        console.log('Inputs:', res4[0].inputs.map(i => i.itemName));
    }
}

// --- Heater Test (Plant Ash) ---
console.log('\n--- Heater Test (Plant Ash) ---');
const res5 = calculateProduction({
    targets: [{ item: 'Plant Ash', rate: 10 }],
    factoryEfficiency: 0,
    alchemySkill: 0,
    fuelEfficiency: 0,
    logisticsEfficiency: 10,
    fertilizerEfficiency: 0,
    salesAbility: 0,
    throwingEfficiency: 0,
    negotiationSkill: 0,
    customerMgmt: 0,
    relicKnowledge: 0,
    selectedFuel: 'Coal'
});

if (res5[0]) {
    console.log(`Item: ${res5[0].itemName}`);
    console.log(`Machines: ${res5[0].deviceCount} (Expected: 0.5)`);
    console.log(`Heat: ${res5[0].heatConsumption} (Expected: 150)`);
    const fuelInput = res5[0].inputs.find(i => i.itemName === 'Coal');
    if (fuelInput) {
        console.log(`Fuel Input: ${fuelInput.itemName} @ ${fuelInput.rate} (Expected: ~0.277)`);
    } else {
        console.log('No Fuel Input found!');
        console.log('Inputs:', res5[0].inputs.map(i => i.itemName));
    }
}
