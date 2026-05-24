/**
 * Preload entry — pure CommonJS, not compiled by TypeScript.
 */
const { contextBridge } = require('electron')
const { createLearnbuddyApi } = require('./api/index.cjs')
const { assertSafeBridgeApi } = require('./security/index.cjs')

const api = createLearnbuddyApi()
assertSafeBridgeApi(api)
contextBridge.exposeInMainWorld('learnbuddy', api)
