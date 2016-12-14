'use strict'

var mondo = require('../../lib/mondo')
var _ = require('lodash')

var nock = require('nock')

var mondoHelper = require('../helper/mondo-unit-spec-helper')
var mH = mondoHelper
var mondargs = mH.mondargs
var methodPaths = mondargs.api.resources

var knocker = mH.knocker
var testSuccess = mH.success
var testResponseError = mH.responseError
var testRequestError = mH.requestError

describe('Mondo unit tests', function () {
  beforeEach(function () {
    nock.cleanAll()
  })

  if (typeof Promise !== 'undefined') {
    describe('Authenticating', function () {
      describe('Get a token', function () {
        function tokenNock () {
          var successCreds = _.extend({grant_type: 'password'}, mondargs.credentials)
          knocker({
            url: methodPaths.token,
            form: successCreds,
            auth: false
          })
          var invalidRequestCreds = _.extend({}, successCreds, { username: 'invalid' })
          knocker({
            url: methodPaths.token,
            form: invalidRequestCreds,
            auth: false,
            code: 400
          })
          var invalidClientCreds = _.extend({}, successCreds, {client_id: 'invalid'})
          knocker({
            url: methodPaths.token,
            form: invalidClientCreds,
            auth: false,
            code: 401
          })
        }
        beforeEach(function () {
          tokenNock()
        })
        it('should send correct token request', function (done) {
          mondo.token(mondargs.credentials).then(testSuccess(done))
        })
        it('should send correct token request when using callback', function (done) {
          mondo.token(mondargs.credentials, testSuccess(done))
        })
        it('should send handle token response failure', function (done) {
          mondo.token(_.extend({}, mondargs.credentials, { username: 'invalid' })).catch(testResponseError(done))
        })
        it('should send handle token response failure when using callback', function (done) {
          mondo.token(_.extend({}, mondargs.credentials, { client_id: 'invalid' }), testResponseError(done))
        })
        it('should send handle request failure', function (done) {
          mondo.token({ unhandled: 'invalid' }).catch(testRequestError(done))
        })
      })

      describe('Get information about an access token', function () {
        function tokenInfoNock () {
          knocker({
            url: methodPaths.tokenInfo
          })
          knocker({
            url: methodPaths.tokenInfo,
            auth: false,
            code: 401
          })
        }
        beforeEach(function () {
          tokenInfoNock()
        })
        it('should send correct tokenInfo request', function (done) {
          mondo.tokenInfo(mondargs.access_token).then(testSuccess(done))
        })
        it('should send correct tokenInfo request when using callback', function (done) {
          mondo.tokenInfo(mondargs.access_token, testSuccess(done))
        })
        it('should send handle tokenInfo request failure', function (done) {
          mondo.tokenInfo('invalid_token').catch(testResponseError(done))
        })
        it('should send handle tokenInfo request failure when using callback', function (done) {
          mondo.tokenInfo('invalid_token', testResponseError(done))
        })
      })

      describe('Refresh an access token', function () {
        var successCreds = {
          grant_type: 'refresh_token',
          refresh_token: mondargs.refresh_token,
          client_id: mondargs.credentials.client_id,
          client_secret: mondargs.credentials.client_secret
        }
        function refreshTokenNock () {
          knocker({
            url: methodPaths.refreshToken,
            form: successCreds,
            auth: false
          })
          knocker({
            url: methodPaths.refreshToken,
            method: 'post',
            auth: false,
            code: 400
          })
        }
        beforeEach(function () {
          refreshTokenNock()
        })
        it('should send correct refreshToken request', function (done) {
          mondo.refreshToken({
            refresh_token: mondargs.refresh_token,
            client_id: mondargs.credentials.client_id,
            client_secret: mondargs.credentials.client_secret
          }).then(testSuccess(done))
        })
        it('should send correct tokenInfo request when using callback', function (done) {
          mondo.refreshToken(mondargs.refresh_token, testSuccess(done))
        })
        it('should send handle tokenInfo request failure', function (done) {
          mondo.refreshToken('invalid_token').catch(testResponseError(done))
        })
        it('should send handle tokenInfo request failure when using callback', function (done) {
          mondo.refreshToken('invalid_token', testResponseError(done))
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
        mondo.accounts(mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct accounts request when using callback', function (done) {
        mondo.accounts(mondargs.access_token, testSuccess(done))
      })
    })

    describe('Balance', function () {
      function balanceNock () {
        var url = methodPaths.balance
        knocker({
          url: url,
          query: { account_id: mondargs.account_id }
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
        mondo.balance(mondargs.account_id, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct balance request when using callback', function (done) {
        mondo.balance(mondargs.account_id, mondargs.access_token, testSuccess(done))
      })
      it('should send handle balance request failure', function (done) {
        mondo.balance('invalid_account', mondargs.access_token).catch(testResponseError(done))
      })
      it('should send handle balance request failure when using callback', function (done) {
        mondo.balance('invalid_account', mondargs.access_token, testResponseError(done))
      })
    })

    describe('Transactions', function () {
      var url = methodPaths.transactions
      function transactionsNock () {
        function transKnocker (query) {
          query = _.extend({}, { account_id: mondargs.account_id }, query)
          knocker({
            url: url,
            query: query
          })
        }
        transKnocker()
        transKnocker({ limit: 10 })
        transKnocker({ since: /\d\d\d\d-\d\d-\d\dT\d\d/ })
        transKnocker({ before: /\d\d\d\d-\d\d-\d\dT\d\d/ })
        transKnocker({ 'expand[]': 'merchant' })
      }

      beforeEach(function () {
        transactionsNock()
      })
      it('should send correct transactions request', function (done) {
        mondo.transactions(mondargs.account_id, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct transactions request when using callback', function (done) {
        mondo.transactions(mondargs.account_id, mondargs.access_token, testSuccess(done))
      })
      it('should send correct transactions request with limit', function (done) {
        mondo.transactions({
          account_id: mondargs.account_id,
          limit: 10
        }, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct transactions request with ISO date string', function (done) {
        mondo.transactions({
          account_id: mondargs.account_id,
          since: '2015-11-10T23:00:00Z'
        }, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct transactions request with date object', function (done) {
        mondo.transactions({
          account_id: mondargs.account_id,
          before: new Date()
        }, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct transactions request when expand param passed', function (done) {
        mondo.transactions({
          account_id: mondargs.account_id,
          expand: 'merchant'
        }, mondargs.access_token).then(testSuccess(done))
      })
    })

    describe('Transaction', function () {
      var url = methodPaths.transaction + mondargs.transaction_id
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
        mondo.transaction(mondargs.transaction_id, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct transaction request when using callback', function (done) {
        mondo.transaction(mondargs.transaction_id, mondargs.access_token, testSuccess(done))
      })
      it('should send correct transaction request when sent as object', function (done) {
        mondo.transaction({
          transaction_id: mondargs.transaction_id
        }, mondargs.access_token, testSuccess(done))
      })
      it('should send correct transaction request when expand param passed', function (done) {
        mondo.transaction({
          transaction_id: mondargs.transaction_id,
          expand: 'merchant'
        }, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Annotating transaction', function () {
      var url = methodPaths.annotateTransaction
      var metadata = {foo: 'bar'}
      function annotateTransactionNock () {
        knocker({
          method: 'patch',
          url: url + mondargs.transaction_id,
          form: {'metadata[foo]': 'bar'}
        })
      }
      beforeEach(function () {
        annotateTransactionNock()
      })
      it('should send correct annotateTransaction request', function (done) {
        mondo.annotateTransaction(mondargs.transaction_id, metadata, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct annotateTransaction request when using callback', function (done) {
        mondo.annotateTransaction(mondargs.transaction_id, metadata, mondargs.access_token, testSuccess(done))
      })
      it('should send correct annotateTransaction request when sent as object', function (done) {
        mondo.annotateTransaction(_.extend({transaction_id: mondargs.transaction_id}, metadata), mondargs.access_token, testSuccess(done))
      })
      it('should send correct annotateTransaction request when sent as nested object', function (done) {
        mondo.annotateTransaction({
          transaction_id: mondargs.transaction_id,
          metadata: metadata
        }, mondargs.access_token, testSuccess(done))
      })
      it('should send correct annotateTransaction request when metadata aliased as annotation', function (done) {
        mondo.annotateTransaction({
          transaction_id: mondargs.transaction_id,
          annotation: metadata
        }, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Create feed item', function () {
      var url = methodPaths.createFeedItem
      var params = {
        account_id: mondargs.account_id,
        url: 'http://foo.com',
        params: {
          title: 'foo',
          image_url: 'http://foo.com/icon.gif'
        }
      }
      function createFeedItemNock () {
        knocker({
          url: url,
          form: {
            account_id: mondargs.account_id,
            url: 'http://foo.com',
            type: 'basic',
            'params[title]': 'foo',
            'params[image_url]': 'http://foo.com/icon.gif'
          }
        })
      }
      beforeEach(function () {
        createFeedItemNock()
      })
      it('should send correct createFeedItem request', function (done) {
        mondo.createFeedItem(params, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct createFeedItem request when using callback', function (done) {
        mondo.createFeedItem(params, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Webhooks', function () {
      function webhooksNock () {
        var url = methodPaths.webhooks
        knocker({
          url: url,
          query: { account_id: mondargs.account_id }
        })
      }
      beforeEach(function () {
        webhooksNock()
      })
      it('should send correct webhooks request', function (done) {
        mondo.webhooks(mondargs.account_id, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct webhooks request when using callback', function (done) {
        mondo.webhooks(mondargs.account_id, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Register webhook', function () {
      var url = methodPaths.registerWebhook
      var webhookUrl = 'http://foo.com'
      function registerWebhookNock () {
        knocker({
          url: url,
          form: {
            account_id: mondargs.account_id,
            url: webhookUrl
          }
        })
      }
      beforeEach(function () {
        registerWebhookNock()
      })
      it('should send correct registerWebhook request', function (done) {
        mondo.registerWebhook(mondargs.account_id, webhookUrl, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct registerWebhook request when using callback', function (done) {
        mondo.registerWebhook(mondargs.account_id, webhookUrl, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Delete webhook', function () {
      var webhook_id = 'webhook_id'
      var url = methodPaths.deleteWebhook + webhook_id
      function deleteWebhookNock () {
        knocker({
          method: 'delete',
          url: url
        })
      }
      beforeEach(function () {
        deleteWebhookNock()
      })
      it('should send correct deleteWebhook request', function (done) {
        mondo.deleteWebhook(webhook_id, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct deleteWebhook request when using callback', function (done) {
        mondo.deleteWebhook(webhook_id, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Register attachment', function () {
      var url = methodPaths.registerAttachment
      var file_url = 'http://foo.com/bar.gif'
      var file_type = 'gif'
      var params = {
        external_id: mondargs.transaction_id,
        file_url: file_url,
        file_type: file_type
      }
      function registerAttachmentNock () {
        knocker({
          url: url,
          form: params
        })
      }
      beforeEach(function () {
        registerAttachmentNock()
      })
      it('should send correct registerAttachment request', function (done) {
        mondo.registerAttachment(params, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct registerAttachment request when using callback', function (done) {
        mondo.registerAttachment(params, mondargs.access_token, testSuccess(done))
      })
      it('should send correct registerAttachment request when params aliases used', function (done) {
        mondo.registerAttachment({
          transaction_id: mondargs.transaction_id,
          url: file_url,
          type: file_type
        }, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Upload attachment', function () {
      var url = methodPaths.uploadAttachment
      var file_name = 'bar.png'
      var file_type = 'png'
      var params = {
        file_name: file_name,
        file_type: file_type
      }
      function uploadAttachmentNock () {
        knocker({
          url: url,
          form: params
        })
      }
      beforeEach(function () {
        uploadAttachmentNock()
      })
      it('should send correct uploadAttachment request', function (done) {
        mondo.uploadAttachment(params, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct uploadAttachment request when using callback', function (done) {
        mondo.uploadAttachment(params, mondargs.access_token, testSuccess(done))
      })
      it('should send correct uploadAttachment request when params aliases used', function (done) {
        mondo.uploadAttachment({
          file_name: file_name,
          type: file_type
        }, mondargs.access_token, testSuccess(done))
      })
      it('should send correct uploadAttachment request when other params aliases used', function (done) {
        mondo.uploadAttachment({
          name: file_name,
          file_type: file_type
        }, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Deregister attachment', function () {
      var url = methodPaths.deregisterAttachment
      var attachment_id = 'attachment_id'
      function deregisterAttachmentNock () {
        knocker({
          url: url,
          form: {
            id: attachment_id
          }
        })
      }
      beforeEach(function () {
        deregisterAttachmentNock()
      })
      it('should send correct deregisterAttachment request', function (done) {
        mondo.deregisterAttachment(attachment_id, mondargs.access_token).then(testSuccess(done))
      })
      it('should send correct deregisterAttachment request when using callback', function (done) {
        mondo.deregisterAttachment(attachment_id, mondargs.access_token, testSuccess(done))
      })
    })

    describe('Dev Methods', function () {
      function setHostNock () {
        knocker({
          host: 'http://localhost:9090',
          url: methodPaths.accounts
        })
      }
      beforeEach(function () {
        setHostNock()
      })
      it('should send correct accounts request', function (done) {
        mondo.setHost('http://localhost:9090')
        mondo.accounts(mondargs.access_token).then(testSuccess(done))
      })
    })
  }
})
