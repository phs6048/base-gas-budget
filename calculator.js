export function units(value, decimals, label = '값') {
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`${label}: 0 이상의 숫자를 입력하세요.`);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error(`${label}: 소수점 ${decimals}자리까지 입력할 수 있어요.`);
  if (whole.length > 30) throw new Error(`${label}: 입력값이 너무 커요.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}

export function formatUnits(value, decimals = 18) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const divisor = 10n ** BigInt(decimals);
  const fraction = (absolute % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return sign + (absolute / divisor).toString() + (fraction ? '.' + fraction : '');
}

export function calculate(input) {
  const budget = units(input.budget, 18, '총 예산');
  const reserve = units(input.reserve, 18, '남겨둘 ETH');
  const gas = units(input.gas, 0, '예상 gas 사용량');
  const price = units(input.price, 9, 'gas 가격');
  const l1 = units(input.l1, 18, 'L1 수수료');
  const operator = units(input.operator, 18, '운영 수수료');
  const value = units(input.value, 18, '배포 시 보내는 ETH');
  const count = units(input.count, 0, '목표 횟수');
  const margin = units(input.margin, 2, '여유 비율');
  if (gas === 0n || price === 0n || count === 0n) throw new Error('gas 사용량, gas 가격, 목표 횟수는 0보다 커야 해요.');
  if (count > 1000000n || gas > 1000000000n || margin > 50000n) throw new Error('횟수는 100만, gas는 10억, 여유 비율은 500% 이하로 입력하세요.');
  if (reserve > budget) throw new Error('남겨둘 ETH가 총 예산보다 많아요.');
  const execution = gas * price;
  const baseFee = execution + l1 + operator;
  // Ceiling division: never round the budget allowance down to a fraction of wei.
  const bufferedFee = (baseFee * (10000n + margin) + 9999n) / 10000n;
  const perDeployment = bufferedFee + value;
  const available = budget - reserve;
  const total = perDeployment * count;
  return { budget, reserve, execution, l1, operator, baseFee, bufferedFee, value, perDeployment,
    available, total, count, capacity: available / perDeployment,
    remaining: budget - total, shortfall: total > available ? total - available : 0n,
    affordable: total <= available };
}
