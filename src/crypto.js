const { generateKeyPairSync, publicEncrypt, privateDecrypt } = require('crypto')
const algorithm = 'aes-256-cbc'
const passphrase = ''

module.exports = {

  generateKeys: () => {
    return generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
        cipher: algorithm,
        passphrase,
      },
    })
  },

  encrypt: (toEncrypt, publicKey) => {
    const buffer = Buffer.from(toEncrypt)
    const encrypted = publicEncrypt(publicKey.toString(), buffer)
    return encrypted.toString("base64")
  },

  decrypt: (toDecrypt, privateKey) => {
    try {
      
      /** @todo Remove this hack */
      // The .env is parsed differently on various hosts ?
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n')
      }
      
      const buffer = Buffer.from(toDecrypt, 'base64')
      const decrypted = privateDecrypt(
        {
          key: privateKey.toString(),
          passphrase,
        },
        buffer,
      )
      return decrypted.toString('utf8')
    }
    catch(c) {
      console.error(c)
      return null
    }
  },

}
