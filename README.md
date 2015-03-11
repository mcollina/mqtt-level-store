# MQTT.js Level Store

Store in-flight MQTT.js packets in LevelDB

## Usage

```js
var mqtt = require('mqtt'),
  level = levelStore('path/to/db');

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
