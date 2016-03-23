import mockFs from 'mock-fs'
import resolvePlugins, {resolveRoles} from '../src/resolver'
import {afterEach, describe, it} from 'mocha'
import {
  getBasicTree,
  getDeepTree,
  getInvalidJson,
  getInvalidManifest,
  getMixedPluginTree,
  getResolutionOrderFixture,
  getScopedPluginsTree,
  getStyleTree,
  getMultiTree
} from './fixtures'

describe('plugin resolver', () => {
  afterEach(() => {
    mockFs.restore()
  })

  it('rejects on invalid root-level JSON', () => {
    mockFs(getInvalidJson({atRoot: true}))
    return resolvePlugins({basePath: '/sanity'}).should.be.rejectedWith(SyntaxError)
  })

  it('rejects on invalid non-root-level JSON', () => {
    mockFs(getInvalidJson({atRoot: false}))
    return resolvePlugins({basePath: '/sanity'}).should.be.rejectedWith(SyntaxError)
  })

  it('rejects on invalid root-level manifest', () => {
    mockFs(getInvalidManifest({atRoot: true}))
    return resolvePlugins({basePath: '/sanity'}).should.be.rejectedWith(/ValidationError/, /must be an array/)
  })

  it('rejects on invalid non-root-level manifest', () => {
    mockFs(getInvalidManifest({atRoot: false}))
    return resolvePlugins({basePath: '/sanity'}).should.be.rejectedWith(/ValidationError/, /must be an array/)
  })

  it('rejects on missing plugin', () => {
    mockFs(getDeepTree({missingPlugin: true}))
    return resolvePlugins({basePath: '/sanity'}).should.be.rejectedWith(/Error/, /"missing"/)
  })

  it('rejects on missing plugin manifest', () => {
    mockFs(getDeepTree({missingManifest: true}))
    return resolvePlugins({basePath: '/sanity'}).should.be.rejectedWith(/Error/, /"sanity\.json"/)
  })

  it('resolves plugins in the right order', () => {
    mockFs(getDeepTree())
    return resolvePlugins({basePath: '/sanity'}).then(plugins => {
      plugins.map(plugin => plugin.name).should.eql([
        '@sanity/default-layout',
        '@sanity/core',
        'baz',
        'bar',
        'foo'
      ])
    })
  })

  describe('respects the sanity plugin resolution order', () => {
    it('prefers fully qualified, local path (/plugins/sanity-plugin-<name>)', () => {
      mockFs(getResolutionOrderFixture({chosenMethod: 'fullLocalPath'}))
      return resolvePlugins({basePath: '/sanity'}).then(plugins => {
        plugins[0].path.should.equal('/sanity/plugins/sanity-plugin-bar')
      })
    })

    it('prefers short-named, local path as 2nd option (/plugins/<name>)', () => {
      mockFs(getResolutionOrderFixture({chosenMethod: 'shortLocalPath'}))
      return resolvePlugins({basePath: '/sanity'}).then(plugins => {
        plugins[0].path.should.equal('/sanity/plugins/bar')
      })
    })

    const subPath = '/node_modules/sanity-plugin-<parent>/node_modules/sanity-plugin-<name>'
    it(`prefers fully qualified in parent plugin node_modules as 3rd option (${subPath})`, () => {
      mockFs(getResolutionOrderFixture({chosenMethod: 'subNodeModules'}))
      return resolvePlugins({basePath: '/sanity'}).then(plugins => {
        plugins[0].path.should.equal('/sanity/node_modules/sanity-plugin-foo/node_modules/sanity-plugin-bar')
      })
    })

    it('prefers fully qualified in root node_modules as 4th option (/node_modules/sanity-plugin-<name>)', () => {
      mockFs(getResolutionOrderFixture({chosenMethod: 'nodeModules'}))
      return resolvePlugins({basePath: '/sanity'}).then(plugins => {
        plugins[0].path.should.equal('/sanity/node_modules/sanity-plugin-bar')
      })
    })
  })

  it('can resolve roles for a basic setup', () => {
    mockFs(getBasicTree())
    return resolveRoles({basePath: '/sanity'}).then(res => {
      const settings = res.provided['default-layout/settings-pane']
      settings.path.should.equal('/sanity/node_modules/@sanity/default-layout')
      settings.multi.should.equal(true)

      const tool = res.fulfilled['default-layout/tool']
      tool.should.have.length(2)
      tool[0].should.eql({
        plugin: 'instagram',
        path: '/sanity/node_modules/sanity-plugin-instagram/lib/components/InstagramTool'
      })

      const main = res.fulfilled['core/mainComponent']
      main.should.eql({
        plugin: '@sanity/default-layout',
        path: '/sanity/node_modules/@sanity/default-layout/src/components/Main'
      })

      const comments = res.fulfilled['instagram/commentsListComponent']
      comments.should.eql({
        plugin: 'instagram',
        path: '/sanity/node_modules/sanity-plugin-instagram/lib/components/CommentsList'
      })
    })
  })

  it('resolves plugins as well as roles', () => {
    mockFs(getBasicTree())
    return resolveRoles({basePath: '/sanity'}).then(res => {
      res.plugins.should.have.length(3)
      res.plugins.map(plugin => plugin.path).should.eql([
        '/sanity/node_modules/@sanity/default-layout',
        '/sanity/node_modules/@sanity/core',
        '/sanity/node_modules/sanity-plugin-instagram'
      ])
    })
  })

  it('doesnt try to look up the same location twice', () => {
    mockFs(getScopedPluginsTree())
    return resolveRoles({basePath: '/sanity'}).catch(err => {
      err.locations.some((location, index) =>
        err.locations.indexOf(location, index + 1) !== -1
      ).should.equal(false)
    })
  })

  it('resolves path to lib for node_modules, src for plugins', () => {
    mockFs(getMixedPluginTree())
    return resolveRoles({basePath: '/sanity'}).then(res => {
      res.fulfilled['default-layout/tool'][0].should.eql({
        plugin: 'foo',
        path: '/sanity/plugins/foo/src/File'
      })

      res.fulfilled['default-layout/tool'][1].should.eql({
        plugin: 'instagram',
        path: '/sanity/node_modules/sanity-plugin-instagram/lib/components/InstagramTool'
      })
    })
  })

  it('late-defined plugins override default implementations of roles', () => {
    mockFs(getMixedPluginTree())
    return resolveRoles({basePath: '/sanity'}).then(res => {
      res.fulfilled['instagram/commentsListComponent'].should.eql({
        plugin: 'foo',
        path: '/sanity/plugins/foo/src/InstaComments'
      })
    })
  })

  it('resolves multi-fulfiller roles correctly', () => {
    mockFs(getMultiTree())
    return resolveRoles({basePath: '/sanity'}).then(res => {
      res.provided.should.have.property('components:@sanity/base/absolutes')
      res.fulfilled.should.have.property('components:@sanity/base/absolutes')
      res.fulfilled['components:@sanity/base/absolutes'].should.have.length(2)
    })
  })

  it('treats all style roles as multi-fulfiller roles', () => {
    mockFs(getStyleTree())
    return resolveRoles({basePath: '/sanity'}).then(res => {
      res.fulfilled['style:@sanity/default-layout/header'].should.eql([
        {
          path: '/sanity/node_modules/sanity-plugin-screaming-dev-badge/css/scream.css',
          plugin: 'screaming-dev-badge'
        },
        {
          path: '/sanity/node_modules/sanity-plugin-material-design/css/header.css',
          plugin: 'material-design'
        },
        {
          path: '/sanity/node_modules/@sanity/default-layout/css/header.css',
          plugin: '@sanity/default-layout'
        }
      ])
    })
  })
})