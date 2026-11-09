import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electoresAPI', {
  listar: (options) => ipcRenderer.invoke('electores:listar', options)
})