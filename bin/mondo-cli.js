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

var validMethods = [
  'token',
  'refreshToken',
  'tokenInfo',
  'accounts',
  'balance',
  'transactions',
  'transaction',
  'annotateTransaction',
  'createFeedItem',
  'registerWebhook',
  'deleteWebhook',
  'webhooks',
  'uploadAttachment',
  'registerAttachment',
  'deregisterAttachment'
]
var methodUsageDescription = {
  token: 'Get a token',
  refreshToken: 'Renew a token',
  tokenInfo: 'Inspect authentication details',
  accounts: 'Get list of acccounts',
  balance: 'Get account balance',
  transactions: 'Get list of transactions',
  transaction: 'Get transaction details',
  annotateTransaction: 'Annotate a transaction',
  createFeedItem: 'Create a feed item',
  registerWebhook: 'Register a webhook',
  deleteWebhook: 'Delete a webhook',
  webhooks: 'Get list of webhooks',
  uploadAttachment: 'Request authorisation to upload an attachment',
  registerAttachment: 'Register an attachment',
  deregisterAttachment: 'Deregister an attachment'
}
var methodUsage = {

}

yargs
  .usage('$0 <method> or $0 --method <method>')
  .options({
    method: {
      description: 'API method to call',
      required: false,
      choices: validMethods
    },
    access_token: {
      description: 'Explicitly pass access_token'
    },
    refresh_token: {
      description: 'Explicitly pass refresh_token'
    },
    account_id: {
      description: 'Explicitly pass account_id'
    },
    config: {
      description: 'Path where config files are stored - defaults to current working directory'
    }
  })

validMethods.forEach(function (vMethod) {
  var example = methodUsage[vMethod] || '$0 --' + vMethod
  yargs.example(example, methodUsageDescription[vMethod])
})

yargs.help('help')

var argv = yargs.argv

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

var transactionIdArg = {
  transaction_id: {
    description: 'Transaction ID'
  }
}

var accessTokenUsage = '\n\nIf access_token is not passed, uses value stored in tokens.json'

var accountUsage = '\n\nIf account_id is not passed, uses value specified in default.json or first account in account list' + accessTokenUsage

var transactionUsage = '\n\nIf transaction_id is not passed, uses value specified in default.json or last transaction' + accessTokenUsage

if (argv.method === 'transactions') {
  yargs.reset()
    .usage('$0 --transactions\n\nDate params can be passed as ISO date or a date/period recognised by moment.js ')
    .options({
      limit: {
        description: 'Max number of transactions to return (100 max)'
      },
      since: {
        description: 'Date after which to show results'
      },
      before: {
        description: 'Date before which to show results'
      }
    }, accessTokenArg)
    .help('h')
    .example('$0 --transactions --limit 5', 'Show 5 transactions at most')
    .example('$0 --transactions --since 7d', 'Show transactions since last 7 days')
    .example('$0 --transactions --before 2015-12-25', 'Show transactions before specific time')
    .example('$0 --transactions --before 2015-12-25T00:00:00Z', 'Show transactions before specific time')
    .argv
}
if (argv.method === 'transaction') {
  yargs.reset()
    .usage('$0 --transaction' + transactionUsage)
    .options(_.extend({}, transactionIdArg, {
      expand: {
        description: 'Property to expand details for',
        choices: ['merchant']
      }
    }, accessTokenArg))
    .help('h')
    .example('$0 --transaction', 'Transaction details')
    .example('$0 --transaction --transaction_id trc23131231', 'Transaction details')
    .example('$0 --transaction --expand merchant', 'Transaction details with expanded merchant details')
    .argv
}
if (argv.method === 'annotateTransaction') {
  yargs.reset()
    .usage('$0 --annotateTransaction' + transactionUsage)
    .options(_.extend({}, transactionIdArg, {
      annotation: {
        description: 'Key/value pair to apply to transaction',
        type: 'array'
      }
    }, accessTokenArg))
    .help('h')
    .example('$0 --annotateTransaction --annotation.foo bar --annotation.baz bim', 'Annotate transaction with keys foo and baz')
    .example('$0 --annotateTransaction --annotation.foo \'\'', 'Remove annotation with key foo from transaction')
    .argv
}
if (argv.method === 'createFeedItem') {
  yargs.reset()
    .usage('$0 --createFeedItem' + accountUsage)
    .options(_.extend({}, accountIdArg, {
      'params.title': {
        description: 'Title for feed item [required]'
      },
      'params.image_url': {
        description: 'Icon for feed item [required]'
      },
      'params.body': {
        description: 'Body text'
      },
      'params.background_color': {
        description: 'Background colour'
      },
      'params.body_color': {
        description: 'Body text colour'
      },
      'params.title_color': {
        description: 'Title text colour'
      },
      url: {
        description: 'URL for feed item to point to [required]'
      }
    }, accessTokenArg))
    .help('h')
    .example('$0 --createFeedItem --params.title \'Hello world!\' --params.image_url https://robohash.org/104.236.21.134.png', 'Create feed item')
    .argv
}
if (argv.method === 'registerWebhook') {
  yargs.reset()
    .usage('$0 --registerWebhook')
    .options({
      account_id: {
        description: 'Account ID'
      },
      url: {
        description: 'Webhook url [required]'
      }
    })
    .help('h')
    .example('$0 --registerWebhook --url http://foo.com/bar')
    .argv
}
if (argv.method === 'deleteWebhook') {
  yargs.reset()
    .usage('$0 --deleteWebhook')
    .options({
      account_id: {
        description: 'Account ID'
      },
      webhook_id: {
        description: 'Webhook ID [required]'
      }
    })
    .help('h')
    .example('$0 --deleteWebhook --webhook_id wh2239123912')
    .argv
}
if (argv.method === 'webhooks') {
  yargs.reset()
    .usage('$0 --webhooks')
    .options({
      account_id: {
        description: 'Account ID'
      }
    })
    .help('h')
    .example('$0 --webhooks')
    .example('$0 --webhooks --account_id acc123456789')
    .argv
}
if (argv.method === 'uploadAttachment') {
  yargs.reset()
    .usage('$0 --uploadAttachment')
    .options({
      file: {
        description: 'File name [required]'
      },
      type: {
        description: 'File type [required]'
      }
    })
    .help('h')
    .example('$0 --uploadAttachment --name foo.jpg --type jpg')
    .argv
}
if (argv.method === 'registerAttachment') {
  yargs.reset()
    .usage('$0 --registerAttachment')
    .options({
      transaction_id: {
        description: 'Transaction ID [required]'
      },
      url: {
        description: 'File url [required]'
      },
      type: {
        description: 'File type [required]'
      }
    })
    .help('h')
    .example('$0 --registerAttachment --name http://foo.com/bar.jpg --type jpg')
    .argv
}
if (argv.method === 'deregisterAttachment') {
  yargs.reset()
    .usage('$0 --deregisterAttachment')
    .options(_.extend({
      attachment_id: {
        description: 'Attachment ID [required]'
      }
    }, accessTokenArg))
    .help('h')
    .example('$0 --deregisterAttachment --attachment_id att123456789')
    .argv
}

var PWD = process.env.PWD
var configPaths = {
  credentials: 'credentials.json',
  tokens: 'tokens.json',
  defaults: 'defaults.json'
}
var configDir = path.resolve(PWD, argv.config || '', '.mondo-cli-config')
Object.keys(configPaths).forEach(function(cPath){
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
    type: 'string',
    required: true
  }, {
    name: 'password',
    description: 'Client password >',
    type: 'string',
    required: true
  }], function(err, results) {
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


if (argv) {

  var defaults = {}
  try {
    defaults = require(configPaths.defaults)
  } catch (e) {}

  var tokens = {}
  try {
    tokens = require(configPaths.tokens)
  } catch (e) {}
  var access_token = argv.access_token || tokens.access_token
  var refresh_token = argv.refresh_token || tokens.refresh_token

  function debug () {
    if (argv.debug) {
        console.log.apply(null, arguments)
      }
  }

  function logGeneric (logType, methodType, output) {
    var logArgs = [output]
    if (argv.debug) {
      logArgs.unshift(logType + '\n')
      logArgs.unshift(methodType)
      
    }
    console.log.apply(null, logArgs)
  }

  function logSuccess (methodType, fn) {
    return function (res) {
      var output = argv.length ? res[methodType].length : JSON.stringify(res, null, 2)
      logGeneric('success', methodType, output)
      if (fn) {
        fn(res)
      }
    }
  }

  function logError (methodType) {
    return function (err) {
      var errOutput = JSON.stringify(err, null, 2)
      logGeneric('error', methodType, errOutput)
    }
  }

  function runPromise (type, typePromise, fn) {
    typePromise
      .then(logSuccess(type, fn))
      .catch(logError(type))
  }

  function saveTokens (tokens) {
    var tokensStr = JSON.stringify(tokens, null, 2)
    fs.writeFile(path.resolve(__dirname, configPaths.tokens), tokensStr, function (err) {
      if (err) {
        debug('Failed to update tokens.json', err)
      } else {
        debug('Updated tokens.json')
      }
    })
  }

  function requiredArgs (method, argList) {
    if (typeof argList === 'string') {
      argList = [argList]
    }
    argList.forEach(function (arg) {
      argv[arg] = argv[arg] || argv[arg.replace(/.+_id$/, 'id')] || (defaults[method] ? defaults[method][arg] : defaults[arg])
      if (!argv[arg]) {
        console.log('Please provide the', arg,  'arg')
        process.exit(1)
      }
    })
  }

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
          runPromise('tokenInfo', mondo.tokenInfo(access_token))
        }

        if (argv.accounts) {
          runPromise('accounts', mondo.accounts(access_token))
        }

        if (argv.balance) {
          runPromise('balance', mondo.balance(account_id, access_token))
        }

        if (argv.transactions) {
          var args = {
            account_id: account_id
          }
          var defaultTrans = defaults.transactions
          args.limit = argv.limit || defaultTrans.limit
          args.before = argv.before || defaultTrans.before
          args.since = argv.since || defaultTrans.since
          function toISO (arg) {
            if (args[arg]) {
              args[arg].replace(/(\d+)\s*(\w+)/, function(m, m1, m2){
                args[arg] = moment().subtract(m1, m2)
              })
              args[arg] = moment(args[arg]).toISOString()
            }
          }
          toISO('since');
          toISO('before');
          runPromise('transactions', mondo.transactions(args, access_token))
        }

        if (argv.transaction) {
          var transaction = mondo.transaction({
            transaction_id: transaction_id,
            expand: argv.expand
          }, access_token)
          runPromise('transaction', transaction)
        }

        if (argv.annotateTransaction) {
          // should this spanner out if no annotation passed?
          var annotations = argv.annotation || {}
          // var annotate = mondo.annotateTransaction(transaction_id, annotations, access_token)
          annotations.transaction_id = transaction_id
          var annotate = mondo.annotateTransaction(annotations, access_token)
          runPromise('annotateTransaction', annotate)
        }

        if (argv.createFeedItem) {
          argv.params = argv.params || (defaults.createFeedItem ? defaults.createFeedItem.params : {})
          argv.url = argv.url || (defaults.createFeedItem ? defaults.createFeedItem.url : undefined)
          requiredArgs('createFeedItem', ['url'])
          function requiredParam (param) {
            if (!argv.params[param]) {
              console.log('Please provide the params.' + param, 'arg')
              process.exit(1)
            }
          }
          requiredParam('title')
          requiredParam('image_url')
          var createFeedItem = mondo.createFeedItem({
            account_id: account_id,
            params: argv.params,
            url: argv.url
          }, access_token)
          runPromise('createFeedItem', createFeedItem)
        }

        if (argv.registerWebhook) {
          requiredArgs('registerWebhook', 'url')
          var registerWebhook = mondo.registerWebhook(account_id, argv.url, access_token)
          runPromise('registerWebhook', registerWebhook)
        }

        if (argv.deleteWebhook) {
          requiredArgs('deleteWebhook', 'webhook_id')
          runPromise('deleteWebhook', mondo.deleteWebhook(argv.webhook_id, access_token))
        }

        if (argv.webhooks) {
          runPromise('webhooks', mondo.webhooks(account_id, access_token))
        }

        if (argv.uploadAttachment) {
          requiredArgs('uploadAttachment', ['file', 'type'])
          var uploadAttachment = mondo.uploadAttachment({
            file: argv.file,
            type: argv.type
          }, access_token)
          runPromise('uploadAttachment', uploadAttachment)
        }

        if (argv.registerAttachment) {
          requiredArgs('registerAttachment', ['url', 'type'])
          var registerAttachment = mondo.registerAttachment({
            transaction_id: transaction_id,
            url: argv.url,
            type: argv.type
          }, access_token)
          runPromise('registerAttachment', registerAttachment)
        }

        if (argv.deregisterAttachment) {
          requiredArgs('deregisterAttachment', 'attachment_id')
          runPromise('deregisterAttachment', mondo.deregisterAttachment(argv.attachment_id, access_token))
        }
      })
    })
  }
}
