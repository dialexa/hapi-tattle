Tattle Plugin for Hapi
======================

[![NPM](https://nodei.co/npm/hapi-tattle.png)](https://nodei.co/npm/hapi-tattle/)

[![npm version](https://badge.fury.io/js/hapi-tattle.svg)](http://badge.fury.io/js/hapi-tattle)
[![Build Status](https://travis-ci.org/dialexa/hapi-tattle.svg)](https://travis-ci.org/dialexa/hapi-tattle)

A Hapi plugin that reports certain requests to a central HTTP service.  Works with Hapi version 8 or later.

```bash
npm install --save hapi-tattle
```

Register the plugin and each request for which `filterFunc` returns true will result in a call to `url` containing information about the request.  The call occurs as a `onPreResponse` extension and doesn't interrupt the response.  It also registers a "tail" event that resolves after the external service responds.

```javascript
var Hapi = require('hapi');

var server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

server.register({
  register: require('hapi-tattle'),
  options: {
    url: 'https://my.app.com/transactions',
    filterFunc: function(req){
      return req.route.settings.app.isTransaction;
    }
  }
}, function(){
  server.start();
});

server.route({
  method: 'GET',
  url: '/tracked',
  config: {
    app: {
      isTransaction: true
    }
  },
  method: function(req, reply){
    reply('ok');
  }
})

server.route({
  method: 'GET',
  url: '/untracked',
  config: {
    app: {
      isTransaction: false
    }
  },
  method: function(req, reply){
    reply('ok');
  }
})
```

With the above, information about calls to `/tracked` will be posted to `https://my.app.com/transactions`, and those to `/untracked` will not be.

Plugin Options
--------------

The following options are available when registering the plugin:
- _'url'_ (required) - the URL to call for authentication.
- _'auth'_ - authentication object that will be included with the request to the external service.  Can be an object including `username` and `password` or `null` to not authenticate the request.  Defaults to `null`.
- _'filterFunc'_ - function that will be passed the request object and, if it returns `true`, the request will be reported.  Otherwise the report will be skipped.  Defaults to a function that always returns `true`.
- _'objectName'_ - the name of the object that will be sent to the external service.  Defaults to "transaction".
- _'otherData'_ - static object to be merged with the transaction object being sent.  Defaults to `null`.