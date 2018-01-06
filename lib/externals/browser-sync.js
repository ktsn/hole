'use strict'

const fs = require('fs')
const path = require('path')
const url = require('url')
const vfs = require('vinyl-fs')
const browserSync = require('browser-sync')
const proxy = require('http-proxy-middleware')
const mime = require('mime')
const util = require('../util')

const defaultBsOptions = {
  ui: false,
  ghostMode: false,
  notify: false
}

module.exports = (config, bsOptions, depResolver, basePath) => {
  const bs = browserSync.create()

  bsOptions = util.merge(defaultBsOptions, bsOptions)

  bsOptions.server = config.output
  injectMiddleware(bsOptions, transformer(config, depResolver, basePath))
  config.proxy.forEach(p => {
    injectMiddleware(bsOptions, proxy(p.context, p.config))
  })

  bs.init(bsOptions)

  return bs
}

function injectMiddleware (options, middleware) {
  if (Array.isArray(options.middleware)) {
    options.middleware.push(middleware)
    return
  }

  if (options.middleware) {
    options.middleware = [options.middleware, middleware]
    return
  }

  options.middleware = [middleware]
}

function transformer (config, depResolver, basePath) {
  return (req, res, next) => {
    const parsedPath = url.parse(req.url).pathname
    const reqPath = normalizePath(parsedPath)

    const outputPath = resolveBase(basePath, reqPath)
    if (outputPath === null) {
      return next()
    }

    const rule = config.findRuleByOutput(outputPath, inputPath => {
      return fs.existsSync(path.join(config.input, inputPath))
    })

    // If any rules are not matched, leave it to browsersync
    if (!rule) return next()

    const inputPath = path.join(
      config.input,
      rule.getInputPath(outputPath)
    )

    // If Input file is excluded by config, leave it to browsersync
    if (config.isExclude(inputPath)) return next()

    // If it is directory, redirect to path that added trailing slash
    // There should not be not found error
    // since it is already checked in previous process
    if (fs.statSync(inputPath).isDirectory()) {
      return redirect(res, reqPath + '/')
    }

    const src = vfs.src(inputPath)
      .on('data', file => {
        depResolver.register(file.path, String(file.contents))
      })

    rule.task(src)
      .on('data', file => {
        res.setHeader('Content-Type', mime.getType(outputPath))
        res.end(file.contents)
      })
  }
}

function redirect (res, pathname) {
  res.statusCode = 301
  res.setHeader('Location', pathname)
  res.end()
}

function resolveBase (base, target) {
  function loop (base, target) {
    const bh = base[0]
    if (bh === undefined) {
      return '/' + target.join('/')
    }

    const th = target[0]
    if (bh !== th) {
      return null
    }

    return loop(base.slice(1), target.slice(1))
  }

  const baseList = base.split('/').filter(item => item !== '')
  const targetList = trimHead(target.split('/'))
  return loop(baseList, targetList)
}

function normalizePath (pathname) {
  if (isDirectoryPath(pathname)) {
    pathname = path.join(pathname, 'index.html')
  }
  return pathname
}

function isDirectoryPath (pathname) {
  return /\/$/.test(pathname)
}

function trimHead (list) {
  return util.dropWhile(list, item => item === '')
}
