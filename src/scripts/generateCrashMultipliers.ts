// src/scripts/generateCrashMultipliers.ts

import fs from "fs";

const generateMultipliers = (count: number): number[] => {
  const multipliers: number[] = [];

  let lastValue = 0;

  while (multipliers.length < count) {
    let next: number;

    const chance = Math.random();

    if (chance < 0.60) {
      // 60% chance: low crash (1.00 - 2.00)
      next = parseFloat((1.00 + Math.random() * 1.00).toFixed(2));
    } else if (chance < 0.90) {
      // 30% chance: mid crash (2.00 - 10.00)
      next = parseFloat((2.00 + Math.random() * 8.00).toFixed(2));
    } else if (chance < 0.98) {
      // 8% chance: high (10x - 50x)
      next = parseFloat((10 + Math.random() * 40).toFixed(2));
    } else {
      // 2% chance: ultra rare (50x - 200x)
      next = parseFloat((50 + Math.random() * 150).toFixed(2));
    }

    // Avoid consecutive repeats
    if (next === lastValue) continue;

    multipliers.push(next);
    lastValue = next;
  }

  return multipliers;
};

// 🔢 CONFIG
const NUM_ROUNDS = 300;
const output = generateMultipliers(NUM_ROUNDS);

// 📄 Save to file
const filePath = "./src/data/crashMultipliers.ts";
const fileContent = `// Auto-generated realistic multiplier list\n\nconst crashMultipliers: number[] = [\n  ${output.join(", ")}\n];\n\nexport default crashMultipliers;\n`;

fs.writeFileSync(filePath, fileContent);

console.log(`✅ Generated ${NUM_ROUNDS} crash multipliers to ${filePath}`);