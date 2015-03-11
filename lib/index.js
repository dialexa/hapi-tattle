'use strict';

var Joi = require('joi');
var Hoek = require('hoek');
var yarp = require('yarp');

var internals = {
  defaults: {
    objectName: 'transaction',
    filterFunc: function(req){ return true; }
  },
  options: Joi.object({
    url: Joi.string().uri({scheme: ['http', 'https']}).required(),
    auth: Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required()
    }),
    filterFunc: Joi.func(),
    objectName: Joi.string().optional().allow(null, false),
    otherData: Joi.object().optional()
  })
};

exports.register = function(plugin, options, next){
  var validateOptions = internals.options.validate(options);
  if (validateOptions.error) {
    return next(validateOptions.error);
  }

  var settings = Hoek.clone(internals.defaults);
  Hoek.merge(settings, options);

  plugin.ext('onPreResponse', function(req, reply){
    if(!settings.filterFunc(req)) { return reply.continue(); }

    var tail = req.tail('report transaction');

    var record = {
      path: req.url.path,
      statusCode: req.response.statusCode,
      method: req.method.toUpperCase()
    };

    if(settings.otherData) {
      Hoek.merge(record, settings.otherData, false);
    }

    if(settings.objectName) {
      var res2 = {};
      res2[settings.objectName] = record;
      record = res2;
    }

    var request = {
      method: 'POST',
      url: settings.url,
      body: record,
      json: true
    };

    if(settings.auth) {
      request.auth = settings.auth;
    }

    yarp(request).catch(function(err){
      req.log(['error', 'tattle'], 'Error sending transaction record: '+JSON.stringify(err));
    }).fin(function(){
      tail();
    }).done();

    reply.continue();
  });

  next();
};

exports.register.attributes = {
  pkg: require('../package.json')
};