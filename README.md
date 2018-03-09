# MQTTLogger

Collection of not entirely cohesive programs written in TypeScript
around the purpose of logging data from an MQTT server
and 

## Build it

```sh
node build.js
```

## Log stuff

```sh
node target/cjs/MQTTLogger.js -h <hostname or mqtt:// URL> -t <topic> [-t ...]
```

Will wrote logs to 

## Scripts to process log files

TODO:
- Process log files or real-time readings into hourly averages
- Combine multiple averages
- Thing that outputs a graph
- Nice user interface