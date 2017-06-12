const assert = require('assert');
const createSync = require('../index');

describe('#createSync', function() {
  it('executes all promises and streams out to success stream', (done) => {
    const sync = createSync({
      syncAction: (item) => {
        return new Promise((resolve, reject) => {
          resolve(item.id);
        });
      }
    });

    let counter = 0;

    sync.syncedItems.subscribe(x => {
      // console.log('Received an item from the synced stream: ', x);
      counter++;
      if (counter === 2) {
        done();
      }
    });

    sync.queue({ id: 1 });
    sync.queue({ id: 2 });
  });


  it('when an item fails, it goes to the failed stream', (done) => {
    const sync = createSync({
      syncAction: (item) => {
        return new Promise((resolve, reject) => {
          reject(item.id);
        });
      }
    });

    let counter = 0;

    sync.failedItems.subscribe(x => {
      // console.log('Received an item from the failed stream: ', x);
      counter++;
      if (counter === 2) {
        done();
      }
    });

    sync.queue({ id: 1 });
    sync.queue({ id: 2 });
  });


  it('when an item fails, it gets retried up to the maximum number of retries', (done) => {
    let numberOfTries = 0;

    const sync = createSync({
      maxRetries: 5,
      syncAction: (item) => {
        numberOfTries += 1;
        return new Promise((resolve, reject) => {
          reject(item.id);
        });
      }
    });

    sync.failedItems.subscribe(x => {
      // do this in a timeout to prevent promise catching to kick in
      setTimeout(() => {
        assert.equal(numberOfTries, 5);
        done();
      });
    });

    sync.queue({ id: 1 });
  });  
});