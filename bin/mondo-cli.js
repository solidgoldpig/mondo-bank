#!/usr/bin/env node

'use strict'

var mondo = require('../lib/mondo')
var fs = require('fs')
var path = require('path')
var moment = require('moment')
var yargs = require('yargs')
var mkdirp = require('mkdirp')
var prompt = require('prompt')
var _ = require('lodash')

// https://github.com/bcoe/yargs/issues/251 yargs + chalk

var initialArgv = yargs.argv

var paramDescriptions = {
  access_token: 'If not passed, uses value stored in tokens.json',
  account_id: 'If not passed, uses value specified in default.json or first account in account list',
  transaction_id: 'If not passed, uses value specified in default.json or last transaction',
  metadata: 'Annotation metadata object passed as key/value pairs (see examples below)',
  date_usage: 'Date params can be passed as ISO date or a date/period recognised by moment.js'
}

var examples = {
  transactions: [
    ['--limit 5', 'Show 5 transactions at most'],
    ['--since 7d', 'Show transactions since last 7 days'],
    ['--before 2015-12-25', 'Show transactions before specific time'],
    ['--before 2015-12-25T00:00:00Z', 'Show transactions before specific time']
  ],
  transaction: [
    ['', 'Transaction details'],
    ['--transaction_id trc23131231', 'Transaction details'],
    ['--expand merchant', 'Transaction details with expanded merchant details']
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
    ['--webhook_id wh2239123912', 'Delete webhook']
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
    ['--attachment_id att123456789']
  ]
}

// object to add auto-aliases too
// seed with additional aliases not provided by module
var aliases = {
  deleteWebhook: {
    webhook_id: ['id']
  },
  deregisterAttachment: {
    attachment_id: ['id']
  }
}

var PWD = process.env.PWD
var configPaths = {
  credentials: 'credentials.json',
  tokens: 'tokens.json',
  defaults: 'defaults.json'
}
var configDir = path.resolve(PWD, initialArgv.config || '', '.mondo-cli-config')
Object.keys(configPaths).forEach(function (cPath) {
  configPaths[cPath] = path.resolve(configDir, configPaths[cPath])
})

var credentials
try {
  credentials = require(configPaths.credentials)
} catch (e) {
  argv = undefined
  mkdirp.sync(configDir)
  prompt.message = ''
  prompt.delimiter = ''
  prompt.get([{
    name: 'client_id',
    description: 'Dev API client id >',
    type: 'string',
    required: true
  }, {
    name: 'client_secret',
    description: 'Dev API client secret >',
    type: 'string',
    required: true
  }, {
    name: 'username',
    description: 'Client username >',
    type: 'string'
  }, {
    name: 'password',
    description: 'Client password >',
    type: 'string'
  }], function (err, results) {
    if (err) {
      process.exit()
    }
    fs.writeFile(configPaths.credentials, JSON.stringify(results, null, 2), function (err) {
      if (err) {
        console.log('Failed to write', configPaths.credentials)
      }
      console.log('Wrote', configPaths.credentials)
      console.log('Please run the command again')
    })
  })
}

var tokens = {}
try {
  tokens = require(configPaths.tokens)
} catch (e) {}

var defaults = {}
try {
  defaults = require(configPaths.defaults)
} catch (e) {}
defaults = _.extend(defaults, credentials, tokens)

var validMethods = Object.keys(require('../lib/api.values.json').resources)

var mondoSource = fs.readFileSync(path.resolve(__dirname, '..', 'lib/mondo.js'), 'utf8')
var methodDocs = {}
var methodRegex = /\/\*\*\s+\*\s*@method\s+(\w+)([\s\S]+?)\*\//
var skipParams = ['fn']
while (mondoSource.match(methodRegex)) {
  mondoSource = mondoSource.replace(methodRegex, function (m, m1, m2) {
    var description = m2.replace(/[\s\S]*@description\s*\*\s*(.*)\n[\s\S]*/, function (n, n1) {
      return n1
    })
    var params = []
    var paramAliases = {}
    m2.replace(/@param\s+\{([^\}]+)\}\s+(\S+)\s+(.*?)\n/g, function (n, type, name, description) {
      var required = true
      name = name.replace(/^\[(.*)\]$/, function (o, o1) {
        required = false
        return o1
      })
      // KLUDGE
      name = name.replace(/[^.]+\./, '')
      // KLUDGE
      if (name.indexOf('params.' !== -1)) {
        name = name.replace(/params\./, '')
      }
      // KLUDGE
      if (name.match(/^(account_id)$/)) {
        required = false
      }
      description = paramDescriptions[name] || description
      var aliasMatch = description.match(/Alias for (\w+)/)
      if (aliasMatch) {
        var aliased = aliasMatch[1]
        paramAliases[aliased] = paramAliases[aliased] || []
        paramAliases[aliased].push(name)
        return
      }
      if (skipParams.indexOf(name) === -1 && type.indexOf('object') === -1) {
        params.push({
          name: name,
          type: type,
          description: description,
          required: required
        })
      }
      if (Object.keys(paramAliases).length) {
        aliases[m1] = paramAliases
      }
    })
    methodDocs[m1] = {
      description: description,
      params: params
    }
  })
}

// provides values for autocompletion
if (initialArgv.completions) {
  var completions = []
  var methodToComplete = initialArgv._[0] ? initialArgv._[0].replace(/ .*/, '') : undefined
  if (methodDocs[methodToComplete]) {
    var methodCompletions = methodDocs[methodToComplete].params.map(function (p) {
      return '--' + p.name
    })
    completions = methodCompletions
  } else {
    completions = validMethods
  }
  console.log(completions.join('\n'))
  process.exit()
}

var cmd = initialArgv['$0'].replace(/.*\//, '')

yargs
  .usage(cmd + ' <command>')

validMethods.forEach(function (vMethod) {
  yargs.command(vMethod, methodDocs[vMethod].description, function (yargs) {
    if (methodDocs[vMethod].params) {
      var optionsParams = {}
      var date_usage
      methodDocs[vMethod].params.forEach(function (param) {
        if (defaults[param.name] || (defaults[vMethod] && defaults[vMethod][param.name] !== undefined)) {
          yargs.default(param.name, defaults[param.name] !== undefined ? defaults[param.name] : defaults[vMethod][param.name])
        }
        if (aliases[vMethod] && aliases[vMethod][param.name]) {
          yargs.alias(param.name, aliases[vMethod][param.name])
        }
        if (param.type.indexOf('date') !== -1) {
          date_usage = true
        }
        delete param.type
        optionsParams[param.name] = param
      })
      yargs.usage('\n' + cmd + ' ' + vMethod + ' [options]\n\n    ' + methodDocs[vMethod].description)
      yargs.options(optionsParams)
      if (date_usage) {
        yargs.epilogue(paramDescriptions.date_usage)
      }
      if (examples[vMethod]) {
        examples[vMethod].forEach(function (eg) {
          yargs.example(cmd + ' ' + vMethod + ' ' + eg[0], eg[1])
        })
      }
      yargs.help('help')
        .alias('help', 'h')
      yargs.updateStrings({
        'Options:': 'Options:'
      })
    }
  })
})

yargs.options({
  config: {
    description: 'Path where config files are stored - defaults to current working directory',
    alias: 'c'
  },
  verbose: {
    count: true,
    description: 'Verbose debug output',
    alias: 'v'
  }
})
/*
  access_token: {
    description: 'Explicitly pass access_token',
    alias: 't'
  },
  refresh_token: {
    description: 'Explicitly pass refresh_token'
  },
  account_id: {
    description: 'Explicitly pass account_id',
    alias: 'a'
  },
*/
yargs.updateStrings({
  'Options:': 'General Options:'
})
yargs.epilogue('Type ' + cmd + ' <command> -h for more information about a command')
yargs.help('help')
  .alias('help', 'h')
yargs.completion('completion')
// .alias('v', 'verbose')
// yargs.wrap(yargs.terminalWidth())

var argv = _.extend({}, yargs.argv)

if (argv._.length) {
  argv.method = argv._.shift()
}

if (argv.method) {
  argv[argv.method] = true
} else {
  var passedMethod = Object.keys(argv).filter(function (pMethod) {
    return validMethods.indexOf(pMethod) !== -1
  })
  if (passedMethod.length !== 1) {
    if (!passedMethod.length) {
      console.log('You must pass a valid method')
    } else {
      console.log('You must pass only one method')
    }
    console.log()
    yargs.showHelp()
    process.exit(1)
  }
  argv.method = passedMethod[0]
}

var accessTokenArg = {
  access_token: {
    description: 'Access token'
  }
}

var accountIdArg = {
  account_id: {
    description: 'Account ID'
  }
}

if (argv) {
  var access_token = argv.access_token || tokens.access_token
  var refresh_token = argv.refresh_token || tokens.refresh_token

  if (argv.token) {
    runPromise('token', mondo.token(credentials), saveTokens)
  } else if (argv.refreshToken) {
    var refreshToken = mondo.refreshToken({
      refresh_token: refresh_token,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret
    })
    runPromise('refreshToken', refreshToken, saveTokens)
  } else {
    mondo.accounts(access_token).then(function (accountsRes) {
      if (!access_token) {
        console.log('Method requires an access_token')
        process.exit(1)
      }
      var account_id = argv.account_id || defaults.account_id || accountsRes.accounts[0].id
      if (!account_id) {
        console.log('No account found')
        process.exit(1)
      }
      debug('Using account', account_id)
      mondo.transactions(account_id, access_token).then(function (transactionsRes) {
        var transactions = transactionsRes.transactions
        var transaction_id = argv.transaction_id || defaults.transaction_id || transactions[transactions.length - 1].id
        debug('Using transaction', transaction_id)

        if (argv.tokenInfo) {
          var tokenInfoPromise = mondo.tokenInfo(access_token)
          runPromise('tokenInfo', tokenInfoPromise)
        }

        if (argv.accounts) {
          var accountsPromise = mondo.accounts(access_token)
          runPromise('accounts', accountsPromise)
        }

        if (argv.balance) {
          var balancePromise = mondo.balance(account_id, access_token)
          runPromise('balance', balancePromise)
        }

        if (argv.transactions) {
          var args = {
            account_id: account_id,
            limit: argv.limit,
            since: argv.since,
            before: argv.before
          }
          var toISO = function toISO (arg) {
            if (args[arg]) {
              args[arg].replace(/(\d+)\s*(\w+)/, function (m, m1, m2) {
                args[arg] = moment().subtract(m1, m2)
              })
              args[arg] = moment(args[arg]).toISOString()
            }
          }
          toISO('since')
          toISO('before')
          var transactionsPromise = mondo.transactions(args, access_token)
          runPromise('transactions', transactionsPromise)
        }

        if (argv.transaction) {
          var transactionPromise = mondo.transaction({
            transaction_id: transaction_id,
            expand: argv.expand
          }, access_token)
          runPromise('transaction', transactionPromise)
        }

        if (argv.annotateTransaction) {
          // should this spanner out if no annotation passed?
          var annotations = argv.metadata || argv.annotation || {}
          var annotateTransactionPromise = mondo.annotateTransaction(transaction_id, annotations, access_token)
          runPromise('annotateTransaction', annotateTransactionPromise)
        }

        if (argv.createFeedItem) {
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

        if (argv.registerWebhook) {
          var registerWebhookPromise = mondo.registerWebhook(account_id, argv.url, access_token)
          runPromise('registerWebhook', registerWebhookPromise)
        }

        if (argv.deleteWebhook) {
          var deleteWebhookPromise = mondo.deleteWebhook(argv.webhook_id, access_token)
          runPromise('deleteWebhook', deleteWebhookPromise)
        }

        if (argv.webhooks) {
          var webhooksPromise = mondo.webhooks(account_id, access_token)
          runPromise('webhooks', webhooksPromise)
        }

        if (argv.uploadAttachment) {
          var uploadAttachmentPromise = mondo.uploadAttachment({
            file: argv.file,
            type: argv.type
          }, access_token)
          runPromise('uploadAttachment', uploadAttachmentPromise)
        }

        if (argv.registerAttachment) {
          var registerAttachmentPromise = mondo.registerAttachment({
            transaction_id: transaction_id,
            url: argv.url,
            type: argv.type
          }, access_token)
          runPromise('registerAttachment', registerAttachmentPromise)
        }

        if (argv.deregisterAttachment) {
          var deregisterAttachmentPromise = mondo.deregisterAttachment(argv.attachment_id, access_token)
          runPromise('deregisterAttachment', deregisterAttachmentPromise)
        }
      })
        .catch(logError('transactions'))
    })
      .catch(logError('accounts'))
  }
}

function debug () {
  var debugArgs = Array.prototype.slice.call(arguments)
  // var debugLevel = debugArgs.shift()
  if (argv.v >= 1) {
    console.log.apply(null, debugArgs)
  }
}

function logGeneric (logType, methodType, output, fn) {
  var logArgs = [output]
  if (argv.v >= 1) {
    logArgs.unshift(logType + '\n')
    logArgs.unshift(methodType)
  }
  console.log.apply(null, logArgs)
  if (fn) {
    fn(output)
  }
}

function logSuccess (methodType, fn) {
  return function (res) {
    var output = argv.length ? res[methodType].length : JSON.stringify(res, null, 2)
    logGeneric('success', methodType, output, fn)
  }
}

function logError (methodType, fn) {
  return function (err) {
    var errOutput = JSON.stringify(err, null, 2)
    logGeneric('error', methodType, errOutput, fn)
  }
}

function runPromise (type, typePromise, fn) {
  var lSuccess = logSuccess(type, fn)
  var lError = logError(type, fn)
  typePromise
    .then(lSuccess)
    .catch(lError)
}

function saveTokens (tokens) {
  var tokensStr = typeof tokens === 'object' ? JSON.stringify(tokens, null, 2) : tokens
  fs.writeFile(path.resolve(__dirname, configPaths.tokens), tokensStr, function (err) {
    if (err) {
      debug('Failed to update tokens.json', err)
    } else {
      debug('Updated tokens.json')
    }
  })
}
