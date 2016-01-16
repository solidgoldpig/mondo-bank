'use strict'

var fs = require('fs')
var path = require('path')

describe('gh-pages tests', function () {
  it('should have an index page', function (done) {
    fs.readFile(path.resolve('../index.html'), (err, file) => {
      expect(err).toEqual(null)
      done()
    })
  })
})
