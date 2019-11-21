const targetUrl = "https://staging.tiger.sohotokenlabs.com/results/:stlid"
const { labels, statusStates, statusSteps } = require('../config')

const getRepoInfo = context => {
  const { head_commit, repository, sha: payloadSha } = context.payload
  const owner = repository.full_name.split('/')[0]
  const repo = repository.full_name.split('/')[1]
  const sha = head_commit ? head_commit.id : payloadSha
  return { owner, repo, sha }
}

const setStatusObj = (context, step, state) => {
  const { owner, repo, sha } = getRepoInfo(context)
  step = statusSteps[step]
  state = statusStates[state]
  return ({
    owner,
    repo,
    context: labels[step].context,
    description: labels[step].description[state],
    state,
    sha,
  })
}

const sendStatusUpdate = (context, step, state) => {
  context.github.repos.createStatus(
    setStatusObj(
      context,
      statusSteps[step],
      statusStates[state]
    )
  )
}

const sendSetupStatusUpdate = (context, step) => {
  let status = setStatusObj(
    context,
    statusSteps[step],
    statusStates['setup']
  )
  status.state = statusStates.pending
  context.github.repos.createStatus( status )
}

const statusSetupPending = context => {
  sendStatusUpdate(
    context,
    statusSteps.setup,
    statusStates.pending
  )
}

const statusSetupFailure = context => {
  sendStatusUpdate(
    context,
    statusSteps.setup,
    statusStates.failure
  )
}

const statusSetupFailureRepoMismatch = context => {
  let status = setStatusObj(
    context,
    statusSteps.setup,
    statusStates.failure
  )
  status.description = "The decrypted token is for a different repository"
  context.github.repos.createStatus(status)
}

const statusSetupSuccess = context => {
  sendStatusUpdate(
    context,
    statusSteps.setup,
    statusStates.success
  )
}

const statusUploadingSetup = context => {
  sendSetupStatusUpdate(context, statusSteps.uploading)
}

const statusUploadingPending = context => {
  sendStatusUpdate(
    context,
    statusSteps.uploading,
    statusStates.pending
  )
}

const statusUploadingSuccess = context => {
  sendStatusUpdate(
    context,
    statusSteps.uploading,
    statusStates.success
  )
}

const statusUploadingFailure = context => {
  sendStatusUpdate(
    context,
    statusSteps.uploading,
    statusStates.failure
  )
}

const statusTestingSetup = context => {
  sendSetupStatusUpdate(context, statusSteps.testing)
}

const statusTestingPending = context => {
  sendStatusUpdate(
    context,
    statusSteps.testing,
    statusStates.pending
  )
}

const statusTestingFailure = context => {
  sendStatusUpdate(
    context,
    statusSteps.testing,
    statusStates.failure
  )
}

const statusTestingSuccess = context => {
  sendStatusUpdate(
    context,
    statusSteps.testing,
    statusStates.success
  )
}

const statusResultsSetup = context => {
  sendSetupStatusUpdate(context, statusSteps.results)
}

const statusResultsPending = context => {
  sendStatusUpdate(
    context,
    statusSteps.results,
    statusStates.pending
  )
}

const statusResultsFailure = context => {
  let status = setStatusObj(
    context,
    statusSteps.results,
    statusStates.failure
  )
  status.target_url = targetUrl.replace(':stlid', context.testId)
  context.github.repos.createStatus(status)
}

const statusResultsSuccess = (context) => {
  let status = setStatusObj(
    context,
    statusSteps.results,
    statusStates.success
  )
  status.description = status.description.replace(
    "%severity%",
    context.severityThreshold
  )
  status.target_url = targetUrl.replace(':stlid', context.testId)
  context.github.repos.createStatus(status)
}

const passesSeverity = (severity, min_severity) => {
  levels = ['low', 'medium', 'high']
  if (!levels.includes(severity)) return True
  severity = levels.indexOf(severity)
  min_severity = levels.indexOf(min_severity)
  return min_severity > severity
}


module.exports = {
  getRepoInfo,
  passesSeverity,
  statusSetupPending,
  statusSetupFailure,
  statusSetupFailureRepoMismatch,
  statusSetupSuccess,
  statusUploadingSetup,
  statusUploadingPending,
  statusUploadingSuccess,
  statusUploadingFailure,
  statusTestingSetup,
  statusTestingPending,
  statusTestingFailure,
  statusTestingSuccess,
  statusResultsSetup,
  statusResultsPending,
  statusResultsFailure,
  statusResultsSuccess,
}