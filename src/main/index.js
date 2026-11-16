import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

let db = null

const createDataBase = () => {
  // Crear el directorio (carpeta), para almacenar la base de datos
  const carpetaDatos = join(app.getPath('userData'), 'datos')
  mkdirSync(carpetaDatos, {recursive: true})

  // Crear o abrir mi base de datos
  const rutaBaseDatos = join(carpetaDatos, 'registro.sqlite')
  db = new DatabaseSync(rutaBaseDatos)

  console.log('Base de datos:', rutaBaseDatos)
  console.log(`Base de datos: ${rutaBaseDatos}`)
}

const listElectores = (_event, options) => {
  const { page, pageSize, search } = options ?? {}
  const allowedPageSizes = [10, 25, 50, 100]

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new TypeError('El número de página debe ser un entero positivo.')
  }
  if (!allowedPageSizes.includes(pageSize)) {
    throw new TypeError('El tamaño de página no es válido.')
  }
  if (typeof search !== 'string' || search.length > 200) {
    throw new TypeError('El texto de búsqueda no es válido.')
  }

  const query = search.trim()
  const offset = (page - 1) * pageSize
  if (!Number.isSafeInteger(offset)) {
    throw new TypeError('El número de página excede el límite permitido.')
  }
  const where = query
    ? `WHERE instr(lower(CAST(id AS TEXT)), lower(?)) > 0
        OR instr(lower(COALESCE(CAST(cedula AS TEXT), '')), lower(?)) > 0
        OR instr(lower(COALESCE(apellidos_nombres, '')), lower(?)) > 0`
    : ''
  const parameters = query ? [query, query, query] : []
  const total = db
    .prepare(`SELECT COUNT(*) AS total FROM electores ${where}`)
    .get(...parameters).total
  const rows = db
    .prepare(`
      SELECT id, nacionalidad, cedula, apellidos_nombres, centro, fecha_nacimiento
      FROM electores
      ${where}
      ORDER BY id
      LIMIT ? OFFSET ?
    `)
    .all(...parameters, pageSize, offset)

  return { rows, total }
}

const createElector = (_event, elector) => {
  if (!elector || typeof elector !== 'object' || Array.isArray(elector)) {
    throw new TypeError('Los datos del elector no son válidos.')
  }

  const readText = (value, field) => {
    if (typeof value !== 'string') {
      throw new TypeError(`${field} debe ser texto.`)
    }
    return value.trim()
  }

  const nacionalidad = readText(elector.nacionalidad, 'La nacionalidad').toUpperCase()
  const cedula = readText(elector.cedula, 'La cédula')
  const apellidosNombres = readText(elector.apellidos_nombres, 'Los apellidos y nombres')
  const centro = readText(elector.centro, 'El centro')
  const fechaNacimiento = readText(elector.fecha_nacimiento, 'La fecha de nacimiento')

  if (typeof nacionalidad !== 'string' || !/^[A-Z]$/.test(nacionalidad)) {
    throw new TypeError('La nacionalidad debe ser una letra.')
  }
  if (typeof cedula !== 'string' || !/^\d{1,15}$/.test(cedula)) {
    throw new TypeError('La cédula debe contener solo números.')
  }
  if (!Number.isSafeInteger(Number(cedula)) || Number(cedula) < 1) {
    throw new TypeError('La cédula está fuera del rango permitido.')
  }
  if (typeof apellidosNombres !== 'string' || !apellidosNombres || apellidosNombres.length > 200) {
    throw new TypeError('Los apellidos y nombres son obligatorios (máximo 200 caracteres).')
  }
  if (typeof centro !== 'string' || !centro || centro.length > 200) {
    throw new TypeError('El centro es obligatorio (máximo 200 caracteres).')
  }

  const dateMatch = fechaNacimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dateMatch) {
    throw new TypeError('La fecha de nacimiento no es válida.')
  }
  const [, year, month, day] = dateMatch
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    parsedDate.getUTCFullYear() !== Number(year) ||
    parsedDate.getUTCMonth() !== Number(month) - 1 ||
    parsedDate.getUTCDate() !== Number(day)
  ) {
    throw new TypeError('La fecha de nacimiento no es válida.')
  }

  const result = db.prepare(`
      INSERT INTO electores
        (nacionalidad, cedula, apellidos_nombres, centro, fecha_nacimiento)
      VALUES (?, ?, ?, ?, ?)
    `).run(nacionalidad, Number(cedula), apellidosNombres, centro, `${day}/${month}/${year}`)

  const total = db.prepare('SELECT COUNT(*) AS total FROM electores').get().total

  return { id: result.lastInsertRowid, total }
}

const listaElectores = () => {
  const lista = db.prepare(
    `SELECT id, cedula, apellidos_nombres, fecha_nacimiento
     FROM electores
     LIMIT ?
     OFFSET ?
    `).all(5, 5000)

    console.table(lista)
}

const obtenerElector = () => {
  const elector = db.prepare(
    `
    SELECT id, cedula, apellidos_nombres, fecha_nacimiento
    FROM electores
    WHERE id = ?
    `
  ).get(8900)

  console.log(elector)
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'))
  }
}

app.on('will-quit', () => {
  db?.close()
})

app.whenReady().then(() => {
  //listaElectores()
  //obtenerElector()
  createDataBase()
  ipcMain.handle('electores:listar', listElectores)
  ipcMain.handle('electores:crear', createElector)
  createWindow()
})
