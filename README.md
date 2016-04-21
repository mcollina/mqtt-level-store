# MQTT.js Level Store

Persistent Store for in-flight MQTT.js packets. Works in Node and the Browser thanks to [level-browserify](http://npm.im/level-browserify).

## Usage

```js
'use strict';

var mqtt = require('mqtt'),
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

## License

MIT
