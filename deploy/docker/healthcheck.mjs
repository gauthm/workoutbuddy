import http from 'node:http'

// Node fetch does not preserve a custom Host header; core HTTP does.
const port = process.env.PORT || '3000'
const host = process.env.PUBLIC_ORIGIN
  ? new URL(process.env.PUBLIC_ORIGIN).host
  : `localhost:${port}`
await new Promise(resolve => {
  const request = http.get({ hostname: '127.0.0.1', port, path: '/api/v1/settings', headers: { Host: host } }, response => {
    response.resume()
    response.on('end', () => {
      if (response.statusCode !== 200) process.exitCode = 1
      resolve()
    })
  })
  request.setTimeout(4000, () => request.destroy(new Error('Health check timed out')))
  request.on('error', () => { process.exitCode = 1; resolve() })
})
