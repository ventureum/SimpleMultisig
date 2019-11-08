var SimpleMultiSig = artifacts.require('./SimpleMultiSig.sol')
var TestRegistry = artifacts.require('./TestRegistry.sol')
var ERC20Mintable = artifacts.require('./ERC20Mintable.sol')
var lightwallet = require('eth-lightwallet')
const Promise = require('bluebird')

const web3SendTransaction = Promise.promisify(web3.eth.sendTransaction)
const web3GetBalance = Promise.promisify(web3.eth.getBalance)

let DOMAIN_SEPARATOR
const TXTYPE_HASH = '0x3ee892349ae4bbe61dce18f95115b5dc02daf49204cc602458cd4c1f540d56d7'
const NAME_HASH = '0xb7a0bfa1b79f2443f4d73ebb9259cddbcd510b18be6fc4da7d1aa7b1786e73e6'
const VERSION_HASH = '0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6'
const EIP712DOMAINTYPE_HASH = '0xd87cd6ef79d4e2b95e15ce8abf732db51ec771f1ca2edccf22a46c729ac56472'
const SALT = '0x251543af6a222378665a76fe38dbceae4871a070b7fdaf5c6c30cf758dc33cc0'

const CHAINID = 1
const ZEROADDR = '0x0000000000000000000000000000000000000000'
const WALLET_1 = web3.utils.sha3('wallet_1')

contract('SimpleMultiSig', function([deployer, master, client, clientWallet, ...others]) {
  let keyFromPw
  let acct
  let lw
  let multisig
  let erc20

  let unmarshalWalletData = function(_walletData) {
    return {
      nonce: _walletData[0].toNumber(),
      owner: _walletData[1],
      value: _walletData[2],
      DOMAIN_SEPARATOR: _walletData[3]
    }
  }

  let createSigs = async function(multisig, walletId, signers, nonce, destinationAddr) {
    const hash = await multisig.getSig.call(walletId, destinationAddr)

    let sigV = []
    let sigR = []
    let sigS = []

    for (var i = 0; i < signers.length; i++) {
      let sig = lightwallet.signing.signMsgHash(lw, keyFromPw, hash, signers[i])
      let privateKey = lw.exportPrivateKey(signers[i], keyFromPw)
      sigV.push(sig.v)
      sigR.push('0x' + sig.r.toString('hex'))
      sigS.push('0x' + sig.s.toString('hex'))
    }

    return { sigV: sigV, sigR: sigR, sigS: sigS }
  }

  let executeSendSuccess = async function(owners, threshold, signers, done) {
    let randomAddr = web3.utils.sha3(Math.random().toString()).slice(0, 42)
    let executor = master
    let msgSender = master
    let data = '0xfff23243'

    // deploy contract
    // must be depolyed by master
    multisig = await SimpleMultiSig.new(CHAINID, { from: master })

    let value = web3.utils.toWei('0.1', 'ether')

    // Receive funds, owner = client, sent from client wallet
    await multisig.createEthWallet(WALLET_1, client, {
      from: clientWallet,
      value: value
    })

    let walletData = unmarshalWalletData(await multisig.getWallet.call(WALLET_1))

    assert.equal(walletData.nonce, 0)
    assert.equal(walletData.owner, client)
    assert.equal(walletData.value, value)

    let sigs = await createSigs(
      multisig,
      WALLET_1,
      signers, // master, client
      walletData.nonce,
      randomAddr
    )

    await multisig.transfer(
      WALLET_1,
      sigs.sigV,
      sigs.sigR,
      sigs.sigS,
      randomAddr,
      { from: msgSender, gasLimit: 1000000 } // sent by master
    )

    // Check funds sent
    bal = await web3GetBalance(randomAddr)
    assert.equal(bal.toString(), value.toString())

    // Check nonce updated
    walletData = unmarshalWalletData(await multisig.getWallet.call(WALLET_1))
    assert.equal(walletData.nonce, 1)

    done()
  }

  let executeSendERC20Success = async function(owners, threshold, signers, done) {
    let randomAddr = web3.utils.sha3(Math.random().toString()).slice(0, 42)
    let executor = master
    let msgSender = master
    let data = '0xfff23243'
    let TOKEN_AMOUNT = 10000

    // deploy erc20
    erc20 = await ERC20Mintable.new({ from: deployer })

    // mint tokens for client wallet
    await erc20.mint(clientWallet, (TOKEN_AMOUNT * 2).toString())

    // check client token balance
    bal = await erc20.balanceOf.call(clientWallet)
    assert.equal(bal.toString(), (TOKEN_AMOUNT * 2).toString())

    // deploy contract
    // must be depolyed by master
    multisig = await SimpleMultiSig.new(CHAINID, { from: master })

    // client approves wallet for transfering tokens
    await erc20.approve(multisig.address, (TOKEN_AMOUNT * 2).toString(), { from: clientWallet })

    // Receive funds, owner = client
    await multisig.createErc20Wallet(WALLET_1, client, erc20.address, TOKEN_AMOUNT, {
      from: clientWallet
    })

    let walletData = unmarshalWalletData(await multisig.getWallet.call(WALLET_1))

    assert.equal(walletData.nonce, 0)
    assert.equal(walletData.owner, client)
    assert.equal(walletData.value, TOKEN_AMOUNT)

    let sigs = await createSigs(
      multisig,
      WALLET_1,
      signers, // master, client
      walletData.nonce,
      randomAddr
    )

    await multisig.transfer(
      WALLET_1,
      sigs.sigV,
      sigs.sigR,
      sigs.sigS,
      randomAddr,
      { from: msgSender, gasLimit: 1000000 } // sent by master
    )

    // Check funds sent
    bal = await erc20.balanceOf.call(randomAddr)
    assert.equal(bal.toString(), TOKEN_AMOUNT)

    // Check nonce updated
    walletData = unmarshalWalletData(await multisig.getWallet.call(WALLET_1))
    assert.equal(walletData.nonce, 1)

    done()
  }

  before(done => {
    let seed = 'amazing eager broom slender hundred proof fury film rug because spawn enact'

    lightwallet.keystore.createVault(
      { hdPathString: "m/44'/60'/0'/0", seedPhrase: seed, password: 'test', salt: 'testsalt' },
      function(err, keystore) {
        lw = keystore
        lw.keyFromPassword('test', function(e, k) {
          keyFromPw = k

          lw.generateNewAddress(keyFromPw, 20)
          let acctWithout0x = lw.getAddresses()
          acct = acctWithout0x.map(a => {
            return a
          })
          done()
        })
      }
    )
  })

  describe('2 signers, threshold 2', () => {
    it('should succeed with signers 1, 2 for eth', done => {
      let signers = [acct[1], acct[2]]
      executeSendSuccess(acct.slice(1, 3), 2, signers, done)
    })

    it('should succeed with signers 1, 2 for erc20', done => {
      let signers = [acct[1], acct[2]]
      executeSendERC20Success(acct.slice(1, 3), 2, signers, done)
    })
  })
})
