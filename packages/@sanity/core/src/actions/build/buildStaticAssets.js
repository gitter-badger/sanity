import fsp from 'fs-promise'
import path from 'path'
import thenify from 'thenify'
import filesize from 'filesize'
import sortModulesBySize from '../../stats/sortModulesBySize'
import getConfig from '@sanity/util/lib/getConfig'
import {
  getWebpackCompiler,
  getDocumentElement,
  ReactDOM
} from '@sanity/server'

export default (args, context) => {
  const {output, workDir} = context
  const flags = args.extOptions
  const outputDir = args.argsWithoutOptions[0] || path.join(workDir, 'dist')
  const config = getConfig(workDir).get('server')
  const compilationConfig = {
    env: 'production',
    staticPath: resolveStaticPath(workDir, config),
    basePath: workDir,
    outputPath: path.join(outputDir, 'static')
  }

  const compiler = getWebpackCompiler(compilationConfig)
  const compile = thenify(compiler.run.bind(compiler))

  const spin = output.spinner('Building Sanity...')
  spin.start()

  const bundle = {}

  return compile()
    .then(statistics => {
      const stats = statistics.toJson()
      if (stats.errors && stats.errors.length > 0) {
        throw new Error(
          `Errors while building:\n\n${stats.errors.join('\n\n')}`
        )
      }

      const chunkMap = {}
      stats.chunks.forEach(chunk =>
        chunk.files.forEach(file => {
          chunkMap[file] = chunk.hash
        })
      )

      bundle.stats = stats
      return chunkMap
    })
    .then(chunkMap => {
      spin.text = 'Building index document'
      return getDocumentElement(compilationConfig, {
        scripts: ['https://cdn.polyfill.io/v2/polyfill.min.js?features=Intl.~locale.en', 'vendor.bundle.js', 'app.bundle.js'].map(asset => ({
          path: `js/${asset}`,
          hash: chunkMap[asset]
        }))
      })
    })
    .then(doc =>
      fsp.writeFile(
        path.join(outputDir, 'index.html'),
        `<!doctype html>${ReactDOM.renderToStaticMarkup(doc)}`
      )
    )
    .then(() => spin.stop())
    .then(() => {
      bundle.stats.warnings.forEach(output.print)

      output.print(`Javascript bundles built, time spent: ${bundle.stats.time}ms`)

      if (flags.stats) {
        output.print('\nLargest modules (unminified, uncompressed sizes):')
        sortModulesBySize(bundle.stats.modules).slice(0, 10).forEach(module =>
          output.print(`[${filesize(module.size)}] ${module.name}`)
        )
      }
    })
    .catch(err => {
      spin.stop()
      output.error(err)
    })
}

function resolveStaticPath(rootDir, config) {
  const {staticPath} = config
  return path.isAbsolute(staticPath)
    ? staticPath
    : path.resolve(path.join(rootDir, staticPath))
}