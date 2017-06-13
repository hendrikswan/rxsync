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
  maxRetries = 0,
  delayBetweenRetries = 0,
  syncAction,
  loggingEnabled = false,
}) {
  const pauseSubject = new Rx.Subject();
  const syncedItems = new Rx.Subject();
  const failedItems = new Rx.Subject();
  
  const pendingIn = new Rx.Subject();
  const delayedPending = pendingIn
    .map(item => Rx.Observable.of(item).delay(item.sync.counter > 0 ? delayBetweenRetries : 0))
    .mergeAll();
  const pendingOut = pausableBuffered(delayedPending, pauseSubject);

  function log() {
    if (loggingEnabled) {
      console.log.apply(console, arguments);
    }
  }

  function internalQueue(item) {
    log('queuing an item ', item);
    if (item.sync.counter > 0 && item.sync.counter >= maxRetries) {
      failedItems.next(item);
      return;
    }

    const workingItem = Object.assign({}, item, {
      sync: {
        counter: item.sync.counter + 1,
        lastTry: new Date(),
      },
    });

    pendingIn.next(workingItem);
  }

  pendingOut.subscribe((itemWithMetaData) => {
    const item = itemWithMetaData.item;
    log('got an item from the pending stream: ', item);
    syncAction(item)
      .then(result => {
        log('successfully executed the sync action for ', item);
        syncedItems.next(Object.assign({}, itemWithMetaData, {
          sync: Object.assign({}, itemWithMetaData.sync, { result })
        }));
      })
      .catch(error => {
        log('got an error while trying to sync item: ', item, error);
        internalQueue(Object.assign({}, itemWithMetaData, {
          sync: Object.assign({}, itemWithMetaData.sync, { error })
        }));
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

module.exports = createSync;