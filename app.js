import { calculate, formatUnits } from './calculator.js';

const $ = id => document.getElementById(id);
const form = $('calculator');
let current = null;
let gasSource = { mode: 'manual-example' };
function read() { return Object.fromEntries(new FormData(form)); }
function render() {
  try {
    current = calculate(read());
    $('error').hidden = true;
    const r = current;
    $('total').textContent = formatUnits(r.total);
    $('capacity').textContent = r.capacity.toLocaleString('ko-KR');
    $('remaining').textContent = formatUnits(r.remaining);
    $('verdict').textContent = r.affordable ? `목표 ${r.count}건 · 예비 잔액을 남기고 계산상 가능` : `예비 잔액을 유지하려면 ${formatUnits(r.shortfall)} ETH 부족`;
    $('verdict').classList.toggle('insufficient', !r.affordable);
    $('execution').textContent = formatUnits(r.execution) + ' ETH';
    $('other').textContent = formatUnits(r.l1 + r.operator) + ' ETH';
    $('buffer').textContent = formatUnits(r.bufferedFee - r.baseFee) + ' ETH';
    $('per-deployment').textContent = formatUnits(r.perDeployment) + ' ETH';
    const fees = [r.execution, r.l1 + r.operator, r.bufferedFee - r.baseFee];
    [...$('fee-bar').children].forEach((element, index) => { element.style.width = `${Number(fees[index] * 10000n / r.bufferedFee) / 100}%`; });
    $('export').disabled = false;
  } catch (error) {
    current = null;
    $('error').textContent = error.message;
    $('error').hidden = false;
    for (const id of ['total', 'capacity', 'remaining', 'execution', 'other', 'buffer', 'per-deployment']) $(id).textContent = '—';
    $('verdict').textContent = '입력값을 확인해 주세요';
    $('verdict').classList.remove('insufficient');
    [...$('fee-bar').children].forEach(element => element.style.width = '0%');
    $('export').disabled = true;
  }
  document.querySelectorAll('[data-count]').forEach(button => button.classList.toggle('active', button.dataset.count === $('count').value));
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target.id === 'price') {
    gasSource = { mode: 'manual' };
    $('rpc-status').textContent = 'gas 가격을 수동 입력했어요';
  }
  render();
});
document.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => { $('count').value = button.dataset.count; render(); }));

async function rpc(method) {
  const response = await fetch('https://mainnet.base.org', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('RPC 응답 오류');
  const body = await response.json();
  if (body.error || typeof body.result !== 'string' || !/^0x[0-9a-f]+$/i.test(body.result)) throw new Error('RPC 응답을 확인할 수 없어요');
  return body.result;
}
$('refresh').addEventListener('click', async () => {
  $('refresh').disabled = true;
  $('rpc-status').textContent = 'Base 공개 RPC에 조회 중…';
  try {
    const [chain, price] = await Promise.all([rpc('eth_chainId'), rpc('eth_gasPrice')]);
    if (BigInt(chain) !== 8453n || BigInt(price) === 0n) throw new Error('Base 메인넷 응답이 아니에요');
    const at = new Date();
    $('price').value = formatUnits(BigInt(price), 9);
    gasSource = { mode: 'rpc', rpc: 'https://mainnet.base.org', at: at.toISOString() };
    $('rpc-status').textContent = `${at.toLocaleTimeString('ko-KR')} 기준 · gas 가격만 갱신`;
    render();
  } catch {
    $('rpc-status').textContent = '조회 실패 · 기존 입력값으로 계산 중이에요';
  } finally { $('refresh').disabled = false; }
});
$('export').addEventListener('click', () => {
  if (!current) return;
  const report = { tool: 'Base Gas Desk', version: 1, createdAt: new Date().toISOString(), chainId: 8453,
    note: 'Scenario estimate only. L1 and operator fees are manually supplied. No transactions submitted.',
    inputs: read(), gasSource, resultWei: current };
  const blob = new Blob([JSON.stringify(report, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'base-gas-budget.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
