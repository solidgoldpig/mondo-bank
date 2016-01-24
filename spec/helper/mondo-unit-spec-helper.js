'use strict'

var nock = require('nock')
var apiValues = require('../../lib/api.values.json')

var mondargs = {}
mondargs.api = apiValues
mondargs.credentials = {
  client_id: 'valid',
  client_secret: 'valid',
  username: 'valid',
  password: 'valid'
}
mondargs.access_token = 'valid'
mondargs.refresh_token = 'valid'
mondargs.account_id = 'valid'
mondargs.transaction_id = 'valid'

function knocker (options) {
  var knock = nock(options.host || mondargs.api.host)
  if (options.form && !options.method) {
    options.method = 'post'
  }
  knock = knock[(options.method || 'get')](options.url, options.form)
  if (options.query) {
    knock = knock.query(options.query)
  }
  if (options.auth !== false) {
    knock = knock.matchHeader('Authorization', 'Bearer ' + mondargs.access_token)
  }
  knock.reply(options.code || 200, options.code ? '{"err":"error"}' : '{"value":"success"}')
}
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

module.exports = {
  mondargs: mondargs,
  knocker: knocker,
  success: testSuccess,
  responseError: testResponseError,
  requestError: testRequestError
}
