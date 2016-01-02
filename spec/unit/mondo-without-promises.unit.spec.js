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

describe('Mondo unit tests', function () {
  beforeEach(function () {
    nock.cleanAll()
  })

  if (typeof Promise === 'undefined') {
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

      it('should send correct token request when promises are not available', function (done) {
        mondo.token(mondargs.credentials, testSuccess(done))
      })
      it('should send handle token response failure when promises are not available', function (done) {
        mondo.token(_.extend({}, mondargs.credentials, { client_id: 'invalid' }), testResponseError(done))
      })
      it('should throw an error when promises are not available if no callback is passed', function (done) {
        try {
          mondo.token(mondargs.credentials)
        } catch (err) {
          expect(err.message).toEqual('method.missing.callback')
          done()
        }
      })
    })
  }
})
