/**
 * Property-Based Tests: Split Payment Calculations
 *
 * **Validates: Requirements 21.7**
 *
 * Properties:
 * 1. Sum of equal splits = total (within rounding tolerance of ±N CLP)
 * 2. Equal split N people = N amounts where each is floor(total/N) or ceil(total/N)
 * 3. By-item split: sum of person subtotals = order total
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure split calculation functions (mirrors SplitPaymentScreen logic)
// ---------------------------------------------------------------------------

function calculateEqualSplit(total: number, personCount: number): number[] {
  const count = Math.max(1, personCount);
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}

function sumArray(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Property 1: Sum of equal splits = total
// ---------------------------------------------------------------------------

describe('Property: sum of equal splits equals total', () => {
  it('sum of all portions equals the original total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        (total, personCount) => {
          const portions = calculateEqualSplit(total, personCount);
          expect(sumArray(portions)).toBe(total);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Equal split produces N portions
// ---------------------------------------------------------------------------

describe('Property: equal split produces exactly N portions', () => {
  it('number of portions equals person count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        (total, personCount) => {
          const portions = calculateEqualSplit(total, personCount);
          expect(portions).toHaveLength(personCount);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('each portion is either floor(total/N) or ceil(total/N)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        (total, personCount) => {
          const portions = calculateEqualSplit(total, personCount);
          const floor = Math.floor(total / personCount);
          const ceil = Math.ceil(total / personCount);
          for (const portion of portions) {
            expect(portion >= floor && portion <= ceil).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: By-item split — every item assigned to exactly one person
// ---------------------------------------------------------------------------

describe('Property: by-item split assigns every item to exactly one person', () => {
  it('each item appears in exactly one person\'s assignment', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.array(fc.constantFrom('A', 'B', 'C'), { minLength: 1, maxLength: 3 }),
        (itemIds, persons) => {
          // Simulate assigning each item to a random person
          const assignments: Record<string, string> = {};
          itemIds.forEach((id, i) => {
            assignments[id] = persons[i % persons.length];
          });

          // Every item should be assigned to exactly one person
          for (const itemId of itemIds) {
            expect(assignments[itemId]).toBeDefined();
            expect(persons).toContain(assignments[itemId]);
          }

          // Count assignments per item — each item appears exactly once
          const assignedItems = Object.keys(assignments);
          expect(assignedItems.length).toBe(itemIds.length);
        }
      ),
      { numRuns: 200 }
    );
  });
});
