# mondo-bank

Node wrapper for [Mondo](https://getmondo.co.uk/) API

All current methods (as of 1 Dec 2015) implemented and can be used as promises or callback-style.

See https://getmondo.co.uk/docs


## Version

0.1.3


## Installation

    npm install mondo-bank


## Usage

    mondo = require('mondo-bank')

All methods return a promise but can optionally be called with a callback function as the final argument

#### Promise style

    methodPromise = mondo[$method]([$params])
    methodPromise
       .then(function(value){
         ...
       })
       .catch(function(err){
         ...
       })

#### Callback style

    mondo[method]([$params], function(err, value){
      if (err) {
       ...
      }
      ...
    })

### Methods

Acquire an access token

    tokenPromise = mondo.token({
      client_id: client_id,
      client_secret: client_secret,
      username: username,
      password: password
    })

Get information about an access token

    tokenInfoPromise = mondo.tokenInfo(accessToken)

Refresh a proviously acquired token

    refreshTokenPromise = mondo.refreshToken(refreshToken)

or if the client id and secret have not been previously passed

    refreshTokenPromise = mondo.refreshToken({
      refreshToken: refreshToken,
      client_id: client_id,
      client_secret: client_secret
    })

Get detailed information about customer’s accounts

    accountsPromise = mondo.accounts(accessToken)

Get balance details for an account

    balancePromise = mondo.balance(account_id, access_token)

Get details about a transaction

    transactionPromise = mondo.transaction(transaction_id, access_token)

or to see expanded info for the merchant

    transactionPromise = mondo.transaction({
      transaction_id: transaction_id,
      expand: 'merchant'
    }, access_token)

Annotate a transaction

    annotateTransactionPromise = mondo.annotateTransaction(transaction_id, {
      foo: 'bar'
    }, access_token)

or

    annotateTransactionPromise = mondo.annotateTransaction({
      transaction_id: transaction_id,
      foo: 'bar'
    }, access_token)

List transactions

    transactionsPromise = mondo.transactions(account_id, access_token)

or to filter the results

    transactionsPromise = mondo.transactions({
      account_id: account_id,
      since: since,
      before: before
      limit: limit
    }, access_token)

Publish a new feed entry "params[background_color]=#FCF1EE" \ "params[body_color]=#FCF1EE" \ "params[title_color]=#333" \ "params[body]=Some body text to display"

    createFeedItemPromise = mondo.createFeedItem({
      account_id: accountId,
      params: {
        title: title,
        image_url: image_url
      },
      url: url
    }, access_token)

Register a webhook

    registerWebhookPromise = mondo.registerWebhook(account_id, url, access_token)

See [https://getmondo.co.uk/docs/#transaction-created](https://getmondo.co.uk/docs/#transaction-created) for details of the transaction.created event which is sent to the webhook each time a new transaction is created in a user’s account

List webhooks

    webhooksPromise = mondo.webhooks(account_id, access_token)

Delete webhook

    deleteWebhookPromise = mondo.deleteWebhook(webhook_id, access_token)

Register attachment

    registerAttachmentPromise = mondo.registerAttachment({
      external_id: transaction_id,
      file_type: file_type,
      file_url: file_url
    }, access_token)

Request upload attachment url

    uploadAttachmentPromise = mondo.uploadAttachment({
      file_name: file_name,
      file_type: file_type
    }, access_token)

Deregister attachment

    deregisterAttachmentPromise = mondo.deregisterAttachment(attachment_id, access_token)


## Documentation

    npm run docs

This generates documentation with jsdoc in the docs directory (ignored by git) and also updates the README.md file.


## Known issues

- No tests


## Unlicense

mondo-bank is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this software dedicate any and all copyright interest in the software to the public domain. We make this dedication for the benefit of the public at large and to the detriment of our heirs and successors. We intend this dedication to be an overt act of relinquishment in perpetuity of all present and future rights to this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>