const {
  generateKeys,
  encrypt,
  decrypt
} = require('../src/crypto')

describe('Node JS Crypto Module', () => {
  let privateKey, publicKey

  beforeAll(done => {
    const keys = generateKeys()
    privateKey = keys.privateKey
    publicKey = keys.publicKey
    done()
  })

  test('RSA key pair creation', () => {
    expect(privateKey)
    expect(publicKey)
  })

  test('RSA public key encryption', () => {
    const sensitiveData = "encrypt me!"
    const encryptedString = encrypt(sensitiveData, publicKey)
    const decryptedString = decrypt(encryptedString, privateKey)
    expect(decryptedString).toMatch(sensitiveData)
  })

})
