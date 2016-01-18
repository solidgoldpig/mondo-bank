#!/usr/bin/env node

'use strict'

var mondo = require('../lib/mondo')
var fs = require('fs')
var path = require('path')
var moment = require('moment')
var yargonaut = require('yargonaut')
var yargs = require('yargs')
var chalk = yargonaut.chalk()
var prompt = require('prompt')
var _ = require('lodash')

yargonaut
  .style('blue')
  .helpStyle('green')
  .errorsStyle('red.bold')

var commandExamples = {
  transactions: [
    ['--limit 5', 'Show 5 transactions at most'],
    ['--since 7d', 'Show transactions since last 7 days'],
    ['--before 2015-12-25', 'Show transactions before specific time'],
    ['--before 2015-12-25T00:00:00Z', 'Show transactions before specific time']
  ],
  transaction: [
    ['', 'Transaction details'],
    ['--transaction_id trc23131231', 'Transaction details'],
    ['--expand merchant --id trc23131231', 'Transaction details with expanded merchant details']
  ],
  annotateTransaction: [
    ['--metadata.foo bar --metadata.baz bim', 'Annotate transaction with keys foo and baz'],
    ['--metadata.foo ""', 'Remove annotation with key foo from transaction']
  ],
  createFeedItem: [
    ['--title "Hello world!" --image_url https://robohash.org/104.236.21.134.png --url http://foo.com/bar', 'Create feed item']
  ],
  registerWebhook: [
    ['--url http://foo.com/bar', 'Registers webhook']
  ],
  deleteWebhook: [
    ['--webhook_id wh2239123912', 'Delete webhook'],
    ['--id wh2239123912']
  ],
  webhooks: [
    [''],
    ['--account_id acc123456789']
  ],
  uploadAttachment: [
    ['--name foo.jpg --type jpg']
  ],
  registerAttachment: [
    ['--url http://foo.com/bar.jpg --type jpg']
  ],
  deregisterAttachment: [
    ['--attachment_id att123456789'],
    ['--id att123456789']
  ],
  write: [
    ['--account_id acc123456789', 'Set default account'],
    ["--account_id ''", 'Set default account'],
    ['--output_space 0', 'Set default spacing in returned output'],
    ['--transactions.limit 3', 'Set default limit for transactions']
  ]
}

var additionalCommands = {
  deleteToken: {
    description: 'Delete any stored token'
  },
  write: {
    description: 'Write value to config file'
  }
}

var optionDescriptions = {
  access_token: 'If not passed, uses value stored in config',
  account_id: 'If not passed, uses value specified in config',
  transaction_id: 'If not passed, uses value specified in config',
  metadata: 'Annotation metadata object passed as key/value pairs (see examples below)',
  date_usage: 'Date params can be passed as ISO date or a date/period recognised by moment.js'
}

// object to add auto-aliases too
// seed with additional aliases not provided by module
var optionAliases = {
  transaction: {
    transaction_id: ['id']
  },
  deleteWebhook: {
    webhook_id: ['id']
  },
  deregisterAttachment: {
    attachment_id: ['id']
  }
}

var defaultOptions = {
  config: {
    description: 'Path where config files are stored - defaults to .mondo-cli.config.json in home directory. Can also be set as mondo-cli.config environment variable',
    alias: 'c',
    type: 'string'
  },
  output_space: {
    description: 'Number of spaces between items in JSON results',
    default: 2,
    type: 'number'
  },
  verbose: {
    count: true,
    description: 'Verbose debug output',
    alias: 'v',
    type: 'boolean'
  }
}

var initialArgv = yargs.argv

var isHelp = initialArgv.h || initialArgv.help

var configPath = initialArgv.config || process.env['mondo-cli.config'] || path.resolve(process.env.HOME, '.mondo-cli.config.json')

function writeConfig (config, cb) {
  var wconfig = {}
  Object.keys(config).sort().forEach(function (key) {
    wconfig[key] = config[key]
  })
  fs.writeFile(configPath, JSON.stringify(wconfig, null, 2), function (err) {
    if (err) {
      console.log('Failed to write', configPath, err)
    } else {
      debug('Wrote', configPath)
      if (cb) {
        cb()
      }
    }
  })
}
function isEmptyString (str) {
  return str === ''
}
function writeConfigValues (values) {
  Object.keys(values).forEach(function (key) {
    if (typeof values[key] === 'object') {
      defaults[key] = _.omit(_.extend(defaults[key], values[key]), isEmptyString)
    } else {
      defaults[key] = values[key]
    }
  })
  defaults = _.omit(defaults, isEmptyString)
  writeConfig(defaults)
}

var runCommand
var defaults = {}
try {
  defaults = require(configPath)
  if (initialArgv._[0] === 'write' && !initialArgv.h && !initialArgv.help) {
    delete initialArgv._
    delete initialArgv['$0']
    writeConfigValues(initialArgv)
  } else {
    runCommand = true
    defaultOptions.config.default = configPath
  }
} catch (e) {
  console.log()
  console.log('No config found - initialising ', configPath)
  console.log()
  console.log('Enter your credentials (optional)')
  console.log()
  prompt.message = ''
  prompt.delimiter = ''
  prompt.get([{
    name: 'config',
    description: 'Path to config file >',
    default: configPath,
    type: 'string'
  }, {
    name: 'client_id',
    description: 'Dev API client id >',
    type: 'string'
  }, {
    name: 'client_secret',
    description: 'Dev API client secret >',
    type: 'string'
  }, {
    name: 'username',
    description: 'Client username >',
    type: 'string'
  }, {
    name: 'password',
    description: 'Client password (not recommended) >',
    type: 'string'
  }], function (err, results) {
    if (err) {
      process.exit()
    }
    configPath = results.config
    delete results.config
    Object.keys(results).forEach(function (key) {
      if (results[key] !== '') {
        defaults[key] = results[key]
      }
    })
    writeConfig(defaults, function () {
      console.log('Please run your command again')
      process.exit()
    })
  })
}

if (runCommand) {
  var mondoSource = fs.readFileSync(path.resolve(__dirname, '..', 'lib/mondo.js'), 'utf8')
  var methodDocs = {}
  var methodRegex = /\/\*\*\s+\*\s*@method\s+(\w+)([\s\S]+?)\*\//
  var skipParams = ['fn']
  while (mondoSource.match(methodRegex)) {
    mondoSource = mondoSource.replace(methodRegex, function (m, methodName, methodDetails) {
      var description = methodDetails.replace(/[\s\S]*@description\s*\*\s*(.*)\n[\s\S]*/, function (m, methodDescription) {
        return methodDescription
      })
      var params = []
      var paramAliases = {}
      methodDetails.replace(/@param\s+\{([^\}]+)\}\s+(\S+)\s+(.*?)\n/g, function (m, paramType, paramName, paramDescription) {
        var required = true
        paramName = paramName.replace(/^\[(.*)\]$/, function (m, bracketedParam) {
          required = false
          return bracketedParam
        })
        // KLUDGE
        paramName = paramName.replace(/[^.]+\./, '')
        // KLUDGE
        if (paramName.indexOf('params.' !== -1)) {
          paramName = paramName.replace(/params\./, '')
        }
        paramDescription = optionDescriptions[paramName] || paramDescription
        var aliasMatch = paramDescription.match(/Alias for (\w+)/)
        if (aliasMatch) {
          var aliased = aliasMatch[1]
          paramAliases[aliased] = paramAliases[aliased] || []
          paramAliases[aliased].push(paramName)
          return
        }
        if (skipParams.indexOf(paramName) === -1 && paramType.indexOf('object') === -1) {
          params.push({
            name: paramName,
            type: paramType,
            description: paramDescription,
            required: required
          })
        }
        if (Object.keys(paramAliases).length) {
          optionAliases[methodName] = paramAliases
        }
      })
      params.push({
        name: 'property',
        alias: 'p',
        type: 'string',
        description: 'Property (or properties) to be returned'
      })
      for (var dOption in defaultOptions) {
        params.push(_.extend({
          name: dOption
        }, defaultOptions[dOption]))
      }
      methodDocs[methodName] = {
        description: description,
        params: params
      }
    })
  }
  methodDocs = _.extend(methodDocs, additionalCommands)
  var validMethods = Object.keys(methodDocs)

  // provides values for autocompletion
  if (initialArgv.completions) {
    var completions = []
    var methodToComplete = initialArgv._[0]
    if (methodDocs[methodToComplete]) {
      var methodCompletions = methodDocs[methodToComplete].params.map(function (p) {
        return '--' + p.name
      })
      completions = methodCompletions
    } else {
      completions = validMethods
      for (var dOption in defaultOptions) {
        completions.push('--' + dOption)
      }
      completions.push('--help')
    }
    console.log(completions.join('\n'))
    process.exit()
  }

  var cmd = initialArgv['$0'].replace(/.*\//, '')

  yargs
    .usage('\n' + chalk.magenta(cmd + ' <command>'))

  yargs.updateStrings({
    'Commands:': 'Commands',
    'Options:': 'General Options',
    'Examples:': 'Examples'
  })

  validMethods.forEach(function (vMethod) {
    yargs.command(chalk.blue(vMethod), methodDocs[vMethod].description)
    yargs.command(vMethod, false, function (yargs) {
      yargs.updateStrings({
        'Options:': 'Options'
      })
      yargs.usage('\n' + chalk.magenta(cmd + ' ' + vMethod + ' [options]') + '\n\n    ' + methodDocs[vMethod].description)
      if (methodDocs[vMethod].params) {
        var optionsParams = {}
        var date_usage
        methodDocs[vMethod].params.forEach(function (param) {
          if (process.env['mondo-cli.' + param.name]) {
            yargs.default(param.name, process.env['mondo-cli.' + param.name])
          } else if (defaults[param.name] || (defaults[vMethod] && defaults[vMethod][param.name] !== undefined)) {
            yargs.default(param.name, defaults[param.name] !== undefined ? defaults[param.name] : defaults[vMethod][param.name])
          }
          if (isHelp && param.name.match(/(_token|client_id|client_secret)$/) && defaults[param.name]) {
            yargs.default(param.name, 'Using value from config')
          }
          if (optionAliases[vMethod] && optionAliases[vMethod][param.name]) {
            yargs.alias(param.name, optionAliases[vMethod][param.name])
          }
          if (param.type.indexOf('date') !== -1) {
            date_usage = true
          }
          delete param.type
          optionsParams[param.name] = param
        })
        yargs.options(optionsParams)
        if (date_usage) {
          yargs.epilogue(optionDescriptions.date_usage)
        }
      }
      if (commandExamples[vMethod]) {
        commandExamples[vMethod].forEach(function (eg) {
          yargs.example(cmd + ' ' + vMethod + ' ' + eg[0], chalk.gray(eg[1]))
        })
      }
      yargs.help('help')
        .alias('help', 'h')
        .wrap(yargs.terminalWidth())
    })
  })

  yargs.options(defaultOptions)

  yargs.epilogue('Type ' + cmd + ' <command> -h for more information about a command')
  yargs.help('help')
    .alias('help', 'h')
    .wrap(yargs.terminalWidth())

  var argv = _.extend({}, yargs.argv)

  var method = {}
  var methodFail
  if (argv._.length) {
    argv.method = argv._.shift()
    if (validMethods.indexOf(argv.method) === -1) {
      methodFail = argv.method + ' is not a valid command'
    }
    argv[argv.method] = true
    method[argv.method] = true
  } else {
    methodFail = 'You must specify a command'
  }
  if (methodFail) {
    yargs.showHelp()
    console.log(chalk.red.bold(methodFail))
    process.exit(1)
  }

  var access_token = argv.access_token
  var account_id = argv.account_id

  if (method.deleteToken) {
    saveTokens({
      access_token: '',
      refresh_token: ''
    })
  }

  if (method.token) {
    var tokenPromise = mondo.token({
      client_id: argv.client_id,
      client_secret: argv.client_secret,
      username: argv.username,
      password: argv.password
    })
    runPromise('token', tokenPromise, saveTokens)
  }

  if (method.refreshToken) {
    var refreshTokenPromise = mondo.refreshToken({
      refresh_token: argv.refresh_token,
      client_id: argv.client_id,
      client_secret: argv.client_secret
    })
    runPromise('refreshToken', refreshTokenPromise, saveTokens)
  }

  if (method.tokenInfo) {
    var tokenInfoPromise = mondo.tokenInfo(access_token)
    runPromise('tokenInfo', tokenInfoPromise)
  }

  if (method.accounts) {
    var accountsPromise = mondo.accounts(access_token)
    runPromise('accounts', accountsPromise)
  }

  if (method.balance) {
    var balancePromise = mondo.balance(account_id, access_token)
    runPromise('balance', balancePromise)
  }

  if (method.transactions) {
    var args = {
      account_id: account_id,
      limit: argv.limit,
      since: argv.since,
      before: argv.before
    }
    var toISO = function toISO (arg) {
      if (args[arg]) {
        args[arg].replace(/(\d+)\s*(\w+)/, function (m, digits, unit) {
          args[arg] = moment().subtract(digits, unit)
        })
        args[arg] = moment(args[arg]).toISOString()
      }
    }
    toISO('since')
    toISO('before')
    var transactionsPromise = mondo.transactions(args, access_token)
    runPromise('transactions', transactionsPromise)
  }

  if (method.transaction) {
    var transactionPromise = mondo.transaction({
      transaction_id: argv.transaction_id,
      expand: argv.expand
    }, access_token)
    runPromise('transaction', transactionPromise)
  }

  if (method.annotateTransaction) {
    // should this spanner out if no annotation passed?
    var annotations = argv.metadata || argv.annotation || {}
    var annotateTransactionPromise = mondo.annotateTransaction(argv.transaction_id, annotations, access_token)
    runPromise('annotateTransaction', annotateTransactionPromise)
  }

  if (method.createFeedItem) {
    var paramParams = [
      'title',
      'image_url',
      'body',
      'background_color',
      'title_color',
      'body_color'
    ]
    argv.params = {}
    paramParams.forEach(function (param) {
      if (argv[param]) {
        argv.params[param] = argv[param]
      }
    })
    var createFeedItemPromise = mondo.createFeedItem({
      account_id: account_id,
      params: argv.params,
      url: argv.url
    }, access_token)
    runPromise('createFeedItem', createFeedItemPromise)
  }

  if (method.registerWebhook) {
    var registerWebhookPromise = mondo.registerWebhook(account_id, argv.url, access_token)
    runPromise('registerWebhook', registerWebhookPromise)
  }

  if (method.deleteWebhook) {
    var deleteWebhookPromise = mondo.deleteWebhook(argv.webhook_id, access_token)
    runPromise('deleteWebhook', deleteWebhookPromise)
  }

  if (method.webhooks) {
    var webhooksPromise = mondo.webhooks(account_id, access_token)
    runPromise('webhooks', webhooksPromise)
  }

  if (method.uploadAttachment) {
    var uploadAttachmentPromise = mondo.uploadAttachment({
      file: argv.file,
      type: argv.type
    }, access_token)
    runPromise('uploadAttachment', uploadAttachmentPromise)
  }

  if (method.registerAttachment) {
    var registerAttachmentPromise = mondo.registerAttachment({
      transaction_id: argv.transaction_id,
      url: argv.url,
      type: argv.type
    }, access_token)
    runPromise('registerAttachment', registerAttachmentPromise)
  }

  if (method.deregisterAttachment) {
    var deregisterAttachmentPromise = mondo.deregisterAttachment(argv.attachment_id, access_token)
    runPromise('deregisterAttachment', deregisterAttachmentPromise)
  }
}

function debug () {
  var debugArgs = Array.prototype.slice.call(arguments)
  // var debugLevel = debugArgs.shift()
  if (typeof argv === 'object' && argv.verbose >= 1) {
    console.log.apply(null, debugArgs)
  }
}

function logGeneric (logType, methodType, output, fn) {
  var logArgs = [output]
  if (argv.verbose >= 1) {
    logArgs.unshift(logType + '\n')
    logArgs.unshift(methodType)
  }
  console.log.apply(null, logArgs)
  if (fn) {
    fn(output)
  }
}

function runSuccess (methodType, fn) {
  return function (res) {
    var tres = res
    if (!argv.response && Object.keys(tres).length === 1) {
      tres = tres[Object.keys(tres)[0]]
      if (argv.length) {
        output = tres.length
      } else {
        if (argv.property) {
          var singleProperty = typeof argv.property === 'string' && !argv.properties
          if (!Array.isArray(argv.property)) {
            argv.property = [argv.property]
          }
          var isObj = !Array.isArray(tres)
          if (isObj) {
            tres = [tres]
          }
          tres = tres.map(function (item) {
            if (singleProperty) {
              return item[argv.property]
            }
            var mitem = {}
            argv.property.forEach(function (prop) {
              if (item[prop] !== undefined) {
                mitem[prop] = item[prop]
              }
            })
            return mitem
          })
          if (isObj) {
            tres = tres[0]
          }
        }
      }
    }
    var output = JSON.stringify(tres, null, argv.output_space)
    logGeneric('success', methodType, output, fn)
  }
}

function runError (methodType, fn) {
  return function (err) {
    var errOutput = JSON.stringify(err, null, argv.output_space)
    logGeneric('error', methodType, errOutput, fn)
  }
}

function runPromise (type, typePromise, fn) {
  typePromise
    .then(runSuccess(type, fn))
    .catch(runError(type, fn))
}

function saveTokens (tokens) {
  tokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens
  var newDefaults = _.extend({}, defaults, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  })
  writeConfig(newDefaults)
}
