const Rx = require('rxjs/Rx');

const pausableBuffered = (observable, pauser) => {
    const subj = new Rx.Subject();

    let buffer = [];
    const nextEmitter = x => subj.next(x);
    const nextBuffer = x => buffer.push(x);

    let subscriber = nextEmitter;
    observable.subscribe(x => subscriber(x));

    pauser.subscribe(value => {
        if (value) {
            subscriber = nextBuffer;
        } else {
            buffer.forEach(nextEmitter);
            buffer = [];
            subscriber = nextEmitter;
        }
    });

    return subj;
};


function createSync({
  maxRetries = 1000,
  delayBetweenRetries = 0,
  syncAction,
  loggingEnabled = false,
}) {
  const pauseSubject = new Rx.Subject();
  const syncedItems = new Rx.Subject();
  const pendingItems = new Rx.Subject();
  const failedItems = new Rx.Subject();
  const pausablePending = pausableBuffered(pendingItems, pauseSubject);

  function log() {
    if (loggingEnabled) {
      console.log.apply(console, arguments);
    }
  }

  function internalQueue(item) {
    log('queuing an item ', item);
    if (item.sync.counter >= maxRetries - 1) {
      failedItems.next(item);
      return;
    }

    const workingItem = Object.assign({}, item, {
      sync: {
        counter: item.sync.counter + 1,
        lastTry: new Date(),
      },
    });

    pendingItems.next(workingItem);
  }

  pausablePending.subscribe((item) => {
    log('got an item from the pending stream: ', item);
    syncAction(item)
      .then(result => {
        log('successfully executed the sync action for ', item);
        syncedItems.next(Object.assign({}, item, result));
      })
      .catch(error => {
        log('got an error while trying to sync item: ', item, error);
        internalQueue(Object.assign({}, item, error));
      });
  });

  return {
    queue: (item) => {
      internalQueue({
        item,
        sync: {
          counter: 0,
        },
      });
    },
    pause: () => {
      pauseSubject.next(true);
    },
    resume: () => {
      pauseSubject.next(false);
    },
    syncedItems,
    failedItems,
  };
}

const sync = createSync({
  maxRetries: 2,
  delayBetweenRetries: 2000,
  syncAction: (item) => {
    return new Promise((resolve, reject) => {
      const success = Boolean(Math.round(Math.random()));
      if (success) {
        resolve();
      } else {
        reject();
      }
    });
  },
});


module.exports = createSync;

/*
for (let index = 0; index < 100; index++) {
  sync.queue({
    id: index,
  });

  if (index === 50) {
    sync.pause();
  }
}


setTimeout(sync.resume, 5000);

sync.syncedItems.subscribe(item => console.log('successfully synced: ', item));
sync.syncedItems.subscribe(item => console.log('failed sync: ', item));
*/