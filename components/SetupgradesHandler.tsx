"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useFactoryStore } from "../store/useFactoryStore";
import { ResearchState } from "../engine/types";

export function SetupgradesHandler() {
  const searchParams = useSearchParams();
  const setResearchBulk = useFactoryStore((state) => state.setResearchBulk);
  const isHydrated = useFactoryStore.persist.hasHydrated();

  useEffect(() => {
    if (!isHydrated) return;

    const setupgradesParam = searchParams.get("setupgrades");
    if (!setupgradesParam) return;

    // Parse comma-separated list of skill levels
    const values = setupgradesParam.split(",").map((v) => parseInt(v.trim(), 10));

    // Only apply if all 10 values are provided and valid
    if (values.length !== 10 || values.some(isNaN)) {
      console.warn("setupgrades parameter must contain exactly 10 comma-separated numbers");
      return;
    }

    // Map array indices to skill names
    const skillNames: Array<keyof ResearchState> = [
      "logisticsEfficiency",     // [0]
      "throwingEfficiency",      // [1]
      "factoryEfficiency",       // [2]
      "alchemySkill",            // [3]
      "fuelEfficiency",          // [4]
      "fertilizerEfficiency",    // [5]
      "salesAbility",            // [6]
      "negotiationSkill",        // [7]
      "customerMgmt",            // [8]
      "relicKnowledge",          // [9]
    ];

    // Build updates object
    const updates: Partial<ResearchState> = {};
    skillNames.forEach((skillName, index) => {
      updates[skillName] = values[index];
    });

    // Apply all skill updates at once
    setResearchBulk(updates);
  }, [isHydrated, searchParams, setResearchBulk]);

  return null;
}
