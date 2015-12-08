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
          .reply(401, 'error')
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
})
