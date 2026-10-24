// The app's single store instance. In the browser this persists to
// localStorage; in non-browser runtimes (build, tests) it falls back to
// memory via createStore's default storage.
import { createStore } from './store.js'

export const store = createStore()
