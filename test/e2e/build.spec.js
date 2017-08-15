'use strict'

const td = require('testdouble')
const fse = require('fs-extra')
const build = require('../../lib/cli/build').handler
const e2eHelpers = require('../helpers/e2e')
const updateSrc = e2eHelpers.updateSrc
const removeDist = e2eHelpers.removeDist
const compare = e2eHelpers.compare

describe('Build CLI', () => {
  const config = 'test/fixtures/e2e/houl.config.json'
  const cache = 'test/fixtures/e2e/.cache.json'

  let revert, console

  beforeEach(() => {
    console = {
      log: td.function(),
      error: td.function()
    }

    removeDist()
    fse.removeSync(cache)

    process.env.NODE_ENV = null
  })

  afterEach(() => {
    if (revert) {
      revert()
      revert = null
    }
  })

  it('should build in develop mode', done => {
    build({ config }, { console }).on('finish', () => {
      compare('dev')
      done()
    })
  })

  it('should build in production mode', done => {
    build({
      config,
      production: true
    }, { console }).on('finish', () => {
      compare('prod')
      done()
    })
  })

  it('should not build cached files', done => {
    build({ config, cache }, { console }).on('finish', () => {
      removeDist()
      revert = updateSrc()
      build({ config, cache }, { console }).on('finish', () => {
        compare('cache')
        done()
      })
    })
  })

  it('can output dot files', done => {
    build({ config, dot: true }, { console }).on('finish', () => {
      compare('dot')
      done()
    })
  })

  it('can filter input files', done => {
    build({ config, filter: '**/*.scss' }, { console }).on('finish', () => {
      compare('filtered')
      done()
    })
  })

  it('outputs log', done => {
    build({ config }, { console }).on('finish', () => {
      td.verify(console.error(), { times: 0, ignoreExtraArgs: true })
      td.verify(console.log('Building src -> dist'), { times: 1 })
      td.verify(console.log(
        td.matchers.contains('Finished')
      ), { times: 1 })
      done()
    })
  })
})
