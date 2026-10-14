// Pick preparation loads only from the available inventory, below the working load.
export function warmupLoads(targetWeight, achievableLoads = [], equipmentRequired = []) {
  if (!Number.isFinite(targetWeight) || targetWeight <= 0 || equipmentRequired.includes('resistance_band')) return []
  const lighter = [...new Set(achievableLoads.filter(weight => Number.isFinite(weight) && weight > 0 && weight < targetWeight))].sort((a,b)=>a-b)
  if (!lighter.length) return []
  return [...new Set([.4,.7].map(ratio => lighter.filter(weight => weight <= targetWeight*ratio).at(-1) ?? lighter[0]))]
}
