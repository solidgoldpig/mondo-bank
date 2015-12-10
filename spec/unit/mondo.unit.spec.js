'use strict'

var nock = require('nock')
var _ = require('lodash')

var mondo = require('../../lib/mondo')

var apiValues = require('../../lib/api.values.json')

var apiHost = apiValues.host
var methodPaths = apiValues.resources

var credentials = {
  client_id: 'valid',
  client_secret: 'valid',
  username: 'valid',
  password: 'valid'
}
var access_token = 'valid'
var refresh_token = 'valid'
var account_id = 'valid'
var transaction_id = 'valid'

function knocker (options) {
  options = options || {}
  var knock = nock(apiHost)
  if (options.form) {
    options.method = 'form'
  }
  knock = knock[(options.method || 'get')](options.url, options.form)
  if (options.query) {
    knock = knock.query(options.query)
  }
  if (options.auth !== false) {
    knock = knock.matchHeader('Authorization', 'Bearer ' + access_token)
  }
  knock.reply(options.code || 200, options.code ? 'error' : 'success')
}

describe('Mondo unit tests', function () {
  function testSuccess (done) {
    return function (response) {
      if (arguments.length === 2) {
        // response is second arg if callback
        response = arguments[1]
      }
      expect(response).toBe('success')
      done()
    }
  }
  function testError (done) {
    return function (err) {
      expect(err.error).toBe('error')
      done()
    }
  }

  beforeEach(function () {
    nock.cleanAll()
  })

  describe('Authenticating', function () {
    describe('Get a token', function () {
      function tokenNock () {
        var successCreds = _.extend({grant_type: 'password'}, credentials)
        nock(apiHost)
          .post(methodPaths.token, successCreds)
          .reply(200, 'success')
        var invalidRequestCreds = _.extend({}, successCreds, { username: 'invalid' })
        nock(apiHost)
          .post(methodPaths.token, invalidRequestCreds)
          .reply(400, 'error')
        var invalidClientCreds = _.extend({}, successCreds, {client_id: 'invalid'})
        nock(apiHost)
          .post(methodPaths.token, invalidClientCreds)
          .reply(401, 'error')
      }
      beforeEach(function () {
        tokenNock()
      })
      it('should send correct token request', function (done) {
        mondo.token(credentials).then(testSuccess(done))
      })
      it('should send correct token request when using callback', function (done) {
        mondo.token(credentials, testSuccess(done))
      })
      it('should send handle token request failure', function (done) {
        mondo.token(_.extend({}, credentials, { username: 'invalid' })).catch(testError(done))
      })
      it('should send handle token request failure when using callback', function (done) {
        mondo.token(_.extend({}, credentials, { client_id: 'invalid' }), testError(done))
      })
    })

    describe('Get information about an access token', function () {
      function tokenInfoNock () {
        nock(apiHost)
          .get(methodPaths.tokenInfo)
          .matchHeader('Authorization', 'Bearer ' + access_token)
          .reply(200, 'success')
        nock(apiHost)
          .get(methodPaths.tokenInfo)
          .reply(401, 'error')
      }
      beforeEach(function () {
        tokenInfoNock()
      })
      it('should send correct tokenInfo request', function (done) {
        mondo.tokenInfo(access_token).then(testSuccess(done))
      })
      it('should send correct tokenInfo request when using callback', function (done) {
        mondo.tokenInfo(access_token, testSuccess(done))
      })
      it('should send handle tokenInfo request failure', function (done) {
        mondo.tokenInfo('invalid_token').catch(testError(done))
      })
      it('should send handle tokenInfo request failure when using callback', function (done) {
        mondo.tokenInfo('invalid_token', testError(done))
      })
    })

    describe('Refresh an access token', function () {
      var successCreds = {
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret
      }
      function refreshTokenNock () {
        nock(apiHost)
          .post(methodPaths.refreshToken, successCreds)
          .reply(200, 'success')
        nock(apiHost)
          .post(methodPaths.refreshToken)
          .reply(400, 'error')
      }
      beforeEach(function () {
        refreshTokenNock()
      })
      it('should send correct refreshToken request', function (done) {
        mondo.refreshToken({
          refresh_token: refresh_token,
          client_id: credentials.client_id,
          client_secret: credentials.client_secret
        }).then(testSuccess(done))
      })
      it('should send correct tokenInfo request when using callback', function (done) {
        mondo.refreshToken(refresh_token, testSuccess(done))
      })
      it('should send handle tokenInfo request failure', function (done) {
        mondo.refreshToken('invalid_token').catch(testError(done))
      })
      it('should send handle tokenInfo request failure when using callback', function (done) {
        mondo.refreshToken('invalid_token', testError(done))
      })
    })
  })

  describe('Accounts', function () {
    function accountsNock () {
      knocker({ url: methodPaths.accounts })
    }
    beforeEach(function () {
      accountsNock()
    })
    it('should send correct accounts request', function (done) {
      mondo.accounts(access_token).then(testSuccess(done))
    })
    it('should send correct accounts request when using callback', function (done) {
      mondo.accounts(access_token, testSuccess(done))
    })
  })

  describe('Balance', function () {
    function balanceNock () {
      var url = methodPaths.balance
      knocker({
        url: url,
        query: { account_id: account_id }
      })
      knocker({
        code: 403,
        url: url,
        query: { account_id: 'invalid_account' }
      })
    }
    beforeEach(function () {
      balanceNock()
    })
    it('should send correct balance request', function (done) {
      mondo.balance(account_id, access_token).then(testSuccess(done))
    })
    it('should send correct balance request when using callback', function (done) {
      mondo.balance(account_id, access_token, testSuccess(done))
    })
    it('should send handle balance request failure', function (done) {
      mondo.balance('invalid_account', access_token).catch(testError(done))
    })
    it('should send handle balance request failure when using callback', function (done) {
      mondo.balance('invalid_account', access_token, testError(done))
    })
  })

  describe('Transactions', function () {
    var url = methodPaths.transactions
    function transactionsNock () {
      function transKnocker (query) {
        query = _.extend({}, { account_id: account_id }, query)
        knocker({
          url: url,
          query: query
        })
      }
      transKnocker()
      transKnocker({ limit: 10 })
      transKnocker({ since: /\d\d\d\d-\d\d-\d\dT\d\d/ })
      transKnocker({ before: /\d\d\d\d-\d\d-\d\dT\d\d/ })
    }

    beforeEach(function () {
      transactionsNock()
    })
    it('should send correct balance request', function (done) {
      mondo.transactions(account_id, access_token).then(testSuccess(done))
    })
    it('should send correct balance request when using callback', function (done) {
      mondo.transactions(account_id, access_token, testSuccess(done))
    })
    it('should send correct balance request with limit', function (done) {
      mondo.transactions({
        account_id: account_id,
        limit: 10
      }, access_token).then(testSuccess(done))
    })
    it('should send correct balance request with ISO date string', function (done) {
      mondo.transactions({
        account_id: account_id,
        since: '2015-11-10T23:00:00Z'
      }, access_token).then(testSuccess(done))
    })
    // pending until cli-style implemented
    xit('should send correct balance request with period', function (done) {
      mondo.transactions({
        account_id: account_id,
        since: '7d'
      }, access_token).then(testSuccess(done))
    })
    // pending until cli-style implemented
    it('should send correct balance request with date object', function (done) {
      mondo.transactions({
        account_id: account_id,
        before: new Date()
      }, access_token).then(testSuccess(done))
    })
  })

  describe('Transaction', function () {
    var url = methodPaths.transaction + transaction_id
    function transactionNock () {
      knocker({ url: url })
      knocker({
        url: url,
        query: { 'expand[]': 'merchant' }
      })
      knocker({
        code: 403,
        url: url,
        query: { account_id: 'invalid_account' }
      })
    }
    beforeEach(function () {
      transactionNock()
    })
    it('should send correct transaction request', function (done) {
      mondo.transaction(transaction_id, access_token).then(testSuccess(done))
    })
    it('should send correct transaction request when using callback', function (done) {
      mondo.transaction(transaction_id, access_token, testSuccess(done))
    })
    it('should send correct transaction request when sent as object', function (done) {
      mondo.transaction({
        transaction_id: transaction_id
      }, access_token, testSuccess(done))
    })
    it('should send correct transaction request when expand param passed', function (done) {
      mondo.transaction({
        transaction_id: transaction_id,
        expand: 'merchant'
      }, access_token, testSuccess(done))
    })
  })

  describe('Annotating transaction', function () {
    var url = methodPaths.annotateTransaction
    var metadata = {foo: 'bar'}
    function annotateTransactionNock () {
      nock(apiHost)
        .patch(url + transaction_id, {'metadata[foo]': 'bar'})
        .matchHeader('Authorization', 'Bearer ' + access_token)
        .reply(200, 'success')
    }
    beforeEach(function () {
      annotateTransactionNock()
    })
    it('should send correct annotateTransaction request', function (done) {
      mondo.annotateTransaction(transaction_id, metadata, access_token).then(testSuccess(done))
    })
    it('should send correct annotateTransaction request when using callback', function (done) {
      mondo.annotateTransaction(transaction_id, metadata, access_token, testSuccess(done))
    })
    it('should send correct annotateTransaction request when sent as object', function (done) {
      mondo.annotateTransaction(_.extend({transaction_id: transaction_id}, metadata), access_token, testSuccess(done))
    })
    it('should send correct annotateTransaction request when sent as nested object', function (done) {
      mondo.annotateTransaction({
        transaction_id: transaction_id,
        metadata: metadata
      }, access_token, testSuccess(done))
    })
    it('should send correct annotateTransaction request when metadata aliased as annotation', function (done) {
      mondo.annotateTransaction({
        transaction_id: transaction_id,
        annotation: metadata
      }, access_token, testSuccess(done))
    })
  })

  describe('Create feed item', function () {
    var url = methodPaths.createFeedItem
    var params = {
      account_id: account_id,
      url: 'http://foo.com',
      params: {
        title: 'foo',
        image_url: 'http://foo.com/icon.gif'
      }
    }
    function createFeedItemNock () {
      nock(apiHost)
        .post(url, {
          account_id: account_id,
          url: 'http://foo.com',
          type: 'basic',
          'params[title]': 'foo',
          'params[image_url]': 'http://foo.com/icon.gif'
        })
        .matchHeader('Authorization', 'Bearer ' + access_token)
        .reply(200, 'success')
    }
    beforeEach(function () {
      createFeedItemNock()
    })
    it('should send correct createFeedItem request', function (done) {
      mondo.createFeedItem(params, access_token).then(testSuccess(done))
    })
    it('should send correct createFeedItem request when using callback', function (done) {
      mondo.createFeedItem(params, access_token, testSuccess(done))
    })
  })
})

/*
webhooks
registerWebhook
deleteWebhook

uploadAttachment
registerAttachment
deregisterAttachment
*/
