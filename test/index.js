'use strict';

var Lab = require('lab');
var Hapi = require('hapi');
var nock = require('nock');
var Boom = require('boom');
var B = require('bluebird');

var lab = exports.lab = Lab.script();
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var describe = lab.experiment;
var it = lab.test;
var expect = require('code').expect;

var internals = {};

internals.header = function(username, password) {
  return 'Basic ' + (new Buffer(username + ':' + password, 'utf8')).toString('base64');
};

describe('Registration', function() {
  var server;

  beforeEach(function(done) {
    server = new Hapi.Server().connection({ host: 'test' });
    done();
  });

  it('should register', function(done) {
    server.register(require('../'), function() {
      done();
    });
  });
});

describe('Transaction', function() {
  var server;

  beforeEach(function(done) {
    server = new Hapi.Server().connection({ host: 'test' });
    done();
  });

  afterEach(function(done) {
    nock.cleanAll();
    done();
  });

  it('should register a transaction with an external server', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 203, method: 'GET' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions'
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject('/test', function() {});

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should not send a transaction if the filterFunc is not satisfied', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 203, method: 'GET' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        filterFunc: function(req) {
          return req.route.settings.app.isTransaction;
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        config: { app: { isTransaction: false } },
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject('/test', function() {});

      server.on('tail', function() {
        expect(post.isDone()).to.be.false();
        done();
      });
    });
  });

  it('should send a transaction if the filterFunc is satisfied', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 203, method: 'GET' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        filterFunc: function(req) {
          return req.route.settings.app.isTransaction;
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        config: { app: { isTransaction: true } },
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject('/test', function() {});

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should merge other data into the request', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 201, method: 'GET', version: '1.2.3' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        otherData: {
          version: '1.2.3'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(201);
        }
      });

      server.inject('/test', function() { });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should allow the server to set the objectName for the transaction call', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  xaction: { path: '/test', statusCode: 201, method: 'GET', version: '1.2.3' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        objectName: 'xaction',
        otherData: {
          version: '1.2.3'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(201);
        }
      });

      server.inject('/test', function() { });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should allow the server to set the objectName to false and move the transaction info to root', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  path: '/test', statusCode: 201, method: 'GET', version: '1.2.3'
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        objectName: false,
        otherData: {
          version: '1.2.3'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(201);
        }
      });

      server.inject('/test', function() { });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should allow the server to set authentication to include with the report', function(done) {
    var post = nock('https://my.app.com').matchHeader('Authorization', 'Basic bWU6c2VjcmV0')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 201, method: 'GET' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        auth: {
          username: 'me',
          password: 'secret'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(201);
        }
      });

      server.inject('/test', function() {});

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should handle errors from the transaction reporting url', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 203, method: 'GET' }
                }).reply(500, { message: 'ack!' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        auth: {
          username: 'me',
          password: 'secret'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject('/test', function(res) {
        expect(res.result.foo).to.equal('bar');
        expect(res.statusCode).to.equal(203);
      });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should handle Boom responses', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 403, method: 'GET' }
                }).reply(201, { status: 'ok' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions'
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply(Boom.forbidden('not allowed'));
        }
      });

      server.inject('/test', function(res) {
        expect(res.result.message).to.equal('not allowed');
        expect(res.statusCode).to.equal(403);
      });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should not affect the response of the service', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: { path: '/test', statusCode: 203, method: 'GET' }
                }).reply(500, { message: 'ack!' });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        auth: {
          username: 'me',
          password: 'secret'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject('/test', function(res) {
        expect(res.result.foo).to.equal('bar');
        expect(res.statusCode).to.equal(203);
      });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });
});

describe('Credentials', function() {
  var server;

  beforeEach(function(done) {
    server = new Hapi.Server({ debug: { request: [ 'error' ] } }).connection({ host: 'test' });
    server.register(require('hapi-auth-basic'), done);
  });

  afterEach(function(done) {
    nock.cleanAll();
    done();
  });

  it('should send credentials information', function(done) {
    var post = nock('https://my.app.com')
                .post('/transactions', {
                  transaction: {
                    path: '/test',
                    statusCode: 203,
                    method: 'GET',
                    credentials: {
                      id: '02893261-7e35-42e7-98cc-0b4c87296dc1',
                      name: 'test'
                    }
                  }
                }).reply(201, { status: 'ok' });

    server.auth.strategy('simple', 'basic', { validateFunc: function(username, password, cb) {
      cb(null, true, { id: '02893261-7e35-42e7-98cc-0b4c87296dc1', name: 'test' });
    } });

    server.register({
      register: require('../'),
      options: {
        url: 'https://my.app.com/transactions',
        auth: {
          username: 'me',
          password: 'secret'
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        config: { auth: 'simple' },
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject({
        url: '/test',
        method: 'GET',
        headers: { authorization: internals.header('other_user', 'shhhhh') }
      }, function(res) {
        expect(res.result.foo).to.equal('bar');
        expect(res.statusCode).to.equal(203);
      });

      server.on('tail', function() {
        post.done();
        done();
      });
    });
  });

  it('should call a function if provided and expect a promise factory', function(done) {
    var functionCalled = false;

    server.register({
      register: require('../'),
      options: {
        func: function(record) {
          expect(record.transaction.path).to.equal('/test');
          functionCalled = true;

          return B.resolve();
        }
      }
    }, function() {
      server.route({
        method: 'GET',
        path: '/test',
        handler: function(req, reply) {
          reply({ foo: 'bar' }).code(203);
        }
      });

      server.inject('/test', function() {});

      server.on('tail', function() {
        expect(functionCalled).to.be.true();
        done();
      });
    });
  });
});
