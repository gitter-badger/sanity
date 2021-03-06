import path from 'path'
import prettyMs from 'pretty-ms'
import progrescii from 'progrescii'
import linecount from 'linecount/promise'
import debug from '../../debug'
import generateGuid from '../../util/generateGuid'
import readFirstLine from '../../util/readFirstLine'
import strengthenReferences from '../../actions/dataset/import/strengthenReferences'
import importDocumentsToDataset from '../../actions/dataset/import/importDocumentsToDataset'

export default {
  name: 'import',
  group: 'dataset',
  signature: '[FILE] [TARGET_DATASET]',
  description: 'Import dataset from local filesystem',
  action: async (args, context) => {
    const {apiClient, output, chalk} = context

    const gradientMode = args.extOptions.gradient
    const operation = getMutationOperation(args.extOptions)

    const [file, specifiedDataset] = args.argsWithoutOptions
    const signature = 'sanity dataset import [file] [dataset]'
    if (!file) {
      throw new Error(
        `File name must be specified ("${signature}")`
      )
    }

    const importStartTime = Date.now()
    const sourceFile = path.resolve(process.cwd(), file)
    const importId = generateGuid()
    let targetDataset = specifiedDataset
    let fromDataset = specifiedDataset
    let rewriteDataset = false
    try {
      const firstLine = await readFirstLine(sourceFile)
      const firstDocId = JSON.parse(firstLine)._id || ''
      fromDataset = firstDocId.split('/', 2)[0]
      rewriteDataset = specifiedDataset && fromDataset !== specifiedDataset
      targetDataset = specifiedDataset ? specifiedDataset : fromDataset
    } catch (err) {
      throw new Error(err.code === 'ENOENT'
        ? `File "${chalk.cyan(sourceFile)}" does not exist`
        : `Failed to parse specified file ("${chalk.cyan(sourceFile)}"): ${err.message}`
      )
    }

    if (!targetDataset) {
      throw new Error([
        'Could not resolve dataset for import, please specify target dataset:',
        chalk.cyan(`sanity dataset import ${file} ${chalk.bold('<targetDataset>')}`)
      ].join('\n'))
    }

    const client = getSanityClient({
      gradient: gradientMode,
      token: args.extOptions.token,
      dataset: targetDataset,
      apiClient: apiClient
    })

    const documentCount = await linecount(sourceFile)

    debug(`Found ${documentCount} lines in source file`)
    debug(`Target dataset has been resolved to "${targetDataset}"`)
    debug(`IDs ${rewriteDataset ? 'needs' : 'do not need'} to be rewritten`)

    let spinner = null

    // Verify existence of dataset before trying to import to it
    if (!gradientMode) {
      debug('Verifying if dataset already exists')
      spinner = output.spinner('Checking if destination dataset exists').start()
      const datasets = await client.datasets.list()
      if (!datasets.find(set => set.name === targetDataset)) {
        spinner.fail()
        throw new Error([
          `Dataset with name "${targetDataset}" not found.`,
          `Create it by running "${chalk.cyan(`sanity dataset create ${targetDataset}`)}" first`
        ].join('\n'))
      }
      spinner.succeed()
    }

    // Import documents to the target dataset
    const batchSize = 150
    const progressTotal = documentCount * 2 // @todo figure out how many reference maps we're gonna need and make a progress thing that makes sense
    const progress = progrescii.create({
      total: progressTotal,
      template: `${chalk.yellow('●')} Importing documents :b :p% in :ts`
    })

    const progressTicker = setInterval(() => progress.render(), 60)

    try {
      await importDocumentsToDataset({
        sourceFile,
        targetDataset,
        fromDataset,
        importId,
        operation,
        batchSize,
        client,
        progress: () => {
          if (progress.progress + batchSize >= documentCount) {
            progress.template = `${chalk.green('✔')} Importing documents :b :p% in :ts`
            clearInterval(progressTicker)
          }

          progress.step(Math.min(batchSize, documentCount))
        }
      }, context)
      clearInterval(progressTicker)
    } catch (err) {
      clearInterval(progressTicker)
      output.print('\n')
      return output.error(err)
    }

    // Make previously strong references strong once again
    let strengthenCount = 0
    const strengthenStart = Date.now()
    const baseStrengthenText = 'Strengthening weak references'
    spinner = output.spinner(baseStrengthenText).start()

    const strengthenProgress = docCount => {
      strengthenCount += docCount
      spinner.text = `${baseStrengthenText} (${strengthenCount} documents complete)`
    }

    try {
      await strengthenReferences({dataset: targetDataset, progress: strengthenProgress, client, importId})
      const strengthenTime = prettyMs(Date.now() - strengthenStart, {verbose: true})
      spinner.text = `${spinner.text} (${strengthenTime})`
      spinner.succeed()
    } catch (err) {
      spinner.fail()
      return output.error(err)
    }

    // That... should be it.
    const totalTime = prettyMs(Date.now() - importStartTime, {verbose: true})
    return output.print(`${chalk.green('All done!')} Spent ${totalTime}`)
  }
}

function getSanityClient(options) {
  if (!options.gradient) {
    return options.apiClient()
  }

  const existing = options.apiClient({requireUser: false})
  const config = existing.config()

  return existing.clone().config({
    gradientMode: true,
    apiHost: options.gradient,
    dataset: options.dataset || config.dataset,
    token: options.token || config.token,
  })
}

function getMutationOperation(flags) {
  const {replace, missing} = flags
  if (replace && missing) {
    throw new Error('Cannot use both --replace and --missing')
  }

  if (flags.replace) {
    return 'createOrReplace'
  }

  if (flags.missing) {
    return 'createIfNotExists'
  }

  return 'create'
}
