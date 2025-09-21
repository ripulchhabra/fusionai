var redis = require('redis'),
  rclient = redis.createClient();

rclient.on('connect', function (err, response) {
  'use strict';
  console.log('Connected to database');
});

module.exports = rclient;
