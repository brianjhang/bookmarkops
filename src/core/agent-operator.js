import { storageGet, storageSet } from './chrome-api.js'

const AGENT_CONFIG_KEY = 'bookmarkops.agentConfig'

export async function getAgentConfig(storageApi = globalThis.chrome?.storage?.local) {
  const config = (await storageGet(storageApi, AGENT_CONFIG_KEY))?.[AGENT_CONFIG_KEY]

  if (config) {
    const normalized = normalizeAgentConfig(config)

    if (!normalized.token) {
      const migratedConfig = createDefaultAgentConfig()
      await storageSet(storageApi, { [AGENT_CONFIG_KEY]: migratedConfig })
      return migratedConfig
    }

    return normalized
  }

  const defaultConfig = createDefaultAgentConfig()
  await storageSet(storageApi, { [AGENT_CONFIG_KEY]: defaultConfig })
  return defaultConfig
}

export async function setAgentConfig(storageApi, config) {
  const currentConfig = await getAgentConfig(storageApi)
  const nextConfig = {
    enabled: config.enabled !== false,
    token: normalizeToken(config.token) || currentConfig.token || createSessionToken(),
    manualMode: Boolean(config.manualMode),
    initializedAt: currentConfig.initializedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await storageSet(storageApi, { [AGENT_CONFIG_KEY]: nextConfig })
  return maskAgentConfig(nextConfig)
}

export async function rotateAgentToken(storageApi = globalThis.chrome?.storage?.local) {
  const config = await getAgentConfig(storageApi)
  const nextConfig = {
    ...config,
    token: createSessionToken(),
    updatedAt: new Date().toISOString(),
  }

  await storageSet(storageApi, { [AGENT_CONFIG_KEY]: nextConfig })
  return maskAgentConfig(nextConfig)
}

export async function requireAgentSession(storageApi, token) {
  const config = await getAgentConfig(storageApi)

  if (!config.enabled) {
    throw new Error('Agent Operator Mode is disabled.')
  }

  if (!config.token || token !== config.token) {
    throw new Error('Valid agent session token is required.')
  }

  return config
}

// Used by /pending consumers (the MCP bridge poll path) where the agentToken
// no longer travels in the request payload. The bridge has already gated
// /enqueue with the configured token (B1), and the same-process MCP server is
// trusted, so the extension only needs to confirm agent mode is enabled and a
// token exists in storage before executing.
export async function requireAgentEnabled(storageApi) {
  const config = await getAgentConfig(storageApi)

  if (!config.enabled) {
    throw new Error('Agent Operator Mode is disabled.')
  }

  if (!config.token) {
    throw new Error('Agent token is not configured.')
  }

  return config
}

export function maskAgentConfig(config, options = {}) {
  const normalized = normalizeAgentConfig(config)

  return {
    enabled: normalized.enabled,
    hasToken: Boolean(normalized.token),
    manualMode: normalized.manualMode,
    sessionToken: options.includeToken ? normalized.token : undefined,
    maskedSessionToken: maskToken(normalized.token),
    initializedAt: normalized.initializedAt || null,
    updatedAt: normalized.updatedAt || null,
  }
}

function normalizeAgentConfig(config = {}) {
  return {
    enabled: config.enabled !== false,
    token: normalizeToken(config.token),
    manualMode: Boolean(config.manualMode),
    initializedAt: config.initializedAt || null,
    updatedAt: config.updatedAt || null,
  }
}

function createDefaultAgentConfig() {
  const now = new Date().toISOString()

  return {
    enabled: true,
    token: createSessionToken(),
    manualMode: false,
    initializedAt: now,
    updatedAt: now,
  }
}

function normalizeToken(token) {
  return typeof token === 'string' ? token.trim() : ''
}

function createSessionToken() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  const values = new Uint32Array(4)
  globalThis.crypto.getRandomValues(values)
  return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('-')
}

function maskToken(token) {
  const normalized = normalizeToken(token)
  if (!normalized) return ''
  if (normalized.length <= 8) return '••••'
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`
}

