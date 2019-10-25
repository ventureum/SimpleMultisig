// babel does not transpile js in node_modules, we need to ignore them
require('babel-register')({
  ignore: /node_modules\/(?!openzeppelin-solidity\/test\/helpers)/
})
require('babel-polyfill')

const PrivateKeyProvider = require('truffle-privatekey-provider')
const fs = require('fs')

let privateKey = ''

if (fs.existsSync('privateKey.txt')) {
  privateKey = fs
    .readFileSync('privateKey.txt')
    .toString()
    .split('\n')[0]
}

module.exports = {
  quiet: false,
  networks: {
    development: {
      host: 'localhost',
      port: 7545,
      network_id: '*' // Match any network id
    },
    rinkeby: {
      provider: function() {
        return new PrivateKeyProvider(
          privateKey,
          'https://rinkeby.infura.io/v3/9775236247814824bc231e65b1d4972a'
        )
      },
      network_id: '4',
      gas: 6000000,
      gasPrice: 20000000000
    },
    mainnet: {
      provider: function() {
        return new PrivateKeyProvider(
          privateKey,
          'https://mainnet.infura.io/v3/9775236247814824bc231e65b1d4972a'
        )
      },
      network_id: '1',
      gas: 7000000,
      gasPrice: 10000000000
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      currency: 'USD',
      gasPrice: 20
    } // See options below
  }
}
