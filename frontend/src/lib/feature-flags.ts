/**
 * Feature flags controlled by environment variables.
 * Vite exposes only vars prefixed with VITE_.
 */

export const isNexusArchitectEnabled =
  import.meta.env.VITE_ENABLE_NEXUS_ARCHITECT === 'true' ||
  import.meta.env.VITE_ENABLE_NEXUS_ARCHITECT === '1'
