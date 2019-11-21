/** Imports */
const BugCatcher = require('node-bugcatcher')
const { getRepoInfo } = require('./helpers')
const { bugcatcherUri } = require('../config')

/** Constants */
const uploadsPerSecond = 10,
  maxConcurrentUploads = 99,
  millisecondTimeout = Math.floor(1000 / uploadsPerSecond),
  retryAttemptsAllowed = 300,
  retryIntervalMilliseconds = 9000

/** Variables */
let retryAttempts = 0,
  lastPercentComplete = 0,
  currentUploadQueue,
  statusCheck,
  startCounting,
  testTimeElapsed = 0,
  successfulUploads = 0,
  concurrentUploads = 0

/** Functions */
const getBlob = async (context, file_sha) => {
  if (context && file_sha) {
    const { owner, repo } = getRepoInfo(context)
    const blob = await context.github.git.getBlob({
      owner,
      repo,
      file_sha
    })
    return blob ? blob.data : null
  }
}

const getTree = async context => {
  if (context) {
    const { owner, repo, sha: tree_sha } = getRepoInfo(context)
    return await context.github.git.getTree({
      owner,
      repo,
      tree_sha,
      recursive: 1 // recursive bool
    })
  }
}

const uploadFromTree = async (context, tree) => {
  const promise = new Promise((resolve, reject) => {

    // init the api with the token
    const api = BugCatcher(bugcatcherUri, context.token)

    // use the tree sha as the project name
    const { sha: projectName } = getRepoInfo(context)
    const thisUploadQueue = currentUploadQueue = new Date().getTime()

    // clear then show status messages
    let uploadErrors = [],
      uploaded = [],
      toUpload = tree.filter(t => t.type === 'blob'),
      retryFailedUploadsAttempt = 0,
      interval
    const treeSize = toUpload.length

    const checkUploadsComplete = () => {
      if (uploaded.length + uploadErrors.length === treeSize) { 
        if (!uploadErrors.length) {
          clearInterval(interval)
          resolve(true)
        }
        else if (retryFailedUploadsAttempt < 3) {
          retryFailedUploadsAttempt++
          console.log('Retry attempt #' + retryFailedUploadsAttempt)
          successfulUploads = successfulUploads - uploadErrors.length
          toUpload = uploadErrors
          uploadErrors = []
          reject()
        }
        else {
          clearInterval(interval)
        }
      }
    }
    const apiError = (err, file) => {
      console.error(err)
      uploadErrors.push(file)
      checkUploadsComplete()
    }
    const sendFile = async (file) => {
      concurrentUploads++
      const blob = await getBlob(context, file.sha)
        .catch(c => {
          console.error(c || new Error('error fetching blob'))
          console.log(`Failed: ${file.sha}`, file.path)
          return null
        })
      if (blob) {
        api.putCode({
          name: file.path,
          code: 'data:application/octet-stream;base64,' + blob['content'],
          project: encodeURIComponent(projectName),
        })
        .then(apiResponse => {
          successfulUploads++
          concurrentUploads--
          if (!apiResponse) apiError(null, file)
          else {
            uploaded.push(file)
            checkUploadsComplete()
          }
        })
        .catch(err => apiError(err, file))
      }
    }

    // send the files
    const sendFiles = () => {
      if (
        currentUploadQueue === thisUploadQueue
        && concurrentUploads <= maxConcurrentUploads
      ) {
        if (!toUpload.length) checkUploadsComplete()
        else {
          const file = toUpload[0]
          toUpload = toUpload.filter(f => f !== file)
          sendFile(file)
        }
      }
    }
    interval = setInterval(
      sendFiles,
      millisecondTimeout
    )

  })
  return promise
}

const checkTestStatus = (context) => {
  // init the api with the token
  const api = BugCatcher(bugcatcherUri, context.token)
  const { testId: stlid } = context

  let fetchingTest = true
  let reconnecting = false
  if (!stlid) return
  else return new Promise(async (resolve, reject) => {
    const noConnection = (err) => {
      reconnecting = true
      console.error(err || new Error('GET /run_tests connection timed out. Retrying...'))
    }
    const failed = (err) => {
      console.error(err || new Error('GET /run_tests returned a 502 Bad Gateway response'))
      reject()
    }

    const getRunTests = await api.getRunTests({ stlid }).catch(noConnection)
    const { data } = getRunTests || {}
    const { response } = data || {}
    fetchingTest = false

    // Fail for any status in the 400's
    if (getRunTests && response && response.status >= 400 && response.status <= 499) failed()
    
    // Retry failed connections
    if (!getRunTests || !response) noConnection()
    else reconnecting = false

    // abort if stlid does not match stlid
    if (response && response.stlid !== stlid) {
      clearInterval( statusCheck )
      reject()
    }

    // // update result data in `state`
    if (
      response && 
      response.percent_complete &&
      response.percent_complete >= lastPercentComplete
    ) {
      // Complete!
      reconnecting = false
    }

    // `percent_complete` has progressed
    if (
      response && 
      response.percent_complete &&
      response.percent_complete > lastPercentComplete
    ) {
      lastPercentComplete = response.percent_complete
      retryAttempts = 0
      reconnecting = false
    }

    // results are ready
    if (response && response.status_msg === 'COMPLETE') {
      response.percent_complete = 100
      resolve(response)
    }

    // the incoming response is from the current test
    else if (reconnecting || response.stlid === stlid) {
      // we should be fetching or not
      if (
        !fetchingTest &&
        (retryAttempts <= retryAttemptsAllowed || lastPercentComplete === 0)
      ) {
        retryAttempts++
        console.log(`Test Status request #${retryAttempts} at ${lastPercentComplete}% complete`)
        statusCheck = setTimeout(
          () => { resolve(checkTestStatus(context, stlid)) },
          retryIntervalMilliseconds
        )
      }
      else reject()
    }
    else reject()
  })
}

const initCheckTestStatus = async (context) => {
  clearTimeout( statusCheck )
  lastPercentComplete = 0
  if (!testTimeElapsed && context.results) {
    const now = new Date()
    const start = new Date(context.results.start)
    testTimeElapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
  }

  // check the status of the test
  const checkStatusError = (err) => {
    console.error(err || new Error('GET /run_tests returned a bad response'))
    return null
  }
  const results = await checkTestStatus(context).catch(checkStatusError)
  if (results) {
    if (results.status_msg === 'COMPLETE') {
      clearInterval( startCounting )
      testTimeElapsed = 0
      return results
    }
    else return initCheckTestStatus(context)
  }    
}

const runTests = (context, projectName) => {
  return new Promise(async (resolve, reject) => {
    // init the api with the token
    const api = BugCatcher(bugcatcherUri, context.token)

    clearTimeout( statusCheck )
    clearInterval( startCounting )
    statusCheck = null
    // startCounting = setInterval(this._countUp, 1000)
    testTimeElapsed = 0
    successfulUploads = 0
    
    // tell the server to run tests
    const runTestsError = (err) => {
      console.error(err || new Error('POST /run_tests returned a bad response'))
      reject()
    }
    const runTests = await api.postTestProject({ projectName }).catch(runTestsError)
    if (runTests) {
      const { stlid } = runTests.data
      resolve(stlid)
    }
    else runTestsError()
  })
}

const fetchResults = async (context) => {
  // init the api with the token
  const api = BugCatcher(bugcatcherUri, context.token)
  const { testId: stlid } = context

  let { data: results } = await api.getTestResult({
    stlid,
    options: {responseType: 'json'}
  }).catch(() => ({}))
  let { test_run: testRun = {} } = results || {}
  const { codes = [{}] } = testRun
  const { project } = codes[0]
  
  return({ project, results })
}


/** Exports */
module.exports = {
  getBlob,
  getTree,
  fetchResults,
  initCheckTestStatus,
  runTests,
  uploadFromTree,
}
