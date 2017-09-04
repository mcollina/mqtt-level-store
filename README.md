# MQTT.js Level Store

Persistent Store for in-flight MQTT.js packets. Works in Node and the Browser thanks to [level-browserify](http://npm.im/level-browserify).

## Installation

`npm install mqtt-level-store --save`

## Usage

```js
'use strict';

var mqtt = require('mqtt'),
  levelStore = require('mqtt-level-store');
  manager = levelStore('path/to/db');

var client = mqtt.connect({
  port: 8883,
  incomingStore: manager.incoming,
  outgoingStore: manager.outgoing
});

//// or
// var client = mqtt.connect('mqtt://test.mosca.io', {
//  port: 8883,
//  incomingStore: manager.incoming,
//  outgoingStore: manager.outgoing
//});

client.on('connect', function() {
  console.log('connected');
  client.publish('hello', 'world', {qos: 1}, function() {
    console.log('published');
    client.end();
  });
});
```

Note, `path/to/db` is a folder, not a file. Files will be created at the given path.

## License

MIT
