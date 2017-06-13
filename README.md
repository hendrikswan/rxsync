# rxsync

[![Build Status](https://travis-ci.org/hendrikswan/rxsync.svg?branch=master)](https://travis-ci.org/hendrikswan/rxsync)

A lightweight library that operates on rxjs to reliably execute a stream of promises

## Motivation 

When you have a stream of events/messages that you need to sync somewhere else you will have to take into account concerns like retries, pauses between retries, and pausing/resuming the whole sync while you have a confirmed issue, for example an interrupted network connection. 

Although it's possible to get your syncing strategy working with pure promises, it can be very challenging to introduce retries, delays, and pause/resume on the whole sync process. 

This library uses RxJS under the hood to allow for messages/events to be retried with optional delays between retries on a per item basis, as well as give you control to pause/resume the sync process. 

## Installation

`npm i rxsync`

## Usage 

### Import the createSync function
```javascript
const createSync = require('rxsync');
```

### Call createSync to get a sync object back 

You call createSync to get a sync object, which you can use afterwards to queue messages to be synced, pause/resume the syncing, and get notified of the successful and failed items. 

```javascript
const sync = createSync({
  maxRetries: 3, 
  delayBetweenRetries: 500,
  syncAction: (item) => fetch(`http://google.com/?s=${item.search}`)), // a
});

```

### Queueing an item to be synced 

```javascript
sync.queue({ search: 'shoes' });
```

### Processing the results (RxJS observables)

To get notified of the results of each item in your code, you can subscribe to RxJS observables on the sync object. The results returned from the streams will contain extra meta data (number of retries, last try timestamp, error, result, etc). The actual item passed into the `queue` function can be retrieved on the `item` attribute. 

```javascript 
// success
sync.syncedItems.subscribe(x => console.log(x.item));

// failure 
sync.failedItems.subscribe(x => console.log(x.item));
```

### Pausing/resuming

When you run into a problem with your IO, for example a disconnected websocket, you would want to pause processing of the whole queue to ensure that your messages don't all just go to the failure queue. 

Calling pause on an already paused sync will not cause any harm, and calling resume on an already running sync will also cause no harm. 

In this example, we have a socket and we pause the sync process when the socket is disconnected, and resume it when the socket is connected. 

```javascript
socket.on('connect', () => sync.resume());
socket.on('disconnect', () => sync.pause());
```

### Options

These are the options when constructing the sync object by calling `createSync`: 

#### maxRetries

The sync logic will try each item this many times before sending the item on to the failedItems stream. 

#### delayBetweenRetries 

The sync logic will wait this long before retrying an item after it failed processing it. 

#### syncAction 

This is the function that the sync logic will call to get the logic to sync the item. It expects a promise to be returned when this function is called. It'll pass the item being synced to this function. 

In this example, we use the fetch api to call google, expecting a search attribute on the item that was passed through the `queue` function on the sync object. 

```
syncAction: (item) => fetch(`http://google.com/?s=${item.search}`))
```


