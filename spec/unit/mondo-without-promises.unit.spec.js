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
  var knock = nock(apiHost)
  if (options.form && !options.method) {
    options.method = 'post'
  }
  knock = knock[(options.method || 'get')](options.url, options.form)
  if (options.query) {
    knock = knock.query(options.query)
  }
  if (options.auth !== false) {
    knock = knock.matchHeader('Authorization', 'Bearer ' + access_token)
  }
  knock.reply(options.code || 200, options.code ? '{"err":"error"}' : '{"value":"success"}')
}

describe('Mondo unit tests', function () {
  function testSuccess (done) {
    return function (response) {
      if (arguments.length === 2) {
        // response is second arg if callback
        response = arguments[1]
      }
      expect(response).toEqual({value: 'success'})
      done()
    }
  }
  function testResponseError (done) {
    return function (err) {
      expect(err.error).toEqual({err: 'error'})
      done()
    }
  }
  function testRequestError (done) {
    return function (err) {
      expect(err).toMatch(/No match for request/)
      done()
    }
  }

  beforeEach(function () {
    nock.cleanAll()
  })

  if (typeof Promise === 'undefined') {
    describe('Get a token', function () {
      function tokenNock () {
        var successCreds = _.extend({grant_type: 'password'}, credentials)
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

      it('should send correct token request when promises are not available', function (done) {
        mondo.token(credentials, testSuccess(done))
      })
    })
  }
})
