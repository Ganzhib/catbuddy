/**
 * Preload entry — pure CommonJS, not compiled by TypeScript.
 */
const { contextBridge } = require('electron')
const { createCatbuddyApi } = require('./api/index.cjs')
const { assertSafeBridgeApi } = require('./security/index.cjs')

const api = createCatbuddyApi()
assertSafeBridgeApi(api)
contextBridge.exposeInMainWorld('catbuddy', api)
