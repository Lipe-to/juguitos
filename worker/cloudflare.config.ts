import { bindings, defineConfig, exports as workerExports } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'juguitos-minas',
    entrypoint: './index.js',
    compatibilityDate: '2026-11-21',
    compatibilityFlags: ['nodejs_compat'],
    workersDev: true,
    previewUrls: false,
    env: { ROOMS: bindings.durableObject({ worker: 'juguitos-minas', exportName: 'MineRoom' }) },
    exports: { MineRoom: workerExports.durableObject({ storage: 'sqlite' }) },
    observability: {
      enabled: true,
      headSamplingRate: 0.01,
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
  },
})
