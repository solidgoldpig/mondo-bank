;(function () {
  'use strict'

  var request = require('request')
  var _ = require('lodash')

  var version = require('../package.json').version
  var apiValues = require('./api.values.json')

  var apiHost = apiValues.host
  var methodPaths = apiValues.resources
  var dateParams = ['since', 'before']
  var client_id
  var client_secret

  // quick fix host setting
  function setHost (host) {
    apiHost = host
  }

  /**
   * @module mondo-bank
   * @description
   * ## Usage
   *
   *     mondo = require('mondo-bank')
   *
   * All methods return a promise but can optionally be called with a callback function as the final argument
   *
   * #### Promise style
   *
   *     methodPromise = mondo[$method]([$params])
   *     methodPromise
   *        .then(function(value){
   *          ...
   *        })
   *        .catch(function(err){
   *          ...
   *        })
   *
   * #### Callback style
   *
   *     mondo[method]([$params], function(err, value){
   *       if (err) {
   *        ...
   *       }
   *       ...
   *     })
   */

  // Helper functions

  // Allow params to be aliased
  function dealiasParams (params, aliases) {
    params = _.extend({}, params)
    Object.keys(aliases).forEach(function (param) {
      var aliased = aliases[param]
      aliased = typeof aliased === 'string' ? [aliased] : aliased
      aliased.forEach(function (alias) {
        if (params[param] === undefined && params[alias] !== undefined) {
          params[param] = params[alias]
        }
        delete params[alias]
      })
    })
    return params
  }

  // Allow params to be passed unbracketed
  function bracketifyParams (obj, param) {
    var bracketedObj = {}
    Object.keys(obj).forEach(function (prop) {
      // what if bracketed prop already exists?
      bracketedObj[param + '[' + prop + ']'] = obj[prop]
    })
    return bracketedObj
  }

  // Adds necessary auth header
  function addAuthorizationHeader (options, access_token) {
    options.headers = options.headers || {}
    options.headers.Authorization = 'Bearer ' + access_token
    return options
  }

  function handleApiResponse (options, resolve, reject) {
    request(options, function (err, res) {
      if (err) {
        reject(err)
      } else {
        var data = res.body
        if (res.statusCode === 200) {
          resolve(data)
        } else {
          reject({
            status: res.statusCode,
            error: data
          })
        }
      }
    })
  }

  // Call the API
  function apiRequest (options, fn) {
    options = _.extend({}, options)
    if (options.form && options.form.client_id && options.form.client_secret) {
      client_id = options.form.client_id
      client_secret = options.form.client_secret
    }
    if (options.qs) {
      dateParams.forEach(function (dParam) {
        if (typeof options.qs[dParam] === 'object') {
          options.qs[dParam] = options.qs[dParam].toISOString()
        }
      })
    }
    options.uri = apiHost + options.uri
    options.json = true
    options.headers = options.headers || {}
    options.headers.client = 'NodeMondo-v' + version
    options.method = options.method || 'GET'
    options.qsStringifyOptions = {
      arrayFormat: 'brackets'
    }

    if (typeof Promise === 'undefined') {
      if (!fn) {
        var noCallbackError = new Error('method.missing.callback')
        throw noCallbackError
      }
      return handleApiResponse(options, function (res) {
        fn(null, res)
      }, fn)
    }

    var reqpromise = new Promise(function (resolve, reject) {
      handleApiResponse(options, resolve, reject)
    })

    if (!fn) {
      return reqpromise
    } else {
      reqpromise.then(function (parsed_body) {
        fn(null, parsed_body)
      })
        .catch(function (err) {
          fn(err)
        })
    }
  }

  // Call the API with authentication
  function apiRequestAuthenticated (options, access_token, fn) {
    options = _.extend({}, options)
    options = addAuthorizationHeader(options, access_token)
    return apiRequest(options, fn)
  }

  // API methods

  /**
   * @method token
   * @static
   * @param {object} credentials Mondo credentials
   * @param {string} credentials.client_id Dev API client id
   * @param {string} credentials.client_secret Dev API client secret
   * @param {string} credentials.username Mondo user’s username
   * @param {string} credentials.password Mondo user’s password
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Acquire an access token
   *
   *     tokenPromise = mondo.token({
   *       client_id: client_id,
   *       client_secret: client_secret,
   *       username: username,
   *       password: password
   *     })
   *
   * @see https://getmondo.co.uk/docs/#acquiring-an-access-token
   */
  function token (credentials, fn) {
    var options = {
      method: 'POST',
      uri: methodPaths.token,
      form: _.extend({
        grant_type: 'password',
        client_id: client_id,
        client_secret: client_secret
      }, credentials)
    }
    return apiRequest(options, fn)
  }

  /**
   * @method tokenInfo
   * @static
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Get information about an access token
   *
   *     tokenInfoPromise = mondo.tokenInfo(accessToken)
   *
   * @see https://getmondo.co.uk/docs/#authenticating-requests
   */
  function tokenInfo (access_token, fn) {
    var options = {
      uri: methodPaths.tokenInfo
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method refreshToken
   * @static
   * @param {string} refresh_token Refresh token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Refresh a proviously acquired token
   *
   *     refreshTokenPromise = mondo.refreshToken(refreshToken)
   *
   * or if the client id and secret have not been previously passed
   *
   *     refreshTokenPromise = mondo.refreshToken({
   *       refreshToken: refreshToken,
   *       client_id: client_id,
   *       client_secret: client_secret
   *     })
   *
   * @see https://getmondo.co.uk/docs/#refreshing-access
   */
  function refreshToken (refresh_token, fn) {
    if (typeof refresh_token === 'string') {
      refresh_token = {
        refresh_token: refresh_token
      }
    }
    var options = {
      method: 'POST',
      uri: methodPaths.refreshToken,
      form: _.extend({
        grant_type: 'refresh_token',
        client_id: client_id,
        client_secret: client_secret
      }, refresh_token)
    }
    return apiRequest(options, fn)
  }

  /**
   * @method accounts
   * @static
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Get detailed information about customer’s accounts
   *
   *     accountsPromise = mondo.accounts(accessToken)
   *
   * @see https://getmondo.co.uk/docs/#list-accounts
   */
  function accounts (access_token, fn) {
    var options = {
      uri: methodPaths.accounts
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method balance
   * @static
   * @param {string} account_id Account id
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Get balance details for an account
   *
   *     balancePromise = mondo.balance(account_id, access_token)
   *
   * @see https://getmondo.co.uk/docs/#read-balance
   */
  function balance (account_id, access_token, fn) {
    var options = {
      uri: methodPaths.balance,
      qs: {
        account_id: account_id
      }
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method transactions
   * @static
   * @param {object|string} params Query object
   * If passed as a string, used as account_id
   * @param {string} params.account_id Account id
   * @param {array|string} [params.expand] Properties to expand (merchant)
   * @param {date|string} [params.since] Date after which to show results (Date object or ISO string)
   * @param {date|string} [params.before] Date before which to show results (Date object or ISO string)
   * @param {int} [params.limit] Max number of transactions to return (100 max)
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * List transactions
   *
   *     transactionsPromise = mondo.transactions(account_id, access_token)
   *
   * or to filter the results
   *
   *     transactionsPromise = mondo.transactions({
   *       account_id: account_id,
   *       since: since,
   *       before: before
   *       limit: limit
   *     }, access_token)
   *
   * @see https://getmondo.co.uk/docs/#list-transactions
   */
  function transactions (params, access_token, fn) {
    if (typeof params === 'string') {
      params = {
        account_id: params
      }
    }
    if (params && params.expand && typeof params.expand === 'string') {
      params.expand = [params.expand]
    }

    var options = {
      uri: methodPaths.transactions,
      qs: params
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method transaction
   * @static
   * @param {object|String} params Transaction params
   * @param {string} params.transaction_id Transaction ID
   * @param {array|string} [params.expand] Properties to expand (merchant)
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Get details about a transaction
   *
   *     transactionPromise = mondo.transaction(transaction_id, access_token)
   *
   * or to see expanded info for the merchant
   *
   *     transactionPromise = mondo.transaction({
   *       transaction_id: transaction_id,
   *       expand: 'merchant'
   *     }, access_token)
   *
   * @see https://getmondo.co.uk/docs/#retrieve-transaction
   */
  function transaction (params, access_token, fn) {
    var transaction_id
    if (typeof params === 'string') {
      transaction_id = params
      params = undefined
    } else {
      transaction_id = params.transaction_id
      delete params.transaction_id
    }
    if (params && params.expand && typeof params.expand === 'string') {
      params.expand = [params.expand]
    }

    var options = {
      uri: methodPaths.transaction + transaction_id,
      qs: params
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method annotateTransaction
   * @static
   * @param {string|object} transaction_id Transaction ID
   * @param {string} [transaction_id.transaction_id] Transaction ID, if passed as object
   * @param {string} [transaction_id.metadata] Metadata, if passed as nested object
   * @param {object} metadata Annotation metadata object
   * @param {object} annotation Alias for metadata
   * @param {object} annotations Alias for metadata
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Annotate a transaction
   *
   *     annotateTransactionPromise = mondo.annotateTransaction(transaction_id, {
   *       foo: 'bar'
   *     }, access_token)
   *
   * or
   *
   *     annotateTransactionPromise = mondo.annotateTransaction({
   *       transaction_id: transaction_id,
   *       foo: 'bar'
   *     }, access_token)
   *
   * or
   *
   *     annotateTransactionPromise = mondo.annotateTransaction({
   *       transaction_id: transaction_id,
   *       metadata: {
   *        foo: 'bar'
   *       }
   *     }, access_token)
   *
   * @see https://getmondo.co.uk/docs/#annotate-transaction
   */
  function annotateTransaction (transaction_id, metadata, access_token, fn) {
    if (typeof transaction_id === 'object') {
      fn = access_token
      access_token = metadata
      metadata = _.extend({}, transaction_id)
      transaction_id = metadata.transaction_id
      delete metadata.transaction_id
      metadata = dealiasParams(metadata, {
        metadata: 'annotation'
      })
      metadata = metadata.metadata || metadata
    }
    metadata = bracketifyParams(metadata, 'metadata')
    var options = {
      method: 'PATCH',
      uri: methodPaths.annotateTransaction + transaction_id,
      form: metadata
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method createFeedItem
   * @static
   * @param {object} params Params object
   * @param {string} params.account_id Account ID
   * @param {object} params.params Feed item params
   * @param {string} params.params.title Title for feed item
   * @param {string} params.params.image_url Icon url to use as icon
   * @param {string} [params.params.body] Body text to display
   * @param {string} [params.params.background_color] Background colour
   * @param {string} [params.params.title_color] Title colour
   * @param {string} [params.params.body_color] Body colour
   * @param {string} params.url Feed item url
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Publish a new feed entry
   *
   *     createFeedItemPromise = mondo.createFeedItem({
   *       account_id: accountId,
   *       params: {
   *         title: title,
   *         image_url: image_url
   *       },
   *       url: url
   *     }, access_token)
   *
   * @see https://getmondo.co.uk/docs/#create-feed-item
   */
  function createFeedItem (params, access_token, fn) {
    params = _.extend({}, params)
    params.type = params.type || 'basic'
    var feedParams = bracketifyParams(params.params, 'params')
    delete params.params
    params = _.extend(params, feedParams)
    var options = {
      method: 'POST',
      uri: methodPaths.createFeedItem,
      form: params
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method registerWebhook
   * @static
   * @param {string} account_id Account ID
   * @param {string} url Webhook url
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Register a webhook
   *
   *     registerWebhookPromise = mondo.registerWebhook(account_id, url, access_token)
   *
   * See https://getmondo.co.uk/docs/#transaction-created for details of the transaction.created event which is sent to the webhook each time a new transaction is created in a user’s account
   *
   * @see https://getmondo.co.uk/docs/#registering-a-web-hook
   */
  function registerWebhook (account_id, url, access_token, fn) {
    var options = {
      method: 'POST',
      uri: methodPaths.registerWebhook,
      form: {
        account_id: account_id,
        url: url
      }
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method webhooks
   * @static
   * @param {string} account_id Account ID
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * List webhooks
   *
   *     webhooksPromise = mondo.webhooks(account_id, access_token)
   *
   * @see https://getmondo.co.uk/docs/#list-web-hooks
   */
  function webhooks (account_id, access_token, fn) {
    var options = {
      uri: methodPaths.webhooks,
      qs: {
        account_id: account_id
      }
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method deleteWebhook
   * @static
   * @param {string} webhook_id Webhook ID
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Delete webhook
   *
   *     deleteWebhookPromise = mondo.deleteWebhook(webhook_id, access_token)
   *
   * @see https://getmondo.co.uk/docs/#deleting-a-web-hook
   */
  function deleteWebhook (webhook_id, access_token, fn) {
    var options = {
      method: 'DELETE',
      uri: '/webhooks/' + webhook_id
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method registerAttachment
   * @static
   * @param {object} params Params object
   * @param {string} params.external_id Transaction ID
   * @param {string} params.file_type File type
   * @param {string} params.file_url File url
   * @param {string} [params.transaction_id] Alias for external_id
   * @param {string} [params.id] Alias for external_id
   * @param {string} [params.type] Alias for file_type
   * @param {string} [params.url] Alias for file_url
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Register attachment
   *
   *     registerAttachmentPromise = mondo.registerAttachment({
   *       external_id: transaction_id,
   *       file_type: file_type,
   *       file_url: file_url
   *     }, access_token)
   *
   * @see https://getmondo.co.uk/docs/#register-attachment
   */
  function registerAttachment (params, access_token, fn) {
    params = dealiasParams(params, {
      external_id: ['transaction_id', 'id'],
      file_type: 'type',
      file_url: 'url'
    })
    var options = {
      method: 'POST',
      uri: methodPaths.registerAttachment,
      form: params
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  /**
   * @method uploadAttachment
   * @static
   * @description
   * Request upload attachment url
   *
   *     uploadAttachmentPromise = mondo.uploadAttachment({
   *       file_name: file_name,
   *       file_type: file_type
   *     }, access_token)
   *
   * @see https://getmondo.co.uk/docs/#upload-attachment
   * @param {object} params params object
   * @param {string} params.file_name File name
   * @param {string} params.file_type File type
   * @param {string} [params.file] Alias for file_name
   * @param {string} [params.name] Alias for file_name
   * @param {string} [params.type] Alias for file_type
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   */
  function uploadAttachment (params, access_token, fn) {
    params = dealiasParams(params, {
      file_name: ['file', 'name'],
      file_type: 'type'
    })
    var options = {
      method: 'POST',
      uri: methodPaths.uploadAttachment,
      form: params
    }
    return apiRequestAuthenticated(options, access_token, fn)

  /*
  // rough on the train pretend code to allow upload and register in one call
  if (params.transaction_id) {
    // resolve apiRequest and attach image to it
    var upload = apiRequest(options)
    if (! fn) {
      upload.then(function(parsed_body) {
        fn(null, parsed_body)
      })
        .catch(function(err) {
          fn(err)
        })

  } else {
    return apiRequest(options, fn)
  }

   */
  }

  /**
   * @method deregisterAttachment
   * @static
   * @param {string} attachment_id Attachment ID
   * @param {string} access_token Access token
   * @param {function} [fn] Callback function
   * @return {object} Response value
   * @description
   * Deregister attachment
   *
   *     deregisterAttachmentPromise = mondo.deregisterAttachment(attachment_id, access_token)
   *
   * @see https://getmondo.co.uk/docs/#deregister-attachment
   */
  function deregisterAttachment (attachment_id, access_token, fn) {
    var options = {
      method: 'POST',
      uri: methodPaths.deregisterAttachment,
      form: {
        id: attachment_id
      }
    }
    return apiRequestAuthenticated(options, access_token, fn)
  }

  module.exports = {
    token: token,
    tokenInfo: tokenInfo,
    refreshToken: refreshToken,
    accounts: accounts,
    balance: balance,
    transactions: transactions,
    transaction: transaction,
    annotateTransaction: annotateTransaction,
    createFeedItem: createFeedItem,
    webhooks: webhooks,
    registerWebhook: registerWebhook,
    deleteWebhook: deleteWebhook,
    uploadAttachment: uploadAttachment,
    registerAttachment: registerAttachment,
    deregisterAttachment: deregisterAttachment,
    setHost: setHost
  }
})()
