/** Constants */
const os = require('os')
const bugcatcher = require('./bugcatcher')
const { decrypt } = require('./crypto')
const {
  getRepoInfo,
  passesSeverity,
  statusSetupPending,
  statusSetupFailure,
  statusSetupFailureRepoMismatch,
  statusUploadingSetup,
  statusUploadingPending,
  statusUploadingFailure,
  statusTestingSetup,
  statusTestingPending,
  statusTestingFailure,
  statusResultsSetup,
  statusResultsPending,
  statusResultsFailure,
  statusResultsSuccess,
} = require('./helpers')

async function findBugCatcherToken(context, tree) {
  let bugcatcherConfig = {}
  const failed = () => {
    statusSetupFailure(context)
    return false
  }
  // Find an encrypted SID
  const bugcatcherFile = tree.find(file => file.path === '.bugcatcher')
  if (!bugcatcherFile) return failed()
  const blob = await bugcatcher.getBlob(context, bugcatcherFile.sha)
  if (!blob) return failed()
  let buff = Buffer.from(blob.content, 'base64')
  let bc_config = buff.toString('ascii')
  const lines = bc_config.split(os.EOL)
  lines.forEach(l => {
    const splitIndex = l.indexOf('=')
    const key = l.substring(0, splitIndex)
    const value = l.substring(splitIndex + 1)
    bugcatcherConfig[key] = value
  })
  const encryptedToken = bugcatcherConfig['ENCRYPTED_SID']
  if (!encryptedToken) return failed()
  const decryptedTokenString = decrypt(encryptedToken, process.env.FTL_PRIVATE_KEY)
  if (!decryptedTokenString) return failed()
  const splitTokenString = decryptedTokenString.split('|')
  const repoPath = splitTokenString[1]
  const { owner, repo } = getRepoInfo(context)
  if (`${owner}/${repo}` !== repoPath) {
    statusSetupFailureRepoMismatch(context)
    return false
  }
  bugcatcherConfig['DECRYPTED_SID'] = splitTokenString[0]
  return bugcatcherConfig
}

module.exports = {

  push: async (context, app) => {
    const { sha } = getRepoInfo(context)
    const getTree = await bugcatcher.getTree(context)
    const { tree } = getTree['data']
    
    /** Search the git tree for a `.bugcatcher` file with a token */
    const { DECRYPTED_SID: token, SEVERITY_THRESHOLD: severityThreshold } = await findBugCatcherToken(context, tree)
      .catch(() => null)
    if (!token) return false
    context.token = token

    /** Upload repo from tree sha */
    statusSetupPending(context)
    statusUploadingPending(context)
    const uploaded = await bugcatcher.uploadFromTree(context, tree)
      .catch(() => null)
    if (!uploaded) {
      statusUploadingFailure(context)
      return false
    }

    /** Initiate a test */
    statusTestingPending(context)
    const testId = await bugcatcher.runTests(context, sha)
    context.testId = testId
    const test = await bugcatcher.initCheckTestStatus(context)
    if (!test) {
      statusTestingFailure(context)
      return false
    }

    /** Fetch the results */
    statusResultsPending(context)
    const { results } = await bugcatcher.fetchResults(context)
      .catch(() => null)
    if (results && results.test_run_result) {      
      context.severityThreshold = severityThreshold

      let failed
      results.test_run_result.forEach(hit => {
        const test_suite_test = hit['test_suite_test']
        const ftl_severity = test_suite_test['ftl_severity']
        if (!passesSeverity(ftl_severity, severityThreshold))
          failed = true
      })
      
      if (failed) {
        statusResultsFailure(context)
        return false
      }

      statusResultsSuccess(context)
    }
    else statusResultsFailure(context)
  
  },

}

