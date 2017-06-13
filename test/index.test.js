const assert = require('assert');
const createSync = require('../index');

describe('sync', function() {
  this.timeout(2000);

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
      },
      maxRetries: 0,
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

  it('when an item fails, it honors the delay before retrying', (done) => {
    const sync = createSync({
      maxRetries: 2,
      syncAction: (item) => {
        return new Promise((resolve, reject) => {
          reject(item.id);
        });
      },
      delayBetweenRetries: 200,
    });

    var startDate = new Date();
    sync.queue({ id: 1 });

    sync.failedItems.subscribe(x => {
      setTimeout(() => {
        const timeSinceStart =  (new Date()).getTime() - startDate.getTime();
        assert.equal(true, 
          timeSinceStart > 400 && timeSinceStart < 600, 
          'with a max retry of 2 and a delay of 200ms the item should be in the failure stream in just over 400s'
        );
        done();
      });
    });
  });   
});