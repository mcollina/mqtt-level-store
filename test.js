'use strict';

var abstractTest = require('mqtt/test/abstract_store');
var level = require('level-test')();
var mqttLevelStore = require('./');
var mqtt = require('mqtt');
var concat = require('concat-stream')

describe('mqtt level store', function () {
  abstractTest(function (done) {
    done(null, mqttLevelStore.single({ level: level() }));
  });
});

describe('mqtt level store manager', function () {
  var manager;

  beforeEach(function () {
    manager = mqttLevelStore({ level: level() });
  });

  afterEach(function (done) {
    manager.close(done);
  });

  describe('incoming', function () {
    abstractTest(function (done) {
      done(null, manager.incoming);
    });
  });

  describe('outgoing', function () {
    abstractTest(function (done) {
      done(null, manager.outgoing);
    });
  });
});

describe('mqtt.connect flow', function () {
  var server;
  var manager;

  beforeEach(function (done) {
    server = new mqtt.Server()
    server.listen(8883, done)

    server.on('client', function (client) {
      client.on('connect', function (packet) {
        client.connack({returnCode: 0});
      });
    });

    manager = mqttLevelStore({ level: level() });
  });

  it('should resend messages', function (done) {
    var client = mqtt.connect({
      port: 8883,
      incomingStore: manager.incoming,
      outgoingStore: manager.outgoing
    });

    client.publish('hello', 'world', {qos: 1});

    server.once('client', function (serverClient) {
      serverClient.once('publish', function (p) {
        serverClient.stream.destroy();

        manager.outgoing.createStream().pipe(concat(function(list) {
          list.length.should.equal(1)
        }));
      });

      server.once('client', function (serverClient) {
        serverClient.once('publish', function (packet) {
          serverClient.puback(packet);
          client.end();
          done();
        });
      });
    });
  });
});
