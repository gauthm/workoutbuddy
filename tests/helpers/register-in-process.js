import { register } from 'node:module'
register('./in-process-loader.js', import.meta.url)
