'use strict';

var abstractTest = require('mqtt/test/abstract_store');
var level = require('level-test')();
var mqttLevelStore = require('./');

describe('mqtt level store', function() {
  abstractTest(function(done) {
    done(null, mqttLevelStore.single({ level: level() }));
  });
});
