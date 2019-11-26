module.exports = {

  /** @todo get rid of this by updating the `node-bugcatcher` package */
  bugcatcherUri: "https://api.bugcatcher.fasterthanlight.dev/",
  
  labels: {
    setup: {
      context: "FTL BugCatcher",
      description: {
        setup: "Set up FTL static analysis tests",
        pending: "Setting up FTL static analysis...",
        error: "ERROR Setting up FTL static analysis",
        failure: "FAILED to setup FTL static analysis",
        success: "COMPLETED Setting up FTL static analysis",
      }
    },
    uploading: {
      context: "FTL BugCatcher",
      description: {
        setup: "Synchronize repository with BugCatcher",
        pending: "Synchronizing repository with BugCatcher...",
        error: "ERROR Synchronizing repository with BugCatcher",
        failure: "FAILED Synchronizing repository with BugCatcher",
        success: "COMPLETED Synchronization of repository",
      }
    },
    testing: {
      context: "FTL BugCatcher",
      description: {
        setup: "Perform Static Analysis testing",
        pending: "Performing Static Analysis testing...",
        error: "ERROR Performing Static Analysis testing",
        failure: "FAILURE Performing Static Analysis testing",
        success: "COMPLETED Static Analysis testing",
      }
    },
    results: {
      context: "FTL BugCatcher",
      description: {
        setup: "Fetch test results",
        pending: "Fetching test results...",
        error: "ERROR Getting test results",
        failure: "Found possible issues!",
        success: "PASSED All tests with \"%severity%\" severity threshold",
      }
    },
  },

  statusSteps: {
    setup: 'setup',
    uploading: 'uploading',
    testing: 'testing',
    results: 'results',
  },

  statusStates: {
    error: 'error',
    failure: 'failure',
    pending: 'pending',
    setup: 'setup',
    success: 'success',
  }
  
}