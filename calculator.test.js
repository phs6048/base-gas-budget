import { test } from 'node:test';
import assert from 'node:assert/strict';
import { units, formatUnits, calculate } from './calculator.js';
const example = { budget: '0.00061', reserve: '0.0001', gas: '200000', price: '0.005', l1: '0.000001', operator: '0', value: '0', margin: '30', count: '7' };

test('unit conversion preserves one wei and rejects unrepresentable fractions', () => {
  assert.equal(units('0.000000000000000001', 18), 1n);
  assert.equal(units('0.005', 9), 5000000n);
  assert.equal(formatUnits(1n), '0.000000000000000001');
  assert.throws(() => units('0.0000000001', 9));
});
test('scenario includes L1, buffer, reserved funds, and all seven deployments', () => {
  const result = calculate(example);
  assert.equal(result.execution, 1000000000000n);
  assert.equal(result.perDeployment, 2600000000000n);
  assert.equal(result.total, 18200000000000n);
  assert.equal(result.capacity, 196n);
  assert.equal(result.remaining, 591800000000000n);
  assert.equal(result.affordable, true);
});
test('operator cost and transferred value are counted for every deployment', () => {
  const result = calculate({ ...example, operator: '0.000001', value: '0.0001' });
  assert.equal(result.perDeployment, 103900000000000n);
  assert.equal(result.capacity, 4n);
  assert.equal(result.affordable, false);
  assert.equal(result.shortfall, result.total - result.available);
});
test('buffer rounds UP to a whole wei and does not multiply the transferred value', () => {
  const result = calculate({ ...example, gas: '1', price: '0.000000001', l1: '0', value: '0.000000000000000005', margin: '0.01' });
  assert.equal(result.bufferedFee, 2n);
  assert.equal(result.perDeployment, 7n);
});
test('exact budget boundary and an empty usable budget', () => {
  const one = calculate({ ...example, reserve: '0', count: '1' });
  const exact = calculate({ ...example, budget: formatUnits(one.perDeployment), reserve: '0', count: '1' });
  assert.equal(exact.affordable, true);
  assert.equal(exact.capacity, 1n);
  assert.equal(exact.remaining, 0n);
  assert.equal(calculate({ ...example, reserve: example.budget }).capacity, 0n);
});
test('invalid, missing, signed, exponential, or fractional integer inputs are rejected', () => {
  for (const budget of ['', ' ', '-1', 'NaN', 'Infinity', '1e-3', '0x12', '1,000']) assert.throws(() => calculate({ ...example, budget }));
  for (const count of ['0', '1.5', '1000001']) assert.throws(() => calculate({ ...example, count }));
  assert.throws(() => calculate({ ...example, price: '0' }));
  assert.throws(() => calculate({ ...example, reserve: '1' }));
  assert.throws(() => calculate({ ...example, margin: '500.01' }));
});
