// Load sql.js worker
;(async function () {
  // eslint-disable-next-line
  const SQL = await initSqlJs({ locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.4.0/dist/${filename}` })
  let db = null

  const execObject = (sql) => {
    const [{ columns, values }] = db.exec(sql)
    return values.map((value) => columns.reduce((obj, col, index) => ({
      ...obj,
      [col]: value[index]
    }), {}))
  }

  // eslint-disable-next-line
  const app = new Vue({
    el: '#app',
    data: {
      loaded: false,
      activePlayset: '',
      data: '',
      importName: '',
      playsets: [],
      mods: []
    },
    computed: {
      exportLink () {
        const { protocol, host, pathname } = window.location
        return `${protocol}//${host}${pathname}#${this.data}`
      },
      importMods () {
        const data = this.data.split(',')
        const ids = data.slice(1).map(item => {
          switch (data[0]) {
            case 'b16':
              return parseInt(item, 16)
            case 'b36':
              return parseInt(item, 36)
            default:
              return item
          }
        })

        return ids.map(id => this.mods[id] || {
          steamId: id,
          unknown: true
        })
      },
      unknownMods () {
        return this.importMods.filter(item => item.unknown).length
      }
    },
    methods: {
      selectFile () {
        this.$refs.file.click()
      },
      handleFile () {
        const files = this.$refs.file.files
        if (files.length === 0) return

        const reader = new FileReader()
        reader.onload = () => {
          var Uints = new Uint8Array(reader.result)
          db = new SQL.Database(Uints)

          const mods = execObject('SELECT * FROM mods')
          const playsetsMods = execObject('SELECT * FROM playsets_mods')
          const modIdMap = {}
          const modMap = {}
          for (const mod of mods) {
            modIdMap[mod.id] = mod.steamId
            modMap[mod.steamId] = {
              steamId: mod.steamId,
              name: mod.displayName
            }
          }

          this.playsets = execObject('SELECT * FROM playsets').map(playset => {
            const playsetMods = playsetsMods
              .filter(item => item.playsetId === playset.id && item.enabled)
              .sort((a, b) => a.position.localeCompare(b.position))
              .map(item => {
                const steamId = modIdMap[item.modId]
                if (!steamId) return null

                return modMap[steamId] || null
              })
              .filter(item => item !== null)

            return {
              ...playset,
              mods: playsetMods
            }
          })
          this.mods = modMap
          this.loaded = true
        }
        reader.readAsArrayBuffer(files[0])
      },
      handleExpand (id) {
        if (this.activePlayset === id) {
          this.activePlayset = ''
        } else {
          this.activePlayset = id
        }
      },
      exportPlayset (playset) {
        this.data = 'b36,' + playset.mods.map(({ steamId }) => (+steamId).toString(36)).join(',')
      }
    }
  })

  const handleHashChange = () => {
    if (!location.hash) return
    app.data = location.hash.slice(1)
  }
  window.addEventListener('hashchange', handleHashChange)
  handleHashChange()
})()
