const github = require('./src/github')

/**
 * This is the main entrypoint to your app
 * @param {import('probot').Application} app
 */
module.exports = app => {

  app.on('push', context => {
    app.log('PUSH event detected...')
    github.push(context, app)
  })

  app.on('status', async context => {
    const { context: statusContext, description: statusDescription, state: statusState } = context.payload
    app.log(`STATUS Event: ${statusContext} ${statusState} ${statusDescription}`)
  })

}
