'use strict';

var abstractTest = require('mqtt/test/abstract_store');
var level = require('level-test')();
var mqttLevelStore = require('./');

describe('mqtt level store', function() {
  abstractTest(function(done) {
    done(null, mqttLevelStore.single({ level: level() }));
  });
});

describe('mqtt level store manager', function() {
  var manager;

  beforeEach(function() {
    manager = mqttLevelStore({ level: level() });
  });

  afterEach(function(done) {
    manager.close(done);
  });

  describe('incoming', function() {
    abstractTest(function(done) {
      done(null, manager.incoming);
    });
  });

  describe('outgoing', function() {
    abstractTest(function(done) {
      done(null, manager.outgoing);
    });
  });
});
