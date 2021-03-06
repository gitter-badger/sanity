import path from 'path'
import fsp from 'fs-promise'
import {resolveParts} from '@sanity/resolver'
import promiseProps from 'promise-props-recursive'
import generateHelpUrl from '@sanity/generate-help-url'

function sanityCheck(options) {
  return resolveParts({
    basePath: options.dir,
    useCompiledPaths: options.productionMode
  }).then(parts => checkImplementations(parts, options))
}

function checkImplementations({implementations}, options) {
  if (!implementations) {
    return Promise.resolve('No implementations found, nothing to check')
  }

  const fulfillers = Object.keys(implementations).reduce((impls, partName) => {
    return impls.concat(
      implementations[partName].map(impl => ({
        partName: partName,
        plugin: impl.plugin,
        path: impl.path,
        dirName: path.dirname(impl.path),
        fileName: path.basename(impl.path)
      })
    ))
  }, [])

  return getFolderContents(fulfillers.map(impl => impl.dirName))
    .then(folders => verifyImplementationsExist(fulfillers, folders))
    .then(results => throwOnErrors(results, options))
}

function throwOnErrors(results, options) {
  const errors = results
    .filter(result => result instanceof Error)
    .map(err => ` * ${err.message}`)

  if (errors.length > 0) {
    if (options.productionMode) {
      errors.push(getProductionHint())
    }

    const err = new Error(errors.join('\n\n'))
    err.messages = errors
    err.sanityCheck = true
    throw err
  }
}

function getFolderContents(dirs) {
  return promiseProps(dirs.reduce((folders, dir) => {
    if (!folders[dir]) {
      folders[dir] = fsp.readdir(dir).catch(() => [])
    }
    return folders
  }, {}))
}

function verifyImplementationsExist(implementations, folderContents) {
  return Promise.all(implementations.map(impl =>
    verifyImplementationExists(impl, folderContents[impl.dirName])
  ))
}

function verifyImplementationExists(impl, parentDirContent) {
  // Case-sensitive check
  const containsFile = parentDirContent.includes(impl.fileName)
  const containsJsFile = parentDirContent.includes(`${impl.fileName}.js`)
  if (containsFile) {
    return isFileOrDirectoryWithIndex(impl)
  } else if (containsJsFile) {
    return true
  }

  // Case-insensitive check
  const targetFile = impl.fileName.toLowerCase()
  const targetJsFile = `${targetFile}.js`
  const found = parentDirContent.find(file =>
    file.toLowerCase() === targetFile || file.toLowerCase() === targetJsFile
  )

  if (found) {
    return new Error(
      `Part "${impl.partName}" was attempted to be implemented by "${impl.path}",`
      + `but the file is actually located at "${path.join(impl.dirName, found)}" -`
      + ' Sanity uses case-sensitive file names.'
    )
  }

  // Directory/index.js check
  return isFileOrDirectoryWithIndex(impl)
}

function checkImplementationMsg(impl) {
  const location = impl.plugin === '(project root)'
    ? 'Check "sanity.json"'
    : `Check "${impl.plugin}"`

  return `${location} and keep in mind that paths in Sanity are case-sensitive.`
}

function isFileOrDirectoryWithIndex(impl) {
  return fsp.stat(impl.path).then(stats => {
    return stats.isDirectory()
      ? directoryHasIndex(impl)
      : true
  }).catch(() => new Error(
    `Part "${impl.partName}" was attempted to be implemented by "${impl.path}", `
    + `which does not seem to exist. ${checkImplementationMsg(impl)}`
  ))
}

function directoryHasIndex(impl) {
  return fsp.readdir(impl.path).then(dirContent => {
    return dirContent.includes('index.js')
      ? true
      : new Error(
        `Part "${impl.partName}" was attempted to be implemented by "${impl.path}", `
        + 'which is a directory without an "index.js". Please point to a filename.'
      )
  })
}

/* eslint-disable prefer-template */
function getProductionHint() {
  return (
    '[NOTE]: sanity-check is running in production mode - '
    + 'perhaps you have defined a `compiled` path in `sanity.json`? '
    + 'This tells Sanity to look for the files in a different location '
    + 'when running in production mode. When publishing plugins to npm '
    + 'you should make sure to publish precompiled files. See '
    + generateHelpUrl('source-vs-compiled-paths')
  )
}
/* eslint-enable prefer-template */

export default sanityCheck
