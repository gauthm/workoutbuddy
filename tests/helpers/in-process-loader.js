export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'supertest') {
    return { url: new URL('./in-process-request.js', import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
