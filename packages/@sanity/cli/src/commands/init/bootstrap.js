import path from 'path'
import fsp from 'fs-promise'
import partialRight from 'lodash/partialRight'
import promiseProps from 'promise-props-recursive'
import {
  createPackageManifest,
  createSanityManifest,
  createPluginManifest
} from './createManifest'

export async function bootstrapSanity(targetPath, data, output) {
  const writeIfNotExists = partialRight(writeFileIfNotExists, output)

  // Create folder structure
  let spinner = output.spinner('Creating folder structure').start()
  await Promise.all([
    fsp.ensureDir(path.join(targetPath, 'config')),
    fsp.ensureDir(path.join(targetPath, 'plugins')),
    fsp.ensureDir(path.join(targetPath, 'static')),
    fsp.ensureDir(path.join(targetPath, 'schemas'))
  ])
  spinner.succeed()

  // Initialize/populate templates
  spinner = output.spinner('Bootstrapping project files').start()
  const templates = await promiseProps({
    pluginGitKeep: readTemplate('pluginGitKeep'),
    staticGitKeep: readTemplate('staticGitKeep'),
    gitIgnore: readTemplate('gitignore'),
    checksums: readTemplate('checksums'),
    schema: readTemplate('schema'),
    manifest: createPackageManifest(data),
    sanity: createSanityManifest(data, {}),
    readme: `# ${data.name}\n\n${data.description}\n`
  })

  // Write files to target
  await Promise.all([
    writeIfNotExists(path.join(targetPath, 'plugins', '.gitkeep'), templates.pluginGitKeep),
    writeIfNotExists(path.join(targetPath, 'static', '.gitkeep'), templates.staticGitKeep),
    writeIfNotExists(path.join(targetPath, 'config', '.checksums'), templates.checksums),
    writeIfNotExists(path.join(targetPath, 'schemas', 'schema.js'), templates.schema),
    writeIfNotExists(path.join(targetPath, '.gitignore'), templates.gitIgnore),
    writeIfNotExists(path.join(targetPath, 'package.json'), templates.manifest),
    writeIfNotExists(path.join(targetPath, 'sanity.json'), templates.sanity),
    writeIfNotExists(path.join(targetPath, 'README.md'), templates.readme)
  ])
  spinner.succeed()
}

export function bootstrapPlugin(data, opts = {}) {
  const writeIfNotExists = partialRight(writeFileIfNotExists, opts.output)
  const collect = {
    pluginConfig: readTemplate('plugin-config'),
    gitIgnore: readTemplate('gitignore'),
    manifest: createPluginManifest(data, opts),
    readme: `# ${data.name}\n\n${data.description}\n`,
    sanity: createSanityManifest(data, {
      isPlugin: true,
      isSanityStyle: opts.sanityStyle
    })
  }

  const targetPath = data.outputPath
  const styleMetaFiles = ['babelrc', 'editorconfig', 'eslintignore', 'eslintrc', 'npmignore', 'gitignore']

  if (opts.sanityStyle) {
    styleMetaFiles.forEach(file => {
      collect[file] = readTemplate(path.join('sanity-style', file))
    })
  }

  return fsp.ensureDir(targetPath).then(() => promiseProps(collect))
    .then(templates => {
      if (!data.createConfig) {
        return templates
      }

      const confPath = path.join(targetPath, 'config.dist.json')
      return writeIfNotExists(confPath, templates.pluginConfig).then(() => templates)
    })
    .then(templates => {
      const writeOps = [
        writeIfNotExists(path.join(targetPath, '.gitignore'), templates.gitIgnore),
        writeIfNotExists(path.join(targetPath, 'package.json'), templates.manifest),
        writeIfNotExists(path.join(targetPath, 'sanity.json'), templates.sanity),
        writeIfNotExists(path.join(targetPath, 'README.md'), templates.readme)
      ]

      if (opts.sanityStyle) {
        styleMetaFiles.forEach(file =>
          writeOps.push(writeIfNotExists(
            path.join(targetPath, `.${file}`),
            templates[file]
          ))
        )
      }

      return Promise.all(writeOps)
    })
    .then(() => {
      if (!opts.sanityStyle) {
        return
      }

      fsp.ensureDir(path.join(targetPath, 'src')).then(() =>
        writeIfNotExists(
          path.join(targetPath, 'src', 'MyComponent.js'),
          "import React from 'react'\n\n"
          + 'export default function MyComponent() {\n'
          + '  return <div />\n'
          + '}\n'
        )
      )
    })
}

function readTemplate(file) {
  return fsp.readFile(path.join(__dirname, 'templates', file))
}

function writeFileIfNotExists(filePath, content, output) {
  return fsp.writeFile(filePath, content, {flag: 'wx'})
    .catch(err => {
      if (err.code === 'EEXIST') {
        output.print(`[WARN] File "${filePath}" already exists, skipping`)
      } else {
        throw err
      }
    })
}
