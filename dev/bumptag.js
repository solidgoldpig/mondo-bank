'use strict'

import fs from 'fs'
import path from 'path'

let packagePath = path.resolve(__dirname, '..', 'package.json')

let pkg = require(packagePath)
let version = pkg.version
console.log('Pre-publishing mondo', version)

if (!version.includes('-rc')) {
  pkg.repository.url = pkg.repository.url.replace(/#(.*)/, `#${version}`)
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2))
  console.log('Bumped git repository url tag')
}
console.log('Git repository url', pkg.repository.url)
