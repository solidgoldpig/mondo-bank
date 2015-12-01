'use strict';

var version = '0.1.0';

var request = require('request-promise');
var _ = require('lodash');

var apiUri = 'https://production-api.gmon.io';

var client_id;
var client_secret;

var dateParams = ['since', 'before'];

// Helper functions

// Allow params to be aliased
function dealiasParams(params, aliases) {
  params = _.extend({}, params);
  Object.keys(aliases).forEach(function(param){
    var aliased = aliases[param];
    aliased = typeof aliased === 'string' ? [aliased] : aliased;
    aliased.forEach(function(alias){
      if (params[param] === undefined && params[alias] !== undefined) {
        params[param] = params[alias];
      }
    delete params[alias];
    });
  });
  return params;
}

// Allow params to be passed unbracketed
function bracketifyParams(obj, param){
  var bracketedObj = {};
  Object.keys(obj).forEach(function(prop){
    // what if bracketed prop already exists?
    bracketedObj[param+'['+prop+']'] = obj[prop];
  });
  return bracketedObj;
}

// Adds necessary auth header
function addAuthorizationHeader (options, access_token) {
  options.headers = options.headers || {};
  options.headers.Authorization = 'Bearer ' + access_token;
  return options;
}

// Call the API
function apiRequest(options, fn){
  options = _.extend({}, options);
  if (options.form && options.form.client_id && options.form.client_secret) {
    client_id = options.form.client_id;
    client_secret = options.form.client_secret;
  }
  if (options.qs) {
    dateParams.forEach(function(dParam){
      if (typeof options.qs[dParam] === 'object') {
        options.qs[dParam] = options.qs[dParam].toISOString();
      }
    });
  }
  if (options.uri.indexOf('://') === -1) {
    options.uri = apiUri + options.uri;
  }
  options.method = options.method || 'GET';
  options.json = true;
  options.headers = options.headers || {};
  options.headers.client = 'NodeMondo-v' + version;

  var reqpromise = request(options);

  if (! fn) {
    return reqpromise;
  } else {
    reqpromise.then(function(parsed_body) {
      fn(null, parsed_body);
    })
      .catch(function(err) {
        fn(err);
      });
  }
}

// Call the API with authentication
function apiRequestAuthenticated(options, access_token, fn){
  options = _.extend({}, options);
  options = addAuthorizationHeader(options, access_token);
  return apiRequest(options, fn);
}

// API methods

// Acquire an access token
function token(credentials, fn) {
  var options = {
    method: 'POST',
    uri: '/oauth2/token',
    form: _.extend({
      grant_type: 'password',
      client_id: client_id,
      client_secret: client_secret
    }, credentials)
  };
  return apiRequest(options, fn);
}

// Authenticate user
function authenticate(access_token, fn) {
  var options = {
    uri: '/ping/whoami'
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Refresh a proviously acquired token
function refreshToken(refresh_token, fn) {
  if (typeof refresh_token === 'string') {
    refresh_token = {
      refresh_token: refresh_token
    };
  }
  var options = {
    method: 'POST',
    uri: '/oauth2/token',
    form: _.extend({
      grant_type: 'refresh_token',
      client_id: client_id,
      client_secret: client_secret
    }, refresh_token)
  };
  return apiRequest(options, fn);
}

// Get details about a transaction
function transaction(transaction_id, access_token, expanded, fn){
  var options = {
    uri: '/transactions/' + transaction_id
  };
  if (expanded) {
    options.qs = {
      'expand[]': 'merchant'
    };
  }
  options = addAuthorizationHeader(options, access_token);
  return apiRequest(options, fn);
}

// Annotate transaction
function annotateTransaction(transaction_id, metadata, access_token, fn){
  metadata = bracketifyParams(metadata, 'metadata');
  var options = {
    method: 'PATCH',
    uri: '/transactions/' + transaction_id,
    form: metadata
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// List transactions
// { account_id, limit, before, since}
function transactions(qs, access_token, fn){
  if (typeof qs === 'string') {
    qs = {
      account_id: qs
    };
  }
  var options = {
    uri: '/transactions',
    qs: qs
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Get detailed information about customer’s accounts
function accounts(access_token, fn){
  var options = {
    uri: '/accounts'
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Get balance details
function balance(account_id, access_token, fn){
  var options = {
    uri: '/balance',
    qs: {
      account_id: account_id
    }
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Publish a new feed entry
function createFeedItem(form, access_token, fn){
  form = _.extend({}, form);
  form.type = form.type || 'basic';
  var params = bracketifyParams(form.params, 'params');
  delete form.params;
  form = _.extend(form, params);
  var options = {
    method: 'POST',
    uri: '/feed',
    form: form
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Register a webhook
function registerWebhook(account_id, url, access_token, fn){
  var options = {
    method: 'POST',
    uri: '/webhooks',
    form: {
      account_id: account_id,
      url: url
    }
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// List webhooks
function webhooks(account_id, access_token, fn){
  var options = {
    uri: '/webhooks',
    qs: {
      account_id: account_id
    }
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Delete webhook
function deleteWebhook(webhook_id, access_token, fn){
  var options = {
    method: 'DELETE',
    uri: '/webhooks/'+webhook_id,
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Register attachment
// form { external_id, file_type, file_url }
function registerAttachment (form, access_token, fn){
  form = dealiasParams(form, {
    external_id: 'transaction_id',
    file_type: 'type',
    file_url: 'url'
  });
  var options = {
    method: 'POST',
    uri: '/attachment/register',
    form: form
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

// Upload attachment
// { file_name, file_type } optional { transaction_id }
function uploadAttachment(form, access_token, fn){
  form = dealiasParams(form, {
    file_name: ['file', 'name'],
    file_type: 'type'
  });
  var options = {
    method: 'POST',
    uri: '/attachment/upload',
    form: form
  };
  return apiRequestAuthenticated(options, access_token, fn);

  /*
  // rough on the train pretend code to allow upload and register in one call
  if (form.transaction_id) {
    // resolve apiRequest and attach image to it
    var upload = apiRequest(options);
    if (! fn) {
      upload.then(function(parsed_body) {
        fn(null, parsed_body);
      })
        .catch(function(err) {
          fn(err);
        });

  } else {
    return apiRequest(options, fn);
  }

   */
}

// Deregister attachment
function deregisterAttachment(id, access_token, fn){
  var options = {
    method: 'POST',
    uri: '/attachment/deregister',
    form: {
      id: id
    }
  };
  return apiRequestAuthenticated(options, access_token, fn);
}

module.exports = {
  token: token,
  authenticate: authenticate,
  refreshToken: refreshToken,
  transaction: transaction,
  annotateTransaction: annotateTransaction,
  transactions: transactions,
  accounts: accounts,
  balance: balance,
  createFeedItem: createFeedItem,
  registerWebhook: registerWebhook,
  deleteWebhook: deleteWebhook,
  webhooks: webhooks,
  registerAttachment: registerAttachment,
  uploadAttachment: uploadAttachment,
  deregisterAttachment: deregisterAttachment
}

