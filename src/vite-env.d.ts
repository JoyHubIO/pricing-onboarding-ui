/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The pricing API host (joyhub-integration's Scala API). */
  readonly VITE_SCALA_API_URL?: string
  /** Used when one host answers both APIs. */
  readonly VITE_API_URL?: string
  /** `on` shows the test routes and status panels on a production build; `off` hides them in development. */
  readonly VITE_TEST_ROUTES?: string
}
